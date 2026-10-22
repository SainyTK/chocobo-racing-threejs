import { TRACKS } from '../track/tracks.ts';
import { trackLength } from '../track/sampling.ts';
import { botDriving, botLook } from './bot-driving.ts';
import { botMagic, botStoneLane } from './bot-magic.ts';
import { courseLine } from './bot-course.ts';
import { neutralInput, type Input } from './input.ts';
import type { Race, Racer } from './types.ts';

export function botInput(r: Race, p: Racer): Input {
  if (r.time < 0) return { ...neutralInput(), throttle: r.time > -.16 };
  const len = trackLength(r.track), def = TRACKS[r.track], i = r.racers.indexOf(p);
  let lane = Math.sin(i * 2.2 + p.s / 150) * 2.2;
  lane = botStoneLane(r, p) ?? lane;
  const line = courseLine(r, p, lane, botLook(p)), drive = botDriving(r, p, line.target);
  // A timed hazard ahead can hold the CPU back below its cornering speed until it stops striking.
  // Cornering plans read the main road's bends; a shortcut is a near-straight line, so on one only the course line's limit applies.
  const hold = p.speed > line.limit, brake = line.shortcut ? hold : drive.brake || hold;
  return { ...drive, brake, throttle: line.shortcut ? !hold : drive.throttle && !hold, reverse: false, ...botMagic(r, p), rescue: p.speed < 2 && r.time > 8 && Math.abs(p.x) > def.width - 2 || p.s > (p.gates + 2) * len / 12 };
}
