import { RACERS } from '../racers.ts';
import { miniScale } from '../mini.ts';
import { CRASH, DOOM } from '../spells.ts';
import { addStone, canAddStone, stackPositions, takeStack } from '../inventory.ts';
import { crash, hit } from '../combat.ts';
import { event } from '../events.ts';
import type { Race, Racer } from '../types.ts';

const BUMP_BOUNCE = .3, BUMP_SHOVE = 6;
/** Closing speed in m/s above which a contact is felt as a bump: sound, sparks and a small shake. */
const BUMP_IMPACT = 2;

const bodySize = (p: Racer) => RACERS[p.character].size * miniScale(p);
/** Mass grows with body size. A finished racer weighs nothing against a racer still racing, so arrivals shove it aside and are
 * never slowed; two finished racers weigh the same and only push apart as they coast to the roadside. */
const mass = (p: Racer, size: number, other: Racer) => p.finishTime === null ? size ** 3 : other.finishTime === null ? 0 : 1;
/** Separates two overlapping racers along the contact normal (a to b). A heavier racer moves less and shoves a
 * lighter one wide: the impact is partly elastic and every contact parts them sideways.
 * Returns the closing speed, the strength of the bump. */
function pushApart(a: Racer, b: Racer, ma: number, mb: number, nx: number, nz: number, overlap: number) {
  const wa = mb / (ma + mb), wb = ma / (ma + mb);
  a.px -= nx * overlap * wa; a.pz -= nz * overlap * wa; b.px += nx * overlap * wb; b.pz += nz * overlap * wb;
  const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz, push = Math.max(0, closing) * (1 + BUMP_BOUNCE) + Math.max(0, BUMP_SHOVE - Math.max(0, -closing));
  a.vx -= nx * push * wa; a.vz -= nz * push * wa; b.vx += nx * push * wb; b.vz += nz * push * wb;
  return closing;
}

/** Pushes overlapping racers apart and applies contact effects: Doom transfer, Charge and squashing. */
export function resolveContacts(r: Race) {
  for (let i = 0; i < r.racers.length; i++) for (let j = i + 1; j < r.racers.length; j++) {
    const a = r.racers[i], b = r.racers[j]; if (a.falling > 0 || b.falling > 0) continue;
    const sa = bodySize(a), sb = bodySize(b), dx = b.px - a.px, dz = b.pz - a.pz, d = Math.hypot(dx, dz), radius = (sa + sb) * 1.15;
    if (d >= radius) continue;
    const closing = pushApart(a, b, mass(a, sa, b), mass(b, sb, a), d > .001 ? dx / d : 1, d > .001 ? dz / d : 0, radius - d);
    if (a.finishTime !== null || b.finishTime !== null || a.contactCooldown > 0 || b.contactCooldown > 0) continue;
    a.contactCooldown = b.contactCooldown = .7;
    if (closing > BUMP_IMPACT) event(r, a, 'bump', 'Bump!', b.id);
    // Transfer once per collision, never straight back in the reciprocal pair: both racers' contact effects pause for the pass lock.
    const cursed = a.doom > 0 && b.doom <= 0 ? a : b.doom > 0 && a.doom <= 0 ? b : null;
    if (cursed) { const receiver = cursed === a ? b : a; receiver.doom = cursed.doom; receiver.doomOwner = cursed.doomOwner; cursed.doom = 0; a.contactCooldown = b.contactCooldown = DOOM.passLock; event(r, cursed, 'doom-pass', 'Doom passed!', receiver.id); }
    for (const [p, q] of [[a, b], [b, a]]) {
      if (p.charging > 0) hit(r, q, p, 'charge');
      if (q.mini > 0 && q.miniLevel === 3 && p.mini <= 0) crash(r, q, CRASH.crash, 'Squashed!');
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
      const reach = .8 * RACERS[thief.character].size * miniScale(thief);
      let i = at.length - 1; while (i >= 0 && !(Math.hypot(at[i].x - thief.px, at[i].z - thief.pz) < reach && canAddStone(thief))) i--;
      if (i < 0) continue;
      const stack = takeStack(holder, i)!; addStone(thief, stack.kind, stack.level); thief.pickupCooldown = .25;
      event(r, thief, 'steal', stack.level > 1 ? `Stole a level ${stack.level} stack!` : 'Stole a Magic Stone!', holder.id); break;
    }
  }
}
