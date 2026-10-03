import * as THREE from 'three';
import { ellipsoid, ball } from '../../geometry/primitives.ts';
import type { V3 } from '../../geometry/transform.ts';
import type { Rig } from '../rig.ts';

/** Glossy cartoon eyes on a blink joint. */
export function eyes(r: Rig, head: THREE.Object3D, o: { y: number; z: number; sep: number; w: number; h: number; turn: number; iris: string; sclera?: string; pupil?: string; slit?: boolean }) {
  const blink = r.joint(head, [0, o.y, o.z]);
  for (const s of [-1, 1]) {
    const a = s * o.turn, dir: V3 = [Math.sin(a), 0, Math.cos(a)], c: V3 = [s * o.sep, 0, 0], at = (k: number, up = 0, side = 0): V3 => [c[0] + dir[0] * k + side * s, c[1] + up, c[2] + dir[2] * k];
    if (o.sclera !== 'none') r.add(blink, r.t(o.sclera || '#fffdf7'), ellipsoid([o.w, o.h, o.w * .5], c, [0, a, 0], .8));
    r.add(blink, r.t(o.iris, { noOutline: true }), ellipsoid(o.slit ? [o.w * .5, o.h * .8, o.w * .3] : [o.w * .74, o.h * .8, o.w * .3], at(o.w * .3, -o.h * .06), [0, a, 0], .8));
    r.add(blink, r.t(o.pupil || '#120d10', { noOutline: true }), ellipsoid(o.slit ? [o.w * .14, o.h * .68, o.w * .2] : [o.w * .4, o.h * .5, o.w * .2], at(o.w * .45, -o.h * .08), [0, a, 0], .7));
    r.add(blink, r.g('#ffffff', 1.3), ball(o.w * .2, at(o.w * .62, o.h * .32, -o.w * .14), .6), ball(o.w * .09, at(o.w * .6, -o.h * .3, o.w * .18), .5));
  }
  return blink;
}
