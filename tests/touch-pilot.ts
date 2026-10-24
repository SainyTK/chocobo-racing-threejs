import type { BrowserContext, Page } from '@playwright/test';
import { pointAt, trackLength, type TrackId } from '../shared/track/index.ts';

export interface TouchPoint { x: number; y: number; id: number }
const STONES = ['fire', 'ice', 'thunder', 'haste', 'shield', 'mini', 'doom', 'ultima'];

export const raceDebug = (page: Page) => page.evaluate(() => (window as any).__raceDebug);
export const playerOf = (d: any) => d.race.racers.find((r: any) => r.id === d.playerId);

/** Real multi-touch through the browser's input pipeline. Each event lists every finger still down, as a touchscreen reports it. */
export async function touchScreen(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page), down = new Map<number, TouchPoint>();
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', touchPoints: TouchPoint[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  return {
    start: (points: TouchPoint[]) => {
      for (const p of points) down.set(p.id, p);
      return send('touchStart', [...down.values()]);
    },
    move: (points: TouchPoint[]) => {
      for (const p of points) down.set(p.id, p);
      return send('touchMove', [...down.values()]);
    },
    /** Lifts the listed fingers, or every finger when none are listed. */
    end: (points: TouchPoint[] = [...down.values()]) => {
      for (const p of points) down.delete(p.id);
      return send('touchEnd', points);
    },
    cancel: () => {
      down.clear();
      return send('touchCancel', []);
    },
  };
}

export async function centerOf(page: Page, selector: string, id: number): Promise<TouchPoint> {
  const box = (await page.locator(selector).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, id };
}

/**
 * The left thumb on the floating steering pad. It lands at `landing` (the pad's resting centre by default),
 * and `at(offset, rise)` is that finger moved by fractions of the pad's travel: offset -1 is full lock left and 1 full lock right;
 * rise -1 pushes the stick fully up (drive) and 1 pulls it fully down (brake, then reverse).
 */
export async function steeringThumb(page: Page, id: number, landing?: { x: number; y: number }) {
  const { pad, knob } = await page.evaluate(() => {
    const box = (selector: string) => {
      const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
      return { x, y, width, height };
    };
    return { pad: box('.steering-pad'), knob: box('.steer-knob') };
  });
  const origin = landing ?? { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 }, travel = (pad.width - knob.width) / 2, travelY = (pad.height - knob.height) / 2;
  return { travel, at: (offset: number, rise = 0): TouchPoint => ({ x: origin.x + offset * travel, y: origin.y + rise * travelY, id }) };
}

/** The telemetry the pilot reads, taken from one cloned debug snapshot per tick. */
const telemetry = (page: Page) => page.evaluate(() => {
  const d = (window as any).__raceDebug, r = d.race, p = r.racers.find((q: any) => q.id === d.playerId);
  return { time: r.time, s: p.s, x: p.x, px: p.px, pz: p.pz, yaw: p.yaw, speed: p.speed, item: p.item, gates: p.gates, drifting: p.drifting, lapTimes: p.lapTimes, events: r.events.filter((e: any) => e.player === d.playerId).map((e: any) => ({ id: e.id, type: e.type })) };
});

/**
 * Black-box touch pilot for one lap. It reads cloned telemetry and only sends touches:
 * the left thumb lands on the steering zone and slides, the right thumb rolls between DRIVE, DRIFT and BRAKE,
 * and a third finger taps MAGIC when a stone is ready.
 * With `stick`, the left thumb also does the pedals, pushing up to drive and pulling down to brake, and the right thumb rests.
 */
export async function driveLapByTouch(context: BrowserContext, page: Page, { timeout = 150000, stick = false } = {}) {
  const touch = await touchScreen(context, page), steerId = 1, pedalId = 2, castId = 3, rescueId = 4;
  const track = (await raceDebug(page)).race.track as TrackId, len = trackLength(track);
  const point = (s: number) => pointAt(track, ((s % len) + len) % len);
  const steerAt = (await steeringThumb(page, steerId)).at;
  const pedals = { drive: await centerOf(page, '.mobile-drive', pedalId), drift: await centerOf(page, '.mobile-drift', pedalId), brake: await centerOf(page, '.mobile-brake', pedalId) };
  const magic = await centerOf(page, '.mobile-item', castId), rescue = await centerOf(page, '[aria-label="Recover racer"]', rescueId);
  const used = { drive: 0, drift: 0, brake: 0, drifting: 0, casts: 0, rescues: 0, steerLeft: 0, steerRight: 0, maxSpeed: 0, stonesShown: 0 };
  const seen = new Set<number>();
  let p = await telemetry(page);
  while (p.time < -.2) p = await telemetry(page);
  await touch.start(stick ? [steerAt(0)] : [steerAt(0), pedals.drive]);
  const started = Date.now();
  let castUntil = 0, rescueUntil = 0;
  while (p.gates < 12) {
    if (Date.now() - started > timeout) throw new Error(`Touch pilot did not finish a lap: ${JSON.stringify({ gates: p.gates, used })}`);
    const target = point(p.s + Math.max(15, Math.min(32, p.speed * .6 + 8)));
    const delta = ((Math.atan2(target.x - p.px, target.z - p.pz) - p.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const curve = Math.max(...[12, 25, 40].map(v => Math.abs(point(p.s + v).curve)));
    const steer = Math.max(-1, Math.min(1, delta * 2.1));
    const tooFast = p.speed > Math.max(13, Math.min(34, Math.sqrt(24.5 / Math.max(.001, curve))) + 1);
    const pedal = tooFast ? 'brake' : !stick && curve > .02 && p.speed > 18 && Math.abs(steer) > .45 ? 'drift' : 'drive';
    // Positive steer turns left, so the thumb slides left. The offset includes the deadzone so small corrections still turn.
    const offset = -Math.sign(steer) * (.15 + Math.abs(steer) * .85);
    await touch.move(stick ? [steerAt(offset, tooFast ? 1.2 : -1.2)] : [steerAt(offset), pedals[pedal]]);
    used[pedal]++;
    if (steer > .2) used.steerLeft++;
    if (steer < -.2) used.steerRight++;
    if (p.drifting) used.drifting++;
    used.maxSpeed = Math.max(used.maxSpeed, p.speed);
    const now = Date.now();
    if (castUntil && now > castUntil) { await touch.end([magic]); castUntil = 0; }
    else if (!castUntil && p.item) {
      // MAGIC shows the held stone before the thumb casts it.
      if (await page.locator('.mobile-item:not(.empty) .stone-ball img[src^="data:image/png"]').waitFor({ timeout: 500 }).then(() => true, () => false)) used.stonesShown++;
      await touch.start([magic]); castUntil = now + 120;
    }
    if (rescueUntil && now > rescueUntil) { await touch.end([rescue]); rescueUntil = 0; }
    else if (!rescueUntil && (Math.abs(p.x) > 9 && p.speed < 3 && p.time > 6 || p.s > (p.gates + 1) * len / 12 + 15)) { await touch.start([rescue]); rescueUntil = now + 120; }
    for (const e of p.events) if (!seen.has(e.id)) {
      seen.add(e.id);
      if (STONES.includes(e.type)) used.casts++;
      if (e.type === 'recover') used.rescues++;
    }
    p = await telemetry(page);
  }
  await touch.end();
  return { used, lapTime: p.lapTimes?.[0] ?? null };
}
