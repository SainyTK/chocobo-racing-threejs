import { mod } from '../math.ts';
import { pointAt, trackLength } from '../track/sampling.ts';
import { ABILITIES } from './abilities.ts';
import { spellName } from './items.ts';
import { addStone, syncInventory } from './inventory.ts';
import { hit } from './combat.ts';
import { event } from './events.ts';
import { placeRacer } from './setup.ts';
import type { Race, Racer } from './types.ts';

function ahead(r: Race, p: Racer) { const len = trackLength(r.track); return r.racers.filter(q => q !== p && q.finishTime === null).sort((a, b) => mod(a.s - p.s, len) - mod(b.s - p.s, len))[0]; }
export function useItem(r: Race, p: Racer) {
  syncInventory(p); if (!p.item) return;
  const kind = p.item, level = p.itemLevel; p.stones.splice(-level, level); syncInventory(p);
  if (kind === 'haste') p.boost = Math.max(p.boost, 1.5 + level * 1.1);
  else if (kind === 'shield') p.shield = 5;
  else if (kind === 'fire') {
    const targets = level === 3 ? r.racers.filter(q => q !== p && q.finishTime === null) : [level === 2 ? ahead(r, p) : undefined];
    for (const target of targets) r.projectiles.push({ id: ++r.eventId, px: p.px + Math.sin(p.yaw) * 3, pz: p.pz + Math.cos(p.yaw) * 3, yaw: p.yaw, owner: p.id, target: target?.id || null, level, life: level === 3 ? 12 : 5 });
  } else if (kind === 'ice' && level < 3) {
    for (let i = 0; i < (level === 2 ? 6 : 1); i++) { const q = pointAt(r.track, p.s - 4 - Math.floor(i / 3) * 4, p.x + (level === 2 ? (i % 3 - 1) * 3 : 0)); r.traps.push({ id: ++r.eventId, px: q.x, pz: q.z, radius: 2.2, owner: p.id, life: 18 }); }
  } else {
    const targets = kind === 'ultima' || kind === 'mini' || level === 3 ? r.racers.filter(q => q !== p) : [ahead(r, p)];
    for (const target of targets) if (target) hit(r, target, p, kind, level);
  }
  event(r, p, kind, `${spellName(kind, level)}!`);
}
export function useAbility(r: Race, p: Racer) {
  if (p.ability < 100 || ABILITIES[p.abilityId].passive) return;
  if (p.abilityId === 'mug') {
    const target = r.racers.filter(q => q !== p && q.stones.length && Math.hypot(q.px - p.px, q.pz - p.pz) < 150).sort((a, b) => Math.hypot(a.px - p.px, a.pz - p.pz) - Math.hypot(b.px - p.px, b.pz - p.pz))[0];
    if (!target || p.stones.length >= 3) return; addStone(p, target.stones.pop()!); syncInventory(target);
  }
  if (p.abilityId === 'dash') p.boost = 3;
  if (p.abilityId === 'flap') p.flying = 5;
  if (p.abilityId === 'grip') p.gripUp = 7;
  if (p.abilityId === 'charge') { p.boost = 3; p.charging = 3; }
  p.ability = 0; event(r, p, 'ability', `${ABILITIES[p.abilityId].name}!`);
}
export function recover(r: Race, p: Racer) {
  const safe = Math.min(p.lastSafeS - 2, (p.gates + 1) * trackLength(r.track) / 12 - 3);
  placeRacer(r.track, p, safe); p.stun = 0; p.falling = 0; p.drift = 0; p.drifting = false; p.invincible = 2; p.lastRescue = r.time; event(r, p, 'recover', 'Back on the track');
}
