import * as THREE from 'three';
import type { RacerProfile } from '../../../../shared/game/index.ts';
import { ellipsoid, rbox, cyl, torus } from '../../geometry/primitives.ts';
import { rock } from '../../geometry/rock.ts';
import { xf } from '../../geometry/transform.ts';
import { Rig } from '../rig.ts';
import type { Build, Wheel } from '../types.ts';
import { wheel } from '../parts/wheel.ts';

export function golem(c: RacerProfile): Build {
  const r = new Rig(), stone = r.t(c.color, { flat: true }), pale = r.t(c.light, { flat: true }), moss = r.t('#6c9a4a', { flat: true }), iron = r.t('#5d6169'), olive = r.t('#87926b'), chrome = r.t('#c4c9d2'), wheels: Wheel[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const car = r.joint(r.model);
  r.add(car, olive, rbox(2.2, .55, 2.5, .18, [0, .78, -.1]), rbox(2.0, .5, .6, .15, [0, .95, .95]));
  r.add(car, r.t('#f2c842'), rbox(2.25, .1, .1, .03, [0, 1.06, -.1]), rbox(2.25, .1, .1, .03, [0, .72, 1.27]));
  r.add(car, iron, rbox(2.3, .18, .32, .05, [0, .55, -1.35]));
  const drum = r.joint(car, [0, .55, 1.55]); r.add(drum, iron, cyl(.55, .55, 2.0, [0, 0, 0], [0, 0, Math.PI / 2], 24)); for (const x of [-.7, -.25, .25, .7]) r.add(drum, r.t('#7a7f88'), torus(.56, .05, [x, 0, 0], [0, Math.PI / 2, 0]));
  r.add(car, olive, rbox(.14, .5, .9, .05, [-1.05, .75, 1.35]), rbox(.14, .5, .9, .05, [1.05, .75, 1.35]));
  wheels.push({ j: drum, r: .55 });
  for (const s of [-1, 1]) { wheels.push(wheel(r, car, [s * 1.22, .62, -.8], .62, .46, '#b7a46e', true)); contacts.push(r.joint(car, [s * 1.22, .04, -.9])); }
  // V8 block with eight stacks.
  r.add(car, chrome, rbox(1.1, .45, .75, .12, [0, 1.3, -1.0]), rbox(.6, .2, .6, .08, [0, 1.6, -1.0]));
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const z = -1.3 + i * .2; r.add(car, chrome, cyl(.06, .07, .55, [s * .48, 1.62, z], [0, 0, s * .25], 10)); if (i % 2) exhausts.push(r.joint(car, [s * .55, 1.92, z])); }
  const body = r.joint(r.model, [0, 2.05, -.1]);
  r.add(body, stone, rock([.95, .85, .75], [0, 0, 0], 1), rock([.55, .45, .5], [0, -.55, .05], 2));
  r.add(body, pale, rock([.38, .3, .2], [0, .05, .62], 3));
  r.add(body, r.g('#ffd84a', 2.6), xf(new THREE.OctahedronGeometry(.13), [0, .08, .8]));
  const arms: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    r.add(body, stone, rock([.48, .44, .46], [s * 1.0, .42, 0], 4 + s)); r.add(body, moss, rock([.32, .12, .3], [s * 1.0, .82, 0], 7 + s));
    const arm = r.joint(body, [s * 1.0, .2, .1]); arms.push(arm);
    r.add(arm, stone, rock([.3, .4, .3], [s * .1, -.35, .15], 9 + s), rock([.26, .26, .45], [s * .02, -.6, .55], 11 + s), rock([.26, .22, .24], [-s * .1, -.62, .95], 13 + s));
  }
  const head = r.joint(body, [0, .95, .1]);
  r.add(head, stone, rock([.52, .46, .48], [0, 0, 0], 20)); r.add(head, pale, rock([.5, .14, .2], [0, .2, .38], 21)); r.add(head, moss, rock([.4, .14, .38], [0, .42, -.05], 22));
  const blink = r.joint(head, [0, .02, .42]); for (const s of [-1, 1]) r.add(blink, r.g('#ffe066', 3.2), ellipsoid([.1, .065, .05], [s * .2, 0, 0], [0, 0, s * -.2], .6));
  return { r, head, height: 3.9, wheels, steer: [], exhausts, contacts, outline: '#2a241c', update(s, k) {
    body.position.y = 2.05 + Math.sin(s.t * 18) * .02 * k + Math.sin(s.t * 1.5) * .02;
    arms.forEach((a, i) => { a.rotation.x = Math.sin(s.t * 1.5 + i) * .03; a.rotation.z = (i ? -1 : 1) * s.steer * .1; });
    head.rotation.y = s.menu ? Math.sin(s.t * .5) * .3 : s.steer * .2; blink.scale.y = (s.t * .5) % 4 < .12 ? .15 : 1;
  } };
}
