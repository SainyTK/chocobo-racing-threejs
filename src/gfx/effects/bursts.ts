import * as THREE from 'three';
import type { Race } from '../../../shared/game/index.ts';
import { shell } from '../materials/shell.ts';
import { decalMaterial } from '../materials/decal.ts';
import { sphereGeo, ringGeo, pillarGeo } from './geometries.ts';
import { floorY } from './util.ts';

export type BurstKind = 'ring' | 'pillar' | 'sphere';
export interface BurstOptions { grow?: number; follow?: string; height?: number }
interface Burst { mesh: THREE.Mesh; age: number; life: number; size: number; grow: number; follow?: string; kind: BurstKind }

/** Pooled one-shot meshes: shockwave rings, light pillars and blast spheres. */
export class Bursts {
  private pool: Burst[] = [];
  constructor(private group: THREE.Group) {}
  spawn(kind: BurstKind, at: THREE.Vector3, color: string, size: number, life: number, o: BurstOptions = {}) {
    let b = this.pool.find(x => x.kind === kind && x.age >= x.life && (x.mesh.material as THREE.ShaderMaterial).uniforms.uColor.value.equals(new THREE.Color(color)));
    if (!b) {
      const mat = kind === 'ring' ? decalMaterial('ring', color) : kind === 'pillar' ? shell(color, '#ffffff', { power: 1, intensity: 1.6 }) : shell(color, '#ffffff', { power: 1.6, intensity: 2.2 });
      if (kind === 'sphere') mat.side = THREE.DoubleSide;
      if (kind === 'pillar') { mat.side = THREE.DoubleSide; mat.uniforms.uColor = mat.uniforms.uInner; } if (kind === 'sphere') mat.uniforms.uColor = mat.uniforms.uInner;
      b = { mesh: new THREE.Mesh(kind === 'ring' ? ringGeo : kind === 'pillar' ? pillarGeo : sphereGeo, mat), age: 0, life, size, grow: 1, kind }; b.mesh.frustumCulled = false; b.mesh.renderOrder = 3; this.group.add(b.mesh); this.pool.push(b);
    }
    b.age = 0; b.life = life; b.size = size; b.grow = o.grow ?? 1; b.follow = o.follow; b.mesh.visible = true; b.mesh.position.copy(at); b.mesh.userData.height = o.height ?? 12;
  }
  update(dt: number, race: Race | null, time: number) {
    for (const b of this.pool) {
      if (b.age >= b.life) continue; b.age += dt; const t = Math.min(1, b.age / b.life), m = b.mesh.material as THREE.ShaderMaterial;
      if (b.age >= b.life) { b.mesh.visible = false; continue; }
      if (b.follow && race) { const r = race.racers.find(p => p.id === b.follow); if (r) b.mesh.position.set(r.px, floorY(race, r.px, r.pz) + 1.6, r.pz); }
      const ease = 1 - (1 - t) ** 3;
      if (b.kind === 'ring') { b.mesh.scale.setScalar(b.size * (.15 + ease * .85)); m.uniforms.uProgress.value = t; }
      if (b.kind === 'pillar') { const w = b.size * (1 - t * .6); b.mesh.scale.set(w, b.mesh.userData.height * Math.min(1, t * 4), w); m.uniforms.uOpacity.value = (1 - t) ** 1.5; }
      if (b.kind === 'sphere') { b.mesh.scale.setScalar(b.size * (b.grow >= 1 ? .2 + ease * .8 * b.grow : 1 + Math.sin(t * Math.PI) * b.grow)); m.uniforms.uOpacity.value = (1 - t) ** 1.6; }
      if (m.uniforms.uTime) m.uniforms.uTime.value = time;
    }
  }
  reset() { this.pool.forEach(b => { b.age = b.life; b.mesh.visible = false; }); }
}
