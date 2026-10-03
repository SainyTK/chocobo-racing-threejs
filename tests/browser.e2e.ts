import { test, expect, type Page } from '@playwright/test';
import { pointAt, trackLength, TRACK_IDS, type TrackId } from '../shared/track/index.ts';
const debug = (page: Page) => page.evaluate(() => (window as any).__raceDebug);
async function ready(page: Page) { await page.goto('/'); await expect(page.getByRole('button', { name: 'START RACE', exact: true })).toBeVisible(); }
/** Black-box pilot: reads a cloned telemetry snapshot, sends DOM keyboard events.
 * It never writes race state, invokes game functions or alters the simulation clock. */
async function pilot(page: Page) {
  const d = await debug(page), id = d.race.track as TrackId, len = trackLength(id);
  const points = Array.from({ length: 1600 }, (_, i) => pointAt(id, i / 1600 * len));
  await page.evaluate(({ points, len }) => {
    const win = window as any; if (win.__pilotTimer) clearInterval(win.__pilotTimer);
    const held = new Set<string>(); let density = 0, lastDirection = 0; const seen = new Set<string>(); let maxSpeed = 0;
    win.__pilotStats = { events: [], maxSpeed: 0, keyEvents: 0 };
    const send = (code: string, down: boolean) => { document.body.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true })); win.__pilotStats.keyEvents++; };
    const point = (s: number) => points[Math.floor(((s % len + len) % len) / len * points.length) % points.length];
    win.__pilotTimer = setInterval(() => {
      const d = win.__raceDebug, r = d.race, desired = new Set<string>();
      if (r && d.screen === 'race') {
        const p = r.racers.find((p: any) => p.id === d.playerId), target = point(p.s + Math.max(15, Math.min(32, p.speed * .6 + 8)));
        const delta = ((Math.atan2(target.x - p.px, target.z - p.pz) - p.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        const curve = Math.max(...[12, 25, 40].map(v => Math.abs(point(p.s + v).curve)));
        const brake = p.speed > Math.max(13, Math.min(34, Math.sqrt(14 / Math.max(.001, curve))) + 1);
        if (r.time > -.16 && !brake) desired.add('KeyW'); if (brake) desired.add('KeyS');
        const steer = Math.max(-1, Math.min(1, delta * 2.1)); if (Math.sign(steer) !== lastDirection) density = 0; lastDirection = Math.sign(steer); density += Math.abs(steer); if (density >= .7) { desired.add(steer > 0 ? 'KeyD' : 'KeyA'); density -= 1; }
        if (p.item && Math.sin(r.time * 3) > .5) desired.add('Space'); if (p.ability >= 100 && curve < .013) desired.add('KeyE');
        if (Math.abs(p.x) > 9 && p.speed < 3 && r.time > 6 || p.s > (p.gates + 1) * len / 12 + 15) desired.add('KeyR');
        for (const e of r.events) if (e.player === d.playerId || e.target === d.playerId) seen.add(e.type); maxSpeed = Math.max(maxSpeed, p.speed);
      }
      for (const k of held) if (!desired.has(k)) { send(k, false); held.delete(k); }
      for (const k of desired) if (!held.has(k)) { send(k, true); held.add(k); }
      win.__pilotStats.events = [...seen]; win.__pilotStats.maxSpeed = maxSpeed;
      if (!r || d.screen === 'results') { clearInterval(win.__pilotTimer); win.__pilotTimer = null; }
    }, 33);
  }, { points, len });
}
async function finish(page: Page, timeout = 160000) { await expect(page.getByRole('dialog', { name: 'Race results' })).toBeVisible({ timeout }); const d = await debug(page), p = d.race.racers.find((p: any) => p.id === d.playerId); expect(p.finishTime).toBeGreaterThan(0); expect(p.gates).toBe(d.race.laps * 12); return d; }

