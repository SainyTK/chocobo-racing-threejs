import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type V3 = [number, number, number];
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();

/** Bakes a transform into a geometry so outlines and merged batches stay uniform. */
export function xf<T extends THREE.BufferGeometry>(g: T, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 | number = 1): T {
  const k = typeof scale === 'number' ? [scale, scale, scale] : scale;
  e.set(rot[0], rot[1], rot[2]); q.setFromEuler(e); m4.compose(p.set(...pos), q, s.set(k[0], k[1], k[2])); g.applyMatrix4(m4); return g;
}
export const ellipsoid = (r: V3, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], detail = 1) =>
  xf(new THREE.SphereGeometry(1, Math.max(8, Math.round(16 * detail)), Math.max(6, Math.round(11 * detail))), pos, rot, r);
export const ball = (r: number, pos: V3 = [0, 0, 0], detail = 1) => ellipsoid([r, r, r], pos, [0, 0, 0], detail);
/** Rounded box. Tiny radii fall back to a plain box, since the bevel would be sub-pixel and costs hundreds of triangles. */
export const rbox = (w: number, h: number, d: number, r: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) =>
  xf(r < .04 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, r >= .12 ? 2 : 1, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001)), pos, rot);
export const cyl = (rt: number, rb: number, h: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], seg = 14) =>
  xf(new THREE.CylinderGeometry(rt, rb, h, seg), pos, rot);
export const torus = (r: number, tube: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], arc = Math.PI * 2) =>
  xf(new THREE.TorusGeometry(r, tube, 8, 20, arc), pos, rot);
/** Rotationally symmetric profile around Y: points are [radius, height]. */
export const lathe = (profile: [number, number][], pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], seg = 20, scale: V3 | number = 1) =>
  xf(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, .0001), y)), seg), pos, rot, scale);
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
