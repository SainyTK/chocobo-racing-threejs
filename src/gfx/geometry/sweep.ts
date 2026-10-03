import * as THREE from 'three';
import type { V3 } from './transform.ts';

export interface SweepOptions { radial?: number; segments?: number; flat?: number; up?: V3; caps?: boolean }
/**
 * Sweeps a variable-radius cross-section along a smooth curve. Used for necks, feathers, horns, tails and tubes.
 * `flat` squashes the cross-section along the curve normal, which `up` orients; feathers use it to lie flat.
 */
export function sweep(points: V3[], radius: number | ((t: number) => number), o: SweepOptions = {}) {
  const radial = o.radial ?? 8, segments = o.segments ?? 12, flat = o.flat ?? 1, rf = typeof radius === 'number' ? () => radius : radius;
  const curve = new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v)), false, 'centripetal');
  const up = new THREE.Vector3(...(o.up ?? [0, 1, 0])), pos: number[] = [], idx: number[] = [];
  let n = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, c = curve.getPointAt(t), tan = curve.getTangentAt(t).normalize();
    if (i === 0) { n.copy(up).addScaledVector(tan, -up.dot(tan)); if (n.lengthSq() < 1e-6) n.set(1, 0, 0).addScaledVector(tan, -tan.x); n.normalize(); }
    else n.addScaledVector(tan, -n.dot(tan)).normalize();
    const b = new THREE.Vector3().crossVectors(tan, n), r = rf(t);
    for (let j = 0; j < radial; j++) { const a = j / radial * Math.PI * 2; pos.push(c.x + (Math.cos(a) * n.x * flat + Math.sin(a) * b.x) * r, c.y + (Math.cos(a) * n.y * flat + Math.sin(a) * b.y) * r, c.z + (Math.cos(a) * n.z * flat + Math.sin(a) * b.z) * r); }
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b2 = i * radial + (j + 1) % radial, c = a + radial, d = b2 + radial; idx.push(a, b2, c, b2, d, c); }
  if (o.caps !== false) for (const [end, t] of [[0, 0], [segments, 1]] as const) {
    const c = curve.getPointAt(t), center = pos.length / 3; pos.push(c.x, c.y, c.z);
    for (let j = 0; j < radial; j++) { const a = end * radial + j, b2 = end * radial + (j + 1) % radial; if (t === 0) idx.push(center, b2, a); else idx.push(center, a, b2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** Tapered, flattened, slightly cupped feather from `a` through `mid` to `b`. */
export const feather = (a: V3, mid: V3, b: V3, width: number, flat = .32, up: V3 = [0, 1, 0]) =>
  sweep([a, mid, b], t => width * Math.sin(Math.PI * Math.min(1, .12 + t * .95)) * (1 - t * .35), { flat, up, radial: 6, segments: 8 });
/** Horn or claw: thick root tapering to a point. */
export const horn = (pts: V3[], root: number) => sweep(pts, t => root * (1 - t) ** .8 + .004, { radial: 8, segments: 10 });
/** Rounded tube with a constant radius. */
export const tube = (pts: V3[], r: number, radial = 8) => sweep(pts, r, { radial, segments: Math.max(6, pts.length * 4) });
