import { trackLength } from '../track/sampling.ts';
import { ABILITIES, ABILITY_SECONDS } from './abilities.ts';
import { ITEMS, drawStone, inBackHalf, spellName } from './items.ts';
import { addStone, canAddStone, syncInventory, takeStack, takeStone } from './inventory.ts';
import { restartPoint } from '../track/surface.ts';
import { hit } from './combat.ts';
import { event } from './events.ts';
import { random } from './random.ts';
import { placeRacer } from './setup.ts';
import { HASTE_SECONDS, REFLECT_SECONDS } from './spells.ts';
import { activeRivals, racerAhead, rivalsAhead, spellTarget } from './targeting.ts';
import type { Race, Racer } from './types.ts';

function fireball(r: Race, p: Racer, level: number, target: Racer | undefined) {
  r.projectiles.push({ id: ++r.eventId, px: p.px + Math.sin(p.yaw) * 3, pz: p.pz + Math.cos(p.yaw) * 3, yaw: p.yaw, owner: p.id, target: target?.id || null, level, life: level === 3 ? 12 : 5 });
}
export function useItem(r: Race, p: Racer) {
  syncInventory(p); if (!p.item) return;
  const { kind, level } = takeStack(p)!;
  if (kind === 'haste') p.boost = Math.max(p.boost, HASTE_SECONDS[level - 1]);
  else if (kind === 'shield') p.shield = REFLECT_SECONDS;
  // Fire flies straight, Fira homes on the racer ahead and Firaga sends a homing fireball at every racer ahead, or at everyone from first place.
  else if (kind === 'fire') for (const target of level === 3 ? rivalsAhead(r, p) : [level === 2 ? racerAhead(r, p) : undefined]) fireball(r, p, level, target);
  else if (kind === 'ice' && level < 3) {
    // Sheets drop behind the racer in world space, so they land where it drives, shortcuts included.
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    for (let i = 0; i < (level === 2 ? 6 : 1); i++) { const back = 4 + Math.floor(i / 3) * 4, side = level === 2 ? (i % 3 - 1) * 3 : 0; r.traps.push({ id: ++r.eventId, px: p.px - fx * back + fz * side, pz: p.pz - fz * back - fx * side, radius: 2.2, owner: p.id, life: 18 }); }
  } else {
    // Ultima and level 3 spells hit every rival; the rest hit one racer.
    const targets = kind === 'ultima' || level === 3 ? activeRivals(r, p) : [spellTarget(r, p)];
    for (const target of targets) if (target) hit(r, target, p, kind, level);
  }
  event(r, p, kind, `${spellName(kind, level)}!`);
}
/** Mug takes one stone from the latest stack of the best placed rival holding stones. With nobody to rob, it conjures a random stone. */
function mug(r: Race, p: Racer) {
  const victim = activeRivals(r, p).filter(q => q.stones.length).sort((a, b) => a.rank - b.rank)[0];
  if (victim) { const kind = takeStone(victim)!; addStone(p, kind); event(r, p, 'steal', `Mugged a ${ITEMS[kind].name} Stone!`, victim.id); }
  else { const kind = drawStone(random(r), inBackHalf(p.rank, r.racers.length)); addStone(p, kind); event(r, p, 'pickup', `${ITEMS[kind].name} Stone`); }
}
export function useAbility(r: Race, p: Racer) {
  if (p.ability < 100 || ABILITIES[p.abilityId].passive) return;
  // Mug fails while the inventory is full, and keeps its charge.
  if (p.abilityId === 'mug') { if (!canAddStone(p)) return; mug(r, p); }
  if (p.abilityId === 'dash') p.boost = ABILITY_SECONDS.dash;
  if (p.abilityId === 'flap') p.flying = ABILITY_SECONDS.flap;
  if (p.abilityId === 'grip') p.gripUp = ABILITY_SECONDS.grip;
  if (p.abilityId === 'charge') { p.boost = ABILITY_SECONDS.charge; p.charging = ABILITY_SECONDS.charge; }
  p.ability = 0; event(r, p, 'ability', `${ABILITIES[p.abilityId].name}!`);
}
export function recover(r: Race, p: Racer) {
  const safe = restartPoint(r.track, Math.min(p.lastSafeS - 2, (p.gates + 1) * trackLength(r.track) / 12 - 3));
  placeRacer(r.track, p, safe); p.stun = 0; p.falling = 0; p.drift = 0; p.drifting = false; p.invincible = 2; p.lastRescue = r.time; event(r, p, 'recover', 'Back on the track');
}
