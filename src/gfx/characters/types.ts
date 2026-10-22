import * as THREE from 'three';
import type { SkinUniforms } from '../materials/skin.ts';
import type { Rig } from './rig.ts';
import type { Pose } from './poses.ts';

export interface AnimState { t: number; dt: number; speed: number; steer: number; drifting: boolean; flying: number; stun: number; boost: number; menu: boolean; pose?: Pose }
/** A rigged, animated racer. The world positions `root`; the model animates everything below it. */
export interface Character {
  root: THREE.Group; model: THREE.Group; skin: SkinUniforms;
  /** Exhaust smoke spawns from these points. */
  exhausts: THREE.Object3D[];
  /** False for racers without an engine, which give off no smoke. */
  smokes: boolean;
  /** Ground contact points at the back, used for drift sparks and dust. */
  contacts: THREE.Object3D[];
  head: THREE.Object3D; height: number;
  animate(s: AnimState): void; dispose(): void;
}

export interface Wheel { j: THREE.Object3D; r: number }

/** `sync` runs last each frame, after the reaction poses, for racers that apply code-driven turns to skinned bones. */
export interface Build { r: Rig; head: THREE.Object3D; height: number; wheels: Wheel[]; steer: THREE.Object3D[]; exhausts: THREE.Object3D[]; smokes?: boolean; contacts: THREE.Object3D[]; outline: string; update?: (s: AnimState, k: number) => void; sync?: () => void }
