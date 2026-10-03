import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const port = 3107, url = `http://127.0.0.1:${port}`;
let processHandle, browser;
async function start() {
  processHandle = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', PORT: String(port), ALLOWED_ORIGINS: url }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; processHandle.stderr.on('data', chunk => log += chunk);
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${url}/health`)).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw Error(`Server did not start: ${log}`);
}
async function stop() { if (processHandle && processHandle.exitCode === null) { const exited = once(processHandle, 'exit'); processHandle.kill('SIGTERM'); await exited; } }
try {
  await start(); browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.getByRole('button', { name: 'Online', exact: true }).click(); await page.getByRole('button', { name: 'CREATE ROOM', exact: true }).click(); await page.locator('#room-code').waitFor();
  const code = await page.locator('#room-code').innerText(); await page.getByRole('button', { name: 'START ONLINE RACE' }).click(); await page.keyboard.down('w'); await page.waitForTimeout(6000); await page.keyboard.up('w');
  const before = await page.evaluate(() => window.__raceDebug); assert.equal(before.online, true); assert.equal(before.race.phase, 'racing'); assert.ok(before.race.racers.find(p => p.id === before.playerId).speed > 0);
  await page.reload(); await page.locator('#place').waitFor(); const after = await page.evaluate(() => window.__raceDebug); assert.equal(after.playerId, before.playerId); assert.equal(after.race.id, before.race.id);
  await stop(); await page.waitForTimeout(900); await start();
  await page.getByRole('button', { name: 'CREATE ROOM', exact: true }).waitFor({ timeout: 15000 }); assert.match(await page.getByRole('status').innerText(), /expired|restarted/);
  await page.getByRole('button', { name: 'CREATE ROOM', exact: true }).click(); await page.locator('#room-code').waitFor(); assert.notEqual(await page.locator('#room-code').innerText(), code);
  await page.getByRole('button', { name: 'Leave room' }).click(); await page.getByRole('button', { name: 'Quick Race', exact: true }).click(); await page.getByRole('button', { name: 'START RACE', exact: true }).click(); await page.locator('#place').waitFor();
  assert.equal((await page.evaluate(() => window.__raceDebug)).online, false); assert.deepEqual(errors, []);
  await mkdir('output/testing', { recursive: true }); await writeFile('output/testing/v2-production-smoke.json', JSON.stringify({ passed: true, checks: ['production bundle loads', 'room creation', 'server-authoritative free movement', 'page-reload recovery', 'server restart expires room visibly', 'new room after restart', 'local racing after leaving'], pageErrors: errors }, null, 2));
  console.log('Production smoke passed, including server restart recovery.');
} finally { await browser?.close(); await stop(); }
