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
  /** Brake taps while steering open a short sharp-turn window. Each further tap inside it adds grip, up to three. */
  sharpWindow: .34, sharpTaps: 3, sharpGain: .42, sharpScrub: 1.4,
  /** Drifting holds this multiple of the grip limit, rotates the nose faster and drags the speed down. */
  driftGrip: 1.75, driftSteer: 1.5, driftDrag: 2, driftCarry: .25,
  /** Throttle share while sliding (drift or sharp-turn window): the tyres are busy turning. */
  slideAccel: .4,
  /** Share of lateral acceleration above the grip limit that is lost as forward speed. */
  overGripScrub: .8,
};

/** Lateral acceleration a racer holds without sliding. Golem and Chubby corner best, Black Magician and Goblin worst. */
export function cornerGrip(p: Racer) { return (13 + RACERS[p.character].grip * 1.1) * (p.gripUp > 0 ? 1.3 : 1); }
