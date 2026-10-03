import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { skinUniforms } from '../materials/skin.ts';
import { toon } from '../materials/toon.ts';
import { glow } from '../materials/glow.ts';
import { outlineMaterial } from '../materials/outline.ts';
import type { V3 } from '../geometry/transform.ts';

function prep(g: THREE.BufferGeometry) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

export class Rig {
  root = new THREE.Group(); model = new THREE.Group(); skin = skinUniforms();
  private batches = new Map<THREE.Object3D, Map<THREE.Material, THREE.BufferGeometry[]>>();
  private mats = new Map<string, THREE.Material>();
  constructor() { this.root.add(this.model); }
  joint(parent: THREE.Object3D, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...pos); g.rotation.set(...rot); parent.add(g); return g; }
  /** Cached per-rig toon material. `flat` gives faceted stone; `noOutline` skips the hull. */
  t(color: string, o: { flat?: boolean; noOutline?: boolean; emissive?: string; ei?: number } = {}) {
    const key = `t${color}${o.flat ? 'f' : ''}${o.noOutline ? 'n' : ''}${o.emissive || ''}`;
    if (!this.mats.has(key)) { const m = toon(color, this.skin, { emissive: o.emissive, emissiveIntensity: o.ei }); m.userData.noOutline = !!o.noOutline; this.mats.set(key, m); }
    return this.mats.get(key)!;
  }
  g(color: string, intensity = 2.4) { const key = `g${color}${intensity}`; if (!this.mats.has(key)) this.mats.set(key, glow(color, intensity)); return this.mats.get(key)!; }
  add(j: THREE.Object3D, m: THREE.Material, ...geos: THREE.BufferGeometry[]) {
    if (!this.batches.has(j)) this.batches.set(j, new Map());
    const b = this.batches.get(j)!; if (!b.has(m)) b.set(m, []); b.get(m)!.push(...geos.map(prep));
  }
  /**
   * Merges each joint into as few draw calls as possible: every plain toon part is baked into one
   * vertex-coloured mesh, glows stay separate, and one inverted hull outlines the joint.
   */
  finish(outline: string, width = .032) {
    const line = outlineMaterial(outline, width, this.skin), base = toon('#ffffff', this.skin); base.vertexColors = true;
    const c = new THREE.Color();
    for (const [j, byMat] of this.batches) {
      const hull: THREE.BufferGeometry[] = [], baked: THREE.BufferGeometry[] = [];
      for (const [m, geos] of byMat) {
        const toonPart = m instanceof THREE.MeshToonMaterial && !m.emissive.getHex();
        // Small details (claws, knobs, eyes) get no hull: their outline would be sub-pixel at race distance.
        if (m instanceof THREE.MeshToonMaterial && !m.userData.noOutline) for (const x of geos) { x.computeBoundingSphere(); if (x.boundingSphere!.radius > .16) hull.push(x.clone().deleteAttribute('normal')); }
        if (toonPart) {
          c.copy(m.color);
          for (const x of geos) { const n = x.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3); x.setAttribute('color', new THREE.BufferAttribute(col, 3)); baked.push(x); }
          continue;
        }
        const g = mergeGeometries(geos); geos.forEach(x => x.dispose()); if (!g) continue;
        const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; j.add(mesh);
      }
      if (baked.length) { const g = mergeGeometries(baked); baked.forEach(x => x.dispose()); if (g) { const mesh = new THREE.Mesh(g, base); mesh.castShadow = mesh.receiveShadow = true; j.add(mesh); } }
      if (hull.length) { const merged = mergeGeometries(hull); hull.forEach(h => h.dispose()); if (merged) { const welded = mergeVertices(merged, 1e-3); merged.dispose(); welded.computeVertexNormals(); const o = new THREE.Mesh(welded, line); o.userData.outline = true; j.add(o); } }
    }
    this.batches.clear();
  }
}
