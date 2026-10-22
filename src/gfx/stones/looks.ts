import { ITEMS, type Item } from '../../../shared/game/index.ts';

/** A track stone is a fixed type or the black "?" stone that rolls one on pickup. */
export type StoneKind = Item | 'random';
/** Every stone kind, in the order the shader indexes its looks. */
export const STONE_KINDS: StoneKind[] = [...Object.keys(ITEMS) as Item[], 'random'];

/**
 * How each stone is painted, read from footage of the original: a glossy ball in one body colour with a large symbol
 * on the side facing the camera. `glyph` is the symbol's main colour and `accent` its second tone. Ice is the only
 * see-through stone.
 */
export interface StoneLook { body: string; glyph: string; accent: string; opacity: number }
export const STONE_LOOKS: Record<StoneKind, StoneLook> = {
  fire: { body: '#e3200f', glyph: '#ffb01e', accent: '#fff4a8', opacity: 1 },
  ice: { body: '#c9d4f4', glyph: '#ffffff', accent: '#2f5ee0', opacity: .78 },
  thunder: { body: '#45c824', glyph: '#ffe62e', accent: '#fff9c2', opacity: 1 },
  haste: { body: '#2c3fd6', glyph: '#7ff2ff', accent: '#0d2f96', opacity: 1 },
  shield: { body: '#da3a80', glyph: '#7b3cff', accent: '#ffffff', opacity: 1 },
  mini: { body: '#11a98f', glyph: '#ff2cd6', accent: '#ff9cf0', opacity: 1 },
  doom: { body: '#c49496', glyph: '#e9e6e2', accent: '#3a2a2e', opacity: 1 },
  ultima: { body: '#f4f1ff', glyph: '#b28cff', accent: '#ffe27a', opacity: 1 },
  random: { body: '#141218', glyph: '#ffe23a', accent: '#fff6b0', opacity: 1 },
};

/** Track stones: radius in metres and the height of their centre above the road, so they float half a ball up as in the original. */
export const TRACK_STONE = { radius: .85, lift: 1.3 };
/** Held stones sit on the road in the trailing line, about half a track stone across. */
export const HELD_STONE = { radius: .42, lift: .5 };
/** A picked stone bursts into a bright smear of itself for this long. */
export const PUFF_SECONDS = .22;
/** A stone that respawns grows back in over this long. */
export const RESPAWN_GROW_SECONDS = .25;
/** Blinks per second of a held level 2 and level 3 stack. */
export const BLINK_RATE = [0, 0, 4, 8];
