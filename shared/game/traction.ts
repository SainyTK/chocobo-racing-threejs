import { TRACKS } from '../track/tracks.ts';
import { shortcutPaths } from '../track/shortcuts.ts';
import { patchAt } from '../track/surface.ts';
import type { PatchSurface, TrackId } from '../track/types.ts';
import { airborne } from './air.ts';
import { aboveGround } from './combat.ts';
import type { Racer } from './types.ts';

/** Multipliers the ground applies to a racer's driving: top speed, acceleration, sideways grip and steering. `air` means no contact at all. */
export interface Traction { top: number; accel: number; grip: number; steer: number; air: boolean }

const FIRM: Traction = { top: 1, accel: 1, grip: 1, steer: 1, air: false };
const AIR: Traction = { top: 1, accel: 0, grip: 0, steer: .45, air: true };
/** Grass and rough ground halve top speed; mud and goo drag; ice and syrup let the vehicle slide. */
const GROUND: Record<PatchSurface | 'rough', Traction> = {
  rough: { ...FIRM, top: .5 },
  slow: { ...FIRM, top: .45, accel: .5 },
  slip: { ...FIRM, grip: .3, steer: .7 },
};

/** The surface under a racer: the road, a shortcut, a patch, or the rough beyond the edge. */
function ground(track: TrackId, p: Racer): PatchSurface | 'rough' | null {
  if (p.route < 0) return Math.abs(p.x) > TRACKS[track].width ? 'rough' : patchAt(track, p.routeS, p.x);
  const sc = shortcutPaths(track)[p.route].shortcut;
  return Math.abs(p.x) <= sc.width ? sc.surface ?? null : sc.edge === 'rough' ? 'rough' : null;
}

/** How the ground under a racer affects its driving. Floating racers skim over grass and patches, but nobody steers well in mid-air. */
export function traction(track: TrackId, p: Racer): Traction {
  if (airborne(p)) return AIR;
  if (aboveGround(p)) return FIRM;
  const surface = ground(track, p);
  return surface ? GROUND[surface] : FIRM;
}
