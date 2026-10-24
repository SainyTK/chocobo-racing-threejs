import { test, expect, type Browser, type Page } from '@playwright/test';
import { centerOf, driveLapByTouch, playerOf, raceDebug, steeringThumb, touchScreen } from './touch-pilot.ts';

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (a: Box, b: Box) => a.x >= b.x - .5 && a.y >= b.y - .5 && a.x + a.width <= b.x + b.width + .5 && a.y + a.height <= b.y + b.height + .5;
const distance = (a: Box, b: Box) => Math.hypot(Math.max(0, b.x - a.x - a.width, a.x - b.x - b.width), Math.max(0, b.y - a.y - a.height, a.y - b.y - b.height));
const iPadLandscape = { width: 1180, height: 820 };
const viewports = [iPadLandscape, { width: 820, height: 1180 }, { width: 1366, height: 1024 }, { width: 1024, height: 1366 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 667, height: 375 }];
const controlSelectors = ['.mobile-drive', '.mobile-brake', '.mobile-drift', '.mobile-item', '.mobile-ability', '.steering-pad', '[data-touch="behind"]', '[data-touch="rescue"]'];

async function touchRace(browser: Browser, viewport: { width: number; height: number }, quality = 'high') {
  // iPad Safari reports a desktop-class browser, so only phone-sized viewports use the mobile flag.
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: Math.min(viewport.width, viewport.height) < 600 });
  await context.addInitScript(q => localStorage.setItem('cbr-quality', q), quality);
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'START RACE', exact: true }).tap();
  await expect(page.getByLabel('Touchscreen gamepad')).toBeVisible();
  return { context, page };
}
const inputOf = (page: Page) => async () => playerOf(await raceDebug(page)).input;

test('two-thumb layout fits iPad and phone screens without covering the HUD or the racer', async ({ browser, page }) => {
  test.setTimeout(240000);
  await page.goto('/');
  expect(await page.locator('#player-name').evaluate(el => getComputedStyle(el).userSelect)).not.toBe('none');
  await page.getByRole('button', { name: 'START RACE', exact: true }).click();
  await expect(page.getByLabel('Touchscreen gamepad')).toBeHidden();
  const { context, page: touchPage } = await touchRace(browser, viewports[0]);
  try {
    for (const viewport of viewports) {
      const page = touchPage, at = `${viewport.width}x${viewport.height}`;
      await page.setViewportSize(viewport);
      // One snapshot of every rectangle keeps this fast while the race keeps rendering.
      const rects = await page.evaluate(({ controlSelectors, hudSelectors }) => {
        const rect = (selector: string) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const { x, y, width, height } = el.getBoundingClientRect();
          return width ? { x, y, width, height } : null;
        };
        return {
          left: rect('.steering-side')!, right: rect('.action-pad')!, zone: rect('.steering-zone')!, pad: rect('.steering-pad')!, pause: rect('[data-action="pause"]')!,
          controls: controlSelectors.map(rect) as Box[], hud: hudSelectors.map(rect).filter(Boolean) as Box[],
          position: rect('.position')!, speed: rect('.speed-box')!, standings: rect('#standings')!, countdown: rect('#countdown strong'),
          fits: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight,
        };
      }, { controlSelectors, hudSelectors: ['.hud-top', '#standings', '.position', '.speed-box', '#minimap'] });
      expect(rects.left.x + rects.left.width, `${at} clusters`).toBeLessThan(rects.right.x);
      // The steering zone takes the free left side of the screen but never the right thumb's buttons or pause; the pad itself stays thumb-sized.
      expect(overlaps(rects.zone, rects.right), `${at} steering zone over actions`).toBe(false);
      expect(overlaps(rects.zone, rects.pause), `${at} steering zone over pause`).toBe(false);
      expect(rects.zone.x).toBe(0);
      expect(rects.zone.y + rects.zone.height).toBeCloseTo(viewport.height, 0);
      expect(rects.pad.width, `${at} steering pad width`).toBeLessThanOrEqual(200);
      // Look behind and recover live in the right cluster, a deliberate reach from the pedals the right thumb rolls across.
      const [driveBox, brakeBox, driftBox] = rects.controls, utilities = rects.controls.slice(6);
      for (const utility of utilities) {
        expect(inside(utility, rects.right), `${at} utility button outside the right cluster`).toBe(true);
        for (const pedal of [driveBox, brakeBox, driftBox]) expect(distance(utility, pedal), `${at} utility button too close to a pedal`).toBeGreaterThanOrEqual(14);
      }
      for (const box of rects.controls) {
        expect(box.width, `${at} target size`).toBeGreaterThanOrEqual(38);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
      for (const [i, a] of rects.controls.entries()) for (const b of rects.controls.slice(i + 1)) expect(overlaps(a, b), `${at} controls overlap`).toBe(false);
      // DRIVE is where the right thumb rests: the rightmost control.
      const drive = rects.controls[0];
      expect(Math.max(...rects.controls.map(b => b.x + b.width))).toBeCloseTo(drive.x + drive.width, 0);
      // Readouts stay clear of the controls, of each other and of the screen centre where the player's racer is drawn.
      for (const [i, a] of rects.hud.entries()) {
        for (const b of rects.controls) expect(overlaps(a, b), `${at} HUD over controls`).toBe(false);
        for (const b of rects.hud.slice(i + 1)) expect(overlaps(a, b), `${at} HUD elements overlap`).toBe(false);
      }
      const centre = { x: viewport.width * .35, y: viewport.height * .3, width: viewport.width * .3, height: viewport.height * .7 };
      expect(overlaps(rects.position, centre), `${at} position over racer`).toBe(false);
      expect(overlaps(rects.speed, centre), `${at} speed over racer`).toBe(false);
      if (rects.countdown) expect(overlaps(rects.countdown, rects.standings), `${at} countdown under standings`).toBe(false);
      expect(rects.fits, `${at} page scrolls`).toBe(true);
      await page.screenshot({ path: `output/testing/touch-${viewport.width}x${viewport.height}.png` });
    }
  } finally { await context.close(); }
});

