import * as THREE from 'three';
import { stackPositions, type AbilityId, type Item, type Racer } from '../../../../shared/game/index.ts';
import type { Character } from '../../characters/index.ts';
import { HeldStones } from '../../stones/held.ts';
import { HELD_STONE } from '../../stones/looks.ts';
import type { Effects } from '../index.ts';
import { ActivationFx } from './activation.ts';
import { BarrierFx } from './barrier.ts';
import { BoostFx, type BoostKind } from './boost.ts';
import { ChargeFx } from './charge.ts';
import { FlapFx } from './flap.ts';
import { FlareBatch } from './flare-batch.ts';
import { drawGrip } from './grip.ts';
import { HeldCues } from './held-cues.ts';
import { ACTIVATION_BURST, MAGIC_BURST, MUG_BURST, RACER_HEIGHT } from './looks.ts';
import { MagicPlusFx } from './magic-plus.ts';
import { MegaflareFx } from './megaflare.ts';
import { MugFx } from './mug.ts';
import { racerFrame, readFrame, type RacerFrame } from './racer-frame.ts';
import { ReceiveFx } from './receive.ts';

export type { BoostKind } from './boost.ts';
export { flapLift } from './flap.ts';

/** The racer fields the ability effects read. A race's racers fit, and so do the Studio's scripted ones. */
export type AbilityRacer = Pick<Racer, 'id' | 'boost' | 'charging' | 'flying' | 'flare' | 'stun' | 'finishTime' | 'gripUp' | 'barrier' | 'stones' | 'px' | 'pz' | 'yaw' | 'vx' | 'vz' | 'speed' | 'character'>;

const g = racerFrame(), tinted = new THREE.Color(), slot = new THREE.Vector3(), raised = { at: new THREE.Vector3(), height: 1 };

/**
 * The rebuilt effects of every ability: Dash, Haste and the other boosts, Charge, Flap, Megaflare, Grip-Up, Mug,
 * Magic Plus, Barrier and Receive. Every sprite they draw goes into one flare batch, so all of them together cost one
 * draw call; stones carried by Mug's helper and caught by Receive cost one more while they are on screen.
 */
