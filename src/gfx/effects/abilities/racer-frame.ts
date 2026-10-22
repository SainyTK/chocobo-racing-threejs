import * as THREE from 'three';
import type { Character } from '../../characters/index.ts';

/** Where a racer stands this frame: its root on the road, its drawn height and its heading on the ground. */
export interface RacerFrame { at: THREE.Vector3; height: number; forward: THREE.Vector3; side: THREE.Vector3 }

export const racerFrame = (): RacerFrame => ({ at: new THREE.Vector3(), height: 1, forward: new THREE.Vector3(), side: new THREE.Vector3() });

/** Reads a character's frame into `f` without allocating. */
export function readFrame(c: Character, f: RacerFrame) {
  c.root.getWorldPosition(f.at); f.height = c.height * c.root.scale.x;
  const yaw = c.root.rotation.y; f.forward.set(Math.sin(yaw), 0, Math.cos(yaw)); f.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
  return f;
}
