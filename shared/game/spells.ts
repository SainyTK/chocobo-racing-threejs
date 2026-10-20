import type { Item } from './items.ts';

/** Stun seconds of the original's three hit tiers: a spin-out, a crash and a heavy crash. */
export const CRASH = { spin: 1, crash: 1.6, heavy: 2.4 } as const;
/** After a crash ends, the racer blinks and cannot be hit for this long, so hits never chain. */
export const SAFE_WINDOW = 2.5;
/** A track stone comes back this many seconds after someone takes it. */
export const STONE_RESPAWN = 5;
/** Haste, Haste II and Haste III boost seconds. */
export const HASTE_SECONDS = [2, 4, 7];
/** Each Mini level takes this share off the victim's size and top speed: 25%, 50% and 75%. */
export const MINI_SHRINK = .25;
/** Mini seconds per level. Mini III shrinks every rival, so it is the shortest. */
export const MINI_SECONDS = [6, 6, 5];
/** Doom counts down, then crashes whoever holds it. A racer who just received Doom by a bump cannot pass it on until the lock ends. */
export const DOOM = { fuse: 10, stun: 2, passLock: 2 } as const;
/** When White Mage's gauge fills, Barrier is up for this many seconds or until it blocks a hit, while the gauge charges again. */
export const BARRIER_SECONDS = 5;
/** Seconds of the shield a cast Reflect stone raises. A held Reflect stone protects on its own. */
export const REFLECT_SECONDS = 5;

/** Stun from a crashing spell at a level: level 3 Fire, Ice and Thunder are heavy crashes; Ultima III is worse still. */
export function crashSeconds(kind: Item | 'charge', level: number) {
  if (kind === 'charge') return CRASH.spin;
  if (kind === 'ultima') return [CRASH.spin, CRASH.crash, 3.2][level - 1];
  if (level >= 3) return CRASH.heavy;
  if (kind === 'ice' || kind === 'thunder' && level === 1) return CRASH.spin;
  return CRASH.crash;
}
