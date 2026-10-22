import * as THREE from 'three';
import { Shape } from '../../particles/particles.ts';
import type { Effects } from '../index.ts';
import type { FlareBatch } from './flare-batch.ts';
import { Glyph } from './flare-material.ts';
import { DASH_BURST, DASH_FAN, FAN_END, FAN_GROW, HASTE_FAN, HASTE_RING, SPIKE_HOLD, type FanLook } from './looks.ts';
import type { RacerFrame } from './racer-frame.ts';
import { drawFans } from './spike-fan.ts';
import { hashIn, swell, within } from './timing.ts';

/**
 * What started a racer's boost. Dash, start dash and Spin Dash open with the Dash burst; start dash and Spin Dash then
 * show no fans, as the original's start dash does. Charge draws its own look in `charge.ts`.
 */
export type BoostKind = 'dash' | 'haste' | 'start' | 'spindash' | 'pad' | 'charge';
interface BoostState { kind: BoostKind; age: number; ended: number }

const FANS: Partial<Record<BoostKind, FanLook>> = { dash: DASH_FAN, haste: HASTE_FAN, pad: DASH_FAN };
const BURSTS = new Set<BoostKind>(['dash', 'start', 'spindash']);
const B = DASH_BURST, white = new THREE.Color(B.crossColor), glowIn = new THREE.Color(B.glowInner), glowRim = new THREE.Color(B.glowRim);
const coreColor = new THREE.Color(B.coreColor), rayColor = new THREE.Color(B.rayColor), rayTip = new THREE.Color(B.rayTip), black = new THREE.Color(0), ring = new THREE.Color(HASTE_RING.color);
const at = new THREE.Vector3(), ax = new THREE.Vector3(), ay = new THREE.Vector3(), back = new THREE.Vector3();

/** Boost looks: the spike fans, the Dash burst, the Haste ring and the model tint. */
export class BoostFx {
  private states = new Map<string, BoostState>();
  constructor(private fx: Effects) {}
  start(id: string, kind: BoostKind) { this.states.set(id, { kind, age: 0, ended: 0 }); }
  reset() { this.states.clear(); }
  /** Draws one racer's boost. `boosting` is whether the simulation's boost is still running. */
  draw(batch: FlareBatch, id: string, f: RacerFrame, boosting: boolean, dt: number, time: number) {
    const s = this.states.get(id); if (!s) return;
    if (boosting) { s.age += dt; s.ended = 0; } else { s.ended += dt; if (s.ended > FAN_END.hold + FAN_END.fade) { this.states.delete(id); return; } }
    const seed = Math.floor(time / SPIKE_HOLD), fan = FANS[s.kind];
    if (fan) {
      const grow = Math.min(1, s.age / (s.kind === 'haste' ? FAN_GROW.haste : FAN_GROW.dash));
      drawFans(batch, f, fan, .25 + .75 * grow, boosting ? 1 : 1 - Math.max(0, s.ended - FAN_END.hold) / FAN_END.fade, seed);
    }
    if (!boosting) return;
    if (BURSTS.has(s.kind)) this.burst(batch, f, s.age, dt, seed);
    if (s.kind === 'haste' && s.age < HASTE_RING.life) {
      // A thin ring on the road round the racer, like the original's first Haste frames.
      const r = f.height * (.9 + s.age / HASTE_RING.life * .5);
      ax.copy(f.side).multiplyScalar(r); ay.copy(f.forward).multiplyScalar(r); at.copy(f.at).y += .05;
      batch.quad(at, ax, ay, Glyph.Disc, black, ring, 1 - s.age / HASTE_RING.life, .82, .3);
    }
  }
  /** The model tint while the boost runs, written to `out`; returns how strongly it applies. */
  tint(id: string, out: THREE.Color) {
    const s = this.states.get(id), fan = s && !s.ended && FANS[s.kind === 'start' || s.kind === 'spindash' ? 'dash' : s.kind];
    if (!fan) return 0; out.set(fan.tint); return fan.tintAmount;
  }
  /** The Dash burst: a cross of light on the road, a glow spreading round the racer, then a white-hot core with pink rays. */
  private burst(batch: FlareBatch, f: RacerFrame, t: number, dt: number, seed: number) {
    const h = f.height, cross = swell(within(t, B.cross), .2), glow = swell(within(t, B.glow), .4), core = swell(within(t, B.core), .3), rays = swell(within(t, B.rays), .2);
    if (cross > 0) {
      at.copy(f.at).y += .04;
      batch.ray(at, f.forward, f.side, h * 3.2, h * .07, white, white, cross, 1, 1); batch.ray(at, back.copy(f.forward).negate(), f.side, h * 3.2, h * .07, white, white, cross, 1, 1);
      batch.ray(at, f.side, f.forward, h * 3.2, h * .07, white, white, cross, 1, 1); batch.ray(at, back.copy(f.side).negate(), f.forward, h * 3.2, h * .07, white, white, cross, 1, 1);
    }
    if (glow > 0) {
      const r = h * (.8 + 1.6 * within(t, B.glow));
      ax.copy(f.side).multiplyScalar(r * 1.25); ay.copy(f.forward).multiplyScalar(r); at.copy(f.at).y += .03;
      batch.quad(at, ax, ay, Glyph.Disc, glowIn, glowRim, glow * .55, .55, .5);
    }
    if (core > 0) {
      at.copy(f.at).addScaledVector(batch.up, .35 * h).addScaledVector(batch.toward, .6 * h);
      batch.glow(at, h * (1.2 - .5 * within(t, B.core)), coreColor, glowRim, core, .8, .5, .75);
    }
    if (rays > 0) {
      at.copy(f.at).addScaledVector(batch.up, .3 * h).addScaledVector(batch.toward, .5 * h);
      for (let i = 0; i < 9; i++) batch.screenRay(at, hashIn(seed * 13 + i, 0, Math.PI * 2), h * hashIn(seed * 17 + i, 1.5, 4.5), h * .045, rayColor, rayTip, rays * .9, .3, .6);
    }
    // Grey dust puffs at the feet as the core flares.
    if (t >= B.core[0] && t - dt < B.core[0]) this.fx.spray(this.fx.smoke, 6, () => ({ x: f.at.x + (Math.random() - .5) * h * .6, y: f.at.y + .2, z: f.at.z + (Math.random() - .5) * h * .6, vx: (Math.random() - .5) * 2, vy: .8 + Math.random(), vz: (Math.random() - .5) * 2, life: .5 + Math.random() * .3, size: .35 * h, endSize: .7 * h, color: '#9d958c', alpha: .55, drag: 2.5, shape: Shape.Smoke }));
  }
}
