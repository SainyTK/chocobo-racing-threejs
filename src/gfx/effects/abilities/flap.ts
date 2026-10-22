import * as THREE from 'three';
import { ABILITY_SECONDS } from '../../../../shared/game/abilities.ts';
import type { FlareBatch } from './flare-batch.ts';
import { Glyph } from './flare-material.ts';
import { FEATHERS, FLAP, SPIKE_HOLD } from './looks.ts';
import type { RacerFrame } from './racer-frame.ts';
import { hashIn, smooth, swell, within } from './timing.ts';

const SIDES = [-1, 1] as const;
const core = new THREE.Color(FLAP.core), edge = new THREE.Color(FLAP.edge), fadeCore = new THREE.Color(FLAP.fadeCore), fadeEdge = new THREE.Color(FLAP.fadeEdge);
const flashColor = new THREE.Color(FLAP.flashColor), ballIn = new THREE.Color(FLAP.ballInner), ballRim = new THREE.Color(FLAP.ballRim), rayColor = new THREE.Color(FLAP.rayColor);
const at = new THREE.Vector3(), shoulder = new THREE.Vector3(), dir = new THREE.Vector3(), across = new THREE.Vector3(), half = new THREE.Vector3(), centre = new THREE.Vector3();

/** How far into Flap a racer is, in seconds, or -1 when it is not flying. */
const elapsed = (flying: number) => flying > 0 ? ABILITY_SECONDS.flap - flying : -1;

/** How high a flying racer is drawn above the road: it rises once the wings are out and drops back at the end. */
export function flapLift(flying: number) {
  const t = elapsed(flying); if (t < 0) return 0;
  return FLAP.lift * smooth(within(Math.min(t, FLAP.rise[1]), FLAP.rise)) * smooth(flying / FLAP.drop);
}

/** The wing's main angle above level: a raised V that settles, then a slow sweep down and a snap back up. */
function wingAngle(t: number) {
  const k = (t % FLAP.beat) / FLAP.beat, sweep = FLAP.sweep / FLAP.beat;
  const beat = k < sweep ? FLAP.up + (FLAP.down - FLAP.up) * smooth(k / sweep) : FLAP.down + (FLAP.up - FLAP.down) * smooth((k - sweep) / (1 - sweep));
  const settle = smooth(within(Math.min(Math.max(t, FLAP.wingsIn), FLAP.wingsLevel), [FLAP.wingsIn, FLAP.wingsLevel]));
  return .95 + (beat - .95) * settle;
}

/**
 * Mog's Flap: a cross flare and a glowing ball, then big glowing pink and white feathered wings that beat while he
 * flies, turning pale lilac and fading at the end.
 */
export class FlapFx {
  draw(batch: FlareBatch, f: RacerFrame, flying: number, time: number) {
    const t = elapsed(flying); if (t < 0) return;
    const h = f.height, seed = Math.floor(time / SPIKE_HOLD);
    const cross = swell(within(t, FLAP.cross), .2), glow = swell(within(t, FLAP.glow), .3), ball = swell(within(t, FLAP.ball), .4), rays = swell(within(t, FLAP.rays), .25);
    at.copy(f.at).addScaledVector(batch.up, .45 * h).addScaledVector(batch.toward, .6 * h);
    if (cross > 0) {
      batch.screenRay(at, 0, h * 2.6, h * .05, flashColor, flashColor, cross, 1, 1); batch.screenRay(at, Math.PI, h * 2.6, h * .05, flashColor, flashColor, cross, 1, 1);
      batch.screenRay(at, Math.PI / 2, h * 3.2, h * .07, flashColor, flashColor, cross, .5, 1);
    }
    if (glow > 0) batch.glow(at, h * (.6 + .6 * within(t, FLAP.glow)), ballIn, ballRim, glow * .45, .55, .5);
    if (ball > 0) batch.glow(at, h * .7, ballIn, ballRim, ball * .9, .7, .35);
    if (rays > 0) for (let i = 0; i < 7; i++) batch.screenRay(at, hashIn(seed * 7 + i, 0, Math.PI * 2), h * hashIn(seed * 3 + i, 1.4, 3.2), h * .035, rayColor, rayColor, rays * .8, .3, .8);
    if (t >= FLAP.wingsIn) this.wings(batch, f, t, flying, seed);
  }
  private wings(batch: FlareBatch, f: RacerFrame, t: number, flying: number, seed: number) {
    const h = f.height, theta = wingAngle(t), fading = flying < FLAP.fade, appear = Math.min(1, (t - FLAP.wingsIn) / .06);
    const alpha = appear * (fading ? .75 * flying / FLAP.fade : 1), c0 = fading ? fadeCore : core, c1 = fading ? fadeEdge : edge;
    for (const s of SIDES) {
      // Like the original's sprites the wings face the camera, so they read from behind, from the side and from ahead.
      shoulder.copy(f.at).addScaledVector(batch.up, FLAP.shoulder * h).addScaledVector(batch.right, s * .15 * h).addScaledVector(batch.toward, .1 * h);
      for (let i = 0; i < FEATHERS.length; i++) {
        const fe = FEATHERS[i], a = theta + fe.angle, len = FLAP.length * h * fe.length;
        dir.copy(batch.right).multiplyScalar(s * Math.cos(a)).addScaledVector(batch.up, Math.sin(a));
        across.crossVectors(dir, batch.toward);
        centre.copy(shoulder).addScaledVector(dir, len / 2); half.copy(dir).multiplyScalar(len / 2); across.multiplyScalar(len * fe.width);
        batch.quad(centre, across, half, Glyph.Feather, c0, c1, alpha, i * 1.7 + (s > 0 ? .5 : 0) + (seed % 2) * .02);
      }
    }
  }
}
