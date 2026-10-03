import * as THREE from 'three';
import type { RacerProfile } from '../../../../shared/game/index.ts';
import { ellipsoid, ball, rbox, cyl, torus } from '../../geometry/primitives.ts';
import { horn, tube } from '../../geometry/sweep.ts';
import { Rig } from '../rig.ts';
import type { Build, Wheel } from '../types.ts';
import { bird } from '../parts/bird.ts';
import { wheel } from '../parts/wheel.ts';

export function chubby(c: RacerProfile): Build {
  const r = new Rig(), frame = r.t('#db6b41'), chrome = r.t('#cfd5dd'), dark = r.t('#353543'), wheels: Wheel[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const trike = r.joint(r.model);
  r.add(trike, frame, rbox(1.5, .22, 1.9, .1, [0, .7, -.35]), tube([[0, .78, .5], [0, 1.15, 1.05], [0, 1.65, 1.2]], .09));
  r.add(trike, dark, rbox(1.25, .2, 1.05, .09, [0, .9, -.35]));
  r.add(trike, r.t('#ffcf4a'), rbox(1.6, .08, .2, .04, [0, .82, -1.32]));
  const fork = r.joint(trike, [0, 0, 1.18]);
  r.add(fork, chrome, tube([[-.18, .52, 0], [-.18, 1.0, .02], [-.12, 1.5, 0]], .05), tube([[.18, .52, 0], [.18, 1.0, .02], [.12, 1.5, 0]], .05), tube([[-.62, 1.78, -.15], [-.3, 1.66, 0], [.3, 1.66, 0], [.62, 1.78, -.15]], .05));
  r.add(fork, r.t('#f04b4b'), ball(.08, [-.64, 1.79, -.16]), ball(.08, [.64, 1.79, -.16]));
  r.add(fork, r.g('#fff2c0', 2), ellipsoid([.16, .16, .06], [0, 1.25, .17]));
  wheels.push(wheel(r, fork, [0, .52, 0], .52, .3, '#ffcf4a'));
  for (const s of [-1, 1]) { wheels.push(wheel(r, trike, [s * 1.0, .44, -.95], .44, .34, '#ffcf4a')); contacts.push(r.joint(trike, [s * 1.0, .05, -1.05])); }
  // The Phat-Burner tank and twin rocket nozzles.
  r.add(trike, r.t('#e8e2d5'), cyl(.36, .36, 1.1, [0, 1.05, -1.25], [0, 0, Math.PI / 2], 20), ball(.36, [-.55, 1.05, -1.25]), ball(.36, [.55, 1.05, -1.25]));
  r.add(trike, frame, torus(.37, .04, [-.3, 1.05, -1.25], [0, Math.PI / 2, 0]), torus(.37, .04, [.3, 1.05, -1.25], [0, Math.PI / 2, 0]));
  for (const s of [-1, 1]) { r.add(trike, chrome, cyl(.13, .2, .45, [s * .4, 1.05, -1.6], [Math.PI / 2, 0, 0], 16)); r.add(trike, r.g('#ff9d3a', 2.2), torus(.16, .035, [s * .4, 1.05, -1.83])); exhausts.push(r.joint(trike, [s * .4, 1.05, -1.88])); }
  const b = bird(r, r.joint(r.model, [0, 1.8, -.2]), c.color, c.light, true), legs: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const hip = r.joint(b.body, [s * .5, -.6, .45]); r.add(hip, r.t(c.color), ellipsoid([.3, .32, .34], [0, 0, .05])); const shin = r.joint(hip, [0, -.15, .32]); r.add(shin, r.t('#f0a540'), tube([[0, 0, 0], [0, -.25, .2], [0, -.42, .3]], .08)); for (const x of [-.08, 0, .08]) r.add(shin, r.t('#fff3d9'), horn([[x, -.42, .3], [x, -.45, .44], [x, -.52, .5]], .05)); legs.push(hip); }
  let phase = 0;
  return { r, head: b.head, height: 3.6, wheels, steer: [fork], exhausts, contacts, outline: '#3b2a12', update(s, k) {
    phase += s.dt * (s.menu ? 1.2 : 2 + Math.abs(s.speed) * .25);
    legs.forEach((l, i) => { l.rotation.x = Math.sin(phase + i * Math.PI) * .45 * Math.max(k, s.menu ? .3 : 0); });
    b.body.position.y = Math.sin(phase * 2) * .03 + (s.menu ? Math.sin(s.t * 2) * .03 : 0); b.body.rotation.z = Math.sin(phase) * .04;
    b.wings.forEach((w, i) => { const sd = i ? 1 : -1; w.rotation.z = -sd * (s.flying > 0 ? .9 + Math.sin(s.t * 24) * .8 : .5 + Math.sin(s.t * 3) * .06); w.rotation.x = -.9; });
    b.tail.rotation.x = -.15 + Math.sin(s.t * 3) * .05; b.crest.rotation.x = Math.sin(s.t * 7) * .04 * k;
    b.head.rotation.y = s.menu ? Math.sin(s.t * .6) * .3 : s.steer * .25; b.blink.scale.y = (s.t * .8 + 1.3) % 3.9 < .09 ? .12 : 1;
  } };
}
