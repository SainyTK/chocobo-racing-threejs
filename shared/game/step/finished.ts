import { angleDelta, clamp, mod } from '../../math.ts';
import { TRACKS } from '../../track/tracks.ts';
import { pointAt, projectOnTrack, trackLength } from '../../track/sampling.ts';
import type { Race, Racer } from '../types.ts';

/** How far from the road edge finishers park, in metres. */
const KERB = 2.5;

/**
 * A racer past the finish line coasts to a stop at the roadside instead of freezing on the line,
 * alternating sides in finishing order, so later finishers never stop inside an earlier one.
 */
export function stepFinished(r: Race, p: Racer, dt: number) {
  p.drifting = false; p.drift = 0; p.boost = 0;
  for (const key of ['stun', 'mini', 'flying', 'shield', 'charging', 'flare', 'slash', 'invincible', 'gripUp'] as const) p[key] = Math.max(0, p[key] - dt);
  if (p.speed <= 0) { p.vx = p.vz = 0; return; }
  const order = r.racers.filter(q => q.finishTime !== null && q.finishTime < p.finishTime!).length, side = order % 2 ? 1 : -1;
  const aim = pointAt(r.track, p.s + 14, side * (TRACKS[r.track].width - KERB));
  p.yaw += clamp(angleDelta(Math.atan2(aim.x - p.px, aim.z - p.pz), p.yaw), -dt * 1.5, dt * 1.5);
  p.speed = Math.max(0, p.speed - (6 + p.speed * .25) * dt);
  p.vx = Math.sin(p.yaw) * p.speed; p.vz = Math.cos(p.yaw) * p.speed; p.px += p.vx * dt; p.pz += p.vz * dt;
  const at = projectOnTrack(r.track, p.px, p.pz, p.routeS), len = trackLength(r.track);
  p.s += mod(at.s - p.routeS + len / 2, len) - len / 2; p.routeS = at.s; p.x = at.offset;
}
