import type { StoneType } from '../track/types.ts';

export type Item = StoneType;
export const ITEMS: Record<Item, { name: string; names: string[]; symbol: string; color: string; help: string }> = {
  fire: { name: 'Fire', names: ['Fire', 'Fira', 'Firaga'], symbol: '●', color: '#ff5950', help: 'Aim a fireball. Fira homes; Firaga attacks everyone.' },
  ice: { name: 'Ice', names: ['Blizzard', 'Blizzara', 'Blizzaga'], symbol: '❄', color: '#73c9f5', help: 'Drop ice. Blizzara drops six; Blizzaga freezes rivals.' },
  thunder: { name: 'Thunder', names: ['Thunder', 'Thundara', 'Thundaga'], symbol: 'ϟ', color: '#72df89', help: 'Strike a rival ahead. Thundaga hits every rival.' },
  haste: { name: 'Haste', names: ['Haste', 'Haste II', 'Haste III'], symbol: '»', color: '#56e3d2', help: 'A turbo boost. More matching stones last longer.' },
  shield: { name: 'Reflect', names: ['Reflect'], symbol: '◇', color: '#ed73d0', help: 'Held Reflect stones automatically return magical attacks.' },
  mini: { name: 'Mini', names: ['Mini', 'Mini II', 'Mini III'], symbol: '↓', color: '#b68bef', help: 'Shrink rivals. At level three they can be squashed.' },
  doom: { name: 'Doom', names: ['Doom'], symbol: '10', color: '#ba9366', help: 'A ten-second curse. Bump a rival to pass it on.' },
  ultima: { name: 'Ultima', names: ['Ultima', 'Ultima II', 'Ultima III'], symbol: '✦', color: '#f4f0ff', help: 'Crash every rival. More stones cause a longer crash.' },
};

/**
 * Relative strength of one stone, judged at level one.
 * Fire can miss, Ice waits behind you, Haste only helps yourself and Reflect blocks one spell.
 * Thunder always hits the rival ahead; Doom gives a 3.5 s crash but can be passed back.
 * Mini slows every rival for 9 s; Ultima crashes every rival and cannot be reflected.
 */
export const STONE_POWER: Record<Item, number> = { fire: 1, ice: 1, haste: 1, shield: 1.25, thunder: 2, doom: 2.5, mini: 4, ultima: 6 };
/** A random Magic Stone's chance is inversely proportional to its power. */
export const RANDOM_STONE_CHANCE = (() => {
  const weights = Object.entries(STONE_POWER).map(([kind, power]) => [kind, 1 / power] as const), total = weights.reduce((sum, [, w]) => sum + w, 0);
  return Object.fromEntries(weights.map(([kind, w]) => [kind, w / total])) as Record<Item, number>;
})();
/** Maps a uniform roll in [0, 1) to a stone using RANDOM_STONE_CHANCE. */
export function drawStone(roll: number): Item {
  let acc = 0;
  for (const kind of Object.keys(RANDOM_STONE_CHANCE) as Item[]) if (roll < (acc += RANDOM_STONE_CHANCE[kind])) return kind;
  return 'fire';
}

export const spellName = (kind: Item, level: number) => ITEMS[kind].names[Math.min(ITEMS[kind].names.length - 1, Math.max(0, level - 1))];
