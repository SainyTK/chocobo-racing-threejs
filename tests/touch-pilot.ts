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

/** A finger on the steering pad at an offset from its centre, -1 at the left edge and 1 at the right edge. */
export async function steeringPoint(page: Page, offset: number, id: number): Promise<TouchPoint> {
  const box = (await page.locator('.steering-pad').boundingBox())!;
  return { x: box.x + box.width / 2 * (1 + offset), y: box.y + box.height / 2, id };
}

/** The telemetry the pilot reads, taken from one cloned debug snapshot per tick. */
const telemetry = (page: Page) => page.evaluate(() => {
  const d = (window as any).__raceDebug, r = d.race, p = r.racers.find((q: any) => q.id === d.playerId);
  return { time: r.time, s: p.s, x: p.x, px: p.px, pz: p.pz, yaw: p.yaw, speed: p.speed, item: p.item, gates: p.gates, drifting: p.drifting, lapTimes: p.lapTimes, events: r.events.filter((e: any) => e.player === d.playerId).map((e: any) => ({ id: e.id, type: e.type })) };
});

/**
 * Black-box touch pilot for one lap. It reads cloned telemetry and only sends touches:
 * the left thumb slides on the steering pad, the right thumb rolls between DRIVE, DRIFT and BRAKE,
 * and a third finger taps MAGIC when a stone is ready.
 */
export async function driveLapByTouch(context: BrowserContext, page: Page, timeout = 150000) {
  const touch = await touchScreen(context, page), steerId = 1, pedalId = 2, castId = 3, rescueId = 4;
  const track = (await raceDebug(page)).race.track as TrackId, len = trackLength(track);
  const point = (s: number) => pointAt(track, ((s % len) + len) % len);
  const pad = (await page.locator('.steering-pad').boundingBox())!;
  const steerAt = (offset: number) => ({ x: pad.x + pad.width / 2 * (1 + offset), y: pad.y + pad.height / 2, id: steerId });
  const pedals = { drive: await centerOf(page, '.mobile-drive', pedalId), drift: await centerOf(page, '.mobile-drift', pedalId), brake: await centerOf(page, '.mobile-brake', pedalId) };
  const magic = await centerOf(page, '.mobile-item', castId), rescue = await centerOf(page, '[aria-label="Recover racer"]', rescueId);
  const used = { drive: 0, drift: 0, brake: 0, drifting: 0, casts: 0, rescues: 0, steerLeft: 0, steerRight: 0, maxSpeed: 0 };
  const seen = new Set<number>();
  let p = await telemetry(page);
  while (p.time < -.2) p = await telemetry(page);
  await touch.start([steerAt(0), pedals.drive]);
  const started = Date.now();
  let castUntil = 0, rescueUntil = 0;
  while (p.gates < 12) {
    if (Date.now() - started > timeout) throw new Error(`Touch pilot did not finish a lap: ${JSON.stringify({ gates: p.gates, used })}`);
    const target = point(p.s + Math.max(15, Math.min(32, p.speed * .6 + 8)));
    const delta = ((Math.atan2(target.x - p.px, target.z - p.pz) - p.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const curve = Math.max(...[12, 25, 40].map(v => Math.abs(point(p.s + v).curve)));
    const steer = Math.max(-1, Math.min(1, delta * 2.1));
    const pedal = p.speed > Math.max(13, Math.min(34, Math.sqrt(14 / Math.max(.001, curve))) + 1) ? 'brake' : curve > .02 && p.speed > 18 && Math.abs(steer) > .45 ? 'drift' : 'drive';
    // Positive steer turns left, so the thumb moves to the left half of the pad.
    await touch.move([steerAt(-steer * .8), pedals[pedal]]);
    used[pedal]++;
    if (steer > .2) used.steerLeft++;
    if (steer < -.2) used.steerRight++;
    if (p.drifting) used.drifting++;
    used.maxSpeed = Math.max(used.maxSpeed, p.speed);
    const now = Date.now();
    if (castUntil && now > castUntil) { await touch.end([magic]); castUntil = 0; }
    else if (!castUntil && p.item) { await touch.start([magic]); castUntil = now + 120; }
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
