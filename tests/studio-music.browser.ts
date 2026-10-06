import { test, expect, type Page } from '@playwright/test';
import { TRACK_IDS } from '../shared/track/index.ts';
import { MENU_MUSIC } from '../src/music/index.ts';

const status = (page: Page) => page.evaluate(() => (window as any).__studioAudio);

test('studio music links do not autoplay, and all nine scores play without a race', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#panes=music.menu:score');
  await expect(page.getByRole('heading', { name: MENU_MUSIC.title })).toBeVisible();
  expect((await status(page)).playing).toBe(false);
  expect((await status(page)).activeMusicVoices).toBe(0);
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await expect.poll(async () => (await status(page)).running).toBe(true);
  await page.locator('#q').fill('music');
  for (const id of ['menu', ...TRACK_IDS]) {
    await page.locator(`#results .item[data-id="music.${id}"]`).click();
    await expect.poll(async () => (await status(page)).scoreId).toBe(id);
    await expect.poll(async () => (await status(page)).activeMusicVoices).toBeGreaterThan(0);
    expect((await status(page)).activeMusicVoices).toBeLessThanOrEqual(48);
  }
  await page.getByRole('button', { name: 'Pause music', exact: true }).click();
  expect((await status(page)).activeMusicVoices).toBe(0);
  const position = (await status(page)).positionSeconds;
  await page.waitForTimeout(200);
  expect((await status(page)).positionSeconds).toBe(position);
  await page.getByRole('button', { name: 'Restart music', exact: true }).click();
  expect((await status(page)).positionSeconds).toBe(0);
  expect((await status(page)).playing).toBe(false);
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await expect.poll(async () => (await status(page)).positionSeconds).toBeGreaterThan(.2);
  await page.locator('#play').click();
  expect((await status(page)).running).toBe(false);
  await page.getByRole('button', { name: 'Resume music', exact: true }).click();
  await expect.poll(async () => (await status(page)).running).toBe(true);
  await page.getByRole('slider', { name: 'Music volume' }).fill('30');
  await expect(page.getByRole('slider', { name: 'Music volume' })).toHaveValue('30');
  await page.locator('#q').fill('Chocobo');
  await page.locator('#results .item[data-id="char.chocobo"]').click();
  expect((await status(page)).playing).toBe(false);
  expect((await status(page)).activeMusicVoices).toBe(0);
  expect(errors).toEqual([]);
});

test('comparison panes share one player and switching focus changes the audible score', async ({ page }) => {
  await page.goto('/#panes=music.forest:score,music.volcano:score&active=0');
  const first = page.locator('.pane').nth(0), second = page.locator('.pane').nth(1);
  await first.getByRole('button', { name: 'Play music', exact: true }).click();
  await expect.poll(async () => (await status(page)).scoreId).toBe('forest');
  await second.getByRole('button', { name: 'Play music', exact: true }).click();
  await expect.poll(async () => (await status(page)).scoreId).toBe('volcano');
  await expect.poll(async () => (await status(page)).running).toBe(true);
  await expect(first.locator('.music-status')).toHaveText('Select this pane to listen.');
  await expect(second.getByRole('button', { name: 'Pause music', exact: true })).toBeVisible();
  await page.keyboard.press('1');
  await expect.poll(async () => (await status(page)).scoreId).toBe('forest');
  await expect(second.locator('.music-status')).toHaveText('Select this pane to listen.');
  await page.screenshot({ path: 'output/testing/studio-music.png' });
  const hash = await page.evaluate(() => location.hash);
  await page.reload();
  expect(await page.evaluate(() => location.hash)).toBe(hash);
  expect((await status(page)).playing).toBe(false);
});
