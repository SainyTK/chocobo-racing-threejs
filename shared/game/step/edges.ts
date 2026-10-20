import { TRACKS } from '../../track/tracks.ts';
import { shortcutPaths } from '../../track/shortcuts.ts';
import type { Place } from '../../track/route.ts';
import type { TrackId } from '../../track/types.ts';
import type { Racer } from '../types.ts';

/** What the course edge did to a racer this tick: `wall` carries the impact speed into the wall. */
export type EdgeContact = { kind: 'wall'; impact: number } | { kind: 'fall' } | null;

/** Pushes a racer back off a wall, inward along the edge normal, keeping its heading. */
function bounce(p: Racer, cx: number, cz: number, nx: number, nz: number, side: number, reach: number) {
  const outward = (p.vx * nx + p.vz * nz) * side;
  p.px = cx + nx * side * reach; p.pz = cz + nz * side * reach;
  if (outward > 0) { p.vx -= nx * side * outward * 1.25; p.vz -= nz * side * outward * 1.25; p.vx *= .82; p.vz *= .82; }
  return outward;
}

/**
 * Applies the edge of whichever route the racer is on: the main road's walls or cliffs, or a shortcut's own wall, drop or rough ground.
 * Where a shortcut overlaps the road its walls give way to the road, so racers can always drive in and out of its mouth.
 */
export function keepOnCourse(track: TrackId, p: Racer, place: Place): EdgeContact {
  const def = TRACKS[track], grounded = p.alt <= 0;
  if (place.shortcut) {
    const sc = shortcutPaths(track)[place.route].shortcut, q = place.shortcut, outside = Math.abs(q.x) - sc.width;
    if (outside <= 0 || Math.abs(place.main.offset) < def.width + .3) return null;
    if (sc.edge === 'wall') { const side = Math.sign(q.x), impact = bounce(p, q.px, q.pz, q.nx, q.nz, side, sc.width - .05); p.x = side * (sc.width - .05); return { kind: 'wall', impact }; }
    if (sc.edge === 'fall' && outside > 2 && grounded && p.flying <= 0) return { kind: 'fall' };
    return null;
  }
  const m = place.main;
  if (def.wall && Math.abs(p.x) > def.width + .7) { const side = Math.sign(p.x); return { kind: 'wall', impact: bounce(p, m.px, m.pz, m.nx, m.nz, side, def.width + .65) }; }
  if ((def.cliff && Math.abs(p.x) > def.width + 5 || Math.abs(p.x) > def.width + 35) && grounded && p.flying <= 0) return { kind: 'fall' };
  return null;
}
