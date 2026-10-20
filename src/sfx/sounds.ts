import type { Item } from '../../shared/game/index.ts';
import type { Layer, Sound } from './types.ts';

const noise = (length: number, volume: number, type: BiquadFilterType, freq: number, to?: number, q = 1, at = 0): Layer => ({ wave: 'noise', at, length, volume, filter: { type, freq, to, q } });
const tone = (wave: OscillatorType, freq: number, length: number, volume: number, at = 0, to?: number): Layer => ({ wave, freq, to, length, volume, at });
const arpeggio = (wave: OscillatorType, notes: number[], step: number, length: number, volume: number): Layer[] => notes.map((f, i) => tone(wave, f, length, volume, i * step));

/** Race and menu sounds that do not depend on a spell or a character. */
export const SOUNDS = {
  pickup: arpeggio('sine', [659, 880, 1046], .07, .2, .45),
  countdown: [tone('square', 440, .2, .14)],
  go: [tone('square', 880, .35, .16), tone('triangle', 1320, .3, .1, .02)],
  lap: arpeggio('sine', [523, 784, 1046], .1, .3, .4),
  finish: arpeggio('triangle', [523, 659, 784, 1046], .15, .5, .4),
  fanfare: [...arpeggio('triangle', [523, 659, 784], .12, .3, .35), tone('square', 1046, .9, .18, .36), tone('triangle', 784, .9, .25, .36), tone('sine', 523, 1, .3, .36)],
  boost: [noise(.55, .5, 'bandpass', 500, 3200, 1.4), tone('triangle', 260, .45, .22, 0, 780)],
  bump: [tone('sine', 140, .16, .45, 0, 55), noise(.12, .3, 'lowpass', 900, 200)],
  wall: [tone('square', 95, .2, .22, 0, 50), noise(.28, .55, 'bandpass', 1400, 500, 2), noise(.1, .5, 'lowpass', 600)],
  spin: [{ wave: 'triangle', freq: 700, to: 160, length: .6, volume: .32, vibrato: { rate: 14, depth: 60 } }, noise(.3, .3, 'lowpass', 1200, 300)],
  steal: [noise(.18, .35, 'highpass', 2500, 5000), ...arpeggio('square', [1318, 1760], .06, .14, .12)],
  fall: [{ wave: 'sine', freq: 1300, to: 220, length: .9, volume: .3, vibrato: { rate: 9, depth: 25 } }],
  recover: arpeggio('sine', [392, 587, 784], .07, .25, .3),
  flap: Array.from({ length: 6 }, (_, i) => noise(.07, .9, 'bandpass', 700 + i * 60, undefined, 2, i * .07)),
  grip: arpeggio('square', [1600, 1600, 2000], .05, .05, .3),
  doomPass: [noise(.4, .8, 'bandpass', 300, 1200, 2), tone('sawtooth', 160, .4, .25, 0, 90)],
  select: [tone('triangle', 660, .08, .25), tone('triangle', 990, .12, .2, .06)],
} satisfies Record<string, Sound>;

const LEVEL = (level: number) => Math.max(1, Math.min(3, level));

/** The sound of casting a spell. Higher levels are longer, lower and louder. */
export function castSound(kind: Item, level: number): Sound {
  const l = LEVEL(level);
  switch (kind) {
    case 'fire': return [noise(.35 + l * .12, .85, 'bandpass', 400, 2400, 1.2), tone('sine', 120, .2, .4, 0, 50), tone('sawtooth', 90 - l * 12, .3 + l * .15, .12 + l * .05, 0, 60), ...(l > 1 ? [noise(.5 + l * .2, .5, 'lowpass', 900, 250, 1, .05)] : [])];
    case 'ice': return [...arpeggio('sine', [1760, 2349, 2637, 3136].slice(0, 2 + l), .05, .35, .22), noise(.4 + l * .15, .25, 'highpass', 5000, 9000)];
    case 'thunder': return [tone('sawtooth', 220, .25 + l * .05, .25, 0, 1400), noise(.2, .45, 'bandpass', 3000, 6000, 2)];
    case 'haste': return [tone('triangle', 300, .4 + l * .15, .28, 0, 900 + l * 300), noise(.5 + l * .15, .4, 'bandpass', 600, 3600, 1.5), ...(l > 1 ? arpeggio('sine', [1046, 1318, 1568].slice(0, l), .08, .2, .15) : [])];
    case 'shield': return [880, 1320, 1760].map((f, i) => ({ wave: 'sine' as const, freq: f, length: .9, volume: .18, at: i * .04, vibrato: { rate: 7, depth: 8 } }));
    case 'mini': return [{ wave: 'sine', freq: 900, to: 220, length: .45 + l * .1, volume: .35, vibrato: { rate: 18, depth: 40 } }, tone('triangle', 1200, .1, .15)];
    case 'doom': return [tone('sawtooth', 110, 1.1, .12), tone('sawtooth', 116.5, 1.1, .12), { wave: 'sine', freq: 220, length: 1.4, volume: .3, filter: { type: 'lowpass', freq: 600 } }, tone('triangle', 659, 1.2, .12, .05, 640)];
    case 'ultima': return [noise(.9 + l * .2, .45, 'bandpass', 200, 2000, .8), tone('sawtooth', 80, .9 + l * .2, .14, 0, 640), tone('sine', 60, .8 + l * .3, .6, .7, 30), noise(.9, .5, 'lowpass', 1500, 120, 1, .7)];
  }
}

/** The sound of a spell landing on a racer, scaled by crash tier (1 spin-out, 2 crash, 3 big crash). */
export function impactSound(kind: Item | 'charge' | 'doom', tier: number): Sound {
  const t = LEVEL(tier), boom = (len: number, vol: number) => [tone('sine', 110, len, vol, 0, 32), noise(len * 1.2, vol * .8, 'lowpass', 2400, 120)];
  switch (kind) {
    case 'fire': return [...boom(.45 + t * .2, .5 + t * .12), noise(.3, .3, 'highpass', 1800, 600)];
    case 'ice': return [noise(.12, .55, 'highpass', 3500), ...arpeggio('sine', [3136, 2637, 2093, 1568].slice(0, 2 + t), .045, .25, .16)];
    case 'thunder': return [noise(.09, .8, 'highpass', 1200), noise(.5 + t * .25, .55, 'lowpass', 500, 90, 1, .05), tone('sawtooth', 60, .35 + t * .1, .14, .02, 45)];
    case 'ultima': return [...boom(.7 + t * .3, .7), { wave: 'sine', freq: 1568, length: .9, volume: .14, vibrato: { rate: 6, depth: 20 } }];
    case 'doom': return [...boom(1.1, .75), tone('sawtooth', 220, 1, .12, 0, 55)];
    case 'mini': return [tone('square', 640, .14, .22, 0, 150), { wave: 'sine', freq: 420, to: 900, length: .35, volume: .3, at: .12, vibrato: { rate: 16, depth: 50 } }];
    default: return [...boom(.3 + t * .1, .45), ...SOUNDS.spin];
  }
}

export function reflectSound(blocked: boolean): Sound {
  return blocked ? [tone('square', 300, .12, .2, 0, 200), noise(.15, .35, 'bandpass', 900, undefined, 3)] : [tone('square', 1500, .18, .16, 0, 2600), ...arpeggio('sine', [1760, 2637], .05, .4, .18)];
}
