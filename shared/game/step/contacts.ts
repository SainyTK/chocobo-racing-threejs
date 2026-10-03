import { angleDelta } from '../../math.ts';
import { RACERS } from '../racers.ts';
import { addStone, syncInventory } from '../inventory.ts';
import { crash, hit } from '../combat.ts';
import { event } from '../events.ts';
import type { Race } from '../types.ts';

/** Pushes overlapping racers apart and applies contact effects: Doom transfer, Charge, squashing and stone theft. */
export function resolveContacts(r: Race) {
  for (let i = 0; i < r.racers.length; i++) for (let j = i + 1; j < r.racers.length; j++) {
    const a = r.racers[i], b = r.racers[j]; if (a.finishTime !== null || b.finishTime !== null || a.falling > 0 || b.falling > 0) continue;
    const dx = b.px - a.px, dz = b.pz - a.pz, d = Math.hypot(dx, dz), radius = (RACERS[a.character].size * (a.mini > 0 ? 1 - a.miniLevel * .18 : 1) + RACERS[b.character].size * (b.mini > 0 ? 1 - b.miniLevel * .18 : 1)) * 1.15;
    if (d >= radius) continue;
    const nx = d > .001 ? dx / d : 1, nz = d > .001 ? dz / d : 0, correction = (radius - d) * .5;
    a.px -= nx * correction; a.pz -= nz * correction; b.px += nx * correction; b.pz += nz * correction;
    const impact = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (impact > 0) { a.vx -= nx * impact * .4; a.vz -= nz * impact * .4; b.vx += nx * impact * .4; b.vz += nz * impact * .4; }
    if (a.contactCooldown > 0 || b.contactCooldown > 0) continue;
    a.contactCooldown = b.contactCooldown = .7;
    // Transfer once per collision, never straight back in the reciprocal pair.
    const cursed = a.doom > 0 && b.doom <= 0 ? a : b.doom > 0 && a.doom <= 0 ? b : null;
    if (cursed) { const receiver = cursed === a ? b : a; receiver.doom = cursed.doom; receiver.doomOwner = cursed.doomOwner; cursed.doom = 0; event(r, cursed, 'doom-pass', 'Doom passed!', receiver.id); }
    for (const [p, q] of [[a, b], [b, a]]) {
      if (p.charging > 0) hit(r, q, p, 'charge');
      if (q.mini > 0 && q.miniLevel === 3 && p.mini <= 0) crash(r, q, 2, 'Squashed!');
      if (p.stones.length < 3 && q.stones.length && p.s < q.s && p.speed > 8 && Math.abs(angleDelta(Math.atan2(q.px - p.px, q.pz - p.pz), p.yaw)) < .7) { addStone(p, q.stones.pop()!); syncInventory(q); event(r, p, 'steal', 'Stole a Magic Stone!', q.id); }
    }
  }
}
