import * as THREE from 'three';
import { ABILITY_SECONDS } from '../../../../shared/game/abilities.ts';
import { Shape } from '../../particles/particles.ts';
import type { Effects } from '../index.ts';
import type { FlareBatch } from './flare-batch.ts';
import { CHARGE_BURST, CHARGE_FAN, CHARGE_RAM, SPIKE_HOLD } from './looks.ts';
import type { RacerFrame } from './racer-frame.ts';
import { drawFans } from './spike-fan.ts';
import { hashIn, swell, within } from './timing.ts';

const C = CHARGE_BURST, column = new THREE.Color(C.columnColor), domeIn = new THREE.Color(C.domeInner), domeRim = new THREE.Color(C.domeRim), sphere = new THREE.Color(C.sphereColor);
const ray = new THREE.Color(C.rayColor), rayTip = new THREE.Color(C.rayTip), white = new THREE.Color('#ffffff'), pink = new THREE.Color('#ef94e4');
const at = new THREE.Vector3();

/** How far a racer is into its Charge, in seconds, or -1 when it is not charging. */
const elapsed = (charging: number) => charging > 0 ? ABILITY_SECONDS.charge - charging : -1;

/**
 * Behemoth's Charge: yellow-orange spike fans that swell in bursts, a light column, a pink dome crossed by a flare
 * line, a white-pink flash and long rays, all over a red tint. It ends on a hard cut, like the original.
 */
export class ChargeFx {
  constructor(private fx: Effects) {}
  draw(batch: FlareBatch, f: RacerFrame, charging: number, time: number) {
    const t = elapsed(charging); if (t < 0) return;
    const h = f.height, seed = Math.floor(time / SPIKE_HOLD), beat = t % C.pulse;
    // Full fans on the first frame, then a burst every pulse: grow over three frames, fade over the next seven.
    const swellUp = t < C.pulse ? 1 : beat < .1 ? beat / .1 : Math.max(.15, 1 - (beat - .1) / .22);
    drawFans(batch, f, CHARGE_FAN, .55 + .45 * swellUp, swellUp, seed);
    const col = swell(within(t, C.column), .3), dome = swell(within(t, C.dome), .5), flash = swell(within(t, C.sphere), .35), rays = swell(within(t, C.rays), .2);
    if (col > 0) { at.copy(f.at).addScaledVector(batch.toward, .4 * h); batch.ray(at, batch.up, batch.right, h * 3, h * .3, column, column, col * .4, .5, 1); }
    if (dome > 0) {
      at.copy(f.at).addScaledVector(batch.up, .45 * h).addScaledVector(batch.toward, .5 * h);
      batch.glow(at, h * (.7 + .55 * within(t, C.dome)), domeIn, domeRim, dome * .45, .5, .55, .8);
      at.copy(f.at).addScaledVector(batch.up, .05 * h).addScaledVector(batch.toward, .6 * h);
      batch.screenRay(at, 0, h * 2.4, h * .06, white, white, dome, 1, 1); batch.screenRay(at, Math.PI, h * 2.4, h * .06, white, white, dome, 1, 1);
    }
    if (flash > 0) { at.copy(f.at).addScaledVector(batch.up, .5 * h).addScaledVector(batch.toward, .7 * h); batch.glow(at, h * 1.1, sphere, pink, flash, .9, .4); }
    if (rays > 0) {
      at.copy(f.at).addScaledVector(batch.up, .4 * h).addScaledVector(batch.toward, .6 * h);
      for (let i = 0; i < 8; i++) batch.screenRay(at, hashIn(seed * 11 + i, -.4, Math.PI + .4), h * hashIn(seed * 5 + i, 1.6, 3.6), h * .05, ray, rayTip, rays, .3, .7);
    }
  }
  /** The red tint over the whole model, turning pink while the flash covers it. */
  tint(charging: number, out: THREE.Color) {
    const t = elapsed(charging); if (t < 0) return 0;
    const flash = swell(within(t, C.sphere), .35); out.set(CHARGE_FAN.tint).lerp(pink, flash);
    return CHARGE_FAN.tintAmount + flash * .2;
  }
  /** A charging racer rams a rival: a spark burst at the contact point, then stars and blue twinkles round the victim. */
  ram(victim: THREE.Vector3) {
    const fx = this.fx, r = () => Math.random() - .5;
    fx.spray(fx.glow, 18, () => ({ x: victim.x, y: victim.y - .5, z: victim.z, vx: r() * 12, vy: 2 + Math.random() * 5, vz: r() * 12, life: .2 + Math.random() * .2, size: .1, color: CHARGE_RAM.spark, endColor: CHARGE_RAM.sparkEnd, gravity: 16, stretch: .04, shape: Shape.Shard }));
    fx.spray(fx.glow, 3, () => ({ x: victim.x + r() * .4, y: victim.y, z: victim.z + r() * .4, life: .12, size: 1.6 + Math.random() * .6, endSize: .4, color: '#fff6d0', endColor: CHARGE_RAM.spark }));
    fx.spray(fx.glow, 6, i => { const a = i / 6 * Math.PI * 2; return { x: victim.x + Math.cos(a) * .8, y: victim.y + .6, z: victim.z + Math.sin(a) * .8, vx: Math.cos(a) * 2.5, vy: 2 + Math.random() * 2, vz: Math.sin(a) * 2.5, life: .55 + Math.random() * .25, size: .5, endSize: .3, color: CHARGE_RAM.star, gravity: 4, shape: Shape.Star }; });
    fx.spray(fx.glow, 8, () => ({ x: victim.x + r() * 1.6, y: victim.y + Math.random() * 1.5, z: victim.z + r() * 1.6, vy: .6, life: .35 + Math.random() * .3, size: .3, color: '#ffffff', endColor: CHARGE_RAM.twinkle, shape: Shape.Star }));
  }
}
