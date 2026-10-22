import * as THREE from 'three';
import type { FlareBatch } from './flare-batch.ts';
import { Glyph } from './flare-material.ts';
import type { BurstLook } from './looks.ts';
import type { RacerFrame } from './racer-frame.ts';
import { hashIn, swell, within } from './timing.ts';

const at = new THREE.Vector3(), ax = new THREE.Vector3(), ay = new THREE.Vector3(), back = new THREE.Vector3();
const colors = new Map<BurstLook, { cross: THREE.Color; glowIn: THREE.Color; glowRim: THREE.Color; core: THREE.Color; ray: THREE.Color; rayTip: THREE.Color }>();
const paletteOf = (look: BurstLook) => {
  let p = colors.get(look);
  if (!p) { p = { cross: new THREE.Color(look.crossColor), glowIn: new THREE.Color(look.glowInner), glowRim: new THREE.Color(look.glowRim), core: new THREE.Color(look.coreColor), ray: new THREE.Color(look.rayColor), rayTip: new THREE.Color(look.rayTip) }; colors.set(look, p); }
  return p;
};

/**
 * The original's ability activation flash, `t` seconds in: a cross of white lines on the road, a glow spreading round
 * the racer with a violet rim, then a white-hot core with long thin rays. Dash, the start dash and Spin Dash use it,
 * and so do other abilities with their own look. `seed` re-rolls the rays.
 */
export function activationBurst(batch: FlareBatch, f: RacerFrame, t: number, look: BurstLook, seed: number) {
  const h = f.height, p = paletteOf(look), s = look.size;
  const cross = swell(within(t, look.cross), .2), glow = swell(within(t, look.glow), .4), core = swell(within(t, look.core), .3), rays = swell(within(t, look.rays), .2);
  if (cross > 0) {
    const len = h * s.cross, w = h * .07; at.copy(f.at).y += .04;
    batch.ray(at, f.forward, f.side, len, w, p.cross, p.cross, cross, 1, 1); batch.ray(at, back.copy(f.forward).negate(), f.side, len, w, p.cross, p.cross, cross, 1, 1);
    batch.ray(at, f.side, f.forward, len, w, p.cross, p.cross, cross, 1, 1); batch.ray(at, back.copy(f.side).negate(), f.forward, len, w, p.cross, p.cross, cross, 1, 1);
  }
  if (glow > 0) {
    const r = h * (s.glowFrom + (s.glowTo - s.glowFrom) * within(t, look.glow));
    ax.copy(f.side).multiplyScalar(r * 1.25); ay.copy(f.forward).multiplyScalar(r); at.copy(f.at).y += .03;
    batch.quad(at, ax, ay, Glyph.Disc, p.glowIn, p.glowRim, glow * .55, .55, .5);
  }
  if (core > 0) {
    at.copy(f.at).addScaledVector(batch.up, .35 * h).addScaledVector(batch.toward, .6 * h);
    batch.glow(at, h * s.core * (1 - .4 * within(t, look.core)), p.core, p.glowRim, core, .8, .5, .75);
  }
  if (rays > 0) {
    at.copy(f.at).addScaledVector(batch.up, .3 * h).addScaledVector(batch.toward, .5 * h);
    for (let i = 0; i < s.rays; i++) batch.screenRay(at, hashIn(seed * 13 + i, 0, Math.PI * 2), h * hashIn(seed * 17 + i, s.rayFrom, s.rayTo), h * .045, p.ray, p.rayTip, rays * .9, .3, .6);
  }
}
