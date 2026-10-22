import { spellName, type Item } from './items.ts';
import { addStone, takeStack } from './inventory.ts';
import { event } from './events.ts';
import { DOOM, MEGAFLARE, MINI_SECONDS, SAFE_WINDOW, crashSeconds } from './spells.ts';
import { RACERS } from './racers.ts';
import { activeRivals } from './targeting.ts';
import type { Race, Racer } from './types.ts';

export function crash(r: Race, p: Racer, seconds: number, text: string) { p.stun = Math.max(p.stun, seconds); p.vx *= .25; p.vz *= .25; p.drifting = false; p.drift = 0; p.invincible = Math.max(p.invincible, seconds + SAFE_WINDOW); event(r, p, 'crash', text); }

export const aboveGround = (p: Racer) => p.flying > 0 || RACERS[p.character].hovers;
/** Reflect returns level 1 and 2 spells; level 3 spells, Ice and Ultima are only blocked. */
const reflectable = (kind: Item, level: number) => level < 3 && kind !== 'ice' && kind !== 'ultima';
export function hit(r: Race, target: Racer, source: Racer, kind: Item | 'charge' = 'fire', level = 1, reflected = false) {
  if (target.finishTime !== null || target.invincible > 0 || target.falling > 0) return;
  if (target.barrier > 0) { target.barrier = 0; event(r, target, 'block', 'Barrier!'); return; }
  const reflectIndex = target.stones.findIndex(s => s.kind === 'shield');
  if (kind !== 'charge' && (reflectIndex >= 0 || target.shield > 0)) {
    if (target.shield <= 0) takeStack(target, reflectIndex);
    const returnAttack = reflectable(kind, level) && !reflected;
    event(r, target, returnAttack ? 'reflect' : 'block', returnAttack ? 'Reflect!' : 'Magic blocked!', source.id);
    if (returnAttack) hit(r, source, target, kind, level, true); return;
  }
  // A charged Receive catches the spell instead of suffering it, as long as there is room for the stone.
  if (target.abilityId === 'receive' && target.ability >= 100 && kind !== 'charge' && addStone(target, kind, level)) { target.ability = 0; event(r, target, 'receive', `Received ${spellName(kind, level)}!`); return; }
  // Mini casts stack on a racer who is already small.
  if (kind === 'mini') { target.miniLevel = Math.min(3, (target.mini > 0 ? target.miniLevel : 0) + level); target.mini = MINI_SECONDS[target.miniLevel - 1]; event(r, source, 'mini', `${spellName(kind, level)}!`, target.id); return; }
  if (kind === 'doom') { target.doom = DOOM.fuse; target.doomOwner = source.id; event(r, source, 'doom', 'Doom: 10 seconds!', target.id); return; }
  if (kind === 'ice' && aboveGround(target) && level < 3) return;
  crash(r, target, crashSeconds(kind, level), `${source.name}: ${kind === 'charge' ? 'Charge' : spellName(kind, level)}!`);
  event(r, source, 'hit', `${source.name} hit ${target.name}`, target.id);
}
/**
 * Megaflare: every rival is thrown into the air and crashes. Barrier, Reflect and Receive cannot stop it,
 * as in the original; only the post-crash safe window and a fall protect a racer.
 */
export function megaflare(r: Race, source: Racer) {
  for (const target of activeRivals(r, source)) {
    if (target.invincible > 0 || target.falling > 0) continue;
    crash(r, target, MEGAFLARE.stun, `${source.name}: Megaflare!`);
    event(r, source, 'hit', `${source.name} hit ${target.name}`, target.id);
  }
}
