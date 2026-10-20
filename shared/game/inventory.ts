import { RACERS } from './racers.ts';
import type { Item } from './items.ts';
import type { Racer, StoneStack } from './types.ts';

/**
 * A racer holds at most this many stones. Matching stones merge into one stack that casts as a higher level spell,
 * but every stone in it still takes a place, so a level 3 stack fills the inventory until it is cast.
 */
export const MAX_STONES = 3;
/** Reflect and Doom never combine; every other stone stacks up to level three. */
export const maxLevel = (kind: Item) => kind === 'shield' || kind === 'doom' ? 1 : 3;
/** Stones held, counting each stone in a stack. */
export const heldStones = (p: Racer) => p.stones.reduce((sum, stack) => sum + stack.level, 0);

export function syncInventory(p: Racer) { const top = p.stones.at(-1); p.item = top?.kind ?? null; p.itemLevel = top?.level ?? 0; }
/** True when the racer has room for another stone. */
export const canAddStone = (p: Racer) => heldStones(p) < MAX_STONES;
/** Adds `level` stones of `kind`, merging into the latest stack first. Stones that do not fit are lost. Returns false when none fit. */
export function addStone(p: Racer, kind: Item, level = 1) {
  if (!canAddStone(p)) return false;
  level = Math.min(level, MAX_STONES - heldStones(p));
  while (level > 0) {
    const top = p.stones.at(-1), cap = maxLevel(kind);
    if (top?.kind === kind && top.level < cap) { const n = Math.min(level, cap - top.level); top.level += n; level -= n; }
    else { const n = Math.min(level, cap); p.stones.push({ kind, level: n }); level -= n; }
  }
  syncInventory(p); return true;
}
/** Magic Plus adds a matching stone to the latest stack. Returns false without a stack that can level up or room for it. */
export function levelUpLatest(p: Racer) {
  const top = p.stones.at(-1);
  return !!top && top.level < maxLevel(top.kind) && addStone(p, top.kind);
}
/** Removes one stone from the latest stack and returns its kind. */
export function takeStone(p: Racer) {
  const top = p.stones.at(-1); if (!top) return undefined;
  if (--top.level === 0) p.stones.pop();
  syncInventory(p); return top.kind;
}
/** Removes and returns the stack at `index` (the latest by default). */
export function takeStack(p: Racer, index = p.stones.length - 1): StoneStack | undefined { const [stack] = p.stones.splice(index, 1); syncInventory(p); return stack; }

/** Distance between neighbouring held stacks, and from the racer's centre to the first one, scaled by racer size. */
const STACK_GAP = 1.3, STACK_START = 2.1;
/**
 * World positions of the held stacks on the ground plane. They trail in a line behind the racer's direction of
 * travel, oldest closest; the latest stack (the next to cast) is the last in line. The renderer draws the orbs here
 * and a racer that drives into one takes it.
 */
export function stackPositions(p: Racer) {
  const heading = p.speed > 2 ? Math.atan2(p.vx, p.vz) : p.yaw, bx = -Math.sin(heading), bz = -Math.cos(heading), size = RACERS[p.character].size;
  return p.stones.map((_, i) => { const d = (STACK_START + i * STACK_GAP) * size; return { x: p.px + bx * d, z: p.pz + bz * d }; });
}
