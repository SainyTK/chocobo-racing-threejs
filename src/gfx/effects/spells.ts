import * as THREE from 'three';
import { ITEMS, type Item } from '../../../shared/game/index.ts';
import { Shape } from '../particles/particles.ts';
import type { CrashInfo, CrashTier } from '../../race-events.ts';
import type { Effects } from './index.ts';
import { rand } from './util.ts';

const v = new THREE.Vector3();
const feet = (at: THREE.Vector3, up = .1) => v.set(at.x, at.y - 1.5 + up, at.z).clone();
/** Size of a spell's visuals per level, so level 2 and 3 read as clearly bigger moments. */
const GROW = [1, 1.45, 2.1];

/**
 * Cast and impact visuals for every spell, scaled by level. `at` is a racer's centre, about 1.5 m above the road.
 * Visuals around the player's own racer stay rim-lit and short so they never wash out the road ahead.
 */
export class SpellFx {
  constructor(private fx: Effects) {}

  cast(kind: Item, level: number, at: THREE.Vector3, fwd: THREE.Vector3, casterId: string, mine: boolean) {
    const fx = this.fx, g = GROW[level - 1] ?? 1, color = ITEMS[kind].color;
    switch (kind) {
      case 'fire': {
        // A burst of flame thrown forward from the caster's hands.
        const m = at.clone().addScaledVector(fwd, 2.2);
        fx.spray(fx.glow, 10 + level * 6, () => ({ x: m.x, y: m.y, z: m.z, vx: fwd.x * rand(8, 16) * g + rand() * 3, vy: rand(0, 3), vz: fwd.z * rand(8, 16) * g + rand() * 3, life: rand(.2, .4), size: rand(.6, 1.1) * g, endSize: .1, color: '#ffb347', endColor: '#ff3a08', drag: 4 }));
        fx.spray(fx.smoke, 4 + level * 3, () => ({ x: m.x + rand() * .5, y: m.y + rand() * .5, z: m.z + rand() * .5, vx: fwd.x * rand(3, 6) + rand(), vy: rand(.5, 2), vz: fwd.z * rand(3, 6) + rand(), life: rand(.6, 1), size: .6 * g, endSize: 2 * g, color: '#4a3a36', endColor: '#8b8480', alpha: .45, drag: 2, shape: Shape.Smoke }));
        return;
      }
      case 'ice': {
        fx.shatter(at.clone().addScaledVector(fwd, -2.5), 14 + level * 6);
        if (level < 3) return;
        // Blizzaga: a freezing wave rolls out over the track.
        fx.bursts.spawn('ring', feet(at), '#bfefff', 48, 1.1); fx.bursts.spawn('dome', feet(at, 0), '#9fe3ff', 40, 1.1);
        fx.spray(fx.glow, 70, () => { const a = rand(0, 6.28), r = rand(1, 5); return { x: at.x + Math.cos(a) * r, y: at.y + rand(-1, 3), z: at.z + Math.sin(a) * r, vx: Math.cos(a) * rand(8, 20), vy: rand(-1, 2), vz: Math.sin(a) * rand(8, 20), life: rand(.6, 1.1), size: rand(.25, .5), color: '#ffffff', endColor: '#8fdcff', drag: 1, shape: Shape.Star }; });
        return;
      }
      case 'thunder': {
        // The caster crackles; the bolt itself lands on the target.
        fx.sparkle(at, color, 12 + level * 6, 1, 3); fx.bursts.spawn('ring', feet(at), color, 2 + level * .6, .3);
        return;
      }
      case 'haste': {
        // The green spike fans and the ring are the boost's look; see abilities/boost.ts.
        fx.abilities.boosted(casterId, 'haste');
        return;
      }
      case 'shield': {
        fx.sparkle(at, color, 26); return;
      }
      case 'mini': case 'doom': {
        // A ring of the spell's colour rises from the caster before it reaches the target.
        fx.sparkle(at, color, 16 + level * 8, 1.2, 2); fx.swirl(feet(at, 0), color, 3, 24 + level * 10); return;
      }
      case 'ultima': {
        // A shockwave dome sweeps out from the caster; its middle stays clear so the caster can still see the road.
        fx.bursts.spawn('dome', feet(at, 0), '#d9c8ff', 26 + level * 14, .9 + level * .2);
        fx.bursts.spawn('ring', feet(at), '#efe6ff', 30 + level * 12, 1); fx.bursts.spawn('ring', feet(at, .15), '#9c7bff', 16 + level * 8, .8);
        if (level >= 2) fx.bursts.spawn('pillar', feet(at, 0), '#e7dcff', 2 + level, .9, { height: 20 + level * 8 });
        fx.swirl(feet(at, 0), '#d7c7ff', 5 + level, 50 + level * 20);
        fx.flash = Math.max(fx.flash, mine ? .35 : .6 + level * .1); if (mine) fx.shake = Math.max(fx.shake, .25 + level * .1);
        return;
      }
    }
  }

