import * as THREE from 'three';
import type { RacerProfile } from '../../../../shared/game/index.ts';
import { ellipsoid, ball, rbox, cyl, torus, lathe } from '../../geometry/primitives.ts';
import { sweep, horn, tube } from '../../geometry/sweep.ts';
import { Rig } from '../rig.ts';
import type { Build, Wheel } from '../types.ts';
import { eyes } from '../parts/eyes.ts';
import { wheel } from '../parts/wheel.ts';

export function goblin(c: RacerProfile): Build {
  const r = new Rig(), wood = r.t('#a26c3b'), woodD = r.t('#7a4c27'), skin = r.t(c.color), skinL = r.t(c.light), hood = r.t('#c23b45'), wheels: Wheel[] = [], steer: THREE.Object3D[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const cart = r.joint(r.model);
  r.add(cart, wood, rbox(1.8, .3, 2.5, .05, [0, .62, 0]));
  for (const x of [-.6, 0, .6]) r.add(cart, woodD, rbox(.04, .31, 2.5, .01, [x, .62, 0]));
  for (const s of [-1, 1]) r.add(cart, wood, rbox(.12, .42, 2.2, .04, [s * .88, .92, -.1]));
  r.add(cart, woodD, rbox(1.8, .42, .12, .04, [0, .92, -1.2]), cyl(.14, .14, 2.0, [0, .6, 1.32], [0, 0, Math.PI / 2], 12));
  r.add(cart, r.t('#5a5f6b'), tube([[0, .8, .9], [0, 1.15, .6]], .05), torus(.22, .035, [0, 1.2, .55], [-.9, 0, 0]));
  r.add(cart, r.t('#878c97'), cyl(.12, .15, .6, [.55, .95, -1.35], [-1.2, 0, 0], 12)); exhausts.push(r.joint(cart, [.55, 1.12, -1.62]));
  r.add(cart, r.t('#e9c553'), rbox(.5, .3, .02, .02, [-.45, 1.0, -1.27]));
  for (const s of [-1, 1]) { const st = r.joint(cart, [s * 1.0, .36, .9]); steer.push(st); wheels.push(wheel(r, st, [0, 0, 0], .36, .26, '#c39a52')); wheels.push(wheel(r, cart, [s * 1.0, .42, -.85], .42, .3, '#c39a52')); contacts.push(r.joint(cart, [s * 1.0, .03, -.95])); }
  const body = r.joint(r.model, [0, 1.3, -.25]);
  r.add(body, r.t('#b5713f'), ellipsoid([.55, .55, .48])); r.add(body, r.t('#6b4a2b'), torus(.5, .06, [0, -.12, 0], [Math.PI / 2, 0, 0]));
  for (const s of [-1, 1]) r.add(body, skin, tube([[s * .48, .25, .05], [s * .42, .05, .45], [s * .22, -.05, .72]], .11), ball(.14, [s * .2, -.05, .78]));
  const head = r.joint(body, [0, .85, .1]);
  r.add(head, skin, ellipsoid([.55, .5, .5])); r.add(head, skinL, ellipsoid([.2, .17, .26], [0, -.06, .5]));
  r.add(head, r.t('#fff6dc'), horn([[-.13, -.25, .4], [-.13, -.38, .42]], .05), horn([[.13, -.25, .4], [.13, -.38, .42]], .05));
  const blink = eyes(r, head, { y: .06, z: .38, sep: .2, w: .12, h: .13, turn: .45, iris: '#ffd23f', pupil: '#1a1208', slit: true });
  r.add(head, r.t('#3b5e2a'), rbox(.22, .05, .06, .02, [-.2, .2, .45], [0, 0, -.35]), rbox(.22, .05, .06, .02, [.2, .2, .45], [0, 0, .35]));
  r.add(head, hood, lathe([[.6, 0], [.58, .14], [.48, .3], [.28, .42], [.0001, .46]], [0, .12, -.04]), torus(.6, .06, [0, .12, -.04], [Math.PI / 2, 0, 0]));
  r.add(head, hood, horn([[0, .5, -.1], [0, .62, -.45], [0, .4, -.8]], .16));
  const ears: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const e = r.joint(head, [s * .48, .04, -.05]); ears.push(e); r.add(e, skin, sweep([[0, 0, 0], [s * .35, .12, -.06], [s * .7, .3, -.18]], t => .17 * (1 - t) + .01, { flat: .35, up: [0, 0, 1] })); r.add(e, r.t('#5f8f45', { noOutline: true }), sweep([[s * .05, .01, .04], [s * .35, .13, .0], [s * .6, .27, -.1]], t => .09 * (1 - t) + .01, { flat: .3, up: [0, 0, 1] })); }
  let ev = 0, ea = 0;
  return { r, head, height: 3.1, wheels, steer, exhausts, contacts, outline: '#1f2a16', update(s, k) {
    ev += ((Math.sin(s.t * 20) * .3 * k - s.steer * .4 - ea) * 80 - ev * 6) * s.dt; ea += ev * s.dt;
    ears.forEach((e, i) => { e.rotation.z = (i ? 1 : -1) * (ea * .5 - k * .15); e.rotation.y = (i ? -1 : 1) * k * .3; });
    body.position.y = 1.3 + Math.abs(Math.sin(s.t * 14)) * .04 * k; head.rotation.y = s.menu ? Math.sin(s.t * .9) * .4 : s.steer * .3;
    blink.scale.y = (s.t * .9 + .4) % 3 < .1 ? .1 : 1;
  } };
}
