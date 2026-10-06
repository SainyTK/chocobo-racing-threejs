import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const port = process.env.PORT || '3219';
const children = new Set();
let stopping = false;
let shutdownPromise;

// Separate process groups let us stop npm's build descendants as well as the
// server and tunnel, including when cancellation happens halfway through a build.
function signalTree(child, signal) {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).on('error', () => child.kill(signal));
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error.code !== 'ESRCH') console.error(`Could not stop process ${child.pid}: ${error.message}`);
  }
}

function shutdown(code) {
  if (shutdownPromise) return shutdownPromise;
  stopping = true;
  process.exitCode = code;
  shutdownPromise = (async () => {
    const active = [...children];
    for (const entry of active) signalTree(entry.child, 'SIGTERM');
    const force = setTimeout(() => {
      for (const entry of active) signalTree(entry.child, 'SIGKILL');
    }, 3000);
    await Promise.all(active.map(entry => entry.done));
    // A parent may exit before a descendant that ignores SIGTERM.
    for (const entry of active) signalTree(entry.child, 'SIGKILL');
    clearTimeout(force);
  })();
  return shutdownPromise;
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!stopping) console.log('\nStopping the build, game server and tunnel…');
    void shutdown(signal === 'SIGINT' ? 130 : 143);
  });
}

function launch(command, args, { env = process.env, piped = false } = {}) {
  if (stopping) throw new Error('Cancelled');
  const child = spawn(command, args, {
    cwd, env, detached: process.platform !== 'win32',
    stdio: piped ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  const entry = { child, done: null };
  entry.done = new Promise(resolve => {
    child.once('error', error => resolve({ code: 1, error }));
    child.once('close', (code, signal) => resolve({ code: code ?? 1, signal }));
  }).then(result => { children.delete(entry); return result; });
  children.add(entry);
  return entry;
}

async function requireSuccess(entry, name) {
  const result = await entry.done;
  if (stopping) throw new Error('Cancelled');
  if (result.error) {
    if (result.error.code === 'ENOENT' && name === 'cloudflared') {
      throw new Error('Install cloudflared first: brew install cloudflared (macOS). Other platforms: https://developers.cloudflare.com/tunnel/downloads/');
    }
    throw result.error;
  }
  if (result.code !== 0) throw new Error(`${name} exited with code ${result.code}.`);
}

async function checkPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', () => reject(new Error(`Port ${port} is unavailable. Stop the existing server or use PORT=<free port> npm run tunnel.`)));
    probe.listen(Number(port), '0.0.0.0', () => probe.close(resolve));
  });
}

async function waitForServer(entry) {
  let output = '';
  let timer;
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Game server did not start within 15 seconds.')), 15000);
        entry.child.stdout.on('data', chunk => {
          process.stdout.write(chunk);
          output = (output + chunk.toString()).slice(-4096);
          if (output.includes(`running at http://localhost:${port}`)) resolve();
        });
      }),
      entry.done.then(result => { throw result.error || new Error(`Game server exited before listening (code ${result.code}).`); }),
    ]);
  } finally { clearTimeout(timer); }
}

async function main() {
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  await requireSuccess(launch('cloudflared', ['--version']), 'cloudflared');
  await checkPort();
  console.log('\nBuilding the game…');
  // npm_execpath is supplied by npm run. Running it with Node avoids a shell
  // wrapper and also works with npm.cmd installations on Windows.
  if (!process.env.npm_execpath) throw new Error('Run this script with npm run tunnel.');
  await requireSuccess(launch(process.execPath, [process.env.npm_execpath, 'run', 'build']), 'Build');
  console.log(`\nStarting the game on port ${port}…`);
  const server = launch(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    // Empty means same-origin checking, not unrestricted origins. Cloudflared
    // preserves the public Host, so Socket.IO accepts the tunnel's own origin.
    env: { ...process.env, NODE_ENV: 'production', PORT: port, ALLOWED_ORIGINS: '' },
    piped: true,
  });
  await waitForServer(server);
  console.log('\nOpening the public tunnel. Share the printed HTTPS URL only with testers.');
  console.log('Open that URL on every device, select Online, and share the room code. Ctrl+C stops everything.\n');
  const tunnel = launch('cloudflared', ['tunnel', '--url', `http://localhost:${port}`]);
  const result = await Promise.race([
    server.done.then(result => ({ ...result, name: 'Game server' })),
    tunnel.done.then(result => ({ ...result, name: 'Tunnel' })),
  ]);
  if (!stopping) {
    console.error(`${result.name} stopped${result.error ? `: ${result.error.message}` : ` (code ${result.code})`}. Stopping the remaining processes.`);
    await shutdown(result.code || 1);
  }
}

try {
  await main();
} catch (error) {
  if (!stopping) { console.error(error.message); await shutdown(1); }
}
if (shutdownPromise) await shutdownPromise;
