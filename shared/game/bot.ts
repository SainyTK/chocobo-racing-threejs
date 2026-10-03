import { clamp, mod, angleDelta } from '../math.ts';
import { TRACKS } from '../track/tracks.ts';
import { pointAt, trackLength } from '../track/sampling.ts';
import { courseObjects } from '../track/objects.ts';
import { RACERS } from './racers.ts';
import { neutralInput, type Input } from './input.ts';
import type { Race, Racer } from './types.ts';

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
