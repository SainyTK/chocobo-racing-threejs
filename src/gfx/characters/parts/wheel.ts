import * as THREE from 'three';
import { cyl, lathe, rbox } from '../../geometry/primitives.ts';
import type { V3 } from '../../geometry/transform.ts';
import { shade } from '../math.ts';
import type { Rig } from '../rig.ts';
import type { Wheel } from '../types.ts';

/** Rubber tyre, rim and hub on its own spin joint. */
export function wheel(r: Rig, parent: THREE.Object3D, pos: V3, radius: number, width: number, rimColor = '#d9dee6', knobby = false) {
  const j = r.joint(parent, pos), side = Math.sign(pos[0]) || 1, w = width / 2, tire = r.t('#26272f');
  r.add(j, tire, lathe([[radius * .6, -w], [radius * .9, -w], [radius, -w * .55], [radius, w * .55], [radius * .9, w], [radius * .6, w]], [0, 0, 0], [0, 0, Math.PI / 2], radius > .2 ? 18 : 10));
  r.add(j, r.t(rimColor), cyl(radius * .62, radius * .62, width * .86, [0, 0, 0], [0, 0, Math.PI / 2], 18));
  r.add(j, r.t('#4b4f5c'), cyl(radius * .26, radius * .3, width * .2, [side * w * .95, 0, 0], [0, 0, Math.PI / 2], 12));
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; r.add(j, r.t(shade(rimColor, .7)), rbox(width * .1, radius * .1, radius * .42, .02, [side * w * .88, Math.sin(a) * radius * .36, Math.cos(a) * radius * .36], [a, 0, 0])); }
  if (knobby) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; r.add(j, tire, rbox(width * .96, radius * .12, radius * .2, .03, [0, Math.sin(a) * radius * 1.01, Math.cos(a) * radius * 1.01], [-a, 0, 0])); }
  return { j, r: radius } as Wheel;
}
