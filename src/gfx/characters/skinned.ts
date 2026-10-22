import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { toon } from '../materials/toon.ts';
import { outlineMaterial } from '../materials/outline.ts';
import { characterModel, type ModelId } from './models.ts';
import type { Rig } from './rig.ts';

/**
 * One instance of a skinned racer model, posed by its own mixer. `outline` is the hull's ink colour from the model.
 * Advance it with `update`, not `mixer.update`, so bones turned on top of the clips start each frame from the clip pose.
 */
export interface SkinnedModel {
  root: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; outline: string; overlays: Overlay[];
  bone(name: string): THREE.Object3D; update(dt: number): void;
}

/** A bone that code turns on top of its clips, through a stand-in joint `j`; see `overlay`. */
export interface Overlay { j: THREE.Object3D; restore(): void; capture(): void; sync(): void }

/**
 * How far along the sun's rays a skinned body ignores occluders, in metres: more than a racer's own depth, so its back
 * is not blotched by its head, wings or bumps, and less than the clearance under a roof, a tunnel or an arch, so those
 * still darken it. Surfaces turned away from the sun are then shaded by the toon ramp alone.
 */
const SELF_SHADOW_REACH = 3;

/**
 * Clones a loaded racer model into the rig with the game's look: the textured body gets the shared toon ramp, rim
 * and hit flash, and the `Outline` mesh becomes the inverted hull in its material's colour. Geometry, texture and
 * clips stay shared. `width` is the outline's thickness.
 */
export function skinnedModel(r: Rig, id: ModelId, width = .032): SkinnedModel {
  const gltf = characterModel(id), root = clone(gltf.scene);
  let outline = '#000000';
  root.traverse(o => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const source = o.material as THREE.MeshStandardMaterial;
    if (o.name.startsWith('Outline')) { outline = `#${source.color.getHexString()}`; o.material = outlineMaterial(outline, width, r.skin); o.castShadow = false; o.userData.outline = true; return; }
    const m = toon('#ffffff', r.skin, { shadowReach: SELF_SHADOW_REACH });
    m.map = source.map; m.vertexColors = !!o.geometry.attributes.color; o.material = m; o.castShadow = o.receiveShadow = true;
  });
  r.model.add(root);
  const mixer = new THREE.AnimationMixer(root), actions = new Map(gltf.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  const overlays: Overlay[] = [];
  return {
    root, mixer, actions, outline, overlays,
    bone(name) { const b = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)); if (!b) throw new Error(`${id} has no bone ${name}`); return b; },
    update(dt) { for (const o of overlays) o.restore(); mixer.update(dt); for (const o of overlays) o.capture(); },
  };
}

/** An empty fixed to a bone at a point given in model space, for exhausts, contacts and effect anchors. */
export function anchor(m: SkinnedModel, bone: string, at: [number, number, number]) {
  const o = new THREE.Object3D(); m.root.add(o); o.position.set(...at); m.root.updateMatrixWorld(true); m.bone(bone).attach(o); return o;
}

/**
 * A stand-in joint for a bone the game turns in code, such as a wheel or a fork. The shared animator turns the stand-in
 * like a code-built racer's joint (`rotation.x` spins a wheel, `rotation.y` steers); `sync` then turns the bone by that
 * angle about `axis`, given in model space, on top of its rest pose. Call `sync` after the mixer update.
 */
export function driven(m: SkinnedModel, bone: string, axis: [number, number, number], angle: 'x' | 'y') {
  const b = m.bone(bone), rest = b.quaternion.clone(), j = new THREE.Object3D(), turn = new THREE.Quaternion();
  m.root.updateMatrixWorld(true);
  const toBone = m.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(b.getWorldQuaternion(new THREE.Quaternion())).invert();
  const local = new THREE.Vector3(...axis).normalize().applyQuaternion(toBone);
  return { j, sync() { b.quaternion.copy(rest).multiply(turn.setFromAxisAngle(local, j.rotation[angle])); } };
}

/**
 * A stand-in joint for a bone that the shared animator turns on top of its clips, such as the head. The animator and
 * the reaction poses set `j.rotation` in model axes every frame (x nods, y turns), and `sync`, called after them,
 * turns the bone by it on top of the clip pose. `j` sits where the bone is, so its world position can be read.
 *
 * Turning the bone itself does not work: the mixer only writes a bone when its blended clip value changes, so on any
 * frame it skips, a turn added to the bone piles onto the last frame's and the head spins, and zeroing its rotation
 * throws away the bone's own rest tilt. `SkinnedModel.update` therefore puts back the clip value before each mixer
 * update and keeps the result for `sync`.
 */
export function overlay(m: SkinnedModel, bone: string): Overlay {
  const b = m.bone(bone), j = new THREE.Object3D(), clip = b.quaternion.clone(), turn = new THREE.Quaternion();
  m.root.updateMatrixWorld(true);
  // The bone's rest orientation in model space converts a turn about model axes into one about the bone's own axes.
  const rest = m.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(b.getWorldQuaternion(new THREE.Quaternion())), back = rest.clone().invert();
  b.parent!.add(j); j.position.copy(b.position);
  const o: Overlay = {
    j,
    restore() { b.quaternion.copy(clip); },
    capture() { clip.copy(b.quaternion); },
    sync() { turn.setFromEuler(j.rotation); b.quaternion.copy(clip).multiply(back).multiply(turn).multiply(rest); j.position.copy(b.position); },
  };
  m.overlays.push(o);
  return o;
}

