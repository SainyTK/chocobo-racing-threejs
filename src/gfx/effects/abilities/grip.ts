import * as THREE from 'three';
import { ABILITY_SECONDS } from '../../../../shared/game/abilities.ts';
import type { FlareBatch } from './flare-batch.ts';
import { Glyph } from './flare-material.ts';
import { GRIP } from './looks.ts';
import type { RacerFrame } from './racer-frame.ts';
import { hash, progress, smooth } from './timing.ts';

const at = new THREE.Vector3(), ax = new THREE.Vector3(), ay = new THREE.Vector3();

/**
 * Grip-Up's magenta rings, one beside each side of the kart at wheel height, as the original draws them after the
 * activation burst: thin at the hubs, flung out as crescents a kart width away, snapped back in, then held with a
 * slow pulse until they fade. `gripUp` is the simulation's remaining seconds.
 */
export function drawGrip(batch: FlareBatch, f: RacerFrame, gripUp: number, time: number) {
  if (gripUp <= 0) return;
  const t = ABILITY_SECONDS.grip - gripUp, h = f.height;
  if (t < GRIP.hubs[0]) return;
  const flung = t < GRIP.snap[0] ? smooth(progress(t, GRIP.out)) : 1 - smooth(progress(t, GRIP.snap));
  const born = Math.min(1, (t - GRIP.hubs[0]) / (GRIP.hubs[1] - GRIP.hubs[0])), fade = Math.min(1, gripUp / GRIP.fade);
  const pulse = 1 + GRIP.pulse * Math.sin((t - GRIP.snap[1]) / GRIP.period * Math.PI * 2);
  const width = h * GRIP.width * (.25 + .75 * born), height = h * GRIP.height * (t > GRIP.snap[1] ? pulse : .35 + .65 * born);
  for (const s of [-1, 1]) {
    // Outward on screen, so the hollow side faces the kart from any angle.
    const outward = Math.sign(f.side.dot(batch.right) * s) || s;
    at.copy(f.at).addScaledVector(f.side, s * h * (GRIP.offset + GRIP.fling * flung)).addScaledVector(f.forward, h * GRIP.ahead).setY(f.at.y + h * GRIP.hub);
    ax.copy(batch.right).multiplyScalar(width * outward); ay.copy(batch.up).multiplyScalar(height);
    batch.quad(at, ax, ay, Glyph.Crescent, GRIP.rim, GRIP.band, fade * GRIP.alpha, Math.floor(time * 30) % 97, flung, GRIP.cover);
    // Streaky pink trails back toward the kart while flung out, like a comet's tail.
    if (flung > .05) for (let i = 0; i < GRIP.streaks; i++) {
      const lift = (i / (GRIP.streaks - 1) - .5) * height * 1.2;
      at.addScaledVector(batch.up, lift); batch.screenRay(at, outward > 0 ? Math.PI : 0, h * GRIP.fling * flung * (.6 + .4 * hash(i + Math.floor(time * 30))), h * .05, GRIP.band, GRIP.trail, flung * .6 * fade, .2, .3); at.addScaledVector(batch.up, -lift);
    }
  }
}
