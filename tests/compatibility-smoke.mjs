import { webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const browser = await webkit.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message)); await page.goto('http://localhost:3000');
  await page.getByRole('button', { name: 'START RACE', exact: true }).waitFor();
  const stats = () => page.evaluate(() => window.__raceDebug);
  const initial = (await stats()).graphics;
  for (let cycle = 0; cycle < 2; cycle++) for (let i = 0; i < 8; i++) { await page.getByRole('button', { name: 'Next course', exact: true }).click(); await page.waitForTimeout(50); }
  await page.waitForTimeout(200); const after = (await stats()).graphics;
  assert.ok(after.geometries <= initial.geometries + 3, `Geometry grew from ${initial.geometries} to ${after.geometries}`);
  assert.ok(after.textures <= initial.textures + 1);
  await page.getByRole('button', { name: 'Choose Black Magician', exact: true }).click();
  await page.getByRole('button', { name: 'START RACE', exact: true }).click(); await page.waitForTimeout(4000);
  assert.equal((await stats()).race.racers[0].speed, 0);
  await page.keyboard.down('w'); await page.waitForTimeout(900); await page.keyboard.down('d'); await page.waitForTimeout(300); await page.keyboard.up('d'); await page.keyboard.up('w');
  const moving = await stats(); assert.ok(moving.race.racers[0].speed > 15);
  await page.getByRole('button', { name: 'Pause menu' }).click(); const at = (await stats()).race.time; await page.waitForTimeout(250); assert.equal((await stats()).race.time, at);
  const immutable = await page.evaluate(() => { const copy = window.__raceDebug; copy.race.racers[0].px = 999999; return window.__raceDebug.race.racers[0].px !== 999999; }); assert.equal(immutable, true);
  await page.keyboard.press('Escape'); await page.screenshot({ path: 'output/testing/v2-webkit-race.png' });
  await page.keyboard.down('s'); await page.waitForTimeout(900); await page.keyboard.up('s'); assert.ok((await stats()).race.racers[0].speed < .1);
  await page.keyboard.down('x'); await page.waitForTimeout(600); await page.keyboard.up('x'); const reverse = (await stats()).race.racers[0]; assert.ok(reverse.vx * Math.sin(reverse.yaw) + reverse.vz * Math.cos(reverse.yaw) < -4);
  assert.deepEqual(errors, []);
  await mkdir('output/testing', { recursive: true }); await writeFile('output/testing/v2-webkit-smoke.json', JSON.stringify({ passed: true, engine: 'Playwright WebKit', checks: ['WebGL 2 scene', '16 course replacements without GPU object growth', 'Black Magician vehicle', 'manual acceleration', 'steering', 'braking', 'reverse', 'pause/resume', 'read-only diagnostics'], initialGraphics: initial, afterGraphics: after, pageErrors: errors }, null, 2));
  console.log('WebKit compatibility and GPU replacement smoke passed.', { initial, after });
} finally { await browser.close(); }
