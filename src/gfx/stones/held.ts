import * as THREE from 'three';
import type { Item } from '../../../shared/game/index.ts';
import { BLINK_RATE, HELD_STONE } from './looks.ts';
import { stoneMaterial } from './material.ts';
import { StoneMesh, stoneGeo } from './mesh.ts';

const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();

/**
 * Every racer's held stones in one draw call. Call `begin`, `add` each stone, then `end`.
 * A stack of two or three blinks to show its level, as in the original.
 */
export class HeldStones {
  readonly mesh: THREE.InstancedMesh;
  private stones: StoneMesh; private material = stoneMaterial(); private count = 0;
  constructor(private capacity: number) { this.stones = new StoneMesh(stoneGeo, this.material, capacity); this.mesh = this.stones.mesh; this.mesh.renderOrder = 4; }
  begin(t: number) { this.material.uniforms.uTime.value = t; this.count = 0; }
  /** A stack at `at` (the centre of the ball), for a racer of size `scale`. `blink` overrides the level's blink rate. */
  add(at: THREE.Vector3, kind: Item, level: number, scale: number, phase: number, blink = BLINK_RATE[level] ?? 0) {
    if (this.count >= this.capacity) return;
    this.stones.set(this.count++, m.compose(at, q, s.setScalar(HELD_STONE.radius * scale)), kind, phase, blink, 1);
  }
  end() { this.stones.commit(this.count); }
  dispose() { this.stones.dispose(); this.material.dispose(); }
}
