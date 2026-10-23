import { HELD_STONE_RADIUS, ITEMS, type Item } from '../../../shared/game/index.ts';

/** A track stone is a fixed type or the black "?" stone that rolls one on pickup. */
export type StoneKind = Item | 'random';
/** Every stone kind, in the order the shader indexes its looks. */
export const STONE_KINDS: StoneKind[] = [...Object.keys(ITEMS) as Item[], 'random'];

/**
 * How each stone is painted, read from footage of the original: a glossy ball in one body colour with a large symbol
 * on the side facing the camera. `glyph` is the symbol's main colour and `accent` its second tone.
 */
export interface StoneLook { body: string; glyph: string; accent: string }
export const STONE_LOOKS: Record<StoneKind, StoneLook> = {
  fire: { body: '#e3200f', glyph: '#ffb01e', accent: '#fff4a8' },
  ice: { body: '#1f43cf', glyph: '#46dcee', accent: '#0a1966' },
  thunder: { body: '#45c824', glyph: '#ffe62e', accent: '#fff9c2' },
  haste: { body: '#11a98f', glyph: '#ff2cd6', accent: '#9a2fb8' },
  shield: { body: '#da3a80', glyph: '#7b3cff', accent: '#ffffff' },
  mini: { body: '#9d96cc', glyph: '#212778', accent: '#d2ddf6' },
  doom: { body: '#c49496', glyph: '#e9e6e2', accent: '#3a2a2e' },
  ultima: { body: '#ab9c2c', glyph: '#d6edf8', accent: '#6880b0' },
  random: { body: '#141218', glyph: '#ffe23a', accent: '#fff6b0' },
};

/** Kinds whose symbol stays centred on the ball: Ultima's burst fills the face inside an even gold ring, and Mini's man stands in the middle. */
export const CENTRED_KINDS: StoneKind[] = ['mini', 'ultima'];

/** Track stones: radius in metres and the height of their centre above the road, so they float half a ball up as in the original. */
export const TRACK_STONE = { radius: .85, lift: 1.3 };
/** Held stones roll on the road in the chain behind the racer, at the size the simulation uses for contacts. */
export const HELD_STONE = { radius: HELD_STONE_RADIUS, lift: .5 };
/** A picked stone bursts into a bright smear of itself for this long. */
export const PUFF_SECONDS = .22;
/** A stone that respawns grows back in over this long. */
export const RESPAWN_GROW_SECONDS = .25;
