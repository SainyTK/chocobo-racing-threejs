import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';

/**
 * The production build served by `vite preview`, with the signaling Worker under local Wrangler. The build must point
 * at `signalPort`, as `npm run test:production` and `npm run benchmark:multiplayer` arrange.
 */
export const LOCAL_SIGNAL_PORT = 8796;
const bin = (name: string) => new URL(`../../node_modules/.bin/${name}`, import.meta.url).pathname;

async function ready(url: string, child: ChildProcess, name: string, log: () => string) {
  for (let i = 0; i < 600; i++) {
    if (child.exitCode !== null) throw Error(`${name} exited: ${log()}`);
    try { if ((await fetch(url)).ok) return; } catch { /* Not listening yet. */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw Error(`${name} did not start: ${log()}`);
}

export async function startLocalStack({ pagePort, signalPort = LOCAL_SIGNAL_PORT }: { pagePort: number; signalPort?: number }) {
  const children: ChildProcess[] = [];
  const launch = (name: string, command: string, args: string[]) => {
    const child = spawn(command, args, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let log = ''; for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log = (log + chunk).slice(-4000); });
    children.push(child);
    return { child, log: () => log, name };
  };
  const signal = launch('Signaling Worker', bin('wrangler'), ['dev', '--config', 'signaling/wrangler.jsonc', '--port', String(signalPort), '--local', '--persist-to', 'output/wrangler-state/stack', '--show-interactive-dev-session=false']);
  const page = launch('Page server', bin('vite'), ['preview', '--port', String(pagePort), '--strictPort']);
  const stop = async () => {
    for (const child of children) if (child.exitCode === null) { const exited = once(child, 'exit'); try { process.kill(-child.pid!, 'SIGTERM'); } catch { child.kill('SIGTERM'); } await exited; }
  };
  try {
    await ready(`http://localhost:${signalPort}/health`, signal.child, signal.name, signal.log);
    await ready(`http://localhost:${pagePort}/`, page.child, page.name, page.log);
  } catch (error) { await stop(); throw error; }
  return { url: `http://localhost:${pagePort}`, signalUrl: `http://localhost:${signalPort}`, stop };
}
