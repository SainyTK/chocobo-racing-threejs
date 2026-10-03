import * as THREE from 'three';
import { ellipsoid, ball, rbox, cyl, torus } from '../../geometry/primitives.ts';
import { feather, horn, tube } from '../../geometry/sweep.ts';
import { clamp } from '../math.ts';
import { Rig } from '../rig.ts';
import type { Build, Wheel } from '../types.ts';
import { eyes } from '../parts/eyes.ts';
import { wheel } from '../parts/wheel.ts';

export function mog(): Build {
  const r = new Rig(), blue = r.t('#3f8bd8'), deep = r.t('#2a5f9c'), chrome = r.t('#d8dde4'), fur = r.t('#fbf3ef'), pink = r.t('#f2c6c2'), wheels: Wheel[] = [], steer: THREE.Object3D[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const car = r.joint(r.model);
  r.add(car, blue, rbox(1.75, .55, 2.6, .26, [0, .66, -.05]), ellipsoid([.82, .4, .7], [0, .66, 1.05]), rbox(1.8, .3, 1.0, .14, [0, .95, -.85]));
  r.add(car, deep, rbox(1.82, .12, 2.5, .05, [0, .48, -.05]));
  r.add(car, r.t('#26304a'), rbox(1.25, .16, 1.15, .07, [0, .98, -.2]), rbox(1.2, .62, .22, .1, [0, 1.25, -.72]));
  r.add(car, r.t('#ffe07a'), rbox(.5, .05, 2.3, .02, [0, .94, .1]));
  r.add(car, r.t('#9fd6ff'), rbox(1.1, .26, .03, .015, [0, 1.12, .62], [-.6, 0, 0])); r.add(car, r.t('#d8dde4'), torus(.03, .02, [-.55, 1.0, .66]), torus(.03, .02, [.55, 1.0, .66]));
  r.add(car, chrome, rbox(1.9, .14, .18, .07, [0, .5, 1.52]), rbox(1.9, .14, .18, .07, [0, .5, -1.38]), torus(.24, .035, [0, 1.3, .3], [-1.0, 0, 0]));
  for (const s of [-1, 1]) {
    r.add(car, r.g('#fff2c8', 2.4), ellipsoid([.14, .12, .06], [s * .5, .72, 1.6])); r.add(car, r.g('#ff3a3a', 2.2), rbox(.26, .12, .05, .03, [s * .62, .78, -1.4]));
    r.add(car, chrome, cyl(.08, .1, .36, [s * .38, .48, -1.48], [Math.PI / 2, 0, 0], 12)); exhausts.push(r.joint(car, [s * .38, .48, -1.68]));
    const st = r.joint(car, [s * .86, .38, .88]); steer.push(st); wheels.push(wheel(r, st, [0, 0, 0], .38, .32));
    wheels.push(wheel(r, car, [s * .86, .38, -.85], .38, .32)); contacts.push(r.joint(car, [s * .86, .03, -.95]));
  }
  const body = r.joint(r.model, [0, 1.42, -.18]); r.add(body, fur, ellipsoid([.56, .5, .5]));
  for (const s of [-1, 1]) r.add(body, fur, tube([[s * .45, .15, .1], [s * .45, .1, .45], [s * .25, -.08, .55]], .13), ball(.15, [s * .25, -.06, .58]));
  const head = r.joint(body, [0, .78, .1]); r.add(head, fur, ellipsoid([.68, .6, .6]));
  r.add(head, r.t('#e6455c'), ellipsoid([.13, .1, .1], [0, -.12, .57]));
  r.add(head, r.t('#f7a8b4', { noOutline: true }), ellipsoid([.12, .07, .04], [-.36, -.13, .48], [0, -.5, 0]), ellipsoid([.12, .07, .04], [.36, -.13, .48], [0, .5, 0]));
  const blink = eyes(r, head, { y: .06, z: .5, sep: .24, w: .1, h: .13, turn: .38, iris: '#3a2430' });
  for (const s of [-1, 1]) { r.add(head, fur, horn([[s * .34, .36, 0], [s * .5, .64, -.02], [s * .62, .9, -.06]], .2)); r.add(head, pink, horn([[s * .35, .4, .07], [s * .5, .64, .06], [s * .58, .82, .02]], .1)); }
  r.add(head, r.t('#965356'), tube([[0, .55, -.05], [0, .82, -.1], [0, 1.05, -.18]], .028, 8));
  const pom = r.joint(head, [0, 1.12, -.2]); r.add(pom, r.t('#f34364'), ball(.21));
  const wings: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const w = r.joint(body, [s * .3, .3, -.42]); wings.push(w); for (let k = 0; k < 3; k++) r.add(w, r.t(k === 1 ? '#8f5bb8' : '#a774c6'), feather([0, 0, 0], [s * (.25 + k * .05), .18 - k * .12, -.12], [s * (.55 + k * .08), .32 - k * .22, -.2], .14, .22, [0, 0, 1])); }
  let pv = 0, px = 0, pvz = 0, pz = 0;
  return { r, head, height: 3.6, wheels, steer, exhausts, contacts, outline: '#3a2a3a', update(s, k) {
    const ax = -s.steer * 3 * k, az = (s.menu ? 0 : -k) * 1.2;
    pv += ((ax - px) * 60 - pv * 5) * s.dt; px += pv * s.dt; pvz += ((az - pz) * 60 - pvz * 5) * s.dt; pz += pvz * s.dt;
    pom.rotation.z = clamp(px * .3, -.8, .8); pom.rotation.x = clamp(pz * .3 + Math.sin(s.t * 18) * .05 * k, -.8, .8);
    wings.forEach((w, i) => { w.rotation.y = (i ? 1 : -1) * (Math.sin(s.t * (s.flying > 0 ? 30 : 8)) * (s.flying > 0 ? .7 : .25)); });
    body.position.y = 1.42 + Math.sin(s.t * 5) * .015 + Math.sin(s.t * 23) * .01 * k;
    head.rotation.y = s.menu ? Math.sin(s.t * .8) * .3 : s.steer * .25; head.rotation.z = -s.steer * .1;
    blink.scale.y = (s.t * .6 + .7) % 3.2 < .1 ? .1 : 1;
  } };
}
