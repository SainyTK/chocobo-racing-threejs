import * as THREE from 'three';
import type { Item } from '../../../../shared/game/index.ts';
import type { HeldStones } from '../../stones/held.ts';
import { Shape } from '../../particles/particles.ts';
import type { Effects } from '../index.ts';
import type { FlareBatch } from './flare-batch.ts';
import type { HeldCues } from './held-cues.ts';
import { MUG, RACER_HEIGHT } from './looks.ts';
import { MugHelper } from './mug-helper.ts';
import type { RacerFrame } from './racer-frame.ts';
import { within } from './timing.ts';

/** A point in a racer's frame: `ahead` and `right` along the road, `up` above it, all in racer heights. The frame's `side` is the racer's left. */
type Local = readonly [ahead: number, right: number, up: number];
interface Run { thief: string; victim?: string; kind: Item; start: number }

const p = new THREE.Vector3(), q = new THREE.Vector3(), dir = new THREE.Vector3(), hands = new THREE.Vector3();
const toWorld = (f: RacerFrame, [ahead, right, up]: Local, out: THREE.Vector3) => out.copy(f.at).addScaledVector(f.forward, ahead * f.height).addScaledVector(f.side, -right * f.height).setY(f.at.y + up * f.height);

/** Position along a path of keys at progress `k`, with a Catmull-Rom curve through them. */
function along(f: RacerFrame, keys: readonly Local[], k: number, out: THREE.Vector3) {
  const n = keys.length - 1, x = Math.min(.9999, Math.max(0, k)) * n, i = Math.floor(x), u = x - i;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n, i + 2)];
  const c = (a: number, b: number, c: number, d: number) => .5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
  return toWorld(f, [c(k0[0], k1[0], k2[0], k3[0]), c(k0[1], k1[1], k2[1], k3[1]), c(k0[2], k1[2], k2[2], k3[2])], out);
}

/**
 * Goblin's Mug as the original shows it: no stone flies between racers. A little goblin hops off the thief to the
 * right, runs past the victim from right to left while the victim's stone vanishes inside a thin ring, and comes back
 * to the thief from the left with the stone, which then joins the thief's line. Each leg is drawn in the racer's own
 * frame, so every camera sees the part the original shows it.
 */
export class MugFx {
  private runs: Run[] = []; private helpers: MugHelper[] = []; private last = new Map<MugHelper, THREE.Vector3>();
  constructor(private fx: Effects, private cues: HeldCues, private carried: HeldStones) {}
  /** Starts a Mug by `thief` taking a `kind` stone from `victim`, or conjuring one when nobody had a stone. */
  start(thief: string, victim: string | undefined, kind: Item, stackIndex: number | undefined, time: number) {
    this.runs.push({ thief, victim, kind, start: time });
    if (stackIndex !== undefined) this.cues.arriving(thief, stackIndex, time + MUG.arrive);
  }
  reset() { this.runs.length = 0; this.helpers.forEach(h => h.hide()); }
  draw(batch: FlareBatch, frames: ReadonlyMap<string, RacerFrame>, dt: number, time: number) {
    let used = 0;
    const helper = () => { let h = this.helpers[used]; if (!h) { h = new MugHelper(); this.helpers.push(h); this.fx.group.add(h.root); this.last.set(h, new THREE.Vector3()); } used++; return h; };
    for (const r of this.runs) {
      const t = time - r.start, thief = frames.get(r.thief), victim = r.victim ? frames.get(r.victim) : undefined;
      if (thief) {
        const out = within(t, MUG.leave), back = within(t, MUG.back);
        if (out >= 0) this.run(helper(), thief, MUG.leavePath, out, t, dt, null);
        if (back >= 0) this.run(helper(), thief, MUG.backPath, back, t, dt, r.kind);
      }
      if (victim) {
        const pass = within(t, MUG.pass), ring = within(t, MUG.ring);
        if (pass >= 0) this.run(helper(), victim, MUG.passPath, pass, t, dt, null);
        if (ring >= 0) {
          // A thin near-white ring round the victim's lower body that widens and turns pink as the stone vanishes.
          toWorld(victim, [0, 0, MUG.ringHeight], p);
          const k = batch.lift(p, victim.height * MUG.ringTo);
          batch.ring(p, k * victim.height * (MUG.ringFrom + (MUG.ringTo - MUG.ringFrom) * ring), k * victim.height * MUG.ringWidth, MUG.ringColor, MUG.ringFade, 1 - ring * ring, ring);
        }
      }
    }
    for (let i = used; i < this.helpers.length; i++) this.helpers[i].hide();
    this.runs = this.runs.filter(r => time - r.start < MUG.arrive + .1);
  }
  /** Poses a helper `k` of the way along `path` in frame `f`, with its pink motion trail, carrying `stone` if given. */
  private run(h: MugHelper, f: RacerFrame, path: readonly Local[], k: number, t: number, dt: number, stone: Item | null) {
    along(f, path, k, p); along(f, path, Math.min(1, k + .03), q); dir.subVectors(q, p).setY(0);
    if (dir.lengthSq() < 1e-6) dir.copy(f.forward);
    const air = Math.min(1, Math.max(0, (p.y - f.at.y) / (f.height * .6)));
    h.root.scale.setScalar(f.height / RACER_HEIGHT); h.place(p, dir.normalize(), t, air);
    const last = this.last.get(h)!;
    if (dt > 0 && last.distanceToSquared(p) < 400) this.fx.spray(this.fx.glow, 2, i => ({ x: last.x + (p.x - last.x) * i * .5, y: last.y + f.height * .25, z: last.z + (p.z - last.z) * i * .5, life: MUG.trailLife, size: f.height * .32, endSize: f.height * .12, color: MUG.trail, endColor: MUG.trailEnd, alpha: .6, shape: Shape.Glow }));
    last.copy(p);
    if (stone) { hands.copy(p).addScaledVector(dir, f.height * .2).setY(p.y + f.height * .3); this.carried.add(hands, stone, 1, f.height / RACER_HEIGHT * MUG.carriedScale, 0); }
  }
}
