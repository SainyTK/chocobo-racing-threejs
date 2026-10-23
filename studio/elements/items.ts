import * as THREE from 'three';
import { ITEMS, maxLevel, type Item } from '../../shared/game/index.ts';
import { STONE_KINDS } from '../../src/gfx/stones/looks.ts';
import { heldStonePreview, trackStonePreview } from '../../src/gfx/stones/preview.ts';
import type { StudioElement, Variant } from '../types.ts';
import { defaultView } from '../viewport.ts';

const TRACK: Variant[] = [{ id: 'stone', label: 'On the track', inGame: true }];
const LEVELS: Variant[] = [{ id: '1', label: 'Level 1', inGame: true }, { id: '2', label: 'Level 2 (sweeping band)', inGame: true }, { id: '3', label: 'Level 3 (growing ring)', inGame: true }];
const STACKABLE = (Object.keys(ITEMS) as Item[]).filter(kind => maxLevel(kind) > 1);

/** A Magic Stone as it floats over the road, with its shadow. */
const pickups: StudioElement[] = STONE_KINDS.map(kind => ({
  id: `item.${kind}`, name: kind === 'random' ? 'Random Stone' : `${ITEMS[kind].name} Stone`, category: 'Items',
  tags: ['magic stone', 'pickup', 'orb', ...(kind === 'random' ? ['mystery', 'question mark'] : ITEMS[kind].names)],
  variants: TRACK, view: { y: 1.2, distance: 6 },
  create() {
    const stone = trackStonePreview(kind);
    return { object: stone.root, update: (t, dt) => stone.update(t, dt), dispose: () => stone.dispose() };
  },
}));

/** A stack as it trails behind a racer. Matching stones merge into one stack that shows its level as in the original. */
const stacks: StudioElement[] = (Object.keys(ITEMS) as Item[]).map(kind => ({
  id: `stack.${kind}`, name: `${ITEMS[kind].name} Stack`, category: 'Items',
  tags: ['magic stone', 'held', 'stack', 'level', ...ITEMS[kind].names],
  variants: maxLevel(kind) > 1 ? LEVELS : LEVELS.slice(0, 1), view: { y: .5, distance: 3 },
  create(variant) {
    const stack = heldStonePreview(kind, Number(variant) || 1); stack.root.position.y = .5;
    return { object: stack.root, update: t => stack.update(t), dispose: () => stack.dispose() };
  },
}));

/** Level 1, 2 and 3 stacks of one stone side by side, to compare how each level shows. They line up across the default view. */
const across = new THREE.Vector3(Math.cos(defaultView().az), 0, -Math.sin(defaultView().az));
const levels: StudioElement = {
  id: 'stack-levels', name: 'Held Stack Levels', category: 'Items', tags: ['magic stone', 'held', 'stack', 'level', 'flash', 'ring', 'compare'],
  variants: STACKABLE.map(kind => ({ id: kind, label: ITEMS[kind].name, inGame: true })), view: { y: .5, distance: 7 },
  create(variant) {
    const root = new THREE.Group(), stacks = [1, 2, 3].map(level => heldStonePreview(variant as Item, level));
    stacks.forEach((stack, i) => { stack.root.position.copy(across).multiplyScalar((i - 1) * 1.9).setY(.5); root.add(stack.root); });
    return { object: root, update: t => stacks.forEach(stack => stack.update(t)), dispose: () => stacks.forEach(stack => stack.dispose()) };
  },
};

export const items = [...pickups, ...stacks, levels];
