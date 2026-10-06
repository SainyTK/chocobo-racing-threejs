import { test, expect } from '@playwright/test';

test('gamepad follows viewport changes and keeps race actions on the right', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'START RACE', exact: true }).click();
  const controls = page.getByLabel('Touchscreen gamepad');
  await expect(controls).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(controls).toBeVisible();
  const left = (await page.getByRole('group', { name: 'Direction controls' }).boundingBox())!;
  const right = (await page.getByRole('group', { name: 'Race actions' }).boundingBox())!;
  expect(left.x + left.width).toBeLessThan(right.x);
  for (const name of ['Activate item', 'Activate ability', 'Brake', 'Accelerate', 'Reverse', 'Drift', 'Recover racer']) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(right.x);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(controls).toBeHidden();
});

test('touch cancellation and opening a menu release held controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'START RACE', exact: true }).tap();
    const gas = page.getByRole('button', { name: 'Accelerate', exact: true });
    const box = (await gas.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const start = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 0 }] });
    await start();
    await expect(gas).toHaveClass(/pressed/);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(gas).not.toHaveClass(/pressed/);
    await start();
    await page.evaluate(() => (document.querySelector('[data-action="pause"]') as HTMLButtonElement).click());
    await expect(page.getByRole('dialog', { name: 'Race Menu' })).toBeVisible();
    await expect(gas).not.toHaveClass(/pressed/);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.getByRole('button', { name: 'RESUME RACE', exact: true }).tap();
    await expect.poll(() => page.evaluate(() => {
      const d = (window as any).__raceDebug;
      return d.race.racers.find((r: any) => r.id === d.playerId).input.throttle;
    })).toBe(false);
  } finally { await context.close(); }
});
