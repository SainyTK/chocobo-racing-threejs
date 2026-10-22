import * as THREE from 'three';
import type { Item } from '../../../shared/game/index.ts';
import { StoneField } from './field.ts';
import { HeldStones } from './held.ts';
import type { StoneKind } from './looks.ts';

/** A lone stone for the Studio and the HUD icons, drawn by the same code as in a race. */
export interface StonePreview { root: THREE.Group; update(t: number, dt?: number): void; dispose(): void }

/** A track stone with its shadow; the road is at the root's origin. */
export function trackStonePreview(kind: StoneKind): StonePreview {
  const field = new StoneField([{ kind, at: new THREE.Vector3() }]);
  return { root: field.root, update: (t, dt = 0) => field.update(t, dt), dispose: () => field.dispose() };
}

/** A held stack of `level` stones for a racer of size 1, centred on the root's origin. */
export function heldStonePreview(kind: Item, level: number): StonePreview {
  const held = new HeldStones(1), root = new THREE.Group(), at = new THREE.Vector3(); root.add(held.mesh);
  return { root, update: t => { held.begin(t); held.add(at, kind, level, 1, 0); held.end(); }, dispose: () => held.dispose() };
}