export class AbilityFx {
  readonly batch = new FlareBatch(3000);
  /** Stones on their way into a racer's line, drawn like held stones. */
  readonly carried = new HeldStones(12);
  private boost: BoostFx; private charge: ChargeFx; private flap = new FlapFx(); private flare: MegaflareFx; private time = 0;
  private cues = new HeldCues(); private activation = new ActivationFx(); private barrier: BarrierFx; private mug: MugFx;
  private magic = new MagicPlusFx(this.cues); private receive = new ReceiveFx(this.cues, this.carried);
  private frames = new Map<string, RacerFrame>(); private racers: readonly AbilityRacer[] = [];
  constructor(fx: Effects) {
    this.boost = new BoostFx(fx); this.charge = new ChargeFx(fx); this.flare = new MegaflareFx(fx);
    this.barrier = new BarrierFx(fx); this.mug = new MugFx(fx, this.cues, this.carried); fx.group.add(this.carried.mesh);
  }
  /** Starts the look of a racer's ability. Returns false for abilities drawn elsewhere. Mug and Magic Plus start through `mugged` and `raised`. */
  used(ability: AbilityId, racerId: string) {
    if (ability === 'dash' || ability === 'charge') this.boost.start(racerId, ability);
    if (ability === 'grip' || ability === 'barrier') this.activation.start(racerId, ACTIVATION_BURST, this.time);
    return ability === 'dash' || ability === 'charge' || ability === 'flap' || ability === 'megaflare' || ability === 'grip' || ability === 'barrier' || ability === 'mug' || ability === 'magic';
  }
  /** Goblin's Mug took a `kind` stone from `victim`, or conjured one when nobody held a stone. `stackIndex` is a new stack it made in the thief's line. */
  mugged(thief: string, victim: string | undefined, kind: Item, stackIndex: number | undefined) {
    this.activation.start(thief, MUG_BURST, this.time); this.mug.start(thief, victim, kind, stackIndex, this.time);
  }
  /** Magic Plus raised the stack at `stackIndex`. */
  raised(racerId: string, stackIndex: number) { this.activation.start(racerId, MAGIC_BURST, this.time); this.magic.start(racerId, stackIndex, this.time); }
  /** Receive caught a spell as a stack of `kind` and `level`; `stackIndex` is the new stack it made, if any. */
  received(racerId: string, kind: Item, level: number, stackIndex: number | undefined) { this.receive.start(racerId, kind, level, stackIndex, this.time); }
  /** A Barrier blocked a spell and goes down after one last pulse. */
  blocked(racerId: string) { this.barrier.block(racerId, this.time); }
  /** How stack `index` of a racer's held line should be drawn this frame. */
  heldLook(racerId: string, index: number) { return this.cues.look(racerId, index, this.time); }
  /** A boost from something other than an ability: Haste, a boost pad, the start dash or a Spin Dash. */
  boosted(racerId: string, kind: BoostKind) { this.boost.start(racerId, kind); }
  /** A Megaflare strike on a racer whose centre is `at`, about 1.5 m above the road. */
  strike(at: THREE.Vector3, racerId: string, mine: boolean) { this.flare.strike(at, racerId, 1, mine); }
  /** A charging racer rammed the racer whose centre is `at`. */
  ram(at: THREE.Vector3) { this.charge.ram(at); }
  reset() {
    this.boost.reset(); this.flare.reset(); this.activation.reset(); this.barrier.reset(); this.mug.reset(); this.magic.reset(); this.receive.reset(); this.cues.clear();
    this.batch.clear(); this.carried.begin(this.time); this.carried.end();
  }
  update(dt: number, camera: THREE.Camera, racers: readonly AbilityRacer[], chars: ReadonlyMap<string, Character>) {
    this.time += dt; this.batch.begin(camera); this.carried.begin(this.time); this.racers = racers;
    for (const p of racers) {
      const c = chars.get(p.id); if (!c) { this.frames.delete(p.id); continue; }
      let f = this.frames.get(p.id); if (!f) { f = racerFrame(); this.frames.set(p.id, f); }
      readFrame(c, f);
      drawGrip(this.batch, f, p.gripUp, this.time); this.barrier.draw(this.batch, f, p.id, p.barrier, dt, this.time);
      this.boost.draw(this.batch, p.id, f, p.boost > 0 && p.stun <= 0 && p.charging <= 0, dt, this.time);
      this.charge.draw(this.batch, f, p.charging, this.time); this.flap.draw(this.batch, f, p.flying, this.time); this.flare.caster(this.batch, f, p.flare, this.time);
      if (dt > 0 && this.flare.shooting(p.flare)) for (const q of racers) { const d = chars.get(q.id); if (q !== p && d && q.finishTime === null) this.flare.rain(readFrame(d, g), dt); }
    }
    this.flare.update(this.batch, dt, this.time);
    this.activation.draw(this.batch, this.frames, this.time);
    this.mug.draw(this.batch, this.frames, dt, this.time);
    this.magic.draw(this.batch, id => this.raisedStone(id), this.time);
    this.receive.draw(this.batch, this.frames, id => this.latestStone(id, slot), this.time);
    this.cues.prune(this.time); this.batch.end(); this.carried.end();
  }
  private raisedStone(id: string) {
    if (!this.latestStone(id, raised.at)) return null;
    raised.height = this.frames.get(id)!.height; return raised;
  }
  /** Where a racer's latest held stack sits on the road, written to `out`; null when it has none or is off screen. */
  private latestStone(id: string, out: THREE.Vector3) {
    const p = this.racers.find(q => q.id === id), frame = this.frames.get(id); if (!p || !frame || !p.stones.length) return null;
    const at = stackPositions(p as Racer).at(-1)!;
    return out.set(at.x, frame.at.y + HELD_STONE.lift * frame.height / RACER_HEIGHT, at.z);
  }
  /** The tint an ability puts over a racer's model, written to `out`; returns how strongly it applies. */
  tint(p: AbilityRacer, out: THREE.Color) {
    let best = this.flare.tint(p.id, out);
    const charge = this.charge.tint(p.charging, tinted); if (charge > best) { best = charge; out.copy(tinted); }
    const boost = p.charging > 0 ? 0 : this.boost.tint(p.id, tinted); if (boost > best) { best = boost; out.copy(tinted); }
    const wash = Math.max(this.activation.wash(p.id, this.time), this.receive.wash(p.id, this.time)); if (wash > best) { best = wash; out.set('#ffffff'); }
    return best;
  }
}
