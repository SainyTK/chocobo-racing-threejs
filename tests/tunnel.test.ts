import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { get } from 'node:http';

// Stub the public tunnel and build commands; exercise the real game server and
// supervisor without publishing a service or rebuilding in each test.
describe.skipIf(process.platform === 'win32')('one-command tunnel supervisor', () => {
  let dir: string;
  let runner: ChildProcess | undefined;
  let exited: Promise<number | null>;
  let output: string;
  let port: number;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'racing-tunnel-'));
    const probe = createServer();
    await new Promise<void>(resolve => probe.listen(0, '0.0.0.0', resolve));
    port = (probe.address() as { port: number }).port;
    await new Promise<void>(resolve => probe.close(() => resolve()));
    await writeFile(join(dir, 'build.mjs'), `
      if (process.env.FAIL_BUILD) process.exit(2);
      if (process.env.SLOW_BUILD) {
        const { spawn } = await import('node:child_process');
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
        console.log('BUILD_CHILD=' + child.pid);
        setInterval(() => {}, 1000);
      }
    `);
    await writeFile(join(dir, 'cloudflared'), `#!/usr/bin/env node
      if (process.argv.includes('--version')) { console.log('stub cloudflared'); process.exit(0); }
      if (process.env.FAIL_TUNNEL) process.exit(3);
      console.log('TUNNEL_READY=' + process.pid);
      setInterval(() => {}, 1000);
    `);
    await chmod(join(dir, 'cloudflared'), 0o755);
  });
  afterEach(async () => {
    if (runner && runner.exitCode === null) runner.kill('SIGINT');
    if (runner) await exited;
    runner = undefined;
    await rm(dir, { recursive: true, force: true });
  });
  function start(extra: Record<string, string> = {}) {
    output = '';
    runner = spawn(process.execPath, ['scripts/tunnel.mjs'], {
      cwd: resolve('.'),
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, PORT: String(port), npm_execpath: join(dir, 'build.mjs'), ...extra },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const stream of [runner.stdout, runner.stderr]) stream!.on('data', chunk => { output += chunk; });
    exited = new Promise(resolve => runner!.once('exit', resolve));
  }
  const gone = (pid: number) => {
    try { process.kill(pid, 0); return false; } catch { return true; }
  };
  it('starts the server, accepts same-origin multiplayer, and stops both processes on Ctrl+C', async () => {
    start({ ALLOWED_ORIGINS: 'https://stale.example' });
    await expect.poll(() => output).toContain('TUNNEL_READY=');
    const pid = Number(output.match(/TUNNEL_READY=(\d+)/)![1]);
    expect((await fetch(`http://localhost:${port}/health`)).ok).toBe(true);
    const socketUrl = `http://localhost:${port}/socket.io/?EIO=4&transport=polling`;
    const handshake = (origin: string) => new Promise<number | undefined>((resolve, reject) => {
      get(socketUrl, { headers: { Host: 'test.trycloudflare.com', Origin: origin } }, response => {
        response.resume();
        resolve(response.statusCode);
      }).on('error', reject);
    });
    expect(await handshake('https://test.trycloudflare.com')).toBe(200);
    expect(await handshake('https://unrelated.example')).toBe(403);
    runner!.kill('SIGINT');
    expect(await exited).toBe(130);
    await expect.poll(() => gone(pid)).toBe(true);
    await expect(fetch(`http://localhost:${port}/health`)).rejects.toThrow();
  });
  it('stops the server when the tunnel fails', async () => {
    start({ FAIL_TUNNEL: '1' });
    expect(await exited).toBe(3);
    expect(output).toContain('Tunnel stopped');
    await expect(fetch(`http://localhost:${port}/health`)).rejects.toThrow();
  });
  it('does not start a server after a failed build', async () => {
    start({ FAIL_BUILD: '1' });
    expect(await exited).toBe(1);
    expect(output).toContain('Build exited with code 2');
    expect(output).not.toContain('Starting the game');
  });
  it('cancels the build and its descendants', async () => {
    start({ SLOW_BUILD: '1' });
    await expect.poll(() => output).toContain('BUILD_CHILD=');
    const pid = Number(output.match(/BUILD_CHILD=(\d+)/)![1]);
    runner!.kill('SIGINT');
    expect(await exited).toBe(130);
    await expect.poll(() => gone(pid)).toBe(true);
    expect(output).not.toContain('Starting the game');
  });
});
