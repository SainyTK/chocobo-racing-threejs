import * as THREE from 'three';
import type { FlareBatch } from './flare-batch.ts';
import { Glyph } from './flare-material.ts';
import type { HeldCues } from './held-cues.ts';
import { MAGIC_PLUS } from './looks.ts';
import { swell, within } from './timing.ts';

interface Rise { racer: string; start: number }

const at = new THREE.Vector3(), ax = new THREE.Vector3(), ay = new THREE.Vector3();

/**
 * Magic Plus after its burst: a green U-shaped curtain drops from high above the racer, narrows into a thin beam
 * that ends on the raised stone and leaves a green glint. The stone itself flickers black every frame for about 3 s,
 * through `HeldCues`.
 */
export class MagicPlusFx {
  private rises: Rise[] = [];
  constructor(private cues: HeldCues) {}
  start(racer: string, stackIndex: number, time: number) {
    this.rises.push({ racer, start: time });
    this.cues.flicker(racer, stackIndex, time + MAGIC_PLUS.flicker, MAGIC_PLUS.flickerRate);
  }
  reset() { this.rises.length = 0; }
  /** `stoneAt` finds where a racer's raised (latest) stone is drawn and its racer height, or null when it is gone. */
  draw(batch: FlareBatch, stoneAt: (racer: string) => { at: THREE.Vector3; height: number } | null, time: number) {
    for (const r of this.rises) {
      const t = time - r.start, k = within(t, MAGIC_PLUS.curtain), glint = swell(within(t, MAGIC_PLUS.glint), .3);
      if (k < 0 && glint <= 0) continue;
      const stone = stoneAt(r.racer); if (!stone) continue;
      const h = stone.height;
      if (k >= 0) {
        // The curtain's bottom falls to the stone while its width closes from a wide U to a thread.
        const span = h * MAGIC_PLUS.drop * (1 - k * .55), width = h * MAGIC_PLUS.width * (1 - k) ** 1.6 + h * .04;
        at.copy(stone.at).setY(stone.at.y + h * MAGIC_PLUS.drop * (1 - k) + span / 2);
        ax.copy(batch.right).multiplyScalar(width / 2); ay.copy(batch.up).multiplyScalar(span / 2);
        batch.quad(at, ax, ay, Glyph.Curtain, MAGIC_PLUS.edge, MAGIC_PLUS.core, Math.min(1, k * 6), k, 0, MAGIC_PLUS.cover);
      }
      if (glint > 0) {
        batch.glow(stone.at, h * MAGIC_PLUS.glintSize, '#ffffff', MAGIC_PLUS.edge, glint, .8, .2);
        for (let i = 0; i < 4; i++) batch.screenRay(stone.at, i * Math.PI / 2, h * MAGIC_PLUS.glintSize * 2.4, h * .03, '#ffffff', MAGIC_PLUS.core, glint, .2, 1);
      }
    }
    this.rises = this.rises.filter(r => time - r.start < MAGIC_PLUS.glint[1]);
  }
}
