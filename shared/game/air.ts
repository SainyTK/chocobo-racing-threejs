import { courseLayout } from '../track/layouts/index.ts';
import { MAIN_ROUTE } from '../track/route.ts';
import { along, inGap, rampAt } from '../track/surface.ts';
import type { TrackId } from '../track/types.ts';
import type { Racer } from './types.ts';

/** Downward acceleration while airborne, in m/s². Stronger than real gravity, so jumps feel snappy at racing speed. */
export const GRAVITY = 30;
/** Forward speed above which a ramp throws no higher, in m/s. */
const LAUNCH_CAP = 40;

/** True while a racer is off the ground: thrown from a ramp, or dropping off a lip. A grounded racer has no vertical speed. */
export const airborne = (p: Racer) => p.vy !== 0;

/**
 * Vertical motion. Racers ride up ramp wedges, leave the lip with an upward throw that grows with their forward speed,
 * fly ballistically and land. Touching down inside a gap is a fall (returns true) unless the racer is flying.
 * Pure and deterministic; client prediction runs the same step.
 */
export function stepAir(track: TrackId, p: Racer, dt: number) {
  const onMain = p.route === MAIN_ROUTE, ground = onMain ? rampAt(track, p.routeS, p.x)?.height ?? 0 : 0;
  const touchdown = () => { p.alt = ground; p.vy = 0; return onMain && p.flying <= 0 && inGap(track, p.routeS); };
  if (!airborne(p)) {
    if (p.alt <= ground + .02) return touchdown();
    // The surface fell away under the racer: past a ramp's lip, it takes off.
    const lip = onMain ? courseLayout(track).ramps.find(r => { const a = along(track, r.s, p.routeS); return a > 0 && a < 4 && Math.abs(p.x - r.x) <= r.width / 2 + 1; }) : undefined;
    // The throw is capped at top racing speed, so a boost into the lip carries further but does not send a racer into orbit.
    p.vy = lip ? lip.lift * Math.min(LAUNCH_CAP, Math.max(0, p.vx * Math.sin(p.yaw) + p.vz * Math.cos(p.yaw))) : 0;
  }
  p.vy -= GRAVITY * dt; p.alt += p.vy * dt;
  return p.alt > ground ? false : touchdown();
}
