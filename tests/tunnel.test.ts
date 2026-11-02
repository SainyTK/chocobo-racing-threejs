import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { get } from 'node:http';

// Stub the public tunnel and build commands; exercise the real page server and
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
    await mkdir(join(dir, 'dist')); await writeFile(join(dir, 'dist', 'index.html'), '<!doctype html><title>stub page</title>');
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
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, PORT: String(port), PREVIEW_DIR: join(dir, 'dist'), npm_execpath: join(dir, 'build.mjs'), ...extra },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const stream of [runner.stdout, runner.stderr]) stream!.on('data', chunk => { output += chunk; });
    exited = new Promise(resolve => runner!.once('exit', resolve));
  }
  // Resolves once the supervisor has printed `text`, or fails with its output if it exits first. Startup time depends on load
  // (Vite starts the real page server), so readiness is awaited as an event, bounded by the test timeout, not polled for a second.
  function printed(text: string) {
    return new Promise<void>((resolve, reject) => {
      const check = () => { if (output.includes(text)) { done(); resolve(); } };
      const quit = (code: number | null) => { done(); reject(new Error(`Supervisor exited (${code}) before printing ${text}:\n${output}`)); };
      const done = () => { for (const stream of [runner!.stdout, runner!.stderr]) stream!.off('data', check); runner!.off('exit', quit); };
      for (const stream of [runner!.stdout, runner!.stderr]) stream!.on('data', check);
      runner!.once('exit', quit);
      check();
    });
  }
  const gone = (pid: number) => {
    try { process.kill(pid, 0); return false; } catch { return true; }
  };
  it('serves the built page, accepts the tunnel host, and stops both processes on Ctrl+C', async () => {
    start();
    await printed('TUNNEL_READY=');
    const pid = Number(output.match(/TUNNEL_READY=(\d+)/)![1]);
    // fetch() cannot set Host, which is what the tunnel forwards.
    const status = (host: string) => new Promise<number | undefined>((resolve, reject) => {
      get(`http://localhost:${port}/`, { headers: { Host: host } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    expect(await status('test.trycloudflare.com')).toBe(200); expect(await (await fetch(`http://localhost:${port}/`)).text()).toContain('stub page');
    expect(await status('unrelated.example')).toBe(403);
    runner!.kill('SIGINT');
    expect(await exited).toBe(130);
    await expect.poll(() => gone(pid)).toBe(true);
    await expect(fetch(`http://localhost:${port}/`)).rejects.toThrow();
  });
  it('stops the page server when the tunnel fails', async () => {
    start({ FAIL_TUNNEL: '1' });
    expect(await exited).toBe(3);
    expect(output).toContain('Tunnel stopped');
    await expect(fetch(`http://localhost:${port}/`)).rejects.toThrow();
  });
  it('does not start the page server after a failed build', async () => {
    start({ FAIL_BUILD: '1' });
    expect(await exited).toBe(1);
    expect(output).toContain('Build exited with code 2');
    expect(output).not.toContain('Serving the game');
  });
  it('cancels the build and its descendants', async () => {
    start({ SLOW_BUILD: '1' });
    await printed('BUILD_CHILD=');
    const pid = Number(output.match(/BUILD_CHILD=(\d+)/)![1]);
    runner!.kill('SIGINT');
    expect(await exited).toBe(130);
    await expect.poll(() => gone(pid)).toBe(true);
    expect(output).not.toContain('Serving the game');
  });
});
