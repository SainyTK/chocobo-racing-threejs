import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { xf, type V3 } from './transform.ts';

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
