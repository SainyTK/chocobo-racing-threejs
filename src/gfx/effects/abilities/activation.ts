import type { FlareBatch } from './flare-batch.ts';
import { activationBurst } from './burst.ts';
import { SPIKE_HOLD, type BurstLook } from './looks.ts';
import type { RacerFrame } from './racer-frame.ts';
import { swell } from './timing.ts';

interface Activation { racer: string; look: BurstLook; start: number }

/**
 * Activation bursts that play once on a racer, started by an event: Grip-Up, Mug, Barrier and Magic Plus. Boosts draw
 * theirs while the boost runs, in `boost.ts`.
 */
export class ActivationFx {
  private active: Activation[] = [];
  start(racer: string, look: BurstLook, time: number) { this.active.push({ racer, look, start: time }); }
  reset() { this.active.length = 0; }
  /** How far the burst washes the racer's model toward white, 0 to 1. */
  wash(racer: string, time: number) {
    let k = 0;
    for (const a of this.active) if (a.racer === racer) { const t = time - a.start, L = a.look; k = Math.max(k, swell(t < L.glow[0] || t > L.core[1] ? -1 : (t - L.glow[0]) / (L.core[1] - L.glow[0]), .45) * L.wash); }
    return k;
  }
  draw(batch: FlareBatch, frames: ReadonlyMap<string, RacerFrame>, time: number) {
    const seed = Math.floor(time / SPIKE_HOLD);
    for (const a of this.active) { const f = frames.get(a.racer); if (f) activationBurst(batch, f, time - a.start, a.look, seed); }
    this.active = this.active.filter(a => time - a.start < a.look.rays[1]);
  }
}
