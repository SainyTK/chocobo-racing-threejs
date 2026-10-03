import * as THREE from 'three';
import { ellipsoid, ball, torus, lathe } from '../../geometry/primitives.ts';
import { sweep, horn } from '../../geometry/sweep.ts';
import { xf } from '../../geometry/transform.ts';
import { clamp } from '../math.ts';
import { Rig } from '../rig.ts';
import type { Build } from '../types.ts';
import { eyes } from '../parts/eyes.ts';
import { carpet } from '../parts/carpet.ts';

export function whiteMage(): Build {
  const r = new Rig(), robe = r.t('#f7f2ea'), red = r.t('#cf3557'), skinM = r.t('#ffdcc0'), hair = r.t('#9a5d3a'), exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const geo = new THREE.PlaneGeometry(2.3, 3.1, 10, 16); geo.rotateX(-Math.PI / 2); const base = Float32Array.from(geo.attributes.position.array as Float32Array);
  const rugMat = new THREE.MeshToonMaterial({ map: carpet(), side: THREE.DoubleSide, gradientMap: (r.t('#fff') as THREE.MeshToonMaterial).gradientMap });
  const rug = new THREE.Mesh(geo, rugMat); rug.position.y = .5; rug.castShadow = true; r.model.add(rug);
  const tassels = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), r.t('#ffcf6a')); r.model.add(m); return m; });
  for (const s of [-1, 1]) { exhausts.push(r.joint(r.model, [s * .9, .5, -1.6])); contacts.push(r.joint(r.model, [s * .9, .1, -1.4])); }
  const body = r.joint(r.model, [0, .58, 0]);
  r.add(body, robe, lathe([[.86, 0], [.8, .2], [.6, .7], [.44, 1.12], [.0001, 1.25]]));
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; r.add(body, red, xf(new THREE.ConeGeometry(.15, .34, 3), [Math.sin(a) * .82, .2, Math.cos(a) * .82], [0, a, 0], [1, 1, .25])); }
  for (const s of [-1, 1]) { r.add(body, robe, sweep([[s * .38, .95, .05], [s * .52, .6, .3], [s * .3, .45, .58]], t => .14 + t * .1)); r.add(body, red, xf(new THREE.ConeGeometry(.16, .3, 3), [s * .3, .4, .66], [Math.PI, 0, 0], [1, 1, .3])); r.add(body, skinM, ball(.1, [s * .2, .42, .7])); }
  const head = r.joint(body, [0, 1.42, .05]);
  r.add(head, robe, ellipsoid([.62, .6, .6], [0, .04, -.04])); r.add(head, red, torus(.4, .05, [0, -.04, .4]));
  r.add(head, skinM, ellipsoid([.42, .42, .26], [0, -.06, .32]));
  r.add(head, hair, ellipsoid([.4, .16, .2], [0, .22, .4], [.3, 0, 0]));
  for (const s of [-1, 1]) { r.add(head, robe, horn([[s * .3, .5, -.05], [s * .4, .78, -.08], [s * .46, 1.02, -.14]], .19)); r.add(head, r.t('#f4c0cb', { noOutline: true }), ellipsoid([.09, .05, .03], [s * .22, -.2, .55], [0, s * .4, 0])); }
  for (let k = 0; k < 5; k++) { const a = (k - 2) * .5; r.add(head, red, xf(new THREE.ConeGeometry(.12, .3, 3), [Math.sin(a) * .5, -.45, -.25 - Math.cos(a) * .2], [Math.PI, a, 0], [1, 1, .3])); }
  const blink = eyes(r, head, { y: -.04, z: .5, sep: .15, w: .1, h: .14, turn: .3, iris: '#6d3f8a' });
  let phase = 0;
  return { r, head, height: 3.2, wheels: [], steer: [], exhausts, contacts, outline: '#3a2230', update(s, k) {
    phase += s.dt * (2 + Math.abs(s.speed) * .25); const a = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) { const x = base[i * 3], z = base[i * 3 + 2], back = clamp((1 - z) / 3, 0, 1); a.setY(i, Math.sin(z * 2.2 + phase * 2.4) * (.04 + back * .14 * (.4 + k)) + Math.sin(x * 2 + phase) * .03 - s.steer * x * .08 + (Math.abs(x) > .95 && z > 1.3 ? .08 : 0)); }
    a.needsUpdate = true; geo.computeVertexNormals();
    [[0, 0], [10, 0], [0, 16], [10, 16]].forEach(([ix, iz], i) => { const v = iz * 11 + ix; tassels[i].position.set(a.getX(v), a.getY(v) + .5 - .05, a.getZ(v)); });
    rug.position.y = .5 + Math.sin(s.t * 2.2) * .07; body.position.y = .58 + Math.sin(s.t * 2.2) * .07;
    head.rotation.y = s.menu ? Math.sin(s.t * .8) * .3 : s.steer * .25; head.rotation.z = Math.sin(s.t * 1.5) * .04;
    blink.scale.y = (s.t * .75 + .9) % 3.4 < .1 ? .1 : 1;
  } };
}