test('eight distinct racers and courses, independent abilities, options and honest help', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await ready(page);
  await page.screenshot({ path: 'output/testing/v2-home-desktop.png' });
  for (const name of ['Mog', 'Golem', 'Goblin', 'Black Magician', 'White Mage', 'Chubby Chocobo', 'Behemoth', 'Chocobo']) { await page.getByRole('button', { name: `Choose ${name}`, exact: true }).click(); await expect(page.locator('.vehicle-label h1')).toHaveText(name); if (name === 'Black Magician') await page.screenshot({ path: 'output/testing/v2-black-magician.png' }); }
  await page.getByRole('combobox', { name: 'Ability', exact: true }).selectOption('barrier'); expect((await debug(page)).settings.abilityId).toBe('barrier');
  for (let i = 0; i < 8; i++) { await page.getByRole('button', { name: 'Next course' }).click(); if (i === 5) await page.screenshot({ path: 'output/testing/v2-candy-menu.png' }); }
  await page.getByRole('button', { name: 'Controls', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('There is no release turbo'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Options', exact: true }).click(); await expect(page.getByRole('switch', { name: 'Auto-accelerate' })).toHaveAttribute('aria-checked', 'false'); await page.getByRole('combobox', { name: 'Graphics quality' }).selectOption('retro'); await page.getByRole('button', { name: 'DONE', exact: true }).click(); expect((await debug(page)).settings.quality).toBe('retro');
  await page.getByRole('button', { name: 'What matches the original?' }).click(); await expect(page.getByRole('dialog')).toContainText('not an identical copy'); expect(errors).toEqual([]);
});
for (const [index, id] of TRACK_IDS.entries()) test(`real keyboard driving completes ${id}`, async ({ page }) => {
  test.setTimeout(190000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await ready(page);
  for (let i = 0; i < index; i++) await page.getByRole('button', { name: 'Next course' }).click();
  await page.getByRole('combobox', { name: 'Laps', exact: true }).selectOption('1'); await page.getByRole('button', { name: 'START RACE', exact: true }).click();
  await expect(page.locator('#countdown')).not.toBeEmpty(); await pilot(page); await page.waitForTimeout(7000); await page.screenshot({ path: `output/testing/v2-race-${id}.png` });
  if (index === 0) { await page.getByRole('button', { name: 'Pause menu' }).click(); const at = (await debug(page)).race.time; await page.waitForTimeout(300); expect((await debug(page)).race.time).toBe(at); await page.getByRole('button', { name: 'RESUME RACE' }).click(); await pilot(page); }
  const d = await finish(page); expect(d.race.racers).toHaveLength(6); const stats = await page.evaluate(() => (window as any).__pilotStats); expect(stats.maxSpeed).toBeGreaterThan(30); expect(stats.keyEvents).toBeGreaterThan(30);
  await page.screenshot({ path: `output/testing/v2-results-${id}.png` }); await page.getByRole('button', { name: 'RACE AGAIN', exact: true }).click(); expect((await debug(page)).race.time).toBeLessThan(0); expect(errors).toEqual([]);
});
test('Time Attack records a real phantom, persists it and replays it on the next race', async ({ page }) => {
  test.setTimeout(200000); await ready(page); await page.getByRole('button', { name: 'Time Attack', exact: true }).click(); await page.getByRole('combobox', { name: 'Laps', exact: true }).selectOption('1'); await page.getByRole('button', { name: 'START RACE', exact: true }).click(); await pilot(page); const d = await finish(page); expect(d.race.racers).toHaveLength(1); expect(d.recordingSamples).toBeGreaterThan(500);
  await page.getByRole('button', { name: 'Main menu', exact: true }).click(); await page.reload(); await page.getByRole('button', { name: 'Time Attack', exact: true }).click(); await page.getByRole('button', { name: 'START RACE', exact: true }).click(); expect((await debug(page)).ghost.samples).toBeGreaterThan(500); await pilot(page); await page.waitForTimeout(12000); await page.screenshot({ path: 'output/testing/v2-phantom-racer.png' }); await finish(page);
});
test('Grand Prix plays four complete rounds, carries points, changes grid and awards champion', async ({ page }) => {
  test.setTimeout(550000); await ready(page); await page.getByRole('button', { name: 'Grand Prix', exact: true }).click(); await page.getByRole('combobox', { name: 'Laps', exact: true }).selectOption('1'); await page.getByRole('button', { name: 'START GRAND PRIX', exact: true }).click(); let total = 0;
  for (let round = 0; round < 4; round++) { await pilot(page); await finish(page); await expect(page.locator('#next-race')).toBeEnabled({ timeout: 100000 }); const d = await debug(page); expect(d.cup.round).toBe(round); expect(d.race.track).toBe(TRACK_IDS[round]); const sum = Object.values(d.cup.points).reduce((a: any, b: any) => a + b, 0); expect(sum).toBeGreaterThan(total); total = sum as number; if (round < 3) await page.getByRole('button', { name: 'NEXT ROUND' }).click(); }
  await expect(page.locator('#cup-champion')).toContainText('CUP CHAMPION'); await page.screenshot({ path: 'output/testing/v2-grand-prix-champion.png' });
});
test('two independent clients race, reload/rejoin, agree on finish and rematch', async ({ browser }) => {
  test.setTimeout(240000); const ca = await browser.newContext(), cb = await browser.newContext(), a = await ca.newPage(), b = await cb.newPage();
  try { await ready(a); await ready(b); await a.getByRole('button', { name: 'Online', exact: true }).click(); await a.getByRole('combobox', { name: 'Laps', exact: true }).selectOption('1'); await a.getByRole('textbox', { name: 'Your name' }).fill('Host'); await a.getByRole('button', { name: 'CREATE ROOM', exact: true }).click(); const code = await a.locator('#room-code').innerText();
    await b.getByRole('button', { name: 'Choose Mog', exact: true }).click(); await b.getByRole('button', { name: 'Online', exact: true }).click(); await b.getByRole('textbox', { name: 'Your name' }).fill('Friend'); await b.getByRole('textbox', { name: 'Room code' }).fill(code); await b.getByRole('button', { name: 'Join room' }).click(); await expect(a.locator('.roster')).toContainText('Friend'); await a.screenshot({ path: 'output/testing/v2-online-lobby.png' }); await a.getByRole('button', { name: 'START ONLINE RACE' }).click(); await expect(b.locator('#place')).toBeVisible();
    const before = await debug(b); await b.reload(); await expect(b.locator('#place')).toBeVisible(); expect((await debug(b)).playerId).toBe(before.playerId); await ca.setOffline(true); await a.waitForTimeout(1600); await ca.setOffline(false); await expect.poll(async () => (await debug(a)).connected).toBe(true);
    await pilot(a); await pilot(b); await Promise.all([finish(a), finish(b)]); await expect.poll(async () => (await debug(a)).race.phase, { timeout: 100000 }).toBe('finished'); await b.waitForTimeout(300); const da = await debug(a), db = await debug(b); expect(da.race.racers.map((p: any) => [p.id, p.rank, p.finishTime])).toEqual(db.race.racers.map((p: any) => [p.id, p.rank, p.finishTime])); await a.screenshot({ path: 'output/testing/v2-online-results.png' }); const host = da.room.host === da.playerId ? a : b; await host.getByRole('button', { name: 'Back to lobby', exact: true }).click(); await expect(a.locator('#room-code')).toHaveText(code); await expect(b.locator('#room-code')).toHaveText(code);
  } finally { await ca.close(); await cb.close(); }
});
test('Versus drives Behemoth with a separately selected Flap ability against Goblin', async ({ page }) => {
  test.setTimeout(180000); await ready(page); await page.getByRole('button', { name: 'Choose Behemoth', exact: true }).click(); await page.getByRole('button', { name: 'Versus', exact: true }).click(); await page.getByRole('combobox', { name: 'Ability', exact: true }).selectOption('flap'); await page.getByRole('combobox', { name: 'Rival', exact: true }).selectOption('3'); await page.getByRole('combobox', { name: 'Laps', exact: true }).selectOption('1'); await page.getByRole('button', { name: 'START RACE', exact: true }).click(); await pilot(page); const d = await finish(page); expect(d.race.racers).toHaveLength(2); expect(d.race.racers[0]).toMatchObject({ character: 7, abilityId: 'flap' }); expect(d.race.racers[1].character).toBe(3); await page.screenshot({ path: 'output/testing/v2-versus-results.png' });
});
test('mobile portrait and landscape: manual gas, real steering, reverse and no overflow', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }), page = await ctx.newPage();
  try { await ready(page); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: 'output/testing/v2-home-mobile.png', fullPage: true }); await page.getByRole('button', { name: 'START RACE', exact: true }).tap(); await page.waitForTimeout(4000); expect((await debug(page)).race.racers[0].speed).toBe(0);
    const gas = (await page.getByRole('button', { name: 'Accelerate', exact: true }).boundingBox())!, right = (await page.getByRole('button', { name: 'Steer right' }).boundingBox())!, cdp = await ctx.newCDPSession(page); const yaw = (await debug(page)).race.racers[0].yaw;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gas.x + gas.width / 2, y: gas.y + gas.height / 2, id: 0 }, { x: right.x + right.width / 2, y: right.y + right.height / 2, id: 1 }] }); await page.waitForTimeout(700); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); const d = await debug(page); expect(d.race.racers[0].speed).toBeGreaterThan(5); expect(Math.abs(d.race.racers[0].yaw - yaw)).toBeGreaterThan(.2); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: 'output/testing/v2-race-mobile.png' });
    await page.setViewportSize({ width: 844, height: 390 }); await expect(page.getByRole('button', { name: 'Reverse', exact: true })).toBeVisible(); await page.screenshot({ path: 'output/testing/v2-race-landscape.png' }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const hold = async (name: string, ms: number) => { const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 0 }] }); await page.waitForTimeout(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    await hold('Brake', 800); await hold('Reverse', 700); const backwards = (await debug(page)).race.racers[0]; expect(backwards.vx * Math.sin(backwards.yaw) + backwards.vz * Math.cos(backwards.yaw)).toBeLessThan(-4);
    await page.getByRole('button', { name: 'Recover racer', exact: true }).tap(); await expect.poll(async () => (await debug(page)).race.racers[0].lastRescue).toBeGreaterThan(0);
  } finally { await ctx.close(); }
});
