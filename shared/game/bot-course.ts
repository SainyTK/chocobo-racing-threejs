import { clamp, mod } from '../math.ts';
import { TRACKS } from '../track/tracks.ts';
import { trackLength } from '../track/sampling.ts';
import { courseLayout } from '../track/layouts/index.ts';
import { hazardState } from '../track/hazards.ts';
import { shortcutPaths, shortcutPoint } from '../track/shortcuts.ts';
import { MAIN_ROUTE, routePoint } from '../track/route.ts';
import { along } from '../track/surface.ts';
import type { Hazard, TrackPoint } from '../track/types.ts';
import type { Race, Racer } from './types.ts';

/** Where a CPU racer aims, the speed it should brake down to while a timed hazard passes (Infinity for none), and whether it is on a shortcut. */
export interface CourseLine { target: Pick<TrackPoint, 'x' | 'z'>; limit: number; shortcut: boolean }

/** A cheap deterministic coin, so CPU choices differ per racer and lap but replay identically. */
const coin = (a: number, b: number, c: number) => mod(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453, 1);

function dangerous(h: Hazard, time: number, x: number, margin: number) {
  for (const dt of [-.35, 0, .35]) { const st = hazardState(h, time + dt); if (st.live && Math.abs(x - st.x) < h.width / 2 + margin) return true; }
  return false;
}

/**
 * Picks the lane nearest `lane` that is clear of timed hazards, and of patches where it can. Sets a speed limit to wait for a hazard
 * when every lane is blocked, or when the clear lane is too far across to reach before the hazard.
 */
function clearLane(r: Race, p: Racer, i: number, lane: number) {
  const layout = courseLayout(r.track), w = TRACKS[r.track].width, speed = Math.max(12, p.speed);
  const lanes = [lane, ...[-1, -.75, -.5, -.25, 0, .25, .5, .75, 1].map(k => k * (w - 1.4)).sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane))];
  const ahead = (s: number, from: number, to: number) => { const a = along(r.track, p.s, s); return a > from && a < to; };
  const muddy = (x: number) => layout.patches.some(patch => ahead(patch.s + patch.length / 2, -patch.length / 2, 40 + patch.length / 2) && Math.abs(x - patch.x) < patch.width / 2 + 1.2);
  // Each CPU racer misreads some hazards each lap, so they still get caught now and then.
  const watched = layout.hazards.filter((h, k) => ahead(h.s, -2, 50) && coin(i, k, p.lap) >= .2);
  const struck = (x: number, within = 50) => watched.some(h => ahead(h.s, -2, within) && dangerous(h, r.time + Math.max(0, along(r.track, p.s, h.s)) / speed, x, 1.6));
  const free = lanes.find(x => !struck(x) && !muddy(x)) ?? lanes.find(x => !struck(x));
  const wait = struck(p.x, 30) && (free === undefined || Math.abs(free - p.x) > 3.5 && struck(p.x, 22));
  // Crawl towards it, and stop short when it is close, until it stops striking.
  return { lane: free ?? lane, limit: !wait ? Infinity : struck(p.x, 14) ? 2 : 12 };
}

/**
 * Course-aware steering target for a CPU racer `look` metres ahead: follows a shortcut it is on, turns into one it has chosen,
 * stays on ramps that clear a gap, and dodges patches and timed hazards or waits for them. Choices are deterministic per racer and lap.
 */
export function courseLine(r: Race, p: Racer, lane: number, look: number): CourseLine {
  const len = trackLength(r.track), i = r.racers.indexOf(p), paths = shortcutPaths(r.track), layout = courseLayout(r.track);
  if (p.route !== MAIN_ROUTE) {
    const path = paths[p.route], u = mod(p.s + look - path.shortcut.from, len) / path.skipped;
    if (u < 1) return { target: shortcutPoint(path, u, 0), limit: Infinity, shortcut: true };
  }
  for (const [k, path] of paths.entries()) {
    const to = along(r.track, p.s, path.shortcut.from);
    if (to > look + 20 || to < -path.skipped * .3 || coin(i, k + 7, p.lap) < .35) continue;
    // Aim just inside the mouth until it is within reach, so the line crosses the road edge right at the opening, then along the shortcut.
    return { target: shortcutPoint(path, clamp((look - to) / path.skipped, .05, 1), 0), limit: Infinity, shortcut: false };
  }
  const gapRamp = layout.ramps.find(ramp => layout.gaps.some(g => Math.abs(along(r.track, ramp.s, g.s)) < 10) && along(r.track, p.s, ramp.s) > -2 && along(r.track, p.s, ramp.s) < 70);
  const line = gapRamp ? { lane: gapRamp.x, limit: Infinity } : clearLane(r, p, i, lane);
  return { target: routePoint(r.track, MAIN_ROUTE, p.s + look, clamp(line.lane, -TRACKS[r.track].width + 1, TRACKS[r.track].width - 1)), limit: line.limit, shortcut: false };
}
