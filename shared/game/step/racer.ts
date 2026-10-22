import { mod } from '../../math.ts';
import { TRACKS } from '../../track/tracks.ts';
import { trackLength } from '../../track/sampling.ts';
import { locate, MAIN_ROUTE } from '../../track/route.ts';
import { courseObjects } from '../../track/objects.ts';
import { ABILITIES } from '../abilities.ts';
import { integrateDriving, updateDriveMode } from '../driving.ts';
import { HANDLING } from '../handling.ts';
import { ITEMS, drawStone, inBackHalf } from '../items.ts';
import { addStone, canAddStone, levelUpLatest } from '../inventory.ts';
import { BARRIER_SECONDS, DOOM, STONE_RESPAWN } from '../spells.ts';
import { aboveGround, crash, hit, megaflare } from '../combat.ts';
import { recover, useAbility, useItem } from '../actions.ts';
import { event } from '../events.ts';
import { stepFinished } from './finished.ts';
import { followPlace } from '../progress.ts';
import { random } from '../random.ts';
import { stepAir } from '../air.ts';
import { keepOnCourse } from './edges.ts';
import { stepCourse } from './course.ts';
import type { Race, Racer } from '../types.ts';

/** Advances one racer: timers, abilities, driving physics, route, walls, jumps and falls, lap gates, pickups, traps and course gimmicks. */
export function stepRacer(r: Race, p: Racer, dt: number) {
  const def = TRACKS[r.track], len = trackLength(r.track), objects = courseObjects(r.track);
  if (p.finishTime !== null) { stepFinished(r, p, dt); return; }
  const input = p.input;
  for (const key of ['boost', 'shield', 'barrier', 'stun', 'invincible', 'flying', 'gripUp', 'charging', 'mini', 'contactCooldown', 'wallCooldown', 'pickupCooldown'] as const) p[key] = Math.max(0, p[key] - dt);
  if (p.doom > 0) { p.doom = Math.max(0, p.doom - dt); if (p.doom <= 0) crash(r, p, DOOM.stun, 'Doom!'); }
  if (p.flare > 0) { p.flare = Math.max(0, p.flare - dt); if (p.flare <= 0) megaflare(r, p); }
  p.ability = Math.min(100, p.ability + dt * 100 / ABILITIES[p.abilityId].recharge);
  if (p.abilityId === 'magic' && p.ability >= 100 && levelUpLatest(p)) { p.ability = 0; event(r, p, 'ability', 'Magic Plus!'); }
  if (p.abilityId === 'barrier' && p.ability >= 100) { p.ability = 0; p.barrier = BARRIER_SECONDS; event(r, p, 'ability', 'Barrier!'); }
  if (p.falling > 0) { p.falling -= dt; if (p.falling <= 0) recover(r, p); return; }
  if (input.rescue && r.time - p.lastRescue > 3) { recover(r, p); return; }
  if (input.item && !p.lastItem && p.stun <= 0) useItem(r, p);
  if (input.ability && !p.lastAbility && p.stun <= 0) useAbility(r, p);
  p.lastItem = input.item; p.lastAbility = input.ability;
  if (p.stun > 0 && p.spinDash) {
    if (!input.throttle && !input.brake) p.spinReleased = true;
    if (p.spinReleased && input.throttle && !p.lastThrottle) { p.stun = 0; p.boost = HANDLING.spinDash; p.spinDash = false; event(r, p, 'spindash', 'Spin Dash!'); }
  }
  p.lastThrottle = input.throttle;
  updateDriveMode(p, dt);
  if (p.drifting) p.drift += dt; else p.drift = Math.max(0, p.drift - dt * 3);
  if (p.drift > HANDLING.overDrift) { crash(r, p, 1.4, 'Over-drift! Release, then accelerate for Spin Dash.'); p.spinDash = true; p.spinReleased = false; }
  integrateDriving(r.track, p, dt);
  const oldS = p.s, place = locate(r.track, p.px, p.pz, p.route, p.routeS);
  followPlace(r.track, p, place, dt);
  const alignment = p.vx * Math.sin(place.yaw) + p.vz * Math.cos(place.yaw);
  p.wrongWay = alignment < -3;
  if (p.route === MAIN_ROUTE && Math.abs(p.x) < def.width - 1 && alignment > 3 && p.s < (p.gates + 1) * len / 12 + 4) p.lastSafeS = p.s;
  const edge = keepOnCourse(r.track, p, place), fell = stepAir(r.track, p, dt);
  if (edge?.kind === 'wall' && edge.impact > 6 && p.wallCooldown <= 0) { p.wallCooldown = .7; event(r, p, 'wall', 'Wall hit!'); }
  if (edge?.kind === 'fall' || fell) { p.falling = 1.3; p.vx = p.vz = p.speed = 0; event(r, p, 'fall', fell ? 'Fell into the gap!' : 'Watch the edge!'); }
  const nextGate = (p.gates + 1) * len / 12;
  if (oldS < nextGate && p.s >= nextGate && (p.route !== MAIN_ROUTE || Math.abs(p.x) < def.width + 7)) {
    p.gates++;
    if (p.gates % 12 === 0) {
      const split = r.time - (p.s - nextGate) / Math.max(1, alignment); p.lapTimes.push(split - p.lapStart); p.lapStart = split;
      if (p.gates / 12 >= r.laps) { p.finishTime = split; if (r.firstFinish === null) r.firstFinish = r.time; event(r, p, 'finish', 'FINISH!'); }
      else { p.lap = p.gates / 12 + 1; event(r, p, 'lap', p.lap === r.laps ? 'FINAL LAP' : `LAP ${p.lap}`); }
    }
  }
  if (r.mode !== 'time' && p.pickupCooldown <= 0 && canAddStone(p)) for (const stone of objects.stones) {
    // On a shortcut, `routeS` and `x` are measured along it, so only that shortcut's stones can be reached.
    if (r.pickups[stone.id] > 0 || (stone.route ?? MAIN_ROUTE) !== p.route) continue;
    if (Math.abs(mod(stone.s - p.routeS + len / 2, len) - len / 2) > 2.8 || Math.abs(stone.x - p.x) > 2.1) continue;
    const kind = stone.kind === 'random' ? drawStone(random(r), inBackHalf(p.rank, r.racers.length)) : stone.kind;
    addStone(p, kind); r.pickups[stone.id] = STONE_RESPAWN; p.pickupCooldown = .25; event(r, p, 'pickup', `${ITEMS[kind].name} Stone`); break;
  }
  if (!aboveGround(p) && p.invincible <= 0) {
    for (const trap of r.traps) if (trap.owner !== p.id && Math.hypot(trap.px - p.px, trap.pz - p.pz) < trap.radius + .7) { const owner = r.racers.find(q => q.id === trap.owner); if (owner) hit(r, p, owner, 'ice'); trap.life = 0; }
  }
  stepCourse(r, p, oldS);
}
