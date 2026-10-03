import * as THREE from 'three';
import type { Item } from '../../../shared/game/index.ts';
import { crystalMaterial } from '../materials/crystal.ts';
import { shell } from '../materials/shell.ts';
import { decalMaterial } from '../materials/decal.ts';
import { makeOrb, orbColor } from '../orbs/index.ts';
import { sphereGeo, ringGeo, gemGeo } from './geometries.ts';

export type PickupKind = Item | 'random';
/** `orb` is what the game uses. The others stay available for side-by-side comparison in the studio. */
export const PICKUP_STYLES = ['orb', 'orb-clear', 'crystal'] as const;
export type PickupStyle = typeof PICKUP_STYLES[number];
/** A track Magic Stone. `root` sits 1.5 m above the road; `update` spins and bobs it. */
export interface Pickup { root: THREE.Group; update(t: number): void; dispose(): void }

/** Track Magic Stone over a soft ground ring. `phase` desynchronises neighbouring stones. */
export function makePickup(kind: PickupKind, phase = 0, style: PickupStyle = 'orb'): Pickup {
  const color = orbColor(kind), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const disc = new THREE.Mesh(ringGeo, decalMaterial('ring', color)); disc.position.y = -1.42; disc.scale.setScalar(1.3); disc.material.uniforms.uOpacity.value = .4; root.add(disc);
  const timed: THREE.ShaderMaterial[] = [disc.material];
  let inner: { update(t: number): void; dispose(): void };
  if (style === 'crystal') {
    // The original faceted gem inside a coloured halo; it also tilts as it bobs.
    const rainbow = kind === 'random', gem = new THREE.Mesh(gemGeo, crystalMaterial(color, { rainbow, opacity: .92, intensity: 1.25 })), halo = new THREE.Mesh(sphereGeo, shell(color, rainbow ? '#ffffff' : color, { power: 2.5, intensity: 1.1 }));
    gem.scale.setScalar(.85); halo.scale.setScalar(1.25); body.add(gem); root.add(halo); timed.push(gem.material, halo.material);
    inner = { update: t => { gem.rotation.x = Math.sin(t * .9 + phase) * .25; }, dispose: () => { gem.material.dispose(); halo.material.dispose(); } };
  } else {
    const orb = makeOrb(kind, { tint: style === 'orb', halo: style === 'orb' }); orb.root.scale.setScalar(.95); body.add(orb.root); inner = orb;
  }
  return {
    root,
    update(t) {
      root.rotation.y = t * 1.4 + phase; body.position.y = Math.sin(t * 2 + phase) * .2;
      for (const m of timed) m.uniforms.uTime.value = t;
      inner.update(t);
    },
    dispose() { disc.material.dispose(); inner.dispose(); },
  };
}
