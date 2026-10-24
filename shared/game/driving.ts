import { mod } from '../math.ts';
import type { TrackId } from '../track/types.ts';
import { cornerGrip, steerRate, HANDLING as H } from './handling.ts';
import { miniScale } from './mini.ts';
import { RACERS } from './racers.ts';
import { traction } from './traction.ts';
import type { Racer } from './types.ts';

/** Speed along the racer's heading: negative while it rolls backwards. */
const forwardSpeed = (p: Racer) => p.vx * Math.sin(p.yaw) + p.vz * Math.cos(p.yaw);
/**
 * One pedal brakes and reverses, as in most racing games: held without the accelerator it slows a racer moving forward,
 * and once the racer has stopped or rolls backwards it drives in reverse.
 */
const reversing = (p: Racer, forward: number) => p.input.brake && !p.input.throttle && forward <= 0;

/** Reads the held input into the drive mode: drifting, and the sharp-turn window opened by brake taps while steering. */
export function updateDriveMode(p: Racer, dt: number) {
  const input = p.input, steering = Math.abs(input.steer) > .12 && p.speed > 9 && p.stun <= 0;
  p.sharp = Math.max(0, p.sharp - dt);
  if (input.brake && !p.lastBrake && steering && !reversing(p, forwardSpeed(p))) {
    p.sharpTaps = p.sharp > 0 ? Math.min(H.sharpTaps, p.sharpTaps + 1) : 1; p.sharp = H.sharpWindow;
    const keep = Math.max(0, 1 - H.sharpScrub / p.speed); p.vx *= keep; p.vz *= keep;
  }
  if (p.sharp <= 0) p.sharpTaps = 0;
  p.lastBrake = input.brake;
  p.drifting = (input.drift || input.throttle && input.brake) && steering;
}

/** Driving only. No inventory, events, collisions, RNG, abilities or race results.
 * Both authority and prediction use this velocity/steering integration.
 * Grip limits lateral acceleration, so a corner taken too fast runs wide. Brake taps and drifts raise the limit at a speed cost. */
export function integrateDriving(track: TrackId, p: Racer, dt: number) {
  const ch = RACERS[p.character], input = p.input, ground = traction(track, p);
  const oldForward = forwardSpeed(p), grip = cornerGrip(p) * ground.grip;
  const limit = grip * (p.drifting ? H.driftGrip : 1 + H.sharpGain * p.sharpTaps);
  let turn = ground.steer * steerRate(p, oldForward);
  // Without a drift the nose only turns as fast as the tyres can turn the velocity.
  // In the air there are no tyres: the vehicle can still turn to line up its landing.
  if (!p.drifting && !ground.air) turn = Math.min(turn, limit / Math.max(1, Math.abs(oldForward)));
  if (p.stun <= 0) p.yaw = mod(p.yaw + input.steer * turn * dt * (oldForward < -1 ? -1 : 1) + Math.PI, Math.PI * 2) - Math.PI;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = fz, rz = -fx;
  let forward = p.vx * fx + p.vz * fz, lateral = p.vx * rx + p.vz * rz;
  const rough = ground.top < 1, maxSpeed = ch.speed * p.pace * (p.boost > 0 ? H.boostSpeed : 1) * miniScale(p) * ground.top;
  if (p.boost > 0 && !p.boosted && p.stun <= 0 && !ground.air) forward = Math.max(forward, Math.min(maxSpeed, forward + H.boostKick));
  p.boosted = p.boost > 0;
  // In the air nothing pushes the vehicle along; it keeps its velocity until it lands.
  if (ground.air) { p.px += p.vx * dt; p.pz += p.vz * dt; p.speed = Math.hypot(p.vx, p.vz); return; }
  if (p.stun > 0) { forward *= Math.exp(-dt * 4); lateral *= Math.exp(-dt * 4); }
  else {
    const accel = ground.accel * ch.acceleration * (p.gripUp > 0 ? 1.45 : 1) * (p.boost > 0 ? H.boostAccel : 1) * (p.drifting || p.sharp > 0 ? H.slideAccel : 1);
    if (reversing(p, forward)) forward = Math.max(-11, forward - accel * dt);
    else if (input.throttle && (!input.brake || p.drifting)) forward = Math.min(Math.max(maxSpeed, forward), forward + accel * dt);
    else if (input.brake) forward -= Math.sign(forward) * Math.min(Math.abs(forward), H.brake * dt);
    else forward -= Math.sign(forward) * Math.min(Math.abs(forward), H.coast * dt);
    if (forward > maxSpeed) forward = Math.max(maxSpeed, forward - (rough ? H.grassBleed : H.overSpeedBleed) * dt);
    // Tyres cancel sideways speed up to the current limit. A drift carries part of the slide into the new heading.
    const removed = Math.min(Math.abs(lateral), limit * dt), used = removed / dt;
    lateral -= Math.sign(lateral) * removed;
    if (p.drifting && forward > 0) forward = Math.max(0, forward + removed * H.driftCarry - H.driftDrag * dt);
    if (used > grip && forward > 0) forward = Math.max(0, forward - (used - grip) * H.overGripScrub * dt);
  }
  p.vx = fx * forward + rx * lateral; p.vz = fz * forward + rz * lateral;
  p.px += p.vx * dt; p.pz += p.vz * dt; p.speed = Math.hypot(p.vx, p.vz);
}
