import * as THREE from 'three';
import { PUFF_SECONDS, RESPAWN_GROW_SECONDS, TRACK_STONE, type StoneKind } from './looks.ts';
import { stoneMaterial, shadowMaterial } from './material.ts';
import { StoneMesh, stoneGeo, shadowGeo } from './mesh.ts';

/** One track stone: its kind and the road point under it. */
export interface FieldStone { kind: StoneKind; at: THREE.Vector3 }

const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scale = new THREE.Vector3();
const easeOut = (x: number) => 1 - (1 - x) ** 3;

/**
 * Every Magic Stone on a course in three draw calls: the stones, their shadows and the pickup bursts.
 * A stone that is taken bursts into a smear of itself; one that comes back grows in.
 */
export class StoneField {
  readonly root = new THREE.Group();
  private bodies: StoneMesh; private shadows: StoneMesh; private puffs: StoneMesh;
  private materials = [stoneMaterial(), stoneMaterial(true), shadowMaterial()];
  /** Seconds since each stone was last taken (puff) or came back (growth); `shown` is whether it is on the road, null before the first frame. */
  private since: number[]; private shown: (boolean | null)[];
  constructor(private stones: FieldStone[]) {
    const n = Math.max(1, stones.length);
    this.bodies = new StoneMesh(stoneGeo, this.materials[0], n); this.puffs = new StoneMesh(stoneGeo, this.materials[1], n); this.shadows = new StoneMesh(shadowGeo, this.materials[2], n);
    // Shadows first, then the stones, then the additive bursts over them.
    this.shadows.mesh.renderOrder = 3; this.bodies.mesh.renderOrder = 4; this.puffs.mesh.renderOrder = 5;
    this.root.add(this.shadows.mesh, this.bodies.mesh, this.puffs.mesh);
    this.since = stones.map(() => 99); this.shown = stones.map(() => null);
  }
  /** Advances to time `t`. `available(i)` says whether stone i is on the road this frame. */
  update(t: number, dt: number, available: (i: number) => boolean = () => true) {
    for (const mat of this.materials) if ('uTime' in mat.uniforms) mat.uniforms.uTime.value = t;
    let puffs = 0;
    this.stones.forEach((stone, i) => {
      const on = available(i);
      if (this.shown[i] === null) this.shown[i] = on; else if (on !== this.shown[i]) { this.shown[i] = on; this.since[i] = 0; } else this.since[i] += dt;
      const age = this.since[i], phase = i * 2.39;
      if (on) {
        const grow = easeOut(Math.min(1, age / RESPAWN_GROW_SECONDS)), r = TRACK_STONE.radius * grow;
        pos.set(stone.at.x, stone.at.y + TRACK_STONE.lift, stone.at.z); this.bodies.set(i, m.compose(pos, q, scale.setScalar(r)), stone.kind, phase, 0, 1);
        pos.y = stone.at.y + .04; this.shadows.set(i, m.compose(pos, q, scale.setScalar(TRACK_STONE.radius * .95)), stone.kind, phase, 0, grow);
      } else { this.bodies.hide(i); this.shadows.hide(i); }
      const puff = on ? 1 : age / PUFF_SECONDS;
      if (puff < 1) {
        // The burst swells sideways and drifts up as it fades.
        const r = TRACK_STONE.radius * (1 + puff * .8); pos.set(stone.at.x, stone.at.y + TRACK_STONE.lift + puff * .5, stone.at.z);
        this.puffs.set(puffs++, m.compose(pos, q, scale.set(r * (1 + puff * .4), r, r * (1 + puff * .4))), stone.kind, phase, 0, 1, puff);
      }
    });
    this.bodies.commit(); this.shadows.commit(); this.puffs.commit(puffs);
  }
  dispose() { this.bodies.dispose(); this.shadows.dispose(); this.puffs.dispose(); for (const mat of this.materials) mat.dispose(); }
}
