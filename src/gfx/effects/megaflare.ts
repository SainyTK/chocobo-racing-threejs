import * as THREE from 'three';
import type { Race } from '../../../shared/game/index.ts';
import { Shape } from '../particles/particles.ts';
import type { Effects } from './index.ts';
import { floorY, rand } from './util.ts';

/** Megaflare's pink-magenta, from the original's flare shots. */
export const FLARE_COLOR = '#ff5ad2';
const v = new THREE.Vector3();

/**
 * While a Megaflare charges, its caster glows and warning shots streak down around every rival and burst on the
 * road, missing on purpose as in the original. The strike itself is the crash impact.
 */
export function flareRain(fx: Effects, race: Race, dt: number) {
  for (const caster of race.racers) {
    if (caster.flare <= 0 || dt <= 0) continue;
    const cy = floorY(race, caster.px, caster.pz);
    fx.spray(fx.glow, 2, () => { const a = rand(0, 6.28); return { x: caster.px + Math.cos(a) * 1.6, y: cy + rand(.5, 3), z: caster.pz + Math.sin(a) * 1.6, vy: rand(2, 4), life: rand(.3, .5), size: rand(.3, .5), endSize: .05, color: '#ffffff', endColor: FLARE_COLOR, shape: Shape.Star }; });
    for (const p of race.racers) {
      if (p === caster || p.finishTime !== null || Math.random() > .7 * fx.density) continue;
      const y = floorY(race, p.px, p.pz), a = rand(0, 6.28), d = rand(1.8, 4.5), x = p.px + Math.cos(a) * d, z = p.pz + Math.sin(a) * d;
      fx.glow.emit({ x, y: y + 14, z, vy: -42, life: .32, size: rand(.7, 1), endSize: .5, color: '#fff0fb', endColor: FLARE_COLOR, stretch: .06 });
      if (Math.random() < .3) fx.bursts.spawn('ring', v.set(x, y + .1, z), FLARE_COLOR, rand(1.2, 2), .3);
    }
  }
}

/** A Megaflare strike: a column of flare light and a pink shock ring under the victim. */
export function flareImpact(fx: Effects, at: THREE.Vector3, mine: boolean) {
  const ground = v.set(at.x, at.y - 1.5, at.z).clone();
  fx.bursts.spawn('pillar', ground, '#ff2fb8', .9, .7, { height: mine ? 10 : 16 });
  fx.bursts.spawn('ring', ground, FLARE_COLOR, mine ? 3 : 4.5, .5);
  fx.explode(at, mine ? .6 : 1);
  fx.sparkle(at, FLARE_COLOR, mine ? 16 : 30, 1.6, 4);
  fx.flash = Math.max(fx.flash, mine ? .3 : .45);
}
