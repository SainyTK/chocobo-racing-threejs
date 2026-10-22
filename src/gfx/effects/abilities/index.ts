import * as THREE from 'three';
import type { AbilityId, Racer } from '../../../../shared/game/index.ts';
import type { Character } from '../../characters/index.ts';
import type { Effects } from '../index.ts';
import { BoostFx, type BoostKind } from './boost.ts';
import { ChargeFx } from './charge.ts';
import { FlapFx } from './flap.ts';
import { FlareBatch } from './flare-batch.ts';
import { MegaflareFx } from './megaflare.ts';
import { racerFrame, readFrame } from './racer-frame.ts';

export type { BoostKind } from './boost.ts';
export { flapLift } from './flap.ts';

/** The racer fields the ability effects read. A race's racers fit, and so do the Studio's scripted ones. */
export type AbilityRacer = Pick<Racer, 'id' | 'boost' | 'charging' | 'flying' | 'flare' | 'stun' | 'finishTime'>;

const f = racerFrame(), g = racerFrame(), tinted = new THREE.Color();

/**
 * The rebuilt effects of Dash, Haste and the other boosts, Charge, Flap and Megaflare. Every sprite they draw goes
 * into one flare batch, so all of them together cost one draw call.
 */
export class AbilityFx {
  readonly batch = new FlareBatch(3000);
  private boost: BoostFx; private charge: ChargeFx; private flap = new FlapFx(); private flare: MegaflareFx; private time = 0;
  constructor(fx: Effects) { this.boost = new BoostFx(fx); this.charge = new ChargeFx(fx); this.flare = new MegaflareFx(fx); }
  /** Starts the look of a racer's ability. Returns false for abilities drawn elsewhere. */
  used(ability: AbilityId, racerId: string) {
    if (ability === 'dash' || ability === 'charge') this.boost.start(racerId, ability);
    return ability === 'dash' || ability === 'charge' || ability === 'flap' || ability === 'megaflare';
  }
  /** A boost from something other than an ability: Haste, a boost pad, the start dash or a Spin Dash. */
  boosted(racerId: string, kind: BoostKind) { this.boost.start(racerId, kind); }
  /** A Megaflare strike on a racer whose centre is `at`, about 1.5 m above the road. */
  strike(at: THREE.Vector3, racerId: string, mine: boolean) { this.flare.strike(at, racerId, 1, mine); }
  /** A charging racer rammed the racer whose centre is `at`. */
  ram(at: THREE.Vector3) { this.charge.ram(at); }
  reset() { this.boost.reset(); this.flare.reset(); this.batch.clear(); }
  update(dt: number, camera: THREE.Camera, racers: readonly AbilityRacer[], chars: ReadonlyMap<string, Character>) {
    this.time += dt; this.batch.begin(camera);
    for (const p of racers) {
      const c = chars.get(p.id); if (!c) continue; readFrame(c, f);
      this.boost.draw(this.batch, p.id, f, p.boost > 0 && p.stun <= 0 && p.charging <= 0, dt, this.time);
      this.charge.draw(this.batch, f, p.charging, this.time); this.flap.draw(this.batch, f, p.flying, this.time); this.flare.caster(this.batch, f, p.flare, this.time);
      if (dt > 0 && this.flare.shooting(p.flare)) for (const q of racers) { const d = chars.get(q.id); if (q !== p && d && q.finishTime === null) this.flare.rain(readFrame(d, g), dt); }
    }
    this.flare.update(this.batch, dt, this.time);
    this.batch.end();
  }
  /** The tint an ability puts over a racer's model, written to `out`; returns how strongly it applies. */
  tint(p: AbilityRacer, out: THREE.Color) {
    let best = this.flare.tint(p.id, out);
    const charge = this.charge.tint(p.charging, tinted); if (charge > best) { best = charge; out.copy(tinted); }
    const boost = p.charging > 0 ? 0 : this.boost.tint(p.id, tinted); if (boost > best) { best = boost; out.copy(tinted); }
    return best;
  }
}
