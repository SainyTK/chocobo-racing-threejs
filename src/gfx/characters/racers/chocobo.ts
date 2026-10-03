import * as THREE from 'three';
import type { RacerProfile } from '../../../../shared/game/index.ts';
import { ellipsoid, rbox, cyl, torus } from '../../geometry/primitives.ts';
import { horn, tube } from '../../geometry/sweep.ts';
import { damp } from '../math.ts';
import { Rig } from '../rig.ts';
import type { Build, Wheel } from '../types.ts';
import { bird } from '../parts/bird.ts';
import { wheel } from '../parts/wheel.ts';

export function chocobo(c: RacerProfile): Build {
  const r = new Rig(), b = bird(r, r.joint(r.model, [0, 1.9, -.05]), c.color, c.light, false), legs: { hip: THREE.Object3D; knee: THREE.Object3D; ankle: THREE.Object3D }[] = [], wheels: Wheel[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const leg = r.t('#f0a540'), claw = r.t('#fff3d9'), boot = r.t('#3f6fd0'), trim = r.t('#ffcf4a'), metal = r.t('#c9d1dc');
  for (const s of [-1, 1]) {
    const hip = r.joint(b.body, [s * .36, -.48, -.08]); r.add(hip, r.t(c.color), ellipsoid([.28, .36, .31], [0, -.1, 0]));
    const knee = r.joint(hip, [0, -.42, .02]); r.add(knee, leg, tube([[0, 0, 0], [0, -.3, -.06], [0, -.62, 0]], .085));
    const ankle = r.joint(knee, [0, -.64, 0]);
    r.add(ankle, boot, rbox(.34, .26, .56, .11, [0, -.02, .08])); r.add(ankle, trim, rbox(.36, .07, .58, .03, [0, .1, .08]));
    for (const x of [-.09, 0, .09]) r.add(ankle, claw, horn([[x, 0, .33], [x, -.03, .4], [x, -.09, .43]], .035));
    r.add(ankle, metal, rbox(.1, .08, .74, .03, [0, -.17, .06]));
    for (const z of [-.22, .05, .32]) wheels.push(wheel(r, ankle, [0, -.24, z], .1, .07, '#ffcf4a'));
    r.add(ankle, metal, cyl(.075, .1, .24, [0, .02, -.26], [Math.PI / 2, 0, 0], 14)); r.add(ankle, r.g('#ffb24a', 2), torus(.07, .022, [0, .02, -.39]));
    const ex = r.joint(ankle, [0, .02, -.42]); exhausts.push(ex); const ct = r.joint(ankle, [0, -.33, -.25]); contacts.push(ct);
    legs.push({ hip, knee, ankle });
  }
  let phase = 0, flap = 0;
  return { r, head: b.head, height: 3.5, wheels, steer: [], exhausts, contacts, outline: '#3b2a12', update(s, k) {
    phase += s.dt * (s.menu ? 2.4 : 3 + Math.abs(s.speed) * .2); const kl = s.menu ? .2 : k;
    legs.forEach((l, i) => { const p = phase + i * Math.PI, push = Math.max(0, Math.sin(p)); l.hip.rotation.x = -Math.cos(p) * .42 * kl; l.hip.rotation.z = (i ? 1 : -1) * push * .2 * kl; l.knee.rotation.x = (.25 + push * .45) * kl; l.ankle.rotation.x = -l.hip.rotation.x - l.knee.rotation.x * .8; });
    b.body.position.y = Math.abs(Math.sin(phase)) * .07 * k + (s.menu ? Math.sin(s.t * 2.2) * .03 : 0);
    b.body.rotation.z = Math.sin(phase) * .05 * k; b.body.rotation.x = .1 * k;
    flap = damp(flap, s.flying > 0 ? 1 : 0, 6, s.dt);
    b.wings.forEach((w, i) => { const sd = i ? 1 : -1; w.rotation.z = -sd * (.15 + flap * (.9 + Math.sin(s.t * 26) * .8) + (1 - flap) * (.12 + Math.sin(s.t * 3 + phase) * .1 + k * .35)); w.rotation.x = (1 - flap) * k * .25; });
    b.tail.rotation.x = -k * .25 + Math.sin(s.t * 4) * .04; b.tail.rotation.y = -s.steer * .25;
    b.crest.rotation.x = -k * .25 + Math.sin(s.t * 9) * .03 * k;
    b.head.rotation.y = s.menu ? Math.sin(s.t * .7) * .35 : s.steer * .3; b.head.rotation.x = -Math.sin(phase * 2) * .04 * k;
    b.blink.scale.y = (s.t * .7) % 3.5 < .09 ? .12 : 1;
  } };
}
