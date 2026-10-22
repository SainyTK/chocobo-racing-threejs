import { clamp, angleDelta } from '../math.ts';
import { pointAt } from '../track/sampling.ts';
import { DIFFICULTIES } from './difficulty.ts';
import { cornerGrip, HANDLING as H } from './handling.ts';
import { RACERS } from './racers.ts';
import type { Input } from './input.ts';
import type { Race, Racer } from './types.ts';

const PLAN_BRAKE = 34, PLAN_AHEAD = 96, PLAN_STEP = 6;

/**
 * `pointAt().curve` reads about 4/7 of the true curvature: it divides the turn between two chord midpoints by the longer span
 * between the chords' far ends. CPU plans scale it back up, so they brake for bends as tight as they really are.
 */
const TRUE_CURVE = 7 / 4;

/** Fastest speed that holds a bend of `curve`, by the lateral acceleration and by the yaw rate `turn` (rad/s at walking pace,
 * falling with speed as in steerRate). */
function holdSpeed(curve: number, lateral: number, turn: number) {
  // Yaw-rate limit: v * curve = turn / (1 + v / 115), solved for v.
  const steered = (Math.sqrt(1 + 4 * turn / (115 * curve)) - 1) * 115 / 2;
  return Math.sqrt(Math.min(lateral / curve, steered * steered));
}
const bend = (r: Race, p: Racer, d: number) => Math.max(1e-4, Math.abs(pointAt(r.track, p.s + d).curve) * TRUE_CURVE);

/** Fastest speed now that still lets the racer brake into every corner ahead. */
export function cornerSpeed(r: Race, p: Racer, lateral: number, turn: number) {
  let v = Infinity;
  for (let d = 0; d <= PLAN_AHEAD; d += PLAN_STEP) v = Math.min(v, Math.sqrt(holdSpeed(bend(r, p, d), lateral, turn) ** 2 + 2 * PLAN_BRAKE * Math.max(0, d - p.speed * .1)));
  return v;
}

/** True when the racer could hold its boosted top speed, without braking or taps, through every bend it covers in `seconds` (up to 160 m). */
export function boostHolds(r: Race, p: Racer, seconds: number) {
  const top = RACERS[p.character].speed * p.pace * H.boostSpeed, lateral = cornerGrip(p) * DIFFICULTIES[r.difficulty].cpuCorner;
  for (let d = 0; d <= Math.min(160, top * seconds); d += PLAN_STEP) if (holdSpeed(bend(r, p, d), lateral, RACERS[p.character].steering) < top) return false;
  return true;
}

/** How far ahead a CPU racer aims its steering. */
export const botLook = (p: Racer) => clamp(p.speed * .55 + 7, 12, 30);

/** CPU steering and pedals toward a target point. Brakes for corners from the real grip limit, taps the brake through
 * corners that need more grip than the tyres hold, and drifts short slides through hairpins. */
export function botDriving(r: Race, p: Racer, target: { x: number; z: number }): Pick<Input, 'steer' | 'throttle' | 'brake' | 'drift'> {
  const cls = DIFFICULTIES[r.difficulty], grip = cornerGrip(p);
  const delta = angleDelta(Math.atan2(target.x - p.px, target.z - p.pz), p.yaw);
  const plan = grip * cls.cpuCorner * (1 + H.sharpGain * cls.cpuTaps);
  const turn = RACERS[p.character].steering * (p.gripUp > 0 ? 1.25 : 1) * (1 + H.sharpSteer * cls.cpuTaps);
  const desired = Math.min(RACERS[p.character].speed * p.pace * (p.boost > 0 ? H.boostSpeed : 1), cornerSpeed(r, p, plan, turn));
  // Facing well away from its line (after a spin), it slows to turn round instead of driving off the course.
  const brake = p.speed > Math.max(12, desired + 1) || Math.abs(delta) > 1.2 && p.speed > 12;
  const near = Math.max(...[5, 11, 17].map(d => bend(r, p, d)));
  // A tap is one tick of brake with the throttle held; the next tap waits until the sharp-turn window is nearly over.
  const tap = cls.cpuTaps > 0 && !brake && !p.lastBrake && p.sharp < .1 && p.speed * p.speed * near > grip;
  const drift = !brake && near > 1 / 18 && Math.abs(delta) > .3 && p.speed > 16 && p.drift < H.overDrift * .45;
  return { steer: clamp(delta * 2.1, -1, 1), throttle: !brake, brake: brake || tap, drift };
}

/** CPU top speed: the class pace, a small per-racer spread, and mild catch-up keyed on the leading human.
 * Within 30 m of that human there is no lift or cut, so catch-up can bring a CPU back into the fight but never carries it
 * past the human. It ramps to full at 150 m behind; CPUs ahead of the human are held back instead. */
export function botPace(r: Race, p: Racer) {
  const cls = DIFFICULTIES[r.difficulty], i = r.racers.indexOf(p), spread = 1 + ((i * 3) % 5 - 2) * .008;
  const humans = r.racers.filter(q => !q.bot && q.connected);
  let lift = 0;
  if (humans.length) {
    const lead = humans.reduce((a, b) => b.s > a.s ? b : a), gap = p.s - lead.s, weight = clamp((Math.abs(gap) - 30) / 120, 0, 1);
    lift = gap < 0 ? cls.catchUp * weight : -cls.holdBack * weight;
  }
  return cls.speed * cls.cpuPace * spread * (1 + lift);
}
