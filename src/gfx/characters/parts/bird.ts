import * as THREE from 'three';
import { ellipsoid } from '../../geometry/primitives.ts';
import { sweep, feather } from '../../geometry/sweep.ts';
import type { V3 } from '../../geometry/transform.ts';
import { shade } from '../math.ts';
import type { Rig } from '../rig.ts';
import { eyes } from './eyes.ts';

/** Chocobo and Chubby Chocobo share a bird body with different proportions. */
export function bird(r: Rig, parent: THREE.Object3D, color: string, light: string, fat: boolean) {
  const B = r.t(color), L = r.t(light), D = r.t(shade(color, .8)), beak = r.t('#f39a2b'), F = fat ? 1.32 : 1;
  const body = r.joint(parent, [0, 0, 0]);
  r.add(body, B, ellipsoid([.8 * F, .74 * F, .9 * F], [0, 0, 0], [.18, 0, 0]));
  r.add(body, L, ellipsoid([.6 * F, .56 * F, .44 * F], [0, -.08 * F, .5 * F], [.2, 0, 0]));
  for (let i = -2; i <= 2; i++) r.add(body, L, feather([i * .15 * F, .05, .82 * F], [i * .17 * F, -.2 * F, .86 * F], [i * .19 * F, -.38 * F, .8 * F], .13 * F, .35, [0, 0, 1]));
  for (let i = -3; i <= 3; i++) r.add(body, i % 2 ? D : B, feather([i * .12 * F, -.38 * F, -.55 * F], [i * .15 * F, -.6 * F, -.6 * F], [i * .18 * F, -.82 * F, -.48 * F], .12 * F, .4, [0, 0, -1]));
  const neckTop: V3 = fat ? [0, .78, .62] : [0, .98, .66];
  if (!fat) { r.add(body, B, sweep([[0, .1, .3], [0, .55, .56], neckTop], t => .5 - t * .2, { radial: 16 })); }
  const head = r.joint(body, [0, neckTop[1] + (fat ? .3 : .16), neckTop[2] + .04]), H = fat ? 1.12 : 1;
  r.add(head, B, ellipsoid([.5 * H, .47 * H, .52 * H]));
  for (const s of [-1, 1]) r.add(head, r.t('#ffb0a0', { noOutline: true }), ellipsoid([.1 * H, .06 * H, .04 * H], [s * .3 * H, -.12 * H, .4 * H], [0, s * .6, 0]));
  r.add(head, beak, sweep([[0, -.04, .36 * H], [0, -.08, .66 * H], [0, -.18, .92 * H]], t => .21 * (1 - t) + .02, { flat: .55, radial: 12 }));
  r.add(head, r.t('#d97a1c'), sweep([[0, -.15, .36 * H], [0, -.2, .58 * H], [0, -.24, .7 * H]], t => .15 * (1 - t) + .02, { flat: .45, radial: 10 }));
  const crest = r.joint(head, [0, .3 * H, 0]), n = fat ? 3 : 5;
  for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * .12, lift = 1 - Math.abs(k - (n - 1) / 2) * .14; r.add(crest, k % 2 ? D : B, feather([x * .7, 0, .08], [x * 1.1, .36 * lift, -.04], [x * 1.7, .7 * lift, -.44], .13, .42, [1, 0, 0])); }
  const blink = eyes(r, head, { y: .1 * H, z: .35 * H, sep: .24 * H, w: .16 * H, h: .2 * H, turn: .5, iris: '#2f6fb8', pupil: '#0f1a2e' });
  const wings: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const w = r.joint(body, [s * .76 * F, .14 * F, .04], [0, 0, -s * .15]); wings.push(w);
    r.add(w, B, ellipsoid([.17, .32, .42], [s * .05, -.04, -.08]));
    for (let k = 0; k < 3; k++) r.add(w, k === 1 ? L : k ? D : B, feather([s * .06, 0, .12], [s * .14, -.16 - k * .04, -.24], [s * .18, -.3 - k * .08, -.62 + k * .1], .16, .3, [1, 0, 0]));
  }
  const tail = r.joint(body, [0, .12 * F, -.82 * F]);
  for (let k = 0; k < 5; k++) { const a = (k - 2) * .42; r.add(tail, k % 2 ? D : B, feather([Math.sin(a) * .08, 0, .1], [Math.sin(a) * .3, .16, -.4], [Math.sin(a) * .62, .34 + Math.cos(a) * .12 - Math.abs(a) * .2, -1.0], .17, .3, [0, 1, 0])); }
  r.add(tail, L, feather([0, .05, .05], [0, .3, -.35], [0, .52, -.85], .13, .3, [0, 1, 0]));
  return { body, head, blink, crest, wings, tail };
}
