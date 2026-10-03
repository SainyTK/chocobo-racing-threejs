import { RACERS } from './racers.ts';
import type { Item } from './items.ts';
import type { Racer, StoneStack } from './types.ts';

/** A racer carries at most this many stacks. Matching stones merge into one stack, so they free space. */
export const MAX_STACKS = 3;
/** Reflect and Doom never combine; every other stone stacks up to level three. */
export const maxLevel = (kind: Item) => kind === 'shield' || kind === 'doom' ? 1 : 3;

export function syncInventory(p: Racer) { const top = p.stones.at(-1); p.item = top?.kind ?? null; p.itemLevel = top?.level ?? 0; }
/** True when `kind` would merge into the latest stack or fit in a free slot. */
export function canAddStone(p: Racer, kind: Item) { const top = p.stones.at(-1); return top?.kind === kind && top.level < maxLevel(kind) || p.stones.length < MAX_STACKS; }
/** Adds `level` stones of `kind`, merging into the latest stack first. Stones that do not fit are lost. Returns false when none fit. */
export function addStone(p: Racer, kind: Item, level = 1) {
  if (!canAddStone(p, kind)) return false;
  while (level > 0) {
    const top = p.stones.at(-1), cap = maxLevel(kind);
    if (top?.kind === kind && top.level < cap) { const n = Math.min(level, cap - top.level); top.level += n; level -= n; }
    else if (p.stones.length < MAX_STACKS) { const n = Math.min(level, cap); p.stones.push({ kind, level: n }); level -= n; }
    else break;
  }
  syncInventory(p); return true;
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
