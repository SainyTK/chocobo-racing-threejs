import * as THREE from 'three';
import type { SkinUniforms } from '../materials/skin.ts';
import type { Rig } from './rig.ts';

export interface AnimState { t: number; dt: number; speed: number; steer: number; drifting: boolean; flying: number; stun: number; boost: number; menu: boolean }
/** A rigged, animated racer. The world positions `root`; the model animates everything below it. */
export interface Character {
  root: THREE.Group; model: THREE.Group; skin: SkinUniforms;
  /** Boost flames and exhaust smoke spawn from these points. */
  exhausts: THREE.Object3D[];
  /** Ground contact points at the back, used for drift sparks and dust. */
  contacts: THREE.Object3D[];
  head: THREE.Object3D; height: number;
  animate(s: AnimState): void; dispose(): void;
}

export interface Wheel { j: THREE.Object3D; r: number }

export interface Build { r: Rig; head: THREE.Object3D; height: number; wheels: Wheel[]; steer: THREE.Object3D[]; exhausts: THREE.Object3D[]; contacts: THREE.Object3D[]; outline: string; update?: (s: AnimState, k: number) => void }
