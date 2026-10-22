import * as THREE from 'three';
import { BARRIER_SECONDS } from '../../../../shared/game/spells.ts';
import { Shape } from '../../particles/particles.ts';
import type { Effects } from '../index.ts';
import type { FlareBatch } from './flare-batch.ts';
import { Glyph } from './flare-material.ts';
import { BARRIER } from './looks.ts';
import type { RacerFrame } from './racer-frame.ts';

const at = new THREE.Vector3(), ax = new THREE.Vector3(), ay = new THREE.Vector3(), top = new THREE.Vector3();

/**
 * White Mage's Barrier as the original draws it: nothing stays on screen while it is up. Every 0.71 s a frosty
 * pale-cyan bowl rises from the carpet, closes into a white oval round her, lifts off as a cap and leaves a clear cyan
 * sphere that fades. A blocked spell gets one last pulse, then the Barrier is gone.
 */
export class BarrierFx {
  /** When each racer's Barrier blocked a spell, for its last pulse. */
  private blocked = new Map<string, number>();
  constructor(private fx: Effects) {}
  block(racer: string, time: number) { this.blocked.set(racer, time); }
  reset() { this.blocked.clear(); }
  draw(batch: FlareBatch, f: RacerFrame, racer: string, barrier: number, dt: number, time: number) {
    const since = this.blocked.get(racer);
    if (since !== undefined) {
      const k = (time - since - BARRIER.lastPulseDelay) / BARRIER.pulse;
      if (k > 1) this.blocked.delete(racer); else if (k >= 0) this.pulse(batch, f, k);
      return;
    }
    if (barrier <= 0) return;
    const t = BARRIER_SECONDS - barrier - BARRIER.firstPulse;
    if (t < 0) return;
    const k = (t % BARRIER.period) / BARRIER.pulse;
    if (k <= 1) this.pulse(batch, f, k);
    // Small sparkle crosses near the carpet between pulses.
    else if (dt > 0 && Math.random() < dt * BARRIER.sparkleRate) {
      const a = Math.random() * Math.PI * 2, r = f.height * BARRIER.width * .45 * Math.random();
      this.fx.glow.emit({ x: f.at.x + Math.cos(a) * r, y: f.at.y + f.height * BARRIER.carpet, z: f.at.z + Math.sin(a) * r, vy: .3, life: .25, size: f.height * .18, color: '#ffffff', endColor: BARRIER.tint, shape: Shape.Star });
    }
  }
  /** One pulse at progress `k`: the glyph draws the bowl, oval, cap and sphere; a ring and beam join as it fades. */
  private pulse(batch: FlareBatch, f: RacerFrame, k: number) {
    // Drawn toward the camera, so the white oval closes over her as in the original.
    at.copy(f.at).setY(f.at.y + f.height * BARRIER.centre);
    const h = f.height * batch.lift(at, f.height * BARRIER.forward), w = h * BARRIER.width, tall = h * BARRIER.height;
    ax.copy(batch.right).multiplyScalar(w / 2); ay.copy(batch.up).multiplyScalar(tall / 2);
    batch.quad(at, ax, ay, Glyph.FrostPulse, BARRIER.core, BARRIER.rim, 1, k, Math.floor(k * 9), BARRIER.cover);
    const fade = k < BARRIER.capAt ? 0 : 1 - (k - BARRIER.capAt) / (1 - BARRIER.capAt);
    if (fade > 0) {
      top.copy(at).setY(at.y + tall * (.5 + .25 * (k - BARRIER.capAt)));
      batch.ring(top, w * .07, w * .018, '#ffffff', BARRIER.tint, fade * .6, 0);
      batch.ray(at.setY(at.y - tall * .5), batch.up, batch.right, tall * 1.5, h * .025, '#ffffff', BARRIER.beam, fade * .45, 1, 1);
    }
  }
}
