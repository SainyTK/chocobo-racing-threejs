import { mod } from '../math.ts';
import type { Patch, PatchSurface, Ramp, TrackId } from './types.ts';
import { trackLength } from './sampling.ts';
import { courseLayout } from './layouts/index.ts';

/** Signed distance along the lap from `from` to `s`, wrapped to the nearer way round. */
export const along = (id: TrackId, from: number, s: number) => { const len = trackLength(id); return mod(s - from + len / 2, len) - len / 2; };

/** The special surface under a main-road position, if any. */
export function patchAt(id: TrackId, s: number, x: number): PatchSurface | null {
  const hit = courseLayout(id).patches.find((p: Patch) => { const a = along(id, p.s, s); return a >= 0 && a <= p.length && Math.abs(x - p.x) <= p.width / 2; });
  return hit?.surface ?? null;
}

/** The ramp whose wedge is under a main-road position, and how high its surface is there. */
export function rampAt(id: TrackId, s: number, x: number): { ramp: Ramp; height: number } | null {
  for (const ramp of courseLayout(id).ramps) {
    const a = along(id, ramp.s, s);
    if (a > -ramp.length && a <= 0 && Math.abs(x - ramp.x) <= ramp.width / 2) return { ramp, height: ramp.height * (1 + a / ramp.length) };
  }
  return null;
}

/** True over a chasm in the course. */
export function inGap(id: TrackId, s: number) { return courseLayout(id).gaps.some(g => { const a = along(id, g.s, s); return a >= 0 && a <= g.length; }); }

/** The gap a ramp leads over: one starting within 10 m of its lip, if any. */
export function gapBeyond(id: TrackId, ramp: Ramp) { return courseLayout(id).gaps.find(g => Math.abs(along(id, ramp.s, g.s)) < 10); }

/** Run-up a racer needs from a standstill to clear a gap. */
const RUN_UP = 75;
/** Moves a restart point back before any gap it would leave too short a run-up for, so a rescued racer can always make the jump. */
export function restartPoint(id: TrackId, s: number) {
  for (const g of courseLayout(id).gaps) { const a = along(id, g.s - RUN_UP, s); if (a > 0 && a < RUN_UP + g.length) return s - a; }
  return s;
}
