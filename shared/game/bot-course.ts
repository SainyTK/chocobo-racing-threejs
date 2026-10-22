import { clamp, mod } from '../math.ts';
import { TRACKS } from '../track/tracks.ts';
import { trackLength } from '../track/sampling.ts';
import { courseLayout } from '../track/layouts/index.ts';
import { hazardState } from '../track/hazards.ts';
import { shortcutPaths, shortcutPoint, type ShortcutPath } from '../track/shortcuts.ts';
import { MAIN_ROUTE, routePoint } from '../track/route.ts';
import { along, gapBeyond } from '../track/surface.ts';
import type { Hazard, TrackPoint } from '../track/types.ts';
import { DIFFICULTIES } from './difficulty.ts';
import type { Race, Racer } from './types.ts';

/** Where a CPU racer aims, the speed it should brake down to while a timed hazard passes (Infinity for none), and whether it is on a shortcut. */
export interface CourseLine { target: Pick<TrackPoint, 'x' | 'z'>; limit: number; shortcut: boolean }

/** A cheap deterministic coin, so CPU choices differ per racer and lap but replay identically. */
const coin = (a: number, b: number, c: number) => mod(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453, 1);

/** Metres a CPU racer keeps between its lane and a hazard's edge: room for its own width and for running a little wide. */
const BERTH = 2.2;

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
  const struck = (x: number, within: number, list: Hazard[]) => list.some(h => ahead(h.s, -2, within) && dangerous(h, r.time + Math.max(0, along(r.track, p.routeS, h.s)) / speed, x, BERTH));
  const dodged = watched.filter(h => h.motion !== 'cross'), held = dodged.filter(h => h.motion !== 'sweep'), crossing = watched.filter(h => h.motion === 'cross');
  const free = lanes.find(x => !struck(x, 60, dodged) && !muddy(x)) ?? lanes.find(x => !struck(x, 60, dodged));
  // Waiting starts about a second out, early enough to brake from racing speed.
  const reach = Math.max(22, speed * 1.2), close = Math.max(14, speed * .7);
  const wait = struck(p.x, reach, crossing) || struck(p.x, reach + 10, held) && (free === undefined || Math.abs(free - p.x) > 3.5 && struck(p.x, reach, held));
  // Crawl towards it, and stop short when it is close, until it stops striking.
  return { lane: free ?? lane, limit: !wait ? Infinity : struck(p.x, close, [...held, ...crossing]) ? 2 : 12 };
}

/** How often a CPU racer takes a shortcut it reaches. One with a drop at its edges is a risk, so easier classes take it far more rarely. */
const shortcutChance = (r: Race, path: ShortcutPath) => DIFFICULTIES[r.difficulty].cpuShortcut ** (path.shortcut.edge === 'fall' ? 2 : 1);

/** Speed a CPU racer slows to for the turn into a shortcut: 30 m/s for the usual 20 degree join, slower for a sharper one. */
const entrySpeed = (join: number) => 30 * Math.sqrt(Math.min(1, 20 / join));
/** Metres before a shortcut's mouth where a CPU racer turns in: 8 m for the usual 20 degree join, further out for a sharper one. */
const turnIn = (join: number) => 8 + Math.max(0, join - 20) * .4;
/** Where across the road a CPU racer lines up for a shortcut, as a share of the way to its edge: the near edge for a shallow join, the far side for a sharp one. */
const lineUp = (join: number) => clamp((40 - join) / 20, -.6, 1);

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
    const path = paths[p.route], sc = path.shortcut, u = mod(p.routeS + look - sc.from, len) / path.skipped;
    // Off its centre line, after a wide turn in or a drop onto it, a racer slows to its entry speed until it has lined up again.
    const wide = Math.abs(p.x) > sc.width * .4 ? entrySpeed(sc.join) : Infinity;
    if (u < 1) return { target: shortcutPoint(path, u, 0), limit: Math.min(wide, shortcutSpeed(path, mod(p.routeS - sc.from, len) / path.skipped)), shortcut: true };
  }
  for (const [k, path] of paths.entries()) {
    const to = along(r.track, p.routeS, path.shortcut.from);
    // Well past the mouth without having turned in, the chance is gone: chasing it would send the racer the wrong way, or off the
    // road edge beside a shortcut that turns away sharply, so the sharper its join the sooner a racer gives up.
    // A racer just rescued (perhaps from this very shortcut) keeps to the road for a while.
    // So does a racer that is boosting before the mouth, or too fast to slow for the turn in.
    const entry = entrySpeed(path.shortcut.join), braking = (p.speed * p.speed - entry * entry) / 50;
    if (to > look + 60 || to < -path.skipped * .15 * Math.min(1, 20 / path.shortcut.join) || r.time - p.lastRescue < 12 || to > 0 && p.boost > 0 || to > turnIn(path.shortcut.join) && braking > to - 6 || coin(i, k + 7, p.lap) >= shortcutChance(r, path)) continue;
    // Line up along that edge of the road first, then turn in at the mouth, so the turn is gentle enough to make at speed.
    // It also eases off for the turn in, braking early enough to be down to its entry speed at the mouth.
    // For a sharp join it lines up on the far side instead and starts the turn further out, so the turn is a wide arc across the road.
    if (to > turnIn(path.shortcut.join)) return { target: routePoint(r.track, MAIN_ROUTE, p.routeS + look, path.shortcut.side * (TRACKS[r.track].width - 1.2) * lineUp(path.shortcut.join)), limit: to < Math.max(18, braking + 10) ? entry : Infinity, shortcut: false };
    return { target: shortcutPoint(path, clamp((look - to) / path.skipped, .2, 1), 0), limit: entry, shortcut: false };
  }
  // Past the mouth of a railless shortcut it is not taking, it keeps to the other half of the road: running wide there drops it off the edge.
  const mouth = paths.find(path => path.shortcut.edge === 'fall' && along(r.track, p.routeS, path.shortcut.from) > -10 && along(r.track, p.routeS, path.shortcut.from) < 60);
  const kept = mouth ? (mouth.shortcut.side > 0 ? Math.min(lane, 0) : Math.max(lane, 0)) : lane;
  const gapRamp = layout.ramps.find(ramp => gapBeyond(r.track, ramp) && along(r.track, p.routeS, ramp.s) > -2 && along(r.track, p.routeS, ramp.s) < 70);
  const line = gapRamp ? { lane: gapRamp.x, limit: Infinity } : clearLane(r, p, i, kept);
  return { target: routePoint(r.track, MAIN_ROUTE, p.routeS + look, clamp(line.lane, -TRACKS[r.track].width + 1, TRACKS[r.track].width - 1)), limit: line.limit, shortcut: false };
}
