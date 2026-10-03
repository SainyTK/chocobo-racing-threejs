import * as THREE from 'three';
import { xf, type V3 } from '../../geometry/transform.ts';
import { noise3 } from '../noise.ts';

export { ellipsoid, ball, rbox, cyl, torus, lathe } from '../../geometry/primitives.ts';
export { rock } from '../../geometry/rock.ts';
export { sweep, tube, horn } from '../../geometry/sweep.ts';
export { xf, type V3 };

/** Lumpy low-poly blob for canopies, bushes, clouds and candy. `lump` 0 is a clean sphere. */
export function blob(r: V3 | number, pos: V3 = [0, 0, 0], seed = 0, lump = .22, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail), a = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), y = a.getY(i), z = a.getZ(i), k = 1 + (noise3(x * 1.7 + seed * 3.1, y * 1.7, z * 1.7 + seed) - .5) * 2 * lump;
    a.setXYZ(i, x * k, y * k * (y < 0 ? .75 : 1), z * k);
  }
  g.computeVertexNormals();
  return xf(g, pos, [0, seed * 1.3, 0], typeof r === 'number' ? [r, r, r] : r);
}
/** Small round bit (berry, bead, knob) at 20 triangles. Use it instead of `ball` for anything under half a metre. */
export const bead = (r: number, pos: V3 = [0, 0, 0], sy = 1) => xf(new THREE.IcosahedronGeometry(1, 0), pos, [0, 0, 0], [r, r * sy, r]);
/** Flat disc lying on +y, for spots, lily pads and flower heads. */
export const disc = (r: number, seg: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) => xf(new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2), pos, rot);
/** Box with its origin at the bottom centre. */
export const block = (w: number, h: number, d: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) => xf(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), pos, rot);
/** Prism or cone with its origin at the bottom centre. */
export const prism = (rt: number, rb: number, h: number, seg: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) => xf(new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0), pos, rot);
export const cone = (r: number, h: number, seg: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) => xf(new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0), pos, rot);
/** Flat card in the XY plane, for blades, leaves, flags and painted boards. */
export const card = (w: number, h: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], sx = 1, sy = 1) => xf(new THREE.PlaneGeometry(w, h, sx, sy).translate(0, h / 2, 0), pos, rot);
/** A single tapered blade or petal as one triangle pair. */
export function blade(w: number, h: number, bend: number, pos: V3 = [0, 0, 0], yaw = 0) {
  const g = new THREE.BufferGeometry(), b = bend;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, w * .2, h * .55, b * .4, -w * .2, h * .55, b * .4, 0, h, b], 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]); g.computeVertexNormals();
  return xf(g, pos, [0, yaw, 0]);
}
/** Gothic or round arch outline extruded to depth: legs plus a curved top, origin at the bottom centre. */
export function arch(span: number, height: number, thick: number, depth: number, pointed = false, seg = 10) {
  const s = new THREE.Shape(), r = span / 2, o = r + thick, legH = height - (pointed ? r * 1.25 : r);
  s.moveTo(-o, 0); s.lineTo(-o, legH);
  if (pointed) { s.quadraticCurveTo(-o, legH + o * 1.05, 0, legH + o * 1.45); s.quadraticCurveTo(o, legH + o * 1.05, o, legH); }
  else s.absarc(0, legH, o, Math.PI, 0, true);
  s.lineTo(o, 0); s.lineTo(r, 0); s.lineTo(r, legH);
  if (pointed) { s.quadraticCurveTo(r, legH + r * 1.05, 0, legH + r * 1.4); s.quadraticCurveTo(-r, legH + r * 1.05, -r, legH); }
  else s.absarc(0, legH, r, 0, Math.PI, false);
  s.lineTo(-r, 0); s.lineTo(-o, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: seg }).translate(0, 0, -depth / 2);
}
/** Paint helpers: vertical gradient and horizontal stripes in local coordinates. */
export const grad = (bottom: string, top: string, y0: number, y1: number) => { const a = new THREE.Color(bottom), b = new THREE.Color(top); return (_x: number, y: number, _z: number, out: THREE.Color) => { out.copy(a).lerp(b, Math.min(1, Math.max(0, (y - y0) / (y1 - y0)))); }; };
export const stripes = (a: string, b: string, period: number, axis: 'x' | 'y' | 'z' = 'y', slant = 0) => { const ca = new THREE.Color(a), cb = new THREE.Color(b); return (x: number, y: number, z: number, out: THREE.Color) => { const v = (axis === 'x' ? x : axis === 'y' ? y : z) + slant * (axis === 'y' ? x + z : y); out.copy(((Math.floor(v / period) % 2) + 2) % 2 === 0 ? ca : cb); }; };
