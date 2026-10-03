import { TICK } from '../constants.ts';
import { botInput } from '../bot.ts';
import { event } from '../events.ts';
import type { Race } from '../types.ts';
import { stepRacer } from './racer.ts';
import { stepProjectiles } from './projectiles.ts';
import { resolveContacts, stealStacks } from './contacts.ts';
import { updateStandings } from './standings.ts';

export function stepRace(r: Race, dt = TICK) {
  if (r.phase === 'finished') return;
  const previousTime = r.time; r.time += dt;
  for (const p of r.racers) {
    if (p.bot || !p.connected) p.input = botInput(r, p);
    if (p.input.throttle && !p.lastThrottle) p.throttleAt = r.time;
    if (r.time < 0) p.lastThrottle = p.input.throttle;
  }
  if (r.time < 0) return;
  r.phase = 'racing';
  if (previousTime < 0) for (const p of r.racers) if (p.input.throttle && p.throttleAt > -.23) { p.boost = 1.8; p.vx = Math.sin(p.yaw) * 12; p.vz = Math.cos(p.yaw) * 12; event(r, p, 'start', 'Dash start!'); }
  for (let i = 0; i < r.pickups.length; i++) r.pickups[i] = Math.max(0, r.pickups[i] - dt);
  for (const t of r.traps) t.life -= dt;
  r.traps = r.traps.filter(t => t.life > 0);
  for (const p of r.racers) stepRacer(r, p, dt);
  stepProjectiles(r, dt);
  resolveContacts(r);
  stealStacks(r);
  updateStandings(r);
}
