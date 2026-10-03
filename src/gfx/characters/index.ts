import * as THREE from 'three';
import { RACERS, type RacerProfile } from '../../../shared/game/index.ts';
import { clamp, damp } from './math.ts';
import type { Build, Character } from './types.ts';
import { chocobo } from './racers/chocobo.ts';
import { mog } from './racers/mog.ts';
import { golem } from './racers/golem.ts';
import { goblin } from './racers/goblin.ts';
import { blackMage } from './racers/black-mage.ts';
import { whiteMage } from './racers/white-mage.ts';
import { chubby } from './racers/chubby.ts';
import { behemoth } from './racers/behemoth.ts';

export type { AnimState, Character } from './types.ts';

const BUILDERS: ((c: RacerProfile) => Build)[] = [chocobo, mog, golem, goblin, blackMage, whiteMage, chubby, behemoth];

export function createCharacter(index: number): Character {
  const c = RACERS[index], b = BUILDERS[index](c); b.r.finish(b.outline);
  b.r.root.traverse(o => { o.matrixAutoUpdate = true; });
  let lean = 0, spin = 0;
  return {
    root: b.r.root, model: b.r.model, skin: b.r.skin, exhausts: b.exhausts, contacts: b.contacts, head: b.head, height: b.height,
    animate(s) {
      const k = clamp(Math.abs(s.speed) / 38, 0, 1);
      lean = damp(lean, -s.steer * (s.drifting ? .16 : .07) * (s.menu ? 0 : 1), 8, s.dt); b.r.model.rotation.z = lean;
      spin = s.stun > 0 ? spin + s.dt * 13 : damp(spin, Math.round(spin / (Math.PI * 2)) * Math.PI * 2, 10, s.dt); b.r.model.rotation.y = spin;
      // Menu showcase: an idle engine shake, plus a cheerful hop with a flap every few seconds.
      const cycle = (s.t % 4.2) / 4.2, hop = s.menu && cycle < .16 ? Math.sin(cycle / .16 * Math.PI) : 0;
      b.r.model.position.y = s.menu ? hop * .45 + (b.wheels.length ? Math.sin(s.t * 38) * .012 : 0) : Math.sin(s.t * 31) * Math.min(.03, k * .03);
      b.r.model.scale.set(1 + hop * .04, 1 - (s.menu && cycle > .16 && cycle < .2 ? Math.sin((cycle - .16) / .04 * Math.PI) * .08 : 0), 1 + hop * .04);
      if (hop > 0) s = { ...s, flying: 1 };
      for (const w of b.wheels) w.j.rotation.x += s.speed * s.dt / w.r;
      for (const st of b.steer) st.rotation.y = damp(st.rotation.y, s.steer * .45, 12, s.dt);
      b.update?.(s, k);
    },
    dispose() {
      b.r.root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
    },
  };
}
