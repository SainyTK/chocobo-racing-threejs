import { courseLayout } from '../track/layouts/index.ts';
import { MAIN_ROUTE } from '../track/route.ts';
import { along, gapBeyond, inGap, rampAt } from '../track/surface.ts';
import { pointAt } from '../track/sampling.ts';
import type { Ramp, TrackId } from '../track/types.ts';
import type { Racer } from './types.ts';

/** Downward acceleration while airborne, in m/s². Stronger than real gravity, so jumps feel snappy at racing speed. */
export const GRAVITY = 30;
/** Forward speed above which a ramp throws no higher, in m/s. */
const LAUNCH_CAP = 40;

/** Metres a racer must carry past the far edge of a gap before it lands. */
const LANDING_MARGIN = 3;
/**
 * Forward speed at the lip that lands a racer beyond the gap this ramp leads over (0 when it leads over none): the lowest speed whose
 * throw of `lift` times speed, from the lip height, carries past the gap's far edge. Found by bisection, so it is deterministic.
 */
function clearingSpeed(track: TrackId, ramp: Ramp) {
  const gap = gapBeyond(track, ramp);
  if (!gap) return 0;
  const reach = along(track, ramp.s, gap.s) + gap.length + LANDING_MARGIN;
  const carry = (v: number) => { const up = ramp.lift * Math.min(LAUNCH_CAP, v); return v * (up + Math.sqrt(up * up + 2 * GRAVITY * ramp.height)) / GRAVITY; };
  let lo = 0, hi = LAUNCH_CAP;
  for (let n = 0; n < 30; n++) { const mid = (lo + hi) / 2; if (carry(mid) < reach) lo = mid; else hi = mid; }
  return hi;
}

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
    const forward = Math.max(0, p.vx * Math.sin(p.yaw) + p.vz * Math.cos(p.yaw));
    // A ramp that leads over a gap is a spring: whoever takes it at any speed is thrown along the road far enough to land beyond the gap.
    const road = pointAt(track, p.routeS).yaw, rx = Math.sin(road), rz = Math.cos(road);
    const kick = lip ? Math.max(0, clearingSpeed(track, lip) - Math.max(0, p.vx * rx + p.vz * rz)) : 0;
    p.vx += rx * kick; p.vz += rz * kick; p.speed = Math.hypot(p.vx, p.vz);
    // The throw is capped at top racing speed, so a boost into the lip carries further but does not send a racer into orbit.
    p.vy = lip ? lip.lift * Math.min(LAUNCH_CAP, forward + kick) : 0;
  }
  p.vy -= GRAVITY * dt; p.alt += p.vy * dt;
  return p.alt > ground ? false : touchdown();
}
