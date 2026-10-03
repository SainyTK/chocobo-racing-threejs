import { ITEMS, type Item } from '../../shared/game/index.ts';
import { makePickup, type PickupKind, type PickupStyle } from '../../src/gfx/effects/pickup.ts';
import type { StudioElement, Variant } from '../types.ts';

const KINDS: PickupKind[] = [...Object.keys(ITEMS) as Item[], 'random'];
const STYLES: (Variant & { id: PickupStyle })[] = [{ id: 'orb', label: 'Orb, tinted glass', inGame: true }, { id: 'orb-clear', label: 'Orb, clear glass' }, { id: 'crystal', label: 'Crystal (previous)' }];

export const items: StudioElement[] = KINDS.map(kind => ({
  id: `item.${kind}`, name: kind === 'random' ? 'Random Stone' : `${ITEMS[kind].name} Stone`, category: 'Items',
  tags: ['magic stone', 'pickup', 'orb', ...(kind === 'random' ? ['rainbow', 'mystery'] : ITEMS[kind].names)],
  variants: STYLES, view: { y: 1.3, distance: 7.5 },
  create(variant) {
    const stone = makePickup(kind, 0, STYLES.find(s => s.id === variant)?.id ?? 'orb'); stone.root.position.y = 1.5;
    return { object: stone.root, update: t => stone.update(t), dispose: () => stone.dispose() };
  },
}));
