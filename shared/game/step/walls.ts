import { TRACKS } from '../../track/tracks.ts';
import type { Projection } from '../../track/types.ts';
import { event } from '../events.ts';
import type { Race, Racer } from '../types.ts';

/** Keeps a racer inside a walled road. The outward speed bounces back and the hit costs speed in proportion to
 * how hard it was; a long scrape bleeds speed too. Grip-Up glances off with little loss. */
export function bounceOffWall(r: Race, p: Racer, projection: Projection) {
  const width = TRACKS[r.track].width, side = Math.sign(p.x), nx = projection.nx * side, nz = projection.nz * side, outward = p.vx * nx + p.vz * nz;
  p.px = projection.px + nx * (width + .65); p.pz = projection.pz + nz * (width + .65);
  if (outward <= 0) return;
  p.vx -= nx * outward * 1.3; p.vz -= nz * outward * 1.3;
  const keep = 1 - Math.min(.45, .02 + outward * .024) * (p.gripUp > 0 ? .3 : 1);
  p.vx *= keep; p.vz *= keep; p.speed = Math.hypot(p.vx, p.vz);
  if (outward > 6 && p.wallCooldown <= 0) { p.wallCooldown = .7; event(r, p, 'wall', 'Wall hit!'); }
}
