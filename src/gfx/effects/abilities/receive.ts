import * as THREE from 'three';
import type { Item } from '../../../../shared/game/index.ts';
import type { HeldStones } from '../../stones/held.ts';
import type { FlareBatch } from './flare-batch.ts';
import type { HeldCues } from './held-cues.ts';
import { RACER_HEIGHT, RECEIVE } from './looks.ts';
import type { RacerFrame } from './racer-frame.ts';
import { hash, smooth, swell, within } from './timing.ts';

interface Catch { racer: string; kind: Item; level: number; start: number }

const orb = new THREE.Vector3(), mid = new THREE.Vector3(), stone = new THREE.Vector3();

/**
 * Chubby Chocobo's Receive catching a spell: a white orb swells above his head on a faint light pillar while a
 * lavender glow and pink rays rise round him, the caught stone shows inside the orb as it clears, and the stone sinks
 * from above his head to the end of his held line.
 */
export class ReceiveFx {
  private catches: Catch[] = [];
  constructor(private cues: HeldCues, private carried: HeldStones) {}
  /** `stackIndex` is the stack the caught stone made, hidden until it lands; undefined when it merged into one already shown. */
  start(racer: string, kind: Item, level: number, stackIndex: number | undefined, time: number) {
    this.catches.push({ racer, kind, level, start: time });
    if (stackIndex !== undefined) this.cues.arriving(racer, stackIndex, time + RECEIVE.seated);
  }
  reset() { this.catches.length = 0; }
  /** How far the catch's glow washes the racer's model toward white, 0 to 1. */
  wash(racer: string, time: number) {
    let k = 0;
    for (const c of this.catches) if (c.racer === racer) k = Math.max(k, swell(within(time - c.start, RECEIVE.halo), .4) * RECEIVE.wash);
    return k;
  }
  /** `slotAt` finds where the caught stack is drawn in the racer's line. */
  draw(batch: FlareBatch, frames: ReadonlyMap<string, RacerFrame>, slotAt: (racer: string) => THREE.Vector3 | null, time: number) {
    for (const c of this.catches) {
      const f = frames.get(c.racer); if (!f) continue;
      const t = time - c.start, h = f.height, R = RECEIVE;
      orb.copy(f.at).setY(f.at.y + h * R.orbHeight);
      const grow = within(t, R.grow), clear = within(t, R.clear);
      if (grow >= 0 || clear >= 0) {
        const radius = h * (clear >= 0 ? R.orbMax + (R.orbClear - R.orbMax) * clear : R.orbMin + (R.orbMax - R.orbMin) * grow);
        // Solid white while it grows, then see-through with a cross flare as the stone shows inside.
        const solid = clear >= 0 ? 1 - smooth(clear) : 1, alpha = clear >= 0 ? 1 - clear * clear : Math.min(1, grow * 4);
        batch.glow(orb, radius * 1.25, R.orbFringe, R.orbFringe, alpha * .35, .2, .9);
        batch.glow(orb, radius, R.orbCore, R.orbFringe, alpha * (.55 + .45 * solid), .3, .3 + .3 * solid);
        batch.ray(f.at, batch.up, batch.right, h * R.orbHeight, h * .1, R.pillar, R.pillar, alpha * .35, 1, .2);
        if (clear >= 0) for (let i = 0; i < 4; i++) batch.screenRay(orb, i * Math.PI / 2, radius * 1.8, h * .025, '#ffffff', R.orbFringe, alpha, .2, 1);
      }
      const ground = swell(within(t, R.streak), .2);
      if (ground > 0) for (const a of [0, Math.PI]) batch.screenRay(f.at, a, h * 1.6, h * .03, '#ffffff', R.pillar, ground * .8, .1, 1);
      const halo = swell(within(t, R.halo), .4);
      if (halo > 0) { mid.copy(f.at).setY(f.at.y + h * .45); const k = batch.lift(mid, h * .9); batch.glow(mid, k * h * (.75 + .35 * within(t, R.halo)), R.haloInner, R.haloRim, halo * .9, .55, .6, .85); }
      const rays = swell(within(t, R.rays), .2);
      if (rays > 0) {
        const seed = Math.floor(time * 30);
        for (let i = 0; i < R.rayCount; i++) batch.screenRay(mid.copy(f.at).setY(f.at.y + h * .4), hash(seed * 13 + i) * Math.PI * 2, h * (1 + 2 * hash(seed * 7 + i)), h * .035, R.ray, R.rayTip, rays * .85, .3, .6);
      }
      // The stone shows inside the clearing orb, hovers, then sinks to its place in the line.
      const sink = within(t, R.sink);
      if (t >= R.clear[0] && t < R.seated) {
        const slot = slotAt(c.racer);
        if (sink >= 0 && slot) stone.lerpVectors(orb, slot, smooth(sink)); else stone.copy(orb);
        this.carried.add(stone, c.kind, c.level, h / RACER_HEIGHT * (sink >= 0 ? 1 + (R.stoneScale - 1) * (1 - sink) : R.stoneScale), 0);
      }
    }
    this.catches = this.catches.filter(c => time - c.start < RECEIVE.seated + .1);
  }
}
