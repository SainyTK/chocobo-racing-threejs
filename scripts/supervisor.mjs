import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

/**
 * Runs a few child processes as one command: Ctrl+C or the end of any one of them stops the rest. Separate process
 * groups let it stop npm's build descendants as well, including when cancellation happens halfway through a build.
 */
export const cwd = fileURLToPath(new URL('../', import.meta.url));
const children = new Set();
let stopping = false;
let shutdownPromise;

function signalTree({ child, own }, signal) {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).on('error', () => child.kill(signal));
    else if (own) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error.code !== 'ESRCH') console.error(`Could not stop process ${child.pid}: ${error.message}`);
  }
}

export const isStopping = () => stopping;
export function shutdown(code) {
  if (shutdownPromise) return shutdownPromise;
  stopping = true;
  process.exitCode = code;
  shutdownPromise = (async () => {
    const active = [...children];
    for (const entry of active) signalTree(entry, 'SIGTERM');
    const force = setTimeout(() => { for (const entry of active) signalTree(entry, 'SIGKILL'); }, 3000);
    await Promise.all(active.map(entry => entry.done));
    // A parent may exit before a descendant that ignores SIGTERM.
    for (const entry of active) signalTree(entry, 'SIGKILL');
    clearTimeout(force);
  })();
  return shutdownPromise;
}
export function onInterrupt(message) {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (!stopping) console.log(`\n${message}`);
      void shutdown(signal === 'SIGINT' ? 130 : 143);
    });
  }
}

/**
 * `group: 'own'` starts the child in its own process group, so stopping it also stops its descendants, such as npm's
 * build steps. `group: 'shared'` keeps it in this process's group, so a caller that stops that group, as Playwright
 * does with its web server, stops the child too.
 */
export function launch(command, args, { env = process.env, piped = false, group = 'own' } = {}) {
  if (stopping) throw new Error('Cancelled');
  const own = group === 'own' && process.platform !== 'win32';
  const child = spawn(command, args, { cwd, env, detached: own, stdio: piped ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
  const entry = { child, done: null, own };
  entry.done = new Promise(resolve => {
    child.once('error', error => resolve({ code: 1, error }));
    child.once('close', (code, signal) => resolve({ code: code ?? 1, signal }));
  }).then(result => { children.delete(entry); return result; });
  children.add(entry);
  return entry;
}

export async function requireSuccess(entry, name) {
  const result = await entry.done;
  if (stopping) throw new Error('Cancelled');
  if (result.error) throw result.error;
  if (result.code !== 0) throw new Error(`${name} exited with code ${result.code}.`);
}

export function checkPort(port) {
  if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  const probe = createServer();
  return new Promise((resolve, reject) => {
    probe.once('error', () => reject(new Error(`Port ${port} is unavailable. Stop the process using it or choose another port.`)));
    probe.listen(Number(port), '0.0.0.0', () => probe.close(resolve));
  });
}

/** Resolves once a piped child prints `text`, echoing its output; fails if it exits first or takes too long. */
export async function waitForOutput(entry, text, name, timeoutMs = 30000) {
  let output = '';
  let timer;
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${name} did not start within ${timeoutMs / 1000} seconds.`)), timeoutMs);
        entry.child.stdout.on('data', chunk => {
          process.stdout.write(chunk);
          output = (output + chunk.toString()).slice(-4096);
          if (output.includes(text)) resolve();
        });
      }),
      entry.done.then(result => { throw result.error || new Error(`${name} exited before it was ready (code ${result.code}).`); }),
    ]);
  } finally { clearTimeout(timer); }
}

/** Stops everything once any one long-running child ends, and reports which one. */
export async function untilFirstExit(entries) {
  const result = await Promise.race(entries.map(([entry, name]) => entry.done.then(result => ({ ...result, name }))));
  if (!stopping) {
    console.error(`${result.name} stopped${result.error ? `: ${result.error.message}` : ` (code ${result.code})`}. Stopping the remaining processes.`);
    await shutdown(result.code || 1);
  }
}

export async function run(main) {
  try { await main(); } catch (error) { if (!stopping) { console.error(error.message); await shutdown(1); } }
  if (shutdownPromise) await shutdownPromise;
}