test('right thumb drives, drifts and brakes while the left thumb steers and other fingers cast', async ({ browser }) => {
  test.setTimeout(300000);
  const { context, page } = await touchRace(browser, iPadLandscape);
  try {
    const touch = await touchScreen(context, page), input = inputOf(page);
    const drive = await centerOf(page, '.mobile-drive', 2), drift = await centerOf(page, '.mobile-drift', 2), brake = await centerOf(page, '.mobile-brake', 2);
    const item = await centerOf(page, '.mobile-item', 3), ability = await centerOf(page, '.mobile-ability', 4);
    // With no stones MAGIC is dimmed and says so.
    await expect(page.locator('.mobile-item')).toHaveClass(/empty/);
    await expect(page.locator('.mobile-item')).toHaveAccessibleName('Cast magic: no stones held');
    const thumb = await steeringThumb(page, 1);
    // Wherever the thumb lands is straight ahead; full lock is one travel away, a short thumb movement.
    expect(thumb.travel).toBeLessThanOrEqual(64);
    await touch.start([thumb.at(0), drive]);
    await expect.poll(input).toMatchObject({ throttle: true, steer: 0, drift: false, brake: false });
    await touch.move([thumb.at(-1.3)]);
    await expect.poll(input).toMatchObject({ throttle: true, steer: 1 });
    await touch.start([item, ability]);
    await expect.poll(input).toMatchObject({ throttle: true, steer: 1, item: true, ability: true });
    await touch.end([item, ability]);
    await expect.poll(input).toMatchObject({ throttle: true, steer: 1, item: false, ability: false });
    // Steering is proportional along the travel and centres when the thumb returns.
    await touch.move([thumb.at(.6)]);
    await expect.poll(async () => (await input()).steer).toBeLessThan(-.4);
    expect((await input()).steer).toBeGreaterThan(-.65);
    await touch.move([thumb.at(0)]);
    await expect.poll(input).toMatchObject({ steer: 0 });
    // A second finger landing in the steering zone does not take the steering from the first.
    await touch.start([{ ...thumb.at(1.3), id: 5 }]);
    await expect.poll(input).toMatchObject({ steer: 0 });
    await touch.end([{ x: 0, y: 0, id: 5 }]);
    // The right thumb rolls from DRIVE onto DRIFT and BRAKE without lifting.
    await touch.move([thumb.at(1.3), drift]);
    await expect.poll(input).toMatchObject({ throttle: true, drift: true, brake: false, steer: -1 });
    await expect(page.locator('.mobile-drift')).toHaveClass(/pressed/);
    await expect(page.locator('.mobile-drive')).not.toHaveClass(/pressed/);
    await touch.move([brake]);
    await expect.poll(input).toMatchObject({ throttle: false, drift: false, brake: true });
    await touch.move([drive]);
    await expect.poll(input).toMatchObject({ throttle: true, brake: false });
    await touch.cancel();
    await expect.poll(input).toMatchObject({ throttle: false, steer: 0, drift: false, brake: false });
    // The pad floats to a landing point higher up and to the right, and steers from there.
    const zone = (await page.locator('.steering-zone').boundingBox())!, landing = { x: zone.x + zone.width * .6, y: zone.y + zone.height * .45 };
    const floating = await steeringThumb(page, 1, landing);
    await touch.start([floating.at(0)]);
    await expect.poll(input).toMatchObject({ steer: 0 });
    const moved = (await page.locator('.steering-pad').boundingBox())!;
    expect(Math.abs(moved.x + moved.width / 2 - landing.x)).toBeLessThan(2);
    expect(Math.abs(moved.y + moved.height / 2 - landing.y)).toBeLessThan(2);
    await touch.move([floating.at(1.3)]);
    await expect.poll(input).toMatchObject({ steer: -1 });
    await touch.end();
    await expect.poll(input).toMatchObject({ steer: 0 });
    // The same stick drives when pushed up and brakes, then reverses, when pulled down. A thumb sweeping sideways
    // with a little vertical drift only steers.
    await touch.start([thumb.at(0)]);
    await touch.move([thumb.at(.9, -.3)]);
    await expect.poll(input).toMatchObject({ throttle: false, brake: false });
    expect((await input()).steer).toBeLessThan(-.5);
    await touch.move([thumb.at(0, -1)]);
    await expect.poll(input).toMatchObject({ throttle: true, brake: false, steer: 0 });
    await expect(page.locator('.steering-pad')).toHaveAttribute('data-pedal', 'throttle');
    await touch.move([thumb.at(-1, 1)]);
    await expect.poll(input).toMatchObject({ throttle: false, brake: true, steer: 1 });
    await expect(page.locator('.steering-pad')).toHaveAttribute('data-pedal', 'brake');
    // DRIVE held by the right thumb while the stick pulls down still brakes and reverses; with the stick centred DRIVE drives.
    await touch.start([drive]);
    await expect.poll(input).toMatchObject({ throttle: false, brake: true });
    await touch.move([thumb.at(0, 0)]);
    await expect.poll(input).toMatchObject({ throttle: true, brake: false });
    await touch.end();
    await expect.poll(input).toMatchObject({ throttle: false, brake: false, steer: 0 });
    await expect(page.locator('.steering-pad')).toHaveAttribute('data-pedal', '');
    for (const action of ['blur', 'orientationchange', 'menu']) {
      await touch.start([thumb.at(0), drift]);
      await expect(page.locator('.steering-pad')).toHaveClass(/pressed/);
      await page.evaluate(action => {
        if (action === 'menu') (document.querySelector('[data-action="pause"]') as HTMLButtonElement).click();
        else window.dispatchEvent(new Event(action));
      }, action);
      await expect(page.locator('.steering-pad')).not.toHaveClass(/pressed/);
      await touch.end();
      if (action === 'menu') await page.getByRole('button', { name: 'RESUME RACE', exact: true }).tap();
      await expect.poll(input).toMatchObject({ throttle: false, steer: 0, drift: false });
    }
    expect(await page.locator('#world').evaluate(el => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(false);
    expect(await page.locator('.mobile-drive').evaluate(el => el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })))).toBe(false);
    for (const [code, field] of [['ArrowUp', 'throttle'], ['ArrowLeft', 'steer']] as const) {
      await page.keyboard.down(code);
      await expect.poll(async () => (await input())[field]).toBeTruthy();
      await page.keyboard.up(code);
      await expect.poll(async () => (await input())[field]).toBeFalsy();
    }
    // Auto-accelerate keeps the throttle on, and DRIVE shows that it is automatic.
    await page.locator('[data-action="pause"]').tap();
    await page.getByRole('switch', { name: 'Auto-accelerate' }).tap();
    await page.getByRole('button', { name: 'RESUME RACE', exact: true }).tap();
    await expect(page.locator('.mobile-drive .auto-label')).toBeVisible();
    await expect(page.locator('.mobile-drive .drive-label')).toBeHidden();
    await expect.poll(input).toMatchObject({ throttle: true });
  } finally { await context.close(); }
});

