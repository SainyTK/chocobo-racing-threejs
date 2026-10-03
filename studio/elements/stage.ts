import * as THREE from 'three';
import { ITEMS } from '../../shared/game/index.ts';
import { makeBoostPad, padMaterial } from '../../src/gfx/stage/boost-pad.ts';
import type { StudioElement } from '../types.ts';

export const stage: StudioElement[] = [
  {
    id: 'stage.fireball', name: 'Fireball', category: 'Stage', tags: ['projectile', 'fire', ...ITEMS.fire.names], variants: ITEMS.fire.names.map((label, i) => ({ id: String(i + 1), label })), view: { y: 1.3, distance: 12 },
    create: (variant, { fx }) => ({ update(t, dt) { const a = t * 1.6; fx.syncFireballs(dt, [{ key: 'ball', x: Math.cos(a) * 4, y: 1.3, z: Math.sin(a) * 4, level: Number(variant) }]); }, dispose() { fx.syncFireballs(0, []); } }),
  },
  {
    id: 'stage.ice-trap', name: 'Ice Trap', category: 'Stage', tags: ['blizzard', 'ice', 'hazard', 'trap'], variants: [{ id: 'trap', label: 'Grow, idle and shatter' }], view: { y: .8, distance: 9 },
    create: (_, { fx }) => ({ update(t, dt) { fx.syncTraps(dt, [{ key: `trap${Math.floor(t / 3.5)}`, x: 0, y: 0, z: 0, radius: 2.2 }]); }, dispose() { fx.syncTraps(0, []); } }),
  },
  {
    id: 'stage.boost-pad', name: 'Boost Pad', category: 'Stage', tags: ['pad', 'dash', 'chevron', 'turbo'], variants: [{ id: 'pad', label: 'Pad' }], view: { y: 0, distance: 15 },
    create() { const pad = makeBoostPad(); pad.position.y = .02; return { object: pad, update(t) { padMaterial.uniforms.uTime.value = t; } }; },
  },
];
