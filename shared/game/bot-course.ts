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

/** Where a CPU racer aims, and whether it should lift off to let a timed hazard pass first. */
export interface CourseLine { target: Pick<TrackPoint, 'x' | 'z'>; brake: boolean; shortcut: boolean }

/** A cheap deterministic coin, so CPU choices differ per racer and lap but replay identically. */
const coin = (a: number, b: number, c: number) => mod(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453, 1);

function dangerous(h: Hazard, time: number, x: number, margin: number) {
  for (const dt of [-.35, 0, .35]) { const st = hazardState(h, time + dt); if (st.live && Math.abs(x - st.x) < h.width / 2 + margin) return true; }
  return false;
}

/** Picks the lane nearest `lane` that is clear of hazards and patches over the next stretch; brakes when every lane is blocked. */
function clearLane(r: Race, p: Racer, i: number, lane: number) {
  const layout = courseLayout(r.track), w = TRACKS[r.track].width, speed = Math.max(12, p.speed);
  const lanes = [lane, ...[-.75, -.5, -.25, 0, .25, .5, .75].map(k => k * w).sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane))];
  const ahead = (s: number, from: number, to: number) => { const a = along(r.track, p.s, s); return a > from && a < to; };
  const blocked = (x: number) => {
    for (const patch of layout.patches) if (ahead(patch.s + patch.length / 2, -patch.length / 2, 40 + patch.length / 2) && Math.abs(x - patch.x) < patch.width / 2 + 1.2) return true;
    for (const [k, h] of layout.hazards.entries()) {
      // Each CPU racer misreads some hazards each lap, so they still get caught now and then.
      if (!ahead(h.s, -2, 50) || coin(i, k, p.lap) < .2) continue;
      if (dangerous(h, r.time + Math.max(0, along(r.track, p.s, h.s)) / speed, x, 1.6)) return true;
    }
    return false;
  };
  const free = lanes.find(x => !blocked(x));
  const brake = free === undefined && layout.hazards.some(h => ahead(h.s, 4, 30) && h.period);
  return { lane: free ?? lane, brake };
}

/**
 * Course-aware steering target for a CPU racer `look` metres ahead: follows a shortcut it is on, turns into one it has chosen,
 * stays on ramps that clear a gap, and dodges patches and timed hazards. Choices are deterministic per racer and lap.
 */
export function courseLine(r: Race, p: Racer, lane: number, look: number): CourseLine {
  const len = trackLength(r.track), i = r.racers.indexOf(p), paths = shortcutPaths(r.track), layout = courseLayout(r.track);
  if (p.route !== MAIN_ROUTE) {
    const path = paths[p.route], u = mod(p.s + look - path.shortcut.from, len) / path.skipped;
    if (u < 1) return { target: shortcutPoint(path, u, 0), brake: false, shortcut: true };
  }
  for (const [k, path] of paths.entries()) {
    const to = along(r.track, p.s, path.shortcut.from);
    if (to > look + 25 || to < -path.skipped * .3 || coin(i, k + 7, p.lap) < .35) continue;
    // Aim into the mouth from the road edge, then along the shortcut.
    const u = (look - to) / path.skipped;
    return { target: u > .06 ? shortcutPoint(path, u, 0) : routePoint(r.track, MAIN_ROUTE, path.shortcut.from + 4, path.shortcut.side * (TRACKS[r.track].width - 1)), brake: false, shortcut: false };
  }
  const gapRamp = layout.ramps.find(ramp => layout.gaps.some(g => Math.abs(along(r.track, ramp.s, g.s)) < 10) && along(r.track, p.s, ramp.s) > -2 && along(r.track, p.s, ramp.s) < 70);
  const line = gapRamp ? { lane: gapRamp.x, brake: false } : clearLane(r, p, i, lane);
  return { target: routePoint(r.track, MAIN_ROUTE, p.s + look, clamp(line.lane, -TRACKS[r.track].width + 1, TRACKS[r.track].width - 1)), brake: line.brake, shortcut: false };
}
