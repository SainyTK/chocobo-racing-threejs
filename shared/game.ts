import { TRACKS, clamp, mod, angleDelta, pointAt, projectOnTrack, trackLength, courseObjects, type TrackId, type StoneType } from './track.ts';
export const TICK = 1 / 60;
export const GRID_SIZE = 6;
export type AbilityId = 'dash' | 'flap' | 'grip' | 'mug' | 'magic' | 'barrier' | 'receive' | 'charge';
export const ABILITIES: Record<AbilityId, { name: string; description: string; recharge: number; passive?: boolean }> = {
  dash: { name: 'Dash', description: 'A short burst of speed. Best used on a straight.', recharge: 12 },
  flap: { name: 'Flap', description: 'Fly above ice and rough terrain for five seconds.', recharge: 12 },
  grip: { name: 'Grip-Up', description: 'Extra traction, steering and acceleration.', recharge: 11 },
  mug: { name: 'Mug', description: 'Steal the last Magic Stone held by a nearby rival.', recharge: 13 },
  magic: { name: 'Magic Plus', description: 'Automatically adds a level to your latest spell.', recharge: 14, passive: true },
  barrier: { name: 'Barrier', description: 'Automatically blocks a hit when the gauge is full.', recharge: 16, passive: true },
  receive: { name: 'Receive', description: 'Receive the spell that hits you when charged.', recharge: 12, passive: true },
  charge: { name: 'Charge', description: 'Boost and ram rivals to make them crash.', recharge: 14 },
};
export const ABILITY_IDS = Object.keys(ABILITIES) as AbilityId[];
export const RACERS = [
  { name: 'Chocobo', color: '#ffd044', light: '#fff09a', vehicle: 'Jet-Blades CR', ability: 'dash' as AbilityId, speed: 38.4, acceleration: 23, grip: 10, steering: 1.65, size: 1 },
  { name: 'Mog', color: '#f7ece5', light: '#ffffff', vehicle: 'Mog-Mobile R2', ability: 'flap' as AbilityId, speed: 37.5, acceleration: 27, grip: 12, steering: 1.8, size: .93 },
  { name: 'Golem', color: '#a3937e', light: '#d8c8a2', vehicle: "Rockin' Roller V8", ability: 'grip' as AbilityId, speed: 38.4, acceleration: 19, grip: 14, steering: 1.83, size: 1.18 },
  { name: 'Goblin', color: '#83ba62', light: '#c4dc8c', vehicle: 'Gob-Cart H4', ability: 'mug' as AbilityId, speed: 40.2, acceleration: 24, grip: 9, steering: 1.65, size: .92 },
  { name: 'Black Magician', color: '#384fab', light: '#7993e3', vehicle: 'MagiCloud MK-1', ability: 'magic' as AbilityId, speed: 38.0, acceleration: 23, grip: 8.5, steering: 1.7, size: 1 },
  { name: 'White Mage', color: '#eee9dd', light: '#f6d3db', vehicle: 'Cosmic Carpet', ability: 'barrier' as AbilityId, speed: 36.6, acceleration: 26, grip: 12, steering: 1.8, size: .92 },
  { name: 'Chubby Chocobo', color: '#fff6d9', light: '#ffffff', vehicle: 'Phat-Burner Plus', ability: 'receive' as AbilityId, speed: 36.6, acceleration: 18, grip: 14, steering: 1.93, size: 1.3 },
  { name: 'Behemoth', color: '#9370b0', light: '#ceb1db', vehicle: 'Behemo-Buggy 99', ability: 'charge' as AbilityId, speed: 38.4, acceleration: 25, grip: 11, steering: 1.7, size: 1.2 },
];
export type Item = StoneType;
export const ITEMS: Record<Item, { name: string; names: string[]; symbol: string; color: string; help: string }> = {
  fire: { name: 'Fire', names: ['Fire', 'Fira', 'Firaga'], symbol: '●', color: '#ff5950', help: 'Aim a fireball. Fira homes; Firaga attacks everyone.' },
  ice: { name: 'Ice', names: ['Blizzard', 'Blizzara', 'Blizzaga'], symbol: '❄', color: '#73c9f5', help: 'Drop ice. Blizzara drops six; Blizzaga freezes rivals.' },
  thunder: { name: 'Thunder', names: ['Thunder', 'Thundara', 'Thundaga'], symbol: 'ϟ', color: '#72df89', help: 'Strike a rival ahead. Thundaga hits every rival.' },
  haste: { name: 'Haste', names: ['Haste', 'Haste II', 'Haste III'], symbol: '»', color: '#56e3d2', help: 'A turbo boost. More matching stones last longer.' },
  shield: { name: 'Reflect', names: ['Reflect'], symbol: '◇', color: '#ed73d0', help: 'Held Reflect stones automatically return magical attacks.' },
  mini: { name: 'Mini', names: ['Mini', 'Mini II', 'Mini III'], symbol: '↓', color: '#b68bef', help: 'Shrink rivals. At level three they can be squashed.' },
  doom: { name: 'Doom', names: ['Doom'], symbol: '10', color: '#ba9366', help: 'A ten-second curse. Bump a rival to pass it on.' },
  ultima: { name: 'Ultima', names: ['Ultima', 'Ultima II', 'Ultima III'], symbol: '✦', color: '#f4f0ff', help: 'Crash every rival. More stones cause a longer crash.' },
};
export interface Input { steer: number; throttle: boolean; brake: boolean; reverse: boolean; drift: boolean; item: boolean; ability: boolean; rescue: boolean }
export const neutralInput = (): Input => ({ steer: 0, throttle: false, brake: false, reverse: false, drift: false, item: false, ability: false, rescue: false });
export function cleanInput(value: unknown): Input {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { steer: typeof v.steer === 'number' && Number.isFinite(v.steer) ? clamp(v.steer, -1, 1) : 0, throttle: v.throttle === true, brake: v.brake === true, reverse: v.reverse === true, drift: v.drift === true, item: v.item === true, ability: v.ability === true, rescue: v.rescue === true };
}
export interface Racer {
  id: string; name: string; character: number; abilityId: AbilityId; bot: boolean; connected: boolean;
  px: number; pz: number; yaw: number; vx: number; vz: number; speed: number; s: number; routeS: number; x: number;
  drift: number; drifting: boolean; boost: number; shield: number; stun: number; invincible: number; flying: number; gripUp: number; charging: number;
  mini: number; miniLevel: number; doom: number; doomOwner: string; falling: number; wrongWay: boolean;
  ability: number; stones: Item[]; item: Item | null; itemLevel: number;
  finishTime: number | null; rank: number; lap: number; lapTimes: number[]; lapStart: number; gates: number; lastSafeS: number;
  lastRescue: number; contactCooldown: number; wallCooldown: number; pickupCooldown: number; lastItem: boolean; lastAbility: boolean; lastThrottle: boolean; throttleAt: number; spinReleased: boolean; spinDash: boolean; input: Input;
}
export interface GameEvent { id: number; time: number; type: string; player: string; text: string; target?: string }
export interface Trap { id: number; px: number; pz: number; owner: string; life: number; radius: number }
export interface Projectile { id: number; px: number; pz: number; yaw: number; owner: string; target: string | null; level: number; life: number }
export type RaceMode = 'race' | 'time' | 'versus';
export interface Race { id: string; track: TrackId; laps: number; mode: RaceMode; time: number; phase: 'countdown' | 'racing' | 'finished'; racers: Racer[]; pickups: number[]; traps: Trap[]; projectiles: Projectile[]; events: GameEvent[]; eventId: number; firstFinish: number | null; seed: number }
export function makeRacer(id: string, name: string, character = 0, bot = false, abilityId?: AbilityId): Racer {
  character = clamp(Math.floor(character) || 0, 0, RACERS.length - 1);
  return { id, name: name.slice(0, 18), character, abilityId: abilityId && ABILITY_IDS.includes(abilityId) ? abilityId : RACERS[character].ability, bot, connected: true,
    px: 0, pz: 0, yaw: 0, vx: 0, vz: 0, speed: 0, s: 0, routeS: 0, x: 0, drift: 0, drifting: false, boost: 0, shield: 0, stun: 0, invincible: 0, flying: 0, gripUp: 0, charging: 0,
    mini: 0, miniLevel: 0, doom: 0, doomOwner: '', falling: 0, wrongWay: false, ability: 0, stones: [], item: null, itemLevel: 0,
    finishTime: null, rank: 1, lap: 1, lapTimes: [], lapStart: 0, gates: 0, lastSafeS: -8, lastRescue: -100, contactCooldown: 0, wallCooldown: 0, pickupCooldown: 0,
    lastItem: false, lastAbility: false, lastThrottle: false, throttleAt: -100, spinReleased: false, spinDash: false, input: neutralInput() };
}
export function createRace(track: TrackId, humans: Racer[], laps = 3, seed = 42, mode: RaceMode = 'race', rival = 1): Race {
  const racers = humans.map(p => makeRacer(p.id, p.name, p.character, p.bot, p.abilityId)), count = mode === 'time' ? 1 : mode === 'versus' ? 2 : GRID_SIZE;
  for (let i = racers.length; i < count; i++) { const ch = mode === 'versus' ? rival : (i + (humans[0]?.character || 0)) % RACERS.length; racers.push(makeRacer(`bot-${i}`, RACERS[ch].name, ch, true)); }
  racers.forEach((p, i) => { const grid = racers.length - 1 - i; p.s = -8 - Math.floor(grid / 2) * 6; p.x = racers.length === 1 ? 0 : (grid % 2 - .5) * 6; placeRacer(track, p, p.s, p.x); p.rank = grid + 1; });
  return { id: `${Date.now()}-${seed}`, track, laps, mode, time: -3.5, phase: 'countdown', racers, pickups: new Array(courseObjects(track).stones.length).fill(0), traps: [], projectiles: [], events: [], eventId: 0, firstFinish: null, seed };
}
export function placeRacer(track: TrackId, p: Racer, s: number, x = 0) { const q = pointAt(track, s, x); p.px = q.x; p.pz = q.z; p.yaw = q.yaw; p.s = s; p.routeS = mod(s, trackLength(track)); p.x = x; p.lastSafeS = s; p.vx = p.vz = p.speed = 0; }
function random(r: Race) { r.seed = (Math.imul(r.seed, 1664525) + 1013904223) >>> 0; return r.seed / 4294967296; }
function event(r: Race, p: Racer, type: string, text: string, target?: string) { r.events.push({ id: ++r.eventId, time: r.time, type, player: p.id, text, target }); if (r.events.length > 40) r.events.shift(); }
export function syncInventory(p: Racer) { p.item = p.stones.at(-1) || null; let n = 0; if (p.item) for (let i = p.stones.length - 1; i >= 0 && p.stones[i] === p.item; i--) n++; p.itemLevel = p.item === 'shield' || p.item === 'doom' ? Math.min(1, n) : n; }
export function addStone(p: Racer, kind: Item) { if (p.stones.length >= 3) return false; p.stones.push(kind); syncInventory(p); return true; }
export const spellName = (kind: Item, level: number) => ITEMS[kind].names[Math.min(ITEMS[kind].names.length - 1, Math.max(0, level - 1))];
function crash(r: Race, p: Racer, seconds: number, text: string) { p.stun = Math.max(p.stun, seconds); p.vx *= .25; p.vz *= .25; p.drifting = false; p.drift = 0; p.invincible = Math.max(p.invincible, seconds + .9); event(r, p, 'crash', text); }
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
export function botInput(r: Race, p: Racer): Input {
  if (r.time < 0) return { ...neutralInput(), throttle: r.time > -.16 };
  const len = trackLength(r.track), def = TRACKS[r.track], i = r.racers.indexOf(p);
  let lane = Math.sin(i * 2.2 + p.s / 150) * 2.2;
  if (p.stones.length < 3) { const stone = courseObjects(r.track).stones.filter(e => mod(e.s - p.s, len) < 40 && r.pickups[e.id] < .4).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; if (stone) lane = stone.x; }
  const look = clamp(p.speed * .6 + 8, 14, 32), target = pointAt(r.track, p.s + look, lane);
  const delta = angleDelta(Math.atan2(target.x - p.px, target.z - p.pz), p.yaw);
  const curve = Math.max(...[12, 25, 40].map(d => Math.abs(pointAt(r.track, p.s + d).curve)));
  const desiredSpeed = Math.min(RACERS[p.character].speed * (.9 + i * .012), Math.sqrt(16 / Math.max(.001, curve)));
  const brake = p.speed > Math.max(13, desiredSpeed + 1.5);
  const steer = clamp(delta * 2.1, -1, 1);
  return { steer, throttle: !brake, brake, reverse: false, drift: !brake && Math.abs(delta) > .28 && p.speed > 18 && p.drift < 1.8, item: p.stones.length > 0 && Math.sin(r.time * 2 + i) > .65, ability: p.ability >= 100 && (p.abilityId !== 'dash' && p.abilityId !== 'charge' || curve < .014), rescue: p.speed < 2 && r.time > 8 && Math.abs(p.x) > def.width - 2 || p.s > (p.gates + 2) * len / 12 };
}
export function stepRace(r: Race, dt = TICK) {
  if (r.phase === 'finished') return;
  const previousTime = r.time; r.time += dt;
  const def = TRACKS[r.track], len = trackLength(r.track), objects = courseObjects(r.track);
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
  for (const p of r.racers) {
    if (p.finishTime !== null) { p.speed = 0; p.vx = p.vz = 0; p.drifting = false; continue; }
    const input = p.input, ch = RACERS[p.character];
    for (const key of ['boost', 'shield', 'stun', 'invincible', 'flying', 'gripUp', 'charging', 'mini', 'contactCooldown', 'wallCooldown', 'pickupCooldown'] as const) p[key] = Math.max(0, p[key] - dt);
    if (p.doom > 0) { p.doom = Math.max(0, p.doom - dt); if (p.doom <= 0) crash(r, p, 3.5, 'Doom!'); }
    p.ability = Math.min(100, p.ability + dt * 100 / ABILITIES[p.abilityId].recharge);
    if (p.abilityId === 'magic' && p.ability >= 100 && p.stones.length > 0 && p.stones.length < 3 && !['shield', 'doom'].includes(p.stones.at(-1)!)) { addStone(p, p.stones.at(-1)!); p.ability = 0; event(r, p, 'ability', 'Magic Plus!'); }
    if (p.falling > 0) { p.falling -= dt; if (p.falling <= 0) recover(r, p); continue; }
    if (input.rescue && r.time - p.lastRescue > 3) { recover(r, p); continue; }
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
      const choices: Item[] = ['fire', 'fire', 'ice', 'haste', 'haste', 'thunder', 'shield', 'mini', 'doom', 'ultima'];
      const kind = stone.kind === 'random' ? choices[Math.floor(random(r) * choices.length)] : stone.kind;
      addStone(p, kind); r.pickups[stone.id] = 1.1; p.pickupCooldown = .25; event(r, p, 'pickup', `${ITEMS[kind].name} Stone`); break;
    }
    if (!aboveGround(p) && p.invincible <= 0) {
      for (const trap of r.traps) if (trap.owner !== p.id && Math.hypot(trap.px - p.px, trap.pz - p.pz) < trap.radius + .7) { const owner = r.racers.find(q => q.id === trap.owner); if (owner) hit(r, p, owner, 'ice'); trap.life = 0; }
      for (const hazard of objects.hazards) if (Math.abs(mod(hazard.s - p.routeS + len / 2, len) - len / 2) < 2.5 && Math.abs(hazard.x - p.x) < 2.5) { p.vx *= .96; p.vz *= .96; }
    }
    for (const pad of objects.pads) if (oldS < p.s && Math.floor((oldS - pad.s) / len) !== Math.floor((p.s - pad.s) / len) && Math.abs(p.x - pad.x) < 3) { p.boost = Math.max(p.boost, 1.1); event(r, p, 'pad', 'BOOST'); }
  }
  for (const shot of r.projectiles) {
    shot.life -= dt; const target = shot.target ? r.racers.find(p => p.id === shot.target) : null;
    if (target) shot.yaw += clamp(angleDelta(Math.atan2(target.px - shot.px, target.pz - shot.pz), shot.yaw), -dt * 5, dt * 5);
    shot.px += Math.sin(shot.yaw) * 80 * dt; shot.pz += Math.cos(shot.yaw) * 80 * dt;
    for (const p of r.racers) if (p.id !== shot.owner && p.finishTime === null && Math.hypot(p.px - shot.px, p.pz - shot.pz) < 2 + shot.level * .25) { const source = r.racers.find(q => q.id === shot.owner); if (source) hit(r, p, source, 'fire', shot.level); shot.life = 0; break; }
  }
  r.projectiles = r.projectiles.filter(p => p.life > 0);
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
  const progress = (p: Racer) => Math.min(p.s, (p.gates + 1) * len / 12);
  [...r.racers].sort((a, b) => a.finishTime !== null && b.finishTime !== null ? a.finishTime - b.finishTime : a.finishTime !== null ? -1 : b.finishTime !== null ? 1 : progress(b) - progress(a)).forEach((p, i) => p.rank = i + 1);
  if (r.racers.every(p => p.finishTime !== null) || r.firstFinish !== null && r.time - r.firstFinish > 90 || r.time > 360) r.phase = 'finished';
}
