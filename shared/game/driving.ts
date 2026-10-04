import { mod } from '../math.ts';
import { TRACKS } from '../track/tracks.ts';
import type { TrackId } from '../track/types.ts';
import { aboveGround } from './combat.ts';
import { RACERS } from './racers.ts';
import type { Racer } from './types.ts';
/** Driving only. No inventory, events, collisions, RNG, abilities or race results.
 * Both authority and prediction use this velocity/steering integration. */
export function integrateDriving(track: TrackId, p: Racer, dt: number) {
  const def = TRACKS[track], ch = RACERS[p.character], input = p.input;
  const oldForward = p.vx * Math.sin(p.yaw) + p.vz * Math.cos(p.yaw);
  const turn = ch.steering * (p.gripUp > 0 ? 1.25 : 1) * (p.drifting ? 1.45 : 1) * Math.min(1, Math.abs(oldForward) / 8) / (1 + p.speed / 115);
  if (p.stun <= 0) p.yaw = mod(p.yaw + input.steer * turn * dt * (oldForward < -1 ? -1 : 1) + Math.PI, Math.PI * 2) - Math.PI;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = fz, rz = -fx;
  let forward = p.vx * fx + p.vz * fz, lateral = p.vx * rx + p.vz * rz;
  const onGrass = Math.abs(p.x) > def.width, maxSpeed = ch.speed * (p.boost > 0 ? 1.55 : 1) * (p.mini > 0 ? 1 - p.miniLevel * .17 : 1) * (onGrass && !aboveGround(p) ? .5 : 1);
  if (p.stun > 0) { forward *= Math.exp(-dt * 4); lateral *= Math.exp(-dt * 4); }
  else {
    const accel = ch.acceleration * (p.gripUp > 0 ? 1.45 : 1) * (p.boost > 0 ? 1.5 : 1);
    if (input.reverse) forward = Math.max(-11, forward - accel * dt);
    else if (input.throttle && (!input.brake || p.drifting)) forward = Math.min(maxSpeed, forward + accel * dt);
    else if (input.brake) forward -= Math.sign(forward) * Math.min(Math.abs(forward), 47 * dt);
    else forward -= Math.sign(forward) * Math.min(Math.abs(forward), 10 * dt);
    if (forward > maxSpeed) forward = Math.max(maxSpeed, forward - 35 * dt);
    lateral *= Math.exp(-dt * ch.grip * (p.drifting ? .22 : 1) * (p.gripUp > 0 ? 1.6 : 1));
  }
  p.vx = fx * forward + rx * lateral; p.vz = fz * forward + rz * lateral;
  p.px += p.vx * dt; p.pz += p.vz * dt; p.speed = Math.hypot(p.vx, p.vz);
}
