import * as THREE from 'three';
import type { FlareBatch } from './flare-batch.ts';
import type { ActivationLook } from './looks.ts';
import type { RacerFrame } from './racer-frame.ts';
import { hash, hashIn, swell, within } from './timing.ts';

interface Activation { racer: string; look: ActivationLook; start: number }

const at = new THREE.Vector3();

/**
 * The flash the original plays round a racer the moment Grip-Up, Mug, Barrier or Magic Plus fires: a thin white cross
 * of light through the racer, a pale disc with a violet rim swelling round it, then the disc pulling in to a white
 * ball while thin pink rays shoot out. Everything faces the camera, as the PS1's sprites did.
 */
export class ActivationFx {
  private active: Activation[] = [];
  start(racer: string, look: ActivationLook, time: number) { this.active.push({ racer, look, start: time }); }
  reset() { this.active.length = 0; }
  /** How far the flash washes the racer's model toward white, 0 to 1. */
  wash(racer: string, time: number) {
    let k = 0;
    for (const a of this.active) if (a.racer === racer) k = Math.max(k, swell(within(time - a.start, [a.look.disc[0], a.look.shrink[1]]), .45) * a.look.wash);
    return k;
  }
  draw(batch: FlareBatch, frames: ReadonlyMap<string, RacerFrame>, time: number) {
    for (const a of this.active) {
      const f = frames.get(a.racer); if (!f) continue;
      const L = a.look, t = time - a.start, seed = Math.floor(time * 30);
      at.copy(f.at).setY(f.at.y + f.height * L.centre);
      const h = f.height * batch.lift(at, f.height * L.radius);
      const cross = swell(within(t, L.cross), .2);
      if (cross > 0) for (let i = 0; i < 4; i++) batch.screenRay(at, i * Math.PI / 2, h * L.crossLength, h * .025, '#ffffff', L.rim, cross, .15, 1);
      const grow = within(t, L.disc), shrink = within(t, L.shrink);
      if (grow >= 0 || shrink >= 0) {
        const radius = h * (shrink >= 0 ? L.radius + (L.coreRadius - L.radius) * shrink : L.radius * (.3 + .7 * Math.min(1, grow * 1.6)));
        const glow = shrink >= 0 ? 1 - shrink * shrink : Math.min(1, grow * 3);
        // Clear inside while wide, so the racer stays readable; it fills white as it pulls in.
        batch.glow(at, radius, L.inner, L.rim, glow * L.fill * (1 + .6 * Math.max(0, shrink)), .14, .72 - .5 * Math.max(0, shrink), L.squash);
        if (shrink >= 0) batch.glow(at, radius * .55, '#ffffff', L.inner, glow, .6, .7);
      }
      const rays = swell(within(t, L.rays), .2);
      if (rays > 0) for (let i = 0; i < L.rayCount; i++) {
        // Each ray keeps its angle, swinging slowly, and re-rolls its length every frame.
        const angle = hash(a.start * 7 + i) * Math.PI * 2 + Math.sin(t * 2 + i) * .25;
        batch.screenRay(at, angle, h * hashIn(seed * 13 + i, L.rayLength * .4, L.rayLength), h * .03, L.ray, L.rayTip, rays * .9, .2, .8);
      }
    }
    this.active = this.active.filter(a => time - a.start < a.look.rays[1]);
  }
}
