import { ITEMS, maxLevel, type Item } from '../../shared/game/index.ts';
import { makePickup, type PickupKind, type PickupStyle } from '../../src/gfx/effects/pickup.ts';
import { makeHeldStack } from '../../src/gfx/orbs/stack.ts';
import type { StudioElement, Variant } from '../types.ts';

const KINDS: PickupKind[] = [...Object.keys(ITEMS) as Item[], 'random'];
const STYLES: (Variant & { id: PickupStyle })[] = [{ id: 'orb', label: 'Orb, tinted glass', inGame: true }, { id: 'orb-clear', label: 'Orb, clear glass' }, { id: 'crystal', label: 'Crystal (previous)' }];

const LEVELS: Variant[] = [{ id: '1', label: 'Level 1', inGame: true }, { id: '2', label: 'Level 2', inGame: true }, { id: '3', label: 'Level 3', inGame: true }];

const pickups: StudioElement[] = KINDS.map(kind => ({
  id: `item.${kind}`, name: kind === 'random' ? 'Random Stone' : `${ITEMS[kind].name} Stone`, category: 'Items',
  tags: ['magic stone', 'pickup', 'orb', ...(kind === 'random' ? ['mystery', 'question mark'] : ITEMS[kind].names)],
  variants: STYLES, view: { y: 1.3, distance: 7.5 },
  create(variant) {
    const stone = makePickup(kind, 0, STYLES.find(s => s.id === variant)?.id ?? 'orb'); stone.root.position.y = 1.5;
    return { object: stone.root, update: t => stone.update(t), dispose: () => stone.dispose() };
  },
}));

/** A stack as it trails behind a racer. Matching stones merge into one stack and glow harder per level. */
const stacks: StudioElement[] = (Object.keys(ITEMS) as Item[]).map(kind => ({
  id: `stack.${kind}`, name: `${ITEMS[kind].name} Stack`, category: 'Items',
  tags: ['magic stone', 'held', 'stack', 'level', ...ITEMS[kind].names],
  variants: maxLevel(kind) > 1 ? LEVELS : LEVELS.slice(0, 1), view: { y: 1.5, distance: 6 },
  create(variant) {
    const stack = makeHeldStack(kind, Number(variant) || 1); stack.root.position.y = 1.5; stack.root.scale.setScalar(.6);
    return { object: stack.root, update: t => stack.update(t), dispose: () => stack.dispose() };
  },
}));

export const items = [...pickups, ...stacks];
