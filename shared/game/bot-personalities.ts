import type { Item } from './items.ts';

/**
 * How a CPU racer treats its stones, from the original's per-character holding policies.
 * - hoard: keeps every stone except Doom until the inventory is full.
 * - build: keeps attack stones until the inventory is full or it falls to 5th or worse.
 * - quick: casts as soon as there is a target, but holds attack stones when in 5th or worse.
 * - specialist: always builds its favourite attack to level 3 and uses everything else straight away.
 */
export type HoldStyle = 'hoard' | 'build' | 'quick' | 'specialist';
export interface BotMagic { hold: HoldStyle; favourite: Item }
/** Indexed like RACERS. */
export const BOT_MAGIC: BotMagic[] = [
  { hold: 'hoard', favourite: 'haste' }, // Chocobo
  { hold: 'quick', favourite: 'thunder' }, // Mog
  { hold: 'build', favourite: 'ice' }, // Golem
  { hold: 'build', favourite: 'fire' }, // Goblin
  { hold: 'build', favourite: 'thunder' }, // Black Magician
  { hold: 'quick', favourite: 'mini' }, // White Mage
  { hold: 'hoard', favourite: 'ice' }, // Chubby Chocobo
  { hold: 'specialist', favourite: 'fire' }, // Behemoth
  { hold: 'build', favourite: 'fire' }, // Bahamut: no source; builds Fire, the nearest thing to his Flare
  { hold: 'specialist', favourite: 'thunder' }, // Cloud: holds one attack type like Behemoth (GameFAQs 74730); Thunder is a guess
];
