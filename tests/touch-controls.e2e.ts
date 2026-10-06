import { test, expect } from '@playwright/test';

test('mobile layout follows orientation and leaves normal inputs selectable', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('#player-name').evaluate(el => getComputedStyle(el).userSelect)).not.toBe('none');
  await page.getByRole('button', { name: 'START RACE', exact: true }).click();
  const controls = page.getByLabel('Touchscreen gamepad');
  await expect(controls).toBeHidden();
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await expect(controls).toBeVisible();
    const left = (await page.getByRole('group', { name: 'Direction controls', exact: true }).boundingBox())!;
    const right = (await page.getByRole('group', { name: 'Race actions' }).boundingBox())!;
    expect(left.x + left.width).toBeLessThan(right.x);
    for (const name of ['Activate item', 'Drift', 'Recover racer', 'Look behind']) {
      const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(right.x);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.rotate-hint')).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(controls).toBeHidden();
});

test('independent touches drive, steer, drift and cast; cancellation and lifecycle changes clear inputs', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'START RACE', exact: true }).tap();
    const cdp = await context.newCDPSession(page);
    const stick = page.locator('.joystick');
    const box = (await stick.boundingBox())!;
    const point = async (selector: string, id: number) => {
      const b = (await page.locator(selector).boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, id };
    };
    const drive = { x: box.x + box.width * .8, y: box.y + box.height * .2, id: 1 };
    const drift = await point('.mobile-drift', 2), item = await point('.mobile-item', 3), ability = await point('.mobile-ability', 4);
    const input = () => page.evaluate(() => {
      const d = (window as any).__raceDebug;
      return d.race.racers.find((r: any) => r.id === d.playerId).input;
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [drive] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [drive, drift, item, ability] });
    await expect.poll(input).toMatchObject({ throttle: true, steer: -1, drift: true, item: true, ability: true });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [item, ability] });
    await expect.poll(input).toMatchObject({ throttle: true, steer: -1, drift: true, item: false, ability: false });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect.poll(input).toMatchObject({ throttle: false, steer: 0, drift: false });
    for (const action of ['blur', 'orientationchange', 'menu']) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [drive, drift] });
      await expect(stick).toHaveClass(/pressed/);
      await page.evaluate(action => {
        if (action === 'menu') (document.querySelector('[data-action="pause"]') as HTMLButtonElement).click();
        else window.dispatchEvent(new Event(action));
      }, action);
      await expect(stick).not.toHaveClass(/pressed/);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      if (action === 'menu') await page.getByRole('button', { name: 'RESUME RACE', exact: true }).tap();
      await expect.poll(input).toMatchObject({ throttle: false, steer: 0, drift: false });
    }
    expect(await page.locator('#world').evaluate(el => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(false);
    await page.keyboard.down('ArrowUp');
    await expect.poll(input).toMatchObject({ throttle: true });
    await page.keyboard.up('ArrowUp');
    await expect.poll(input).toMatchObject({ throttle: false });
  } finally { await context.close(); }
});
