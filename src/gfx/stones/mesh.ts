import * as THREE from 'three';
import { kindIndex } from './glyphs.ts';
import type { StoneKind } from './looks.ts';

/** Smooth enough for a clean silhouette at close range; the symbol is drawn per pixel, so it needs no extra detail. */
export const stoneGeo = new THREE.SphereGeometry(1, 20, 14);
/** Shadow quad of radius 1 lying on the road. */
export const shadowGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);

const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Many stones in one draw call. Each instance has a matrix, a kind and a state
 * (animation phase, blinks per second, fade 0..1, puff age 0..1); see the stone shader.
 */
export class StoneMesh {
  readonly mesh: THREE.InstancedMesh;
  private kinds: THREE.InstancedBufferAttribute; private states: THREE.InstancedBufferAttribute;
  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number) {
    const g = geometry.clone(); this.kinds = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1); this.states = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.kinds.setUsage(THREE.DynamicDrawUsage); this.states.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aKind', this.kinds); g.setAttribute('aState', this.states);
    this.mesh = new THREE.InstancedMesh(g, material, capacity); this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Instances spread along the whole course, so the mesh's own bounds would cull them wrongly.
    this.mesh.frustumCulled = false;
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, hidden);
  }
  set(i: number, matrix: THREE.Matrix4, kind: StoneKind, phase: number, blink: number, fade: number, puff = 0) {
    this.mesh.setMatrixAt(i, matrix); this.kinds.setX(i, kindIndex(kind)); this.states.setXYZW(i, phase, blink, fade, puff);
  }
  hide(i: number) { this.mesh.setMatrixAt(i, hidden); }
  /** Uploads this frame's changes and draws only the first `count` instances. */
  commit(count = this.mesh.instanceMatrix.count) { this.mesh.count = count; this.mesh.instanceMatrix.needsUpdate = true; this.kinds.needsUpdate = true; this.states.needsUpdate = true; }
  dispose() { this.mesh.geometry.dispose(); }
}
