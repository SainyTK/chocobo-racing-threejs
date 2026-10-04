import { chromium, type Page } from '@playwright/test';
import { createGameServer } from '../server/index.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import os from 'node:os';
const label = process.argv[2] || 'baseline';
const port = 3219, url = `http://127.0.0.1:${port}`;
const server = await createGameServer({ diagnostics: true });
await new Promise<void>(resolve => server.http.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
function stats(a: number[]) { const b = [...a].sort((a,b) => a-b); return { n: b.length, max: b.at(-1) ?? null, p50: b[Math.floor(b.length*.5)] ?? null, p95: b[Math.floor(b.length*.95)] ?? null, p99: b[Math.floor(b.length*.99)] ?? null, mean: b.length ? b.reduce((a,b)=>a+b,0)/b.length : null }; }
const debug = (p: Page) => p.evaluate(() => (window as any).__raceDebug);
const reports: any[] = [];
try {
  for (const profile of [{ name: 'clean', query: '' }, { name: 'delayed', query: '&netDelay=60&netJitter=30&netDrop=0.05' }, { name: 'server-stall', query: '' }]) {
    const contexts = await Promise.all([browser.newContext({ viewport: { width: 640, height: 400 } }), browser.newContext({ viewport: { width: 640, height: 400 } })]);
    for (const c of contexts) await c.addInitScript('window.__name = (fn) => fn; localStorage.setItem("cbr-quality", "retro"); localStorage.setItem("cbr-sound", "false")');
    const [a,b] = await Promise.all(contexts.map(c => c.newPage())); const errors: string[] = [];
    try {
      for (const page of [a,b]) { page.on('pageerror', e => errors.push(e.message)); await page.goto(`${url}/?netPerf${profile.query}`); await page.getByRole('button', { name: 'Online', exact: true }).click(); }
      await a.getByRole('button', { name: 'CREATE ROOM', exact: true }).click();
      const code = await a.locator('#room-code').innerText();
      await b.getByRole('textbox', { name: 'Room code' }).fill(code); await b.getByRole('button', { name: 'Join room' }).click(); await b.locator('#room-code').waitFor();
      await a.getByRole('button', { name: 'START ONLINE RACE' }).click(); await b.locator('#place').waitFor();
      await a.waitForTimeout(4200);
      for (const arr of Object.values(server.metrics)) arr.length = 0;
      await Promise.all([a,b].map(p => p.evaluate(() => (window as any).__resetNetPerf())));
      const start = performance.now();
      // Two non-bot human slots controlled through DOM keyboard events, four CPU racers.
      // Ten alternating throttle trials from rest, followed by short steering trials.
      const responses = await Promise.all([a,b].map(p => p.evaluate(async () => {
        const win = window as any, key = (code: string, down: boolean) => document.body.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
        const local = () => win.__perfPose;
        const response: number[] = [], yawResponse: number[] = [];
        for (let i = 0; i < 10; i++) {
          key('KeyS', true); await new Promise(r => setTimeout(r, 650)); key('KeyS', false);
          const v = local().speed, at = performance.now(); key('KeyW', true);
          await new Promise<void>(resolve => { const frame = () => { if (local().speed > v + .05 || performance.now() - at > 1000) { response.push(performance.now() - at); resolve(); } else requestAnimationFrame(frame); }; requestAnimationFrame(frame); });
          await new Promise(r => setTimeout(r, 250)); const yaw = local().yaw, turnAt = performance.now(); key('KeyA', true);
          await new Promise<void>(resolve => { const frame = () => { if (Math.abs(local().yaw - yaw) > .002 || performance.now() - turnAt > 1000) { yawResponse.push(performance.now() - turnAt); resolve(); } else requestAnimationFrame(frame); }; requestAnimationFrame(frame); });
          key('KeyA', false); key('KeyW', false);
        }
        return { response, yawResponse };
      })));
      if (profile.name === 'server-stall') { const end = performance.now() + 180; while (performance.now() < end) {} }
      await a.waitForTimeout(2000);
      const seconds = (performance.now() - start)/1000;
      const clients = await Promise.all([a,b].map(async (p,i) => { const d = await debug(p); const s = d.network.samples; return { transport: d.network.transport, racers: d.race.racers.length, humans: d.race.racers.filter((p: any)=>!p.bot).length, seconds, metrics: Object.fromEntries(Object.entries(s).map(([k,v]) => [k,stats(v as number[])])), counters: d.network.counters, stateBytesPerSecond: (s.stateBytes || []).reduce((a:number,b:number)=>a+b,0)/seconds, inputToMotionMs: stats(responses[i].response), inputToYawMs: stats(responses[i].yawResponse), rawResponses: responses[i] }; }));
      reports.push({ profile, clients, server: Object.fromEntries(Object.entries(server.metrics).map(([k,v])=>[k,stats(v)])), errors });
      // Explicit leave deletes the room immediately, rather than waiting for session expiry.
      await a.getByRole('button', { name: 'Pause menu' }).click(); await a.getByRole('button', { name: 'Exit race', exact: true }).click(); await a.getByRole('button', { name: 'Exit race', exact: true }).click();
      await b.getByRole('button', { name: 'Pause menu' }).click(); await b.getByRole('button', { name: 'Exit race', exact: true }).click(); await b.getByRole('button', { name: 'Exit race', exact: true }).click();
    } finally { await Promise.all(contexts.map(c=>c.close())); }
  }
  const report = { label, revision: execSync('git rev-parse HEAD').toString().trim(), dirty: !!execSync('git status --porcelain').toString().trim(), environment: { node: process.version, platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model, browser: browser.version(), renderer: 'headless Chromium SwiftShader, 640x400, retro quality', port }, reports };
  await mkdir('docs/performance', { recursive: true }); await writeFile(`docs/performance/${label}.json`, JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); await server.close(); }