for (const viewport of [iPadLandscape, { width: 820, height: 1180 }]) {
  test(`a touch player drives a full lap at ${viewport.width}x${viewport.height} with DRIVE, steering, drift, brake and magic`, async ({ browser }) => {
    test.setTimeout(240000);
    // Retro graphics keep the software-rendered test browser near real-time, so the pilot reacts like a player.
    const { context, page } = await touchRace(browser, viewport, 'retro');
    try {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      const { used, lapTime } = await driveLapByTouch(context, page);
      console.log(`touch lap ${viewport.width}x${viewport.height}`, JSON.stringify({ lapTime, ...used }));
      expect(lapTime).toBeGreaterThan(0);
      expect(used.steerLeft).toBeGreaterThan(0);
      expect(used.steerRight).toBeGreaterThan(0);
      expect(used.maxSpeed).toBeGreaterThan(40);
      expect(used.brake + used.drift).toBeGreaterThan(0);
      expect(used.casts).toBeGreaterThan(0);
      expect(used.stonesShown).toBeGreaterThan(0);
      expect(errors).toEqual([]);
      await page.screenshot({ path: `output/testing/touch-lap-${viewport.width}x${viewport.height}.png` });
    } finally { await context.close(); }
  });
}

// Pushing the stick up drives at full speed in both phone orientations; pulling it down brakes for the corners.
for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`a touch player drives a full lap at ${viewport.width}x${viewport.height} with the stick alone`, async ({ browser }) => {
    test.setTimeout(240000);
    const { context, page } = await touchRace(browser, viewport, 'retro');
    try {
      const { used, lapTime } = await driveLapByTouch(context, page, { stick: true });
      console.log(`stick lap ${viewport.width}x${viewport.height}`, JSON.stringify({ lapTime, ...used }));
      expect(lapTime).toBeGreaterThan(0);
      expect(used.maxSpeed).toBeGreaterThan(39);
      expect(used.brake).toBeGreaterThan(0);
    } finally { await context.close(); }
  });
}
