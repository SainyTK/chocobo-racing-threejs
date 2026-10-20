import type { StoneType } from '../track/types.ts';

export type Item = StoneType;
export const ITEMS: Record<Item, { name: string; names: string[]; symbol: string; color: string; help: string }> = {
  fire: { name: 'Fire', names: ['Fire', 'Fira', 'Firaga'], symbol: '●', color: '#ff5950', help: 'Aim a fireball. Fira homes; Firaga attacks everyone.' },
  ice: { name: 'Ice', names: ['Blizzard', 'Blizzara', 'Blizzaga'], symbol: '❄', color: '#73c9f5', help: 'Drop ice. Blizzara drops six; Blizzaga freezes rivals.' },
  thunder: { name: 'Thunder', names: ['Thunder', 'Thundara', 'Thundaga'], symbol: 'ϟ', color: '#72df89', help: 'Strike a rival ahead. Thundaga hits every rival.' },
  haste: { name: 'Haste', names: ['Haste', 'Haste II', 'Haste III'], symbol: '»', color: '#56e3d2', help: 'A turbo boost. More matching stones last longer.' },
  shield: { name: 'Reflect', names: ['Reflect'], symbol: '◇', color: '#ed73d0', help: 'Held Reflect stones automatically return magical attacks.' },
  mini: { name: 'Mini', names: ['Mini', 'Mini II', 'Mini III'], symbol: '↓', color: '#b68bef', help: 'Shrink and slow the rival ahead. Mini III shrinks every rival so they can be squashed.' },
  doom: { name: 'Doom', names: ['Doom'], symbol: '10', color: '#ba9366', help: 'A ten-second curse. Bump a rival to pass it on.' },
  ultima: { name: 'Ultima', names: ['Ultima', 'Ultima II', 'Ultima III'], symbol: '✦', color: '#f4f0ff', help: 'Rare, from "?" stones in the back of the pack. Crashes every rival; more stones crash longer.' },
};

/**
 * Relative strength of one stone, judged at level one.
 * Fire can miss, Ice waits behind you, Haste only helps yourself and Reflect blocks one spell.
 * Thunder always hits the rival ahead; Doom gives a crash but can be passed on.
 * Mini shrinks and slows a rival; Ultima crashes every rival and cannot be reflected.
 */
export const STONE_POWER: Record<Item, number> = { fire: 1, ice: 1, haste: 1, shield: 1.25, thunder: 2, doom: 2.5, mini: 4, ultima: 6 };
/**
 * Odds of each type from a black "?" stone. In the front half of the field a stone's chance is inversely proportional
 * to its power and Ultima never rolls. In the back half the odds flatten toward strong stones and Ultima can roll.
 */
export function randomStoneChance(back: boolean): Record<Item, number> {
  const weights = Object.entries(STONE_POWER).map(([kind, power]) => [kind, kind === 'ultima' && !back ? 0 : back ? 1 / Math.sqrt(power) : 1 / power] as const), total = weights.reduce((sum, [, w]) => sum + w, 0);
  return Object.fromEntries(weights.map(([kind, w]) => [kind, w / total])) as Record<Item, number>;
}
const CHANCE = { front: randomStoneChance(false), back: randomStoneChance(true) };
/** Maps a uniform roll in [0, 1) to a stone for a racer in the front or back half of the field. */
export function drawStone(roll: number, back: boolean): Item {
  const chance = back ? CHANCE.back : CHANCE.front;
  let acc = 0;
  for (const kind of Object.keys(chance) as Item[]) if (chance[kind] > 0 && roll < (acc += chance[kind])) return kind;
  return 'fire';
}
/** True for a racer in the back half of the field, who gets the stronger random stones. */
export const inBackHalf = (rank: number, racers: number) => rank > racers / 2;

export const spellName = (kind: Item, level: number) => ITEMS[kind].names[Math.min(ITEMS[kind].names.length - 1, Math.max(0, level - 1))];
