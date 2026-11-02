import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { startLocalStack } from './support/local-stack.ts';

/** The production bundle end to end: a player-hosted room, a guest over WebRTC, reload recovery and the host leaving. */
const port = Number(process.env.SMOKE_PORT) || 3107;
let stack, browser;
try {
  stack = await startLocalStack({ pagePort: port }); browser = await chromium.launch();
  const open = async () => { const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); const errors = []; page.on('pageerror', e => errors.push(e.message)); await page.goto(stack.url); await page.getByRole('button', { name: 'Online', exact: true }).click(); return { page, errors }; };
  const host = await open(), guest = await open(), debug = page => page.evaluate(() => window.__raceDebug);
  await host.page.getByRole('button', { name: 'Create room', exact: true }).click(); const code = await host.page.locator('#room-code').innerText();
  await guest.page.getByRole('textbox', { name: 'Room code' }).fill(code); await guest.page.getByRole('button', { name: 'Join room', exact: true }).click(); await guest.page.locator('#room-code').waitFor();
  assert.equal((await debug(guest.page)).network.route, 'direct');
  await host.page.getByRole('button', { name: 'START ONLINE RACE' }).click(); await guest.page.locator('#place').waitFor();
  await guest.page.keyboard.down('w'); await guest.page.waitForTimeout(6000); await guest.page.keyboard.up('w');
  const before = await debug(guest.page), onHost = (await debug(host.page)).race.racers.find(p => p.id === before.playerId);
  assert.equal(before.race.phase, 'racing'); assert.ok(onHost.speed > 0 || onHost.s > 0, 'The host moves the guest');
  await guest.page.reload(); await guest.page.locator('#place').waitFor({ timeout: 30000 }); const after = await debug(guest.page); assert.equal(after.playerId, before.playerId); assert.equal(after.race.id, before.race.id);
  await host.page.getByRole('button', { name: 'Pause menu' }).click(); await host.page.locator('[data-action="exit"]').click(); await host.page.locator('[data-action="leave"]').click();
  await guest.page.getByRole('alert').filter({ hasText: `The host closed room ${code}` }).waitFor({ timeout: 15000 });
  // The host tells the Worker a moment after its guests, so the closing message reaches them first.
  let info; for (let i = 0; i < 50 && !/has closed/.test(info?.error); i++) { info = await (await fetch(`${stack.signalUrl}/rooms/${code}`)).json(); await new Promise(r => setTimeout(r, 100)); }
  assert.match(info.error, /has closed/);
  await guest.page.getByRole('button', { name: 'Quick Race', exact: true }).click(); await guest.page.getByRole('button', { name: 'START RACE', exact: true }).click(); await guest.page.locator('#place').waitFor();
  assert.equal((await debug(guest.page)).online, false); assert.deepEqual([...host.errors, ...guest.errors], []);
  await mkdir('output/testing', { recursive: true }); await writeFile('output/testing/production-smoke.json', JSON.stringify({ passed: true, checks: ['production bundle loads', 'player-hosted room', 'guest over direct WebRTC', 'host-authoritative movement', 'guest reload recovery', 'host exit closes the room for the guest', 'offline race after online'] }, null, 2));
  console.log('Production smoke passed.');
} finally { await browser?.close(); await stack?.stop(); }
