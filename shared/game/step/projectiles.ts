import { clamp, angleDelta } from '../../math.ts';
import { hit } from '../combat.ts';
import type { Race } from '../types.ts';

/** Moves fireballs, homing on their target, and resolves hits. */
export function stepProjectiles(r: Race, dt: number) {
  for (const shot of r.projectiles) {
    shot.life -= dt; const target = shot.target ? r.racers.find(p => p.id === shot.target) : null;
    if (target) shot.yaw += clamp(angleDelta(Math.atan2(target.px - shot.px, target.pz - shot.pz), shot.yaw), -dt * 5, dt * 5);
    shot.px += Math.sin(shot.yaw) * 80 * dt; shot.pz += Math.cos(shot.yaw) * 80 * dt;
    for (const p of r.racers) if (p.id !== shot.owner && p.finishTime === null && Math.hypot(p.px - shot.px, p.pz - shot.pz) < 2 + shot.level * .25) { const source = r.racers.find(q => q.id === shot.owner); if (source) hit(r, p, source, 'fire', shot.level); shot.life = 0; break; }
  }
  r.projectiles = r.projectiles.filter(p => p.life > 0);
}
