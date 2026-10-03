import * as THREE from 'three';
import type { RacerProfile } from '../../../../shared/game/index.ts';
import { ellipsoid, ball, rbox, cyl } from '../../geometry/primitives.ts';
import { sweep, horn, tube } from '../../geometry/sweep.ts';
import { Rig } from '../rig.ts';
import type { Build, Wheel } from '../types.ts';
import { eyes } from '../parts/eyes.ts';
import { wheel } from '../parts/wheel.ts';

export function behemoth(c: RacerProfile): Build {
  const r = new Rig(), fur = r.t(c.color), furL = r.t(c.light), mane = r.t('#574276'), bone = r.t('#f2dcae'), frame = r.t('#e8783e'), body = r.t('#5f586f'), wheels: Wheel[] = [], steer: THREE.Object3D[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const car = r.joint(r.model);
  r.add(car, body, rbox(2.1, .45, 2.9, .16, [0, .78, 0]), rbox(1.7, .35, .8, .14, [0, .9, 1.25], [.3, 0, 0]));
  r.add(car, r.t('#ffd84a'), rbox(2.15, .08, .3, .03, [0, 1.02, .6]), rbox(2.15, .08, .3, .03, [0, 1.02, -.6]));
  r.add(car, frame, tube([[-.95, .95, -1.1], [-.88, 2.2, -1.0], [-.6, 2.85, -.95], [.6, 2.85, -.95], [.88, 2.2, -1.0], [.95, .95, -1.1]], .07), tube([[-.82, 2.6, -.98], [-.85, 1.7, .6], [-.9, 1.0, 1.2]], .06), tube([[.82, 2.6, -.98], [.85, 1.7, .6], [.9, 1.0, 1.2]], .06));
  r.add(car, r.t('#3a3644'), rbox(1.3, .5, .6, .1, [0, 1.18, -1.25]));
  for (const s of [-1, 1]) {
    r.add(car, r.t('#bfc4cc'), cyl(.09, .11, .7, [s * .45, 1.55, -1.42], [-.3, 0, 0], 12)); exhausts.push(r.joint(car, [s * .45, 1.9, -1.55]));
    r.add(car, r.g('#ff3a3a', 2), rbox(.2, .1, .04, .02, [s * .8, .85, -1.47]));
    const st = r.joint(car, [s * 1.18, .55, 1.0]); steer.push(st); wheels.push(wheel(r, st, [0, 0, 0], .55, .5, '#e8783e', true));
    wheels.push(wheel(r, car, [s * 1.22, .64, -1.0], .64, .58, '#e8783e', true)); contacts.push(r.joint(car, [s * 1.22, .04, -1.1]));
  }
  const torso = r.joint(r.model, [0, 1.95, -.25]);
  r.add(torso, fur, ellipsoid([.95, .82, .9])); r.add(torso, furL, ellipsoid([.62, .6, .4], [0, -.12, .55]));
  for (let k = 0; k < 6; k++) r.add(torso, mane, horn([[(k % 2 - .5) * .4, .62 - k * .12, -.45 - k * .1], [(k % 2 - .5) * .5, .9 - k * .14, -.75 - k * .1], [(k % 2 - .5) * .6, 1.05 - k * .16, -1.05 - k * .08]], .17));
  const arms: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const a = r.joint(torso, [s * .82, .25, .2]); arms.push(a); r.add(a, fur, sweep([[0, 0, 0], [s * .2, -.35, .35], [s * .1, -.5, .8]], t => .26 - t * .06)); r.add(a, furL, ball(.22, [s * .08, -.5, .9])); for (const x of [-.08, 0, .08]) r.add(a, bone, horn([[s * .08 + x, -.45, 1.05], [s * .08 + x, -.52, 1.15]], .04)); }
  const tail = r.joint(torso, [0, -.2, -.85]); r.add(tail, fur, tube([[0, 0, 0], [0, .3, -.5], [0, .9, -.75], [0, 1.3, -.6]], .09)); r.add(tail, mane, ellipsoid([.2, .32, .2], [0, 1.4, -.55]));
  const head = r.joint(torso, [0, .75, .75]);
  r.add(head, fur, ellipsoid([.72, .62, .6])); r.add(head, furL, ellipsoid([.56, .34, .42], [0, -.24, .45]));
  r.add(head, r.t('#3c2b4e'), ellipsoid([.2, .11, .1], [0, -.08, .84]));
  for (const s of [-1, 1]) {
    r.add(head, bone, horn([[s * .2, -.32, .7], [s * .22, -.5, .74], [s * .2, -.66, .7]], .07));
    r.add(head, bone, horn([[s * .42, .38, .05], [s * .82, .78, -.05], [s * 1.15, .7, -.42], [s * 1.12, .35, -.6], [s * .95, .2, -.45]], .2));
    r.add(head, mane, rbox(.3, .07, .08, .03, [s * .24, .27, .53], [0, s * -.2, s * .38]));
  }
  for (let k = 0; k < 5; k++) { const a = (k - 2) * .45; r.add(head, mane, horn([[Math.sin(a) * .45, .35, -.25], [Math.sin(a) * .65, .55, -.55], [Math.sin(a) * .8, .45, -.9]], .2)); }
  const blink = eyes(r, head, { y: .1, z: .45, sep: .26, w: .13, h: .12, turn: .5, iris: '#ffc94a', slit: true });
  return { r, head, height: 4.0, wheels, steer, exhausts, contacts, outline: '#22182e', update(s, k) {
    torso.position.y = 1.95 + Math.abs(Math.sin(s.t * 12)) * .04 * k + Math.sin(s.t * 1.8) * .03;
    tail.rotation.y = Math.sin(s.t * 3) * .3 - s.steer * .3; tail.rotation.x = -k * .5;
    arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * s.steer * .12; });
    head.rotation.y = s.menu ? Math.sin(s.t * .6) * .3 : s.steer * .25; head.rotation.x = Math.sin(s.t * 1.8) * .03;
    blink.scale.y = (s.t * .6 + 2) % 3.8 < .1 ? .1 : 1;
  } };
}
