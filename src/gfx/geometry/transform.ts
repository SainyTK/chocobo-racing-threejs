import * as THREE from 'three';

export type V3 = [number, number, number];
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();

/** Bakes a transform into a geometry so outlines and merged batches stay uniform. */
export function xf<T extends THREE.BufferGeometry>(g: T, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 | number = 1): T {
  const k = typeof scale === 'number' ? [scale, scale, scale] : scale;
  e.set(rot[0], rot[1], rot[2]); q.setFromEuler(e); m4.compose(p.set(...pos), q, s.set(k[0], k[1], k[2])); g.applyMatrix4(m4); return g;
}
