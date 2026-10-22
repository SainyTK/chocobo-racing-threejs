import { ITEMS, maxLevel, type Item } from '../../shared/game/index.ts';
import { STONE_KINDS } from '../../src/gfx/stones/looks.ts';
import { heldStonePreview, trackStonePreview } from '../../src/gfx/stones/preview.ts';
import type { StudioElement, Variant } from '../types.ts';

const TRACK: Variant[] = [{ id: 'stone', label: 'On the track', inGame: true }];
const LEVELS: Variant[] = [{ id: '1', label: 'Level 1', inGame: true }, { id: '2', label: 'Level 2 (blinks)', inGame: true }, { id: '3', label: 'Level 3 (blinks fast)', inGame: true }];

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

/** A stack as it trails behind a racer. Matching stones merge into one stack that blinks to show its level. */
const stacks: StudioElement[] = (Object.keys(ITEMS) as Item[]).map(kind => ({
  id: `stack.${kind}`, name: `${ITEMS[kind].name} Stack`, category: 'Items',
  tags: ['magic stone', 'held', 'stack', 'level', ...ITEMS[kind].names],
  variants: maxLevel(kind) > 1 ? LEVELS : LEVELS.slice(0, 1), view: { y: .5, distance: 3 },
  create(variant) {
    const stack = heldStonePreview(kind, Number(variant) || 1); stack.root.position.y = .5;
    return { object: stack.root, update: t => stack.update(t), dispose: () => stack.dispose() };
  },
}));

export const items = [...pickups, ...stacks];
