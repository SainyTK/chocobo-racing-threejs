import { RACERS } from '../racers.ts';
import { addStone, canAddStone, stackPositions, takeStack } from '../inventory.ts';
import { crash, hit } from '../combat.ts';
import { event } from '../events.ts';
import type { Race } from '../types.ts';

/** Pushes overlapping racers apart and applies contact effects: Doom transfer, Charge and squashing. */
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
    }
  }
}

/** A racer that drives into a rival's trailing stack takes the whole stack, as if it were a track pickup. */
export function stealStacks(r: Race) {
  for (const holder of r.racers) {
    if (!holder.stones.length || holder.finishTime !== null || holder.falling > 0) continue;
    const at = stackPositions(holder);
    for (const thief of r.racers) {
      if (thief === holder || thief.finishTime !== null || thief.falling > 0 || thief.stun > 0 || thief.pickupCooldown > 0) continue;
      const reach = 1.1 * RACERS[thief.character].size * (thief.mini > 0 ? 1 - thief.miniLevel * .18 : 1);
      let i = at.length - 1; while (i >= 0 && !(Math.hypot(at[i].x - thief.px, at[i].z - thief.pz) < reach && canAddStone(thief, holder.stones[i].kind))) i--;
      if (i < 0) continue;
      const stack = takeStack(holder, i)!; addStone(thief, stack.kind, stack.level); thief.pickupCooldown = .25;
      event(r, thief, 'steal', stack.level > 1 ? `Stole a level ${stack.level} stack!` : 'Stole a Magic Stone!', holder.id); break;
    }
  }
}
