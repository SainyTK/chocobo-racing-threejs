import type { Item } from './items.ts';

/** Stun seconds of the original's three hit tiers: a spin-out, a crash and a heavy crash. */
export const CRASH = { spin: 1, crash: 1.6, heavy: 2.4 } as const;
/** After a crash ends, the racer blinks and cannot be hit for this long, so hits never chain. */
export const SAFE_WINDOW = 2.5;
/** A track stone comes back this many seconds after someone takes it. */
export const STONE_RESPAWN = 4;
/** Haste, Haste II and Haste III boost seconds. */
export const HASTE_SECONDS = [2, 4, 7];
/** Each Mini level takes this share off the victim's size and top speed: 25%, 50% and 75%. */
export const MINI_SHRINK = .25;
/** Mini seconds per level. Mini III shrinks every rival, so it is the shortest. */
export const MINI_SECONDS = [6, 6, 5];
/** Doom counts down, then crashes whoever holds it. A racer who just received Doom by a bump cannot pass it on until the lock ends. */
export const DOOM = { fuse: 10, stun: 2, passLock: 2 } as const;
/** When White Mage's gauge fills, Barrier is up for this many seconds or until it blocks a hit, while the gauge charges again. */
export const BARRIER_SECONDS = 4;
/** Seconds of the shield a cast Reflect stone raises. A held Reflect stone protects on its own. */
export const REFLECT_SECONDS = 5;

/** Hit tier of a crashing spell: 1 spin-out, 2 crash, 3 heavy crash. Blizzard sheets, Thunder, Ultima and Charge spin; every level 3 spell is heavy. */
export function crashTier(kind: Item | 'charge', level: number): 1 | 2 | 3 {
  if (level >= 3) return 3;
  if (kind === 'charge' || kind === 'ice' || level === 1 && (kind === 'thunder' || kind === 'ultima')) return 1;
  return 2;
}
/** Stun seconds of a crashing spell. Ultima III is a catastrophic crash, longer than the heavy tier. */
export const crashSeconds = (kind: Item | 'charge', level: number) => kind === 'ultima' && level >= 3 ? 3.2 : [CRASH.spin, CRASH.crash, CRASH.heavy][crashTier(kind, level) - 1];