  /** A spell or contact landing on a racer, scaled by spell level and crash tier. */
  impact(info: CrashInfo, at: THREE.Vector3, victimId: string, mine: boolean) {
    // The player's own hit stays smaller: it fills the middle of their view, so a full-size blast would hide the road.
    const fx = this.fx, s = fx.racerStatus(victimId), g = Math.min(GROW[info.level - 1] ?? 1, mine ? 1.1 : 3), tier: CrashTier = info.tier;
    if (s) s.flash = 1; if (mine) fx.shake = Math.max(fx.shake, [0, .35, .6, .9][tier]);
    switch (info.kind) {
      case 'fire': fx.explode(at, 1.1 * g); fx.bursts.spawn('ring', feet(at), '#ff6a2a', 4 * g, .7); if (info.level === 3 && !mine) fx.bursts.spawn('pillar', feet(at, 0), '#ff9a3a', 2.4, .8, { height: 14 }); return;
      case 'thunder': fx.strike(feet(at, 0), info.level, !mine); return;
      case 'ice': fx.shatter(at, 20 + info.level * 10); if (s) s.frozenUntil = fx.time + (info.level === 3 ? 1.6 : .7); fx.bursts.spawn('ring', feet(at), '#bfefff', 3 * g, .6); return;
      case 'ultima': fx.ultimaHit(at, info.level, mine); return;
      case 'doom': fx.doomHit(at); return;
      case 'megaflare': fx.abilities.strike(at, victimId, mine); return;
      case 'charge': fx.abilities.ram(at); fx.dust(at, 10); return;
      case 'squash': fx.sparkle(at, '#c99bff', 20, 1.4, 1); fx.dust(at, 14); return;
      case 'drift': fx.dust(at, 12); return;
      default: fx.sparkle(v.set(at.x, at.y + 1, at.z), '#ffe27a', 18, 1, 2); fx.dust(at, 10); fx.bursts.spawn('ring', feet(at), '#ffd27a', 3, .35);
    }
  }

  /** A Mini spell reaching its target: a puff of smoke and stars as the racer shrinks. */
  shrink(at: THREE.Vector3, level: number, victimId: string) {
    const fx = this.fx, g = GROW[level - 1] ?? 1;
    fx.swirl(feet(at, 0), '#c99bff', 3, 30 + level * 12); const s = fx.racerStatus(victimId); if (s) s.flash = .8;
    fx.spray(fx.smoke, 10 + level * 6, () => ({ x: at.x + rand(), y: at.y + rand(-.5, .8), z: at.z + rand(), vx: rand() * 3 * g, vy: rand(.5, 2.5), vz: rand() * 3 * g, life: rand(.6, 1.1), size: .8 * g, endSize: 2.6 * g, color: '#f3e6ff', endColor: '#b68bef', alpha: .6, drag: 2, shape: Shape.Smoke }));
    fx.bursts.spawn('ring', feet(at), '#c99bff', 3 * g, .45);
  }
}
