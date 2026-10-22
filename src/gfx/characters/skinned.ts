import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { toon } from '../materials/toon.ts';
import { outlineMaterial } from '../materials/outline.ts';
import { characterModel, type ModelId } from './models.ts';
import type { Rig } from './rig.ts';

/** One instance of a skinned racer model, posed by its own mixer. `outline` is the hull's ink colour from the model. */
export interface SkinnedModel { root: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; outline: string; bone(name: string): THREE.Object3D }

/**
 * Clones a loaded racer model into the rig with the game's look: the textured body gets the shared toon ramp, rim
 * and hit flash, and the `Outline` mesh becomes the inverted hull in its material's colour. Geometry, texture and
 * clips stay shared.
 */
export function skinnedModel(r: Rig, id: ModelId, width = .032): SkinnedModel {
  const gltf = characterModel(id), root = clone(gltf.scene);
  let outline = '#000000';
  root.traverse(o => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const source = o.material as THREE.MeshStandardMaterial;
    if (o.name.startsWith('Outline')) { outline = `#${source.color.getHexString()}`; o.material = outlineMaterial(outline, width, r.skin); o.castShadow = false; o.userData.outline = true; return; }
    const m = toon('#ffffff', r.skin);
    m.map = source.map; m.vertexColors = !!o.geometry.attributes.color; o.material = m; o.castShadow = o.receiveShadow = true;
  });
  r.model.add(root);
  const mixer = new THREE.AnimationMixer(root), actions = new Map(gltf.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  return {
    root, mixer, actions, outline,
    bone(name) { const b = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)); if (!b) throw new Error(`${id} has no bone ${name}`); return b; },
  };
}

/** An empty fixed to a bone at a point given in model space, for exhausts, contacts and effect anchors. */
export function anchor(m: SkinnedModel, bone: string, at: [number, number, number]) {
  const o = new THREE.Object3D(); m.root.add(o); o.position.set(...at); m.root.updateMatrixWorld(true); m.bone(bone).attach(o); return o;
}
