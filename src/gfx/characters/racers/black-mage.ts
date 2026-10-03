import * as THREE from 'three';
import { ellipsoid, ball, rbox, cyl, torus, lathe } from '../../geometry/primitives.ts';
import { sweep, horn, tube } from '../../geometry/sweep.ts';
import { damp } from '../math.ts';
import { Rig } from '../rig.ts';
import type { Build } from '../types.ts';

export function blackMage(): Build {
  const r = new Rig(), cloudM = r.t('#f3f5ff'), cloudD = r.t('#c7cdef'), robe = r.t('#3550c4'), robeD = r.t('#26398e'), tan = r.t('#d8a957'), tanD = r.t('#a77a3c'), exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const cloud = r.joint(r.model, [0, .7, 0]), puffs: THREE.Object3D[] = [];
  r.add(cloud, cloudD, ellipsoid([1.15, .32, 1.35], [0, -.15, 0]));
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, p = r.joint(cloud, [Math.sin(a) * .85, Math.cos(i * 3.1) * .05, Math.cos(a) * 1.05]); puffs.push(p); r.add(p, i % 3 ? cloudM : cloudD, ball(.42 + (i * 37 % 10) / 40, [0, 0, 0], .8)); }
  r.add(cloud, cloudM, ellipsoid([.8, .35, .95], [0, .15, 0]));
  for (const s of [-1, 1]) { exhausts.push(r.joint(cloud, [s * .5, 0, -1.25])); contacts.push(r.joint(cloud, [s * .6, -.6, -1.0])); }
  const body = r.joint(r.model, [0, 1.0, 0]);
  r.add(body, robe, lathe([[.82, 0], [.8, .12], [.64, .5], [.48, .9], [.36, 1.2], [.0001, 1.28]]));
  r.add(body, robeD, torus(.8, .07, [0, .06, 0], [Math.PI / 2, 0, 0]));
  r.add(body, tan, lathe([[.38, 0], [.5, .1], [.46, .24], [.32, .3]], [0, 1.08, 0]));
  r.add(body, r.t('#a03d3d'), rbox(.5, .12, .5, .05, [0, .55, .32], [.3, 0, 0]));
  const arms: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const a = r.joint(body, [s * .42, .95, .05]); arms.push(a); r.add(a, robe, sweep([[0, 0, 0], [s * .25, -.3, .2], [s * .2, -.45, .55]], t => .17 + t * .06)); r.add(a, tan, torus(.2, .05, [s * .2, -.45, .58], [0, 0, 0])); r.add(a, r.t('#f2ead8'), ball(.13, [s * .2, -.45, .68])); }
  const staff = r.joint(arms[1], [.2, -.45, .68], [.5, 0, -.2]);
  r.add(staff, r.t('#7a4f2c'), tube([[0, -.6, 0], [0, .4, 0], [0, 1.0, .05]], .045)); r.add(staff, r.t('#c7a24a'), torus(.13, .03, [0, 1.12, .05], [0, Math.PI / 2, 0]));
  r.add(staff, r.g('#b67cff', 2.6), ball(.1, [0, 1.12, .05], .7));
  const head = r.joint(body, [0, 1.48, .05]);
  r.add(head, r.t('#151327'), ellipsoid([.48, .46, .46]));
  const blink = r.joint(head, [0, .02, .4]); for (const s of [-1, 1]) r.add(blink, r.g('#ffe14a', 3.4), ellipsoid([.075, .12, .04], [s * .17, 0, 0], [0, s * .3, 0], .6));
  const hat = r.joint(head, [0, .28, -.02], [-.08, 0, 0]);
  r.add(hat, tan, lathe([[1.05, -.02], [1.08, .02], [.95, .06], [.6, .1], [.5, .12]], [0, 0, 0], [0, 0, 0], 36), torus(1.05, .045, [0, 0, 0], [Math.PI / 2, 0, 0]));
  r.add(hat, tanD, cyl(.53, .55, .14, [0, .14, 0], [0, 0, 0], 24));
  const tip = r.joint(hat, [0, .2, 0]); r.add(tip, tan, horn([[0, 0, 0], [0, .45, -.04], [.05, .9, -.2], [.22, 1.25, -.5]], .52));
  let sway = 0;
  return { r, head, height: 4.2, wheels: [], steer: [], exhausts, contacts, outline: '#121230', update(s, k) {
    cloud.position.y = .7 + Math.sin(s.t * 2.4) * .08; cloud.rotation.y = s.steer * .12;
    puffs.forEach((p, i) => { const b = 1 + Math.sin(s.t * 3 + i * 1.7) * .08; p.scale.setScalar(b); p.position.y = Math.cos(i * 3.1) * .05 + Math.sin(s.t * 2 + i) * .05; });
    body.position.y = 1.0 + Math.sin(s.t * 2.4 - .5) * .07; sway = damp(sway, -k * .5 - s.steer * .2, 4, s.dt);
    tip.rotation.x = sway * .6 + Math.sin(s.t * 3) * .05; tip.rotation.z = s.steer * .25 + Math.sin(s.t * 2.2) * .04; hat.rotation.z = s.steer * .08;
    arms.forEach((a, i) => { a.rotation.x = Math.sin(s.t * 2 + i) * .06; });
    head.rotation.y = s.menu ? Math.sin(s.t * .7) * .3 : s.steer * .25; blink.scale.y = (s.t * .7 + .2) % 3.6 < .1 ? .1 : 1;
  } };
}
