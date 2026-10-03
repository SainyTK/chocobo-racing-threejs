import * as THREE from 'three';
import { vertex, fragment } from './shaders.ts';

/** Particle sprite shapes, drawn procedurally in the fragment shader. */
export const enum Shape { Glow = 0, Star = 1, Smoke = 2, Ring = 3, Shard = 4 }
export interface Emit {
  x: number; y: number; z: number; vx?: number; vy?: number; vz?: number;
  life: number; size: number; endSize?: number; color: THREE.ColorRepresentation; endColor?: THREE.ColorRepresentation;
  alpha?: number; drag?: number; gravity?: number; stretch?: number; shape?: Shape; spin?: number;
}

/**
 * Billboarded instanced particles. CPU simulation, one draw per pool.
 * Instanced quads avoid the point-size caps of gl.POINTS so large explosions stay correct.
 */
export class Particles {
  mesh: THREE.Mesh; private geo: THREE.InstancedBufferGeometry; private n = 0;
  private pos: Float32Array; private vel: Float32Array; private col: Float32Array; private misc: Float32Array;
  private sim: Float32Array; private cols: Float32Array; static readonly S = 10;
  constructor(public capacity: number, additive: boolean) {
    const quad = new THREE.PlaneGeometry(1, 1); this.geo = new THREE.InstancedBufferGeometry(); this.geo.index = quad.index; this.geo.setAttribute('position', quad.attributes.position);
    this.pos = new Float32Array(capacity * 3); this.vel = new Float32Array(capacity * 3); this.gpuVel = new Float32Array(capacity * 3); this.col = new Float32Array(capacity * 4); this.misc = new Float32Array(capacity * 3);
    this.sim = new Float32Array(capacity * Particles.S); this.cols = new Float32Array(capacity * 6);
    for (const [name, arr, size] of [['iPos', this.pos, 3], ['iVel', this.gpuVel, 3], ['iColor', this.col, 4], ['iMisc', this.misc, 3]] as const) { const a = new THREE.InstancedBufferAttribute(arr, size); a.setUsage(THREE.DynamicDrawUsage); this.geo.setAttribute(name, a); }
    this.geo.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex, fragmentShader: fragment.replaceAll('ADDITIVE', additive ? 'true' : 'false'),
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, material); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2;
  }
  private c = new THREE.Color(); private c2 = new THREE.Color();
  emit(e: Emit) {
    if (this.n >= this.capacity) return;
    const i = this.n++, s = i * Particles.S, p = i * 3;
    this.pos[p] = e.x; this.pos[p + 1] = e.y; this.pos[p + 2] = e.z;
    this.vel[p] = e.vx || 0; this.vel[p + 1] = e.vy || 0; this.vel[p + 2] = e.vz || 0;
    this.sim.set([0, e.life, e.size, e.endSize ?? e.size, e.alpha ?? 1, e.drag ?? 0, e.gravity ?? 0, e.stretch ?? 0, e.shape ?? 0, e.spin ?? Math.random() * 6.28], s);
    this.c.set(e.color); this.c2.set(e.endColor ?? e.color); this.cols.set([this.c.r, this.c.g, this.c.b, this.c2.r, this.c2.g, this.c2.b], i * 6);
  }
  update(dt: number) {
    const S = Particles.S;
    for (let i = 0; i < this.n; i++) {
      const s = i * S; this.sim[s] += dt;
      if (this.sim[s] >= this.sim[s + 1]) { this.n--; if (i !== this.n) this.move(this.n, i); i--; continue; }
      const p = i * 3, drag = Math.exp(-this.sim[s + 5] * dt);
      this.vel[p] *= drag; this.vel[p + 1] = this.vel[p + 1] * drag - this.sim[s + 6] * dt; this.vel[p + 2] *= drag;
      this.pos[p] += this.vel[p] * dt; this.pos[p + 1] += this.vel[p + 1] * dt; this.pos[p + 2] += this.vel[p + 2] * dt;
    }
    for (let i = 0; i < this.n; i++) {
      const s = i * S, t = this.sim[s] / this.sim[s + 1], c = i * 6, q = i * 4, m = i * 3;
      const fade = Math.min(1, t * 8) * (1 - t) ** 1.4;
      this.col[q] = this.cols[c] + (this.cols[c + 3] - this.cols[c]) * t; this.col[q + 1] = this.cols[c + 1] + (this.cols[c + 4] - this.cols[c + 1]) * t; this.col[q + 2] = this.cols[c + 2] + (this.cols[c + 5] - this.cols[c + 2]) * t;
      this.col[q + 3] = this.sim[s + 4] * fade;
      this.misc[m] = this.sim[s + 2] + (this.sim[s + 3] - this.sim[s + 2]) * t; this.misc[m + 1] = this.sim[s + 9] + this.sim[s] * 2; this.misc[m + 2] = this.sim[s + 8];
    }
    this.stretchVel(); this.geo.instanceCount = this.n;
    for (const name of ['iPos', 'iVel', 'iColor', 'iMisc']) { const a = this.geo.getAttribute(name) as THREE.InstancedBufferAttribute; a.clearUpdateRanges(); a.addUpdateRange(0, this.n * a.itemSize); a.needsUpdate = true; }
  }
  /** Velocity uploaded to the GPU is scaled by each particle's stretch factor, so round particles get zero. */
  private gpuVel: Float32Array;
  private stretchVel() {
    for (let i = 0; i < this.n; i++) { const k = this.sim[i * Particles.S + 7], p = i * 3; this.gpuVel[p] = this.vel[p] * k; this.gpuVel[p + 1] = this.vel[p + 1] * k; this.gpuVel[p + 2] = this.vel[p + 2] * k; }
  }
  private move(from: number, to: number) {
    const S = Particles.S;
    this.pos.copyWithin(to * 3, from * 3, from * 3 + 3); this.vel.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.sim.copyWithin(to * S, from * S, from * S + S); this.cols.copyWithin(to * 6, from * 6, from * 6 + 6);
  }
  clear() { this.n = 0; this.geo.instanceCount = 0; }
  get count() { return this.n; }
  dispose() { this.geo.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
