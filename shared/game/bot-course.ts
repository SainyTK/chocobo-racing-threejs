import { clamp, mod } from '../math.ts';
import { TRACKS } from '../track/tracks.ts';
import { trackLength } from '../track/sampling.ts';
import { courseLayout } from '../track/layouts/index.ts';
import { hazardState } from '../track/hazards.ts';
import { shortcutPaths, shortcutPoint, type ShortcutPath } from '../track/shortcuts.ts';
import { MAIN_ROUTE, routePoint } from '../track/route.ts';
import { along } from '../track/surface.ts';
import type { Hazard, TrackPoint } from '../track/types.ts';
import { DIFFICULTIES } from './difficulty.ts';
import type { Race, Racer } from './types.ts';

/** Where a CPU racer aims, the speed it should brake down to while a timed hazard passes (Infinity for none), and whether it is on a shortcut. */
export interface CourseLine { target: Pick<TrackPoint, 'x' | 'z'>; limit: number; shortcut: boolean }

/** A cheap deterministic coin, so CPU choices differ per racer and lap but replay identically. */
const coin = (a: number, b: number, c: number) => mod(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453, 1);

/** Whether a hazard is live in lane `x` around `time`. A crossing hazard closes the whole road while it runs, like a level crossing. */
function dangerous(h: Hazard, time: number, x: number, margin: number) {
  for (const dt of [-.35, 0, .35]) { const st = hazardState(h, time + dt); if (st.live && (h.motion === 'cross' || Math.abs(x - st.x) < h.width / 2 + margin)) return true; }
  return false;
}

/**
 * Picks the lane nearest `lane` that is clear of timed hazards, and of patches where it can, and sets a speed limit to wait for a hazard
 * it cannot get around in time. Crossing hazards (carts) are waited for and never dodged.
 * A sweeping hazard is never waited for, since stopping in its path is worse than driving through.
 */
function clearLane(r: Race, p: Racer, i: number, lane: number) {
  const layout = courseLayout(r.track), w = TRACKS[r.track].width, speed = Math.max(12, p.speed);
  const lanes = [lane, ...[-1, -.75, -.5, -.25, 0, .25, .5, .75, 1].map(k => k * (w - 1.4)).sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane))];
  const ahead = (s: number, from: number, to: number) => { const a = along(r.track, p.routeS, s); return a > from && a < to; };
  const muddy = (x: number) => layout.patches.some(patch => ahead(patch.s + patch.length / 2, -patch.length / 2, 40 + patch.length / 2) && Math.abs(x - patch.x) < patch.width / 2 + 1.2);
  // Each CPU racer misreads some hazards each lap, more on easier classes, so they still get caught now and then.
  const watched = layout.hazards.filter((h, k) => ahead(h.s, -2, 60) && coin(i, k, p.lap) >= DIFFICULTIES[r.difficulty].cpuMisread);
  const struck = (x: number, within: number, list: Hazard[]) => list.some(h => ahead(h.s, -2, within) && dangerous(h, r.time + Math.max(0, along(r.track, p.routeS, h.s)) / speed, x, 1.6));
  const dodged = watched.filter(h => h.motion !== 'cross'), held = dodged.filter(h => h.motion !== 'sweep'), crossing = watched.filter(h => h.motion === 'cross');
  const free = lanes.find(x => !struck(x, 60, dodged) && !muddy(x)) ?? lanes.find(x => !struck(x, 60, dodged));
  // Waiting starts about a second out, early enough to brake from racing speed.
  const reach = Math.max(22, speed * 1.2), close = Math.max(14, speed * .7);
  const wait = struck(p.x, reach, crossing) || struck(p.x, reach + 10, held) && (free === undefined || Math.abs(free - p.x) > 3.5 && struck(p.x, reach, held));
  // Crawl towards it, and stop short when it is close, until it stops striking.
  return { lane: free ?? lane, limit: !wait ? Infinity : struck(p.x, close, [...held, ...crossing]) ? 2 : 12 };
}

/** Lateral acceleration a CPU racer plans for along a shortcut's bends, in m/s², a little under every racer's grip. */
const SHORTCUT_GRIP = 22;
/** Fastest a CPU racer should take the next stretch of a shortcut, from how far its centre line turns over each 20 m. */
function shortcutSpeed(path: ShortcutPath, u: number) {
  let sharpest = .001;
  for (let d = 0; d <= 30; d += 10) {
    const a = shortcutPoint(path, u + d / path.length), b = shortcutPoint(path, u + (d + 20) / path.length);
    sharpest = Math.max(sharpest, Math.abs(Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw))) / 20);
  }
  return Math.sqrt(SHORTCUT_GRIP / sharpest);
}

/**
 * Course-aware steering target for a CPU racer `look` metres ahead: follows a shortcut it is on, turns into one it has chosen,
 * stays on ramps that clear a gap, and dodges patches and timed hazards or waits for them. Choices are deterministic per racer and lap.
 * Distances are measured from `routeS`, where the racer is, since its lap progress `s` can lag that after a jump in the projection.
 */
export function courseLine(r: Race, p: Racer, lane: number, look: number): CourseLine {
  const len = trackLength(r.track), i = r.racers.indexOf(p), paths = shortcutPaths(r.track), layout = courseLayout(r.track);
  if (p.route !== MAIN_ROUTE) {
    const path = paths[p.route], u = mod(p.routeS + look - path.shortcut.from, len) / path.skipped;
    if (u < 1) return { target: shortcutPoint(path, u, 0), limit: shortcutSpeed(path, mod(p.routeS - path.shortcut.from, len) / path.skipped), shortcut: true };
  }
  for (const [k, path] of paths.entries()) {
    const to = along(r.track, p.routeS, path.shortcut.from);
    // Well past the mouth without having turned in, the chance is gone: chasing it would send the racer the wrong way.
    // A racer just rescued (perhaps from this very shortcut) keeps to the road for a while.
    if (to > look + 60 || to < -path.skipped * .15 || r.time - p.lastRescue < 12 || coin(i, k + 7, p.lap) >= DIFFICULTIES[r.difficulty].cpuShortcut) continue;
    // Line up along that edge of the road first, then turn in at the mouth, so the turn is gentle enough to make at speed.
    // It also eases off for the turn in, braking early enough to be down to 30 m/s at the mouth.
    if (to > 8) return { target: routePoint(r.track, MAIN_ROUTE, p.routeS + look, path.shortcut.side * (TRACKS[r.track].width - 1.2)), limit: to < Math.max(18, (p.speed * p.speed - 900) / 50 + 10) ? 30 : Infinity, shortcut: false };
    return { target: shortcutPoint(path, clamp((look - to) / path.skipped, .2, 1), 0), limit: 30, shortcut: false };
  }
  const gapRamp = layout.ramps.find(ramp => layout.gaps.some(g => Math.abs(along(r.track, ramp.s, g.s)) < 10) && along(r.track, p.routeS, ramp.s) > -2 && along(r.track, p.routeS, ramp.s) < 70);
  const line = gapRamp ? { lane: gapRamp.x, limit: Infinity } : clearLane(r, p, i, lane);
  return { target: routePoint(r.track, MAIN_ROUTE, p.routeS + look, clamp(line.lane, -TRACKS[r.track].width + 1, TRACKS[r.track].width - 1)), limit: line.limit, shortcut: false };
}
