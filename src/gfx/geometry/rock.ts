import * as THREE from 'three';
import { xf, type V3 } from './transform.ts';

/** Low-detail faceted rock. Used with flat-shaded materials. */
export function rock(r: V3, pos: V3, seed: number, rot: V3 = [0, 0, 0]) {
  const g = new THREE.IcosahedronGeometry(1, 1), a = g.attributes.position as THREE.BufferAttribute, seen = new Map<string, number>();
  for (let i = 0; i < a.count; i++) {
    const key = `${a.getX(i).toFixed(3)},${a.getY(i).toFixed(3)},${a.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, .82 + .3 * Math.abs(Math.sin(seed * 12.9 + seen.size * 78.2)));
    const k = seen.get(key)!; a.setXYZ(i, a.getX(i) * k, a.getY(i) * k, a.getZ(i) * k);
  }
  g.computeVertexNormals(); return xf(g, pos, rot, r);
}
