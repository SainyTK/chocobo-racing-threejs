import { mod } from '../math.ts';
import type { TrackId } from '../track/types.ts';
import { RACERS } from './racers.ts';
import { traction } from './traction.ts';
import type { Racer } from './types.ts';
/** Driving only. No inventory, events, collisions, RNG, abilities or race results.
 * Both authority and prediction use this velocity/steering integration. */
export function integrateDriving(track: TrackId, p: Racer, dt: number) {
  const ch = RACERS[p.character], input = p.input, ground = traction(track, p);
  const oldForward = p.vx * Math.sin(p.yaw) + p.vz * Math.cos(p.yaw);
  const turn = ground.steer * ch.steering * (p.gripUp > 0 ? 1.25 : 1) * (p.drifting ? 1.45 : 1) * Math.min(1, Math.abs(oldForward) / 8) / (1 + p.speed / 115);
  if (p.stun <= 0) p.yaw = mod(p.yaw + input.steer * turn * dt * (oldForward < -1 ? -1 : 1) + Math.PI, Math.PI * 2) - Math.PI;
  // In the air the vehicle can turn to line up its landing, but nothing pushes it along.
  if (ground.air) { p.px += p.vx * dt; p.pz += p.vz * dt; p.speed = Math.hypot(p.vx, p.vz); return; }
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = fz, rz = -fx;
  let forward = p.vx * fx + p.vz * fz, lateral = p.vx * rx + p.vz * rz;
  const maxSpeed = ground.top * ch.speed * (p.boost > 0 ? 1.55 : 1) * (p.mini > 0 ? 1 - p.miniLevel * .17 : 1);
  if (p.stun > 0) { forward *= Math.exp(-dt * 4); lateral *= Math.exp(-dt * 4); }
  else {
    const accel = ground.accel * ch.acceleration * (p.gripUp > 0 ? 1.45 : 1) * (p.boost > 0 ? 1.5 : 1);
    if (input.reverse) forward = Math.max(-11, forward - accel * dt);
    else if (input.throttle && (!input.brake || p.drifting)) forward = Math.min(maxSpeed, forward + accel * dt);
    else if (input.brake) forward -= Math.sign(forward) * Math.min(Math.abs(forward), 47 * dt);
    else forward -= Math.sign(forward) * Math.min(Math.abs(forward), 10 * dt);
    if (forward > maxSpeed) forward = Math.max(maxSpeed, forward - 35 * dt);
    lateral *= Math.exp(-dt * ground.grip * ch.grip * (p.drifting ? .22 : 1) * (p.gripUp > 0 ? 1.6 : 1));
  }
  p.vx = fx * forward + rx * lateral; p.vz = fz * forward + rz * lateral;
  p.px += p.vx * dt; p.pz += p.vz * dt; p.speed = Math.hypot(p.vx, p.vz);
}
