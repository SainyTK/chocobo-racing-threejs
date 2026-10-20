import { TRACKS } from '../track/tracks.ts';
import { pointAt, trackLength } from '../track/sampling.ts';
import { botDriving, botLook } from './bot-driving.ts';
import { botMagic, botStoneLane } from './bot-magic.ts';
import { neutralInput, type Input } from './input.ts';
import type { Race, Racer } from './types.ts';

export function botInput(r: Race, p: Racer): Input {
  if (r.time < 0) return { ...neutralInput(), throttle: r.time > -.16 };
  const len = trackLength(r.track), def = TRACKS[r.track], i = r.racers.indexOf(p);
  let lane = Math.sin(i * 2.2 + p.s / 150) * 2.2;
  lane = botStoneLane(r, p) ?? lane;
  const curve = Math.max(...[12, 25, 40].map(d => Math.abs(pointAt(r.track, p.s + d).curve)));
  return { ...botDriving(r, p, pointAt(r.track, p.s + botLook(p), lane)), reverse: false, ...botMagic(r, p, curve), rescue: p.speed < 2 && r.time > 8 && Math.abs(p.x) > def.width - 2 || p.s > (p.gates + 2) * len / 12 };
}
