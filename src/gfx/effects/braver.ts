import * as THREE from 'three';
import { ABILITY_SECONDS, BRAVER, type Race } from '../../../shared/game/index.ts';
import { Shape } from '../particles/particles.ts';
import type { Effects } from './index.ts';
import { floorY, rand } from './util.ts';

/** Braver's pale mako blue, the colour of the sword's wake. */
export const BRAVER_COLOR = '#8fdcff';
/** The part of the swing when the blade sweeps round his right side, front to back, in seconds. */
const SWEEP = [.3, .6] as const;

/** At the start of a swing: a ring on the road that grows to Braver's reach just as the blade strikes. */
export function braverWindUp(fx: Effects, ground: THREE.Vector3) {
  fx.bursts.spawn('ring', ground, BRAVER_COLOR, BRAVER.reach, BRAVER.strike + .15);
}

/** While a racer swings, streaks of light trail the blade in an arc round its right side, out to the edge of the reach. */
export function braverArcs(fx: Effects, race: Race, dt: number) {
  for (const p of race.racers) {
    const swing = ABILITY_SECONDS.braver - p.slash;
    if (p.slash <= 0 || dt <= 0 || swing < SWEEP[0] || swing > SWEEP[1]) continue;
    const k = (swing - SWEEP[0]) / (SWEEP[1] - SWEEP[0]), y = floorY(race, p.px, p.pz) + 1.4;
    // Angle from his right toward the front: the blade comes round from ahead of him and ends behind.
    const phi = THREE.MathUtils.lerp(1.9, -1.2, k), fx0 = Math.sin(p.yaw), fz0 = Math.cos(p.yaw), rx = -fz0, rz = fx0;
    fx.spray(fx.glow, 7, () => {
      const r = rand(1.6, BRAVER.reach * .9), a = phi + rand(-.08, .08), dx = rx * Math.cos(a) + fx0 * Math.sin(a), dz = rz * Math.cos(a) + fz0 * Math.sin(a);
      const tx = rx * Math.sin(a) - fx0 * Math.cos(a), tz = rz * Math.sin(a) - fz0 * Math.cos(a), speed = r * 7;
      return { x: p.px + dx * r, y: y + rand(-.3, .5), z: p.pz + dz * r, vx: tx * speed, vz: tz * speed, life: rand(.14, .24), size: rand(.35, .6), endSize: .05, color: '#ffffff', endColor: BRAVER_COLOR, stretch: .03, drag: 4, shape: Shape.Shard };
    });
  }
}

/** A Braver strike landing: a pale blue slash flash and sparks. */
export function braverImpact(fx: Effects, at: THREE.Vector3, ground: THREE.Vector3, mine: boolean) {
  fx.bursts.spawn('ring', ground, BRAVER_COLOR, mine ? 2.5 : 3.5, .35);
  fx.sparkle(at, BRAVER_COLOR, mine ? 14 : 24, 1.4, 3);
  fx.spray(fx.glow, 3, () => ({ x: at.x, y: at.y + .4, z: at.z, life: .14, size: rand(1.6, 2.4), endSize: .3, color: '#ffffff', endColor: BRAVER_COLOR }));
  fx.dust(at, 8);
}
