import { mod } from '../../math.ts';
import { TRACKS } from '../../track/tracks.ts';
import { pointAt, projectOnTrack, trackLength } from '../../track/sampling.ts';
import { courseObjects } from '../../track/objects.ts';
import { ABILITIES } from '../abilities.ts';
import { RACERS } from '../racers.ts';
import { ITEMS, drawStone } from '../items.ts';
import { addStone } from '../inventory.ts';
import { aboveGround, crash, hit } from '../combat.ts';
import { recover, useAbility, useItem } from '../actions.ts';
import { event } from '../events.ts';
import { random } from '../random.ts';
import type { Race, Racer } from '../types.ts';

/** Advances one racer: timers, abilities, driving physics, walls and falls, lap gates, pickups, traps and pads. */
export function stepRacer(r: Race, p: Racer, dt: number) {
  const def = TRACKS[r.track], len = trackLength(r.track), objects = courseObjects(r.track);
  if (p.finishTime !== null) { p.speed = 0; p.vx = p.vz = 0; p.drifting = false; return; }
  const input = p.input, ch = RACERS[p.character];
  for (const key of ['boost', 'shield', 'stun', 'invincible', 'flying', 'gripUp', 'charging', 'mini', 'contactCooldown', 'wallCooldown', 'pickupCooldown'] as const) p[key] = Math.max(0, p[key] - dt);
  if (p.doom > 0) { p.doom = Math.max(0, p.doom - dt); if (p.doom <= 0) crash(r, p, 3.5, 'Doom!'); }
  p.ability = Math.min(100, p.ability + dt * 100 / ABILITIES[p.abilityId].recharge);
  if (p.abilityId === 'magic' && p.ability >= 100 && p.stones.length > 0 && p.stones.length < 3 && !['shield', 'doom'].includes(p.stones.at(-1)!)) { addStone(p, p.stones.at(-1)!); p.ability = 0; event(r, p, 'ability', 'Magic Plus!'); }
  if (p.falling > 0) { p.falling -= dt; if (p.falling <= 0) recover(r, p); return; }
  if (input.rescue && r.time - p.lastRescue > 3) { recover(r, p); return; }
  if (input.item && !p.lastItem && p.stun <= 0) useItem(r, p);
  if (input.ability && !p.lastAbility && p.stun <= 0) useAbility(r, p);
  p.lastItem = input.item; p.lastAbility = input.ability;
  if (p.stun > 0 && p.spinDash) {
    if (!input.throttle && !input.brake) p.spinReleased = true;
    if (p.spinReleased && input.throttle && !p.lastThrottle) { p.stun = 0; p.boost = 1.4; p.spinDash = false; event(r, p, 'spindash', 'Spin Dash!'); }
  }
  p.lastThrottle = input.throttle;
  const drifting = (input.drift || input.throttle && input.brake) && Math.abs(input.steer) > .12 && p.speed > 9 && p.stun <= 0;
  if (drifting) p.drift += dt; else p.drift = Math.max(0, p.drift - dt * 3);
  if (p.drift > 2.8) { crash(r, p, 1.4, 'Over-drift! Release, then accelerate for Spin Dash.'); p.spinDash = true; p.spinReleased = false; }
  p.drifting = drifting && p.stun <= 0;
  const oldForward = p.vx * Math.sin(p.yaw) + p.vz * Math.cos(p.yaw);
  const turn = ch.steering * (p.gripUp > 0 ? 1.25 : 1) * (p.drifting ? 1.45 : 1) * Math.min(1, Math.abs(oldForward) / 8) / (1 + p.speed / 115);
  if (p.stun <= 0) p.yaw = mod(p.yaw + input.steer * turn * dt * (oldForward < -1 ? -1 : 1) + Math.PI, Math.PI * 2) - Math.PI;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = fz, rz = -fx;
  let forward = p.vx * fx + p.vz * fz, lateral = p.vx * rx + p.vz * rz;
  const onGrass = Math.abs(p.x) > def.width, maxSpeed = ch.speed * (p.boost > 0 ? 1.55 : 1) * (p.mini > 0 ? 1 - p.miniLevel * .17 : 1) * (onGrass && !aboveGround(p) ? .5 : 1);
  if (p.stun > 0) { forward *= Math.exp(-dt * 4); lateral *= Math.exp(-dt * 4); }
  else {
    const accel = ch.acceleration * (p.gripUp > 0 ? 1.45 : 1) * (p.boost > 0 ? 1.5 : 1);
    if (input.reverse) forward = Math.max(-11, forward - accel * dt);
    else if (input.throttle && (!input.brake || p.drifting)) forward = Math.min(maxSpeed, forward + accel * dt);
    else if (input.brake) forward -= Math.sign(forward) * Math.min(Math.abs(forward), 47 * dt);
    else forward -= Math.sign(forward) * Math.min(Math.abs(forward), 10 * dt);
    if (forward > maxSpeed) forward = Math.max(maxSpeed, forward - 35 * dt);
    lateral *= Math.exp(-dt * ch.grip * (p.drifting ? .22 : 1) * (p.gripUp > 0 ? 1.6 : 1));
  }
  p.vx = fx * forward + rx * lateral; p.vz = fz * forward + rz * lateral;
  p.px += p.vx * dt; p.pz += p.vz * dt; p.speed = Math.hypot(p.vx, p.vz);
  const oldS = p.s, projection = projectOnTrack(r.track, p.px, p.pz, p.routeS);
  const delta = mod(projection.s - p.routeS + len / 2, len) - len / 2;
  if (Math.abs(delta) < Math.max(8, p.speed * dt * 4)) p.s += delta;
  p.routeS = projection.s; p.x = projection.offset;
  const tangent = pointAt(r.track, p.routeS), alignment = p.vx * Math.sin(tangent.yaw) + p.vz * Math.cos(tangent.yaw);
  p.wrongWay = alignment < -3;
  if (Math.abs(p.x) < def.width - 1 && alignment > 3 && p.s < (p.gates + 1) * len / 12 + 4) p.lastSafeS = p.s;
  if (def.wall && Math.abs(p.x) > def.width + .7) {
    const side = Math.sign(p.x), outward = (p.vx * projection.nx + p.vz * projection.nz) * side;
    p.px = projection.px + projection.nx * side * (def.width + .65); p.pz = projection.pz + projection.nz * side * (def.width + .65);
    if (outward > 0) { p.vx -= projection.nx * side * outward * 1.25; p.vz -= projection.nz * side * outward * 1.25; p.vx *= .82; p.vz *= .82; }
    if (outward > 9 && p.wallCooldown <= 0) { p.wallCooldown = .7; event(r, p, 'wall', 'Wall hit!'); }
  } else if ((def.cliff && Math.abs(p.x) > def.width + 5 || Math.abs(p.x) > def.width + 35) && p.flying <= 0) { p.falling = 1.3; p.vx = p.vz = p.speed = 0; event(r, p, 'fall', 'Watch the edge!'); }
  const nextGate = (p.gates + 1) * len / 12;
  if (oldS < nextGate && p.s >= nextGate && Math.abs(p.x) < def.width + 7) {
    p.gates++;
    if (p.gates % 12 === 0) {
      const split = r.time - (p.s - nextGate) / Math.max(1, alignment); p.lapTimes.push(split - p.lapStart); p.lapStart = split;
      if (p.gates / 12 >= r.laps) { p.finishTime = split; p.speed = 0; p.vx = p.vz = 0; p.drifting = false; if (r.firstFinish === null) r.firstFinish = r.time; event(r, p, 'finish', 'FINISH!'); }
      else { p.lap = p.gates / 12 + 1; event(r, p, 'lap', p.lap === r.laps ? 'FINAL LAP' : `LAP ${p.lap}`); }
    }
  }
  if (r.mode !== 'time' && p.pickupCooldown <= 0) for (const stone of objects.stones) {
    if (r.pickups[stone.id] > 0 || p.stones.length >= 3) continue;
    if (Math.abs(mod(stone.s - p.routeS + len / 2, len) - len / 2) > 2.8 || Math.abs(stone.x - p.x) > 2.1) continue;
    const kind = stone.kind === 'random' ? drawStone(random(r)) : stone.kind;
    addStone(p, kind); r.pickups[stone.id] = 1.1; p.pickupCooldown = .25; event(r, p, 'pickup', `${ITEMS[kind].name} Stone`); break;
  }
  if (!aboveGround(p) && p.invincible <= 0) {
    for (const trap of r.traps) if (trap.owner !== p.id && Math.hypot(trap.px - p.px, trap.pz - p.pz) < trap.radius + .7) { const owner = r.racers.find(q => q.id === trap.owner); if (owner) hit(r, p, owner, 'ice'); trap.life = 0; }
    for (const hazard of objects.hazards) if (Math.abs(mod(hazard.s - p.routeS + len / 2, len) - len / 2) < 2.5 && Math.abs(hazard.x - p.x) < 2.5) { p.vx *= .96; p.vz *= .96; }
  }
  for (const pad of objects.pads) if (oldS < p.s && Math.floor((oldS - pad.s) / len) !== Math.floor((p.s - pad.s) / len) && Math.abs(p.x - pad.x) < 3) { p.boost = Math.max(p.boost, 1.1); event(r, p, 'pad', 'BOOST'); }
}
