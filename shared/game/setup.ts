import { clamp, mod } from '../math.ts';
import type { TrackId } from '../track/types.ts';
import { pointAt, trackLength } from '../track/sampling.ts';
import { courseObjects } from '../track/objects.ts';
import { GRID_SIZE } from './constants.ts';
import { ABILITY_IDS, type AbilityId } from './abilities.ts';
import { RACERS } from './racers.ts';
import { neutralInput } from './input.ts';
import type { Racer, Race, RaceMode } from './types.ts';

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
