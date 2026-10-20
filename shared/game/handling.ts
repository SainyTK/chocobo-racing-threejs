import { RACERS } from './racers.ts';
import type { Racer } from './types.ts';

/** Driving tuning shared by the physics, the CPU planner, the HUD and the effects. Speeds are m/s, accelerations m/s2. */
export const HANDLING = {
  /** Continuous drift before an over-drift spin, in seconds. */
  overDrift: 1.9,
  /** Max speed and acceleration multipliers while boosting, and the instant forward kick when a boost starts. */
  boostSpeed: 1.55, boostAccel: 1.5, boostKick: 9,
  boostPad: 1.6, spinDash: 1.4, startDash: 1.8,
  brake: 47, coast: 10,
  /** Speed above the current maximum bleeds off at these rates (after a boost, on grass). */
  overSpeedBleed: 15, grassBleed: 30,
  /** Brake taps while steering open a short sharp-turn window. Each further tap inside it adds grip and steering, up to three. */
  sharpWindow: .34, sharpTaps: 3, sharpGain: .42, sharpSteer: .2, sharpScrub: 1.4,
  /** Drifting holds this multiple of the grip limit, rotates the nose faster and drags the speed down. */
  driftGrip: 1.35, driftSteer: 1.5, driftDrag: 2, driftCarry: .25,
  /** Throttle share while sliding (drift or sharp-turn window): the tyres are busy turning. */
  slideAccel: .4,
  /** Share of lateral acceleration above the grip limit that is lost as forward speed. */
  overGripScrub: .8,
};

/** Lateral acceleration a racer holds without sliding: about 4 g, so medium corners take near top speed and only tight
 * corners and hairpins need a lift, a brake tap or a drift. Chubby, Golem and White Mage corner best, Goblin worst. */
export function cornerGrip(p: Racer) { return (22 + RACERS[p.character].grip * 1.8) * (p.gripUp > 0 ? 1.3 : 1); }

/** Full-lock yaw rate in rad/s at a forward speed, before the grip limit. It falls with speed, so hairpins also need speed off. */
export function steerRate(p: Racer, speed: number) {
  return RACERS[p.character].steering * (p.gripUp > 0 ? 1.25 : 1) * (p.drifting ? HANDLING.driftSteer : 1 + HANDLING.sharpSteer * p.sharpTaps) * Math.min(1, Math.abs(speed) / 8) / (1 + Math.abs(speed) / 115);
}
