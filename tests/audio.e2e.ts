import { test, expect } from '@playwright/test';
import { TRACK_IDS } from '../shared/track/index.ts';

test('each course selects its score and pause, mute and exit control playback', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const playback = () => page.evaluate(() => (window as any).__raceDebug.audio);
  await page.getByRole('button', { name: 'Choose Mog', exact: true }).click();
  await expect.poll(async () => (await playback()).scoreId).toBe('menu');
  for (const id of TRACK_IDS) {
    await page.getByRole('button', { name: 'START RACE', exact: true }).click();
    await expect.poll(async () => (await playback()).scoreId).toBe(id);
    await expect.poll(async () => (await playback()).activeMusicVoices).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Pause menu' }).click();
    await expect.poll(async () => (await playback()).running).toBe(false);
    expect((await playback()).activeMusicVoices).toBe(0);
    await page.getByRole('button', { name: 'RESUME RACE', exact: true }).click();
    await expect.poll(async () => (await playback()).running).toBe(true);
    await page.getByRole('button', { name: 'Pause menu' }).click();
    await page.getByRole('button', { name: 'Exit race', exact: true }).click();
    await page.getByRole('dialog', { name: 'Exit this race?' }).getByRole('button', { name: 'Exit race', exact: true }).click();
    await expect.poll(async () => (await playback()).scoreId).toBe('menu');
    await page.getByRole('button', { name: 'Next course' }).click();
  }
  await page.getByRole('button', { name: 'Toggle sound' }).click();
  await expect.poll(async () => (await playback()).running).toBe(false);
  expect((await playback()).activeMusicVoices).toBe(0);
  await page.getByRole('button', { name: 'Toggle sound' }).click();
  await expect.poll(async () => (await playback()).running).toBe(true);
  expect(errors).toEqual([]);
});

test('real Web Audio produces finite non-silent samples for every stage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose Mog', exact: true }).click();
  const results = await page.evaluate(async ids => {
    const modulePath = '/src/audio.ts';
    const { AudioEngine } = await import(modulePath);
    const engine = new AudioEngine();
    engine.unlock();
    await engine.context.resume();
    const analyser = engine.context.createAnalyser();
    analyser.fftSize = 2048;
    engine.master.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const results: { id: string; peak: number; finite: boolean; voices: number }[] = [];
    try {
      for (const id of ids) {
        engine.update(true, id);
        let peak = 0, finite = true, voices = 0;
        for (let tick = 0; tick < 12; tick++) {
          await new Promise(resolve => setTimeout(resolve, 25));
          engine.update(true, id);
          voices = Math.max(voices, engine.playback.activeMusicVoices);
          analyser.getFloatTimeDomainData(samples);
          for (const sample of samples) {
            finite &&= Number.isFinite(sample);
            peak = Math.max(peak, Math.abs(sample));
          }
        }
        results.push({ id, peak, finite, voices });
      }
    } finally {
      engine.setEnabled(false);
      analyser.disconnect();
      await engine.context.close();
    }
    return results;
  }, TRACK_IDS);
  for (const result of results) {
    expect(result.finite, result.id).toBe(true);
    expect(result.peak, result.id).toBeGreaterThan(.0001);
    expect(result.peak, result.id).toBeLessThan(1);
    expect(result.voices, result.id).toBeLessThanOrEqual(48);
  }
});
