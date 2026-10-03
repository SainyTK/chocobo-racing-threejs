import { spellName, type Item } from './items.ts';
import { addStone, syncInventory } from './inventory.ts';
import { event } from './events.ts';
import type { Race, Racer } from './types.ts';

export function crash(r: Race, p: Racer, seconds: number, text: string) { p.stun = Math.max(p.stun, seconds); p.vx *= .25; p.vz *= .25; p.drifting = false; p.drift = 0; p.invincible = Math.max(p.invincible, seconds + .9); event(r, p, 'crash', text); }

export const aboveGround = (p: Racer) => p.flying > 0 || p.character === 4 || p.character === 5;
export function hit(r: Race, target: Racer, source: Racer, kind: Item | 'charge' = 'fire', level = 1, reflected = false) {
  if (target.finishTime !== null || target.invincible > 0 || target.falling > 0) return;
  if (target.abilityId === 'barrier' && target.ability >= 100) { target.ability = 0; event(r, target, 'block', 'Barrier!'); return; }
  const reflectIndex = target.stones.indexOf('shield');
  if (kind !== 'charge' && (reflectIndex >= 0 || target.shield > 0)) {
    if (target.shield <= 0) { target.stones.splice(reflectIndex, 1); syncInventory(target); }
    const returnAttack = level < 3 && kind !== 'ice' && kind !== 'ultima' && !reflected;
    event(r, target, returnAttack ? 'reflect' : 'block', returnAttack ? 'Reflect!' : 'Magic blocked!', source.id);
    if (returnAttack) hit(r, source, target, kind, level, true); return;
  }
  if (target.abilityId === 'receive' && target.ability >= 100 && kind !== 'charge') { addStone(target, kind); target.ability = 0; event(r, target, 'receive', 'Received a Magic Stone!'); }
  if (kind === 'mini') { target.mini = 7 + level * 2; target.miniLevel = level; event(r, source, 'mini', 'Mini!', target.id); return; }
  if (kind === 'doom') { target.doom = 10; target.doomOwner = source.id; event(r, source, 'doom', 'Doom: 10 seconds!', target.id); return; }
  if (kind === 'ice' && aboveGround(target) && level < 3) return;
  crash(r, target, kind === 'ultima' ? 1.5 + level * .6 : kind === 'charge' ? 1.5 : .7 + level * .4, `${source.name}: ${kind === 'charge' ? 'Charge' : spellName(kind, level)}!`);
  event(r, source, 'hit', `${source.name} hit ${target.name}`, target.id);
}
