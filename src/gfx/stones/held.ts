import * as THREE from 'three';
import type { Item } from '../../../shared/game/index.ts';
import { LevelHalos } from './halo.ts';
import { HELD_STONE } from './looks.ts';
import { stoneMaterial } from './material.ts';
import { StoneMesh, stoneGeo } from './mesh.ts';

const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();

/**
 * Every racer's held stones in one draw call, plus one for the halos of level 3 stacks. Call `begin`, `add` each
 * stone, then `end`, and add `root` to the scene. A stack of two or three shows its level as in the original.
 */
export class HeldStones {
  readonly root = new THREE.Group();
  private stones: StoneMesh; private halos: LevelHalos; private material = stoneMaterial(); private count = 0; private haloCount = 0;
  constructor(private capacity: number) {
    this.stones = new StoneMesh(stoneGeo, this.material, capacity); this.stones.mesh.renderOrder = 4; this.halos = new LevelHalos(capacity);
    this.root.add(this.stones.mesh, this.halos.mesh);
  }
  begin(t: number) { this.material.uniforms.uTime.value = t; this.halos.time = t; this.count = this.haloCount = 0; }
  /** A stack at `at` (the centre of the ball), for a racer of size `scale`. `blink` flips it to black that many times a second. */
  add(at: THREE.Vector3, kind: Item, level: number, scale: number, phase: number, blink = 0) {
    if (this.count >= this.capacity) return;
    m.compose(at, q, s.setScalar(HELD_STONE.radius * scale));
    this.stones.set(this.count++, m, kind, phase, blink, 1, level);
    if (level >= 3) this.halos.set(this.haloCount++, m, phase);
  }
  end() { this.stones.commit(this.count); this.halos.commit(this.haloCount); }
  dispose() { this.stones.dispose(); this.halos.dispose(); this.material.dispose(); }
}
