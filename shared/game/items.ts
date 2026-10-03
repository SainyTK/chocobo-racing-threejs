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

/** Weighted pool a random Magic Stone draws from. */
export const RANDOM_STONES: Item[] = ['fire', 'fire', 'ice', 'haste', 'haste', 'thunder', 'shield', 'mini', 'doom', 'ultima'];

export const spellName = (kind: Item, level: number) => ITEMS[kind].names[Math.min(ITEMS[kind].names.length - 1, Math.max(0, level - 1))];
