import * as THREE from 'three';
import { ITEMS } from '../../shared/game/index.ts';
import { TRACKS, TRACK_IDS, type TrackId } from '../../shared/track/index.ts';
import { makeBoostPad, padMaterial } from '../../src/gfx/stage/boost-pad.ts';
import { courseProp } from '../../src/gfx/stage/props.ts';
import { sceneryMaterial } from '../../src/gfx/stage/materials.ts';
import type { StudioElement } from '../types.ts';

/** Prop slots 0-5 cover every alternate the courses use (the props vary with i % 2, 3, 4 and 5). */
function trackside(id: TrackId) {
  const root = new THREE.Group(); let x = 0;
  for (let i = 0; i < 6; i++) {
    const slot = new THREE.Group(); let base: number | null = null;
    courseProp(id, i, (geo, color, ds, offset, y, sx, sy, sz) => {
      base ??= offset; const m = new THREE.Mesh(geo, sceneryMaterial(color)); m.position.set(ds, y, (offset - base) * Math.sign(base || 1)); m.scale.set(sx, sy, sz); m.castShadow = m.receiveShadow = true; slot.add(m);
    });
    if (!slot.children.length) continue;
    const box = new THREE.Box3().setFromObject(slot); slot.position.x = x - box.min.x; x += box.max.x - box.min.x + 2; root.add(slot);
  }
  root.position.x = -x / 2; const centred = new THREE.Group(); centred.add(root); return centred;
}

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
  {
    id: 'stage.trackside', name: 'Trackside Props', category: 'Stage', tags: ['scenery', 'course', 'tree', 'rock', 'building', ...TRACK_IDS.map(id => TRACKS[id].name)],
    variants: TRACK_IDS.map(id => ({ id, label: TRACKS[id].name })),
    create: variant => ({ object: trackside(TRACK_IDS.includes(variant as TrackId) ? variant as TrackId : 'forest') }),
  },
];
