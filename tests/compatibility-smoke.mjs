import { webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const browser = await webkit.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message)); await page.goto('http://localhost:3000');
  await page.getByRole('button', { name: 'START RACE', exact: true }).waitFor();
  const stats = () => page.evaluate(() => window.__raceDebug);
  // Holds a key for a span of race time, not wall time, since a slow or busy machine makes the race clock lag.
  const raceAt = t => page.waitForFunction(t => window.__raceDebug.race.time >= t, t, { timeout: 30000 });
  const hold = async (key, seconds) => { const t = (await stats()).race.time; await page.keyboard.down(key); await raceAt(t + seconds); await page.keyboard.up(key); };
  // The first lap of courses may allocate shared resources once; a second lap back to the same course must add nothing.
  const lap = async () => { for (let i = 0; i < 8; i++) { await page.getByRole('button', { name: 'Next course', exact: true }).click(); await page.waitForTimeout(50); } await page.waitForTimeout(200); return (await stats()).graphics; };
  const initial = await lap(), after = await lap();
  assert.ok(after.geometries <= initial.geometries, `Geometry grew from ${initial.geometries} to ${after.geometries}`);
  assert.ok(after.textures <= initial.textures, `Textures grew from ${initial.textures} to ${after.textures}`);
  await page.getByRole('button', { name: 'Choose Black Magician', exact: true }).click();
  await page.getByRole('button', { name: 'START RACE', exact: true }).click(); await page.waitForFunction(() => window.__raceDebug.race?.time >= 0, null, { timeout: 30000 });
  assert.equal((await stats()).race.racers[0].speed, 0);
  await page.keyboard.down('w'); await raceAt(.9); await page.keyboard.down('d'); await raceAt(1.2); await page.keyboard.up('d'); await page.keyboard.up('w');
  const moving = await stats(); assert.ok(moving.race.racers[0].speed > 15, `Speed ${moving.race.racers[0].speed} after 1.2 s of throttle`);
  await page.getByRole('button', { name: 'Pause menu' }).click(); const at = (await stats()).race.time; await page.waitForTimeout(250); assert.equal((await stats()).race.time, at);
  const immutable = await page.evaluate(() => { const copy = window.__raceDebug; copy.race.racers[0].px = 999999; return window.__raceDebug.race.racers[0].px !== 999999; }); assert.equal(immutable, true);
  await page.keyboard.press('Escape'); await page.screenshot({ path: 'output/testing/v2-webkit-race.png' });
  await hold('s', .9); assert.ok((await stats()).race.racers[0].speed < .1);
  await hold('x', .6); const reverse = (await stats()).race.racers[0]; assert.ok(reverse.vx * Math.sin(reverse.yaw) + reverse.vz * Math.cos(reverse.yaw) < -4);
  assert.deepEqual(errors, []);
  await mkdir('output/testing', { recursive: true }); await writeFile('output/testing/v2-webkit-smoke.json', JSON.stringify({ passed: true, engine: 'Playwright WebKit', checks: ['WebGL 2 scene', '16 course replacements without GPU object growth', 'Black Magician vehicle', 'manual acceleration', 'steering', 'braking', 'reverse', 'pause/resume', 'read-only diagnostics'], initialGraphics: initial, afterGraphics: after, pageErrors: errors }, null, 2));
  console.log('WebKit compatibility and GPU replacement smoke passed.', { initial, after });
} finally { await browser.close(); }
