import * as THREE from 'three';
import type { FlareBatch } from './flare-batch.ts';
import type { FanLook } from './looks.ts';
import type { RacerFrame } from './racer-frame.ts';
import { hash, hashIn } from './timing.ts';

const SIDES = [-1, 1] as const, root = new THREE.Vector3(), core = new THREE.Vector3(), mid = new THREE.Color(), tip = new THREE.Color();
const colors = new Map<FanLook, { root: THREE.Color; mid: THREE.Color; tip: THREE.Color }>();
const paletteOf = (look: FanLook) => {
  let p = colors.get(look);
  if (!p) { p = { root: new THREE.Color(look.root), mid: new THREE.Color(look.mid), tip: new THREE.Color(look.tip) }; colors.set(look, p); }
  return p;
};

/**
 * Two mirrored, camera-facing fans of spikes rooted on the road beside a racer, as the original draws every boost.
 * `size` grows the fans in, `alpha` fades them out, and `seed` re-rolls every spike's angle and length.
 */
export function drawFans(batch: FlareBatch, f: RacerFrame, look: FanLook, size: number, alpha: number, seed: number) {
  if (size <= 0 || alpha <= 0) return;
  // Seen from the side, the fan over the racer's nose shrinks, so the fans read as a half sunburst behind its rear.
  const h = f.height, p = paletteOf(look), n = look.spikes, nose = f.forward.dot(batch.right);
  for (const s of SIDES) {
    const reach = size * (1 - .7 * Math.max(0, s * nose));
    // Rooted at road level just outside the racer's rear, nudged toward the camera so the vehicle's sides never cut them.
    root.copy(f.at).addScaledVector(batch.right, s * look.offset * h).addScaledVector(f.forward, -.3 * h).addScaledVector(batch.toward, .35 * h);
    for (let i = 0; i < n; i++) {
      const k = seed * 31 + i * 7 + (s > 0 ? 3 : 0), a = look.low + (look.high - look.low) * (i + hashIn(k, .1, .9)) / n;
      // Flat spikes reach furthest and steep ones stop lower, which gives the fan its wing outline.
      const length = look.length * h * reach * (1 - .4 * a / look.high) * hashIn(k + 1, .62, 1);
      const angle = s > 0 ? a : Math.PI - a;
      mid.copy(p.mid).lerp(p.tip, hash(k + 2) * .5); tip.copy(p.tip);
      batch.screenRay(root, angle, length, h * hashIn(k + 3, .07, .11), mid, tip, alpha, .05, 1);
    }
    // The spikes merge into a small white root beside the racer's feet, which leaves the racer clear between the fans.
    core.copy(root).addScaledVector(batch.right, s * .35 * h).addScaledVector(batch.up, .05 * h);
    batch.glow(core, .34 * h * reach, p.root, p.mid, alpha * .55, .6, .5, .4);
  }
}
