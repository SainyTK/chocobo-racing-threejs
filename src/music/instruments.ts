import type { MusicVoice } from './types.ts';

export type PitchedVoice = Exclude<MusicVoice, 'kick' | 'snare' | 'hat'>;
interface Partial {
  type: OscillatorType;
  ratio: number;
  weight: number;
  sustain: number;
  detune?: number;
}
interface Instrument {
  attack: number;
  release: number;
  level: number;
  sustain: number;
  cutoff: number;
  keyTracking: number;
  filterAttack: number;
  filterSustain: number;
  partials: readonly Partial[];
}
const sine = (ratio: number, weight: number, sustain = 1): Partial => ({ type: 'sine', ratio, weight, sustain });

// All weights are normalized by the player. Brighter overtones can decay sooner
// than the fundamental, without adding sampled assets or persistent effect nodes.
export const INSTRUMENTS: Record<PitchedVoice, Instrument> = {
  flute: {
    attack: .025, release: .08, level: .8, sustain: .82,
    cutoff: 1200, keyTracking: 2, filterAttack: .85, filterSustain: .95,
    partials: [sine(1, 1), sine(2, .18, .55)],
  },
  brass: {
    attack: .018, release: .06, level: .48, sustain: .62,
    cutoff: 900, keyTracking: 2.5, filterAttack: .55, filterSustain: .62,
    partials: [{ type: 'sawtooth', ratio: 1, weight: .8, sustain: .8 }, sine(1, .3)],
  },
  strings: {
    attack: .07, release: .14, level: .32, sustain: .85,
    cutoff: 1700, keyTracking: 1.5, filterAttack: .7, filterSustain: .85,
    partials: [
      { type: 'sawtooth', ratio: 1, weight: 1, sustain: 1, detune: -7 },
      { type: 'sawtooth', ratio: 1, weight: .85, sustain: 1, detune: 7 },
    ],
  },
  bell: {
    attack: .003, release: .16, level: .6, sustain: .06,
    cutoff: 6500, keyTracking: 2, filterAttack: 1, filterSustain: .8,
    partials: [sine(1, 1, .7), sine(2.76, .45, .04)],
  },
  organ: {
    attack: .008, release: .045, level: .5, sustain: .95,
    cutoff: 3500, keyTracking: 1, filterAttack: 1, filterSustain: 1,
    partials: [sine(1, 1), sine(2, .62), sine(4, .24)],
  },
  pluck: {
    attack: .003, release: .065, level: .75, sustain: .05,
    cutoff: 2600, keyTracking: 2, filterAttack: 1, filterSustain: .3,
    partials: [{ type: 'triangle', ratio: 1, weight: 1, sustain: .65 }],
  },
  bass: {
    attack: .006, release: .045, level: .85, sustain: .6,
    cutoff: 450, keyTracking: 1.5, filterAttack: 1, filterSustain: .65,
    partials: [{ type: 'triangle', ratio: 1, weight: 1, sustain: 1 }],
  },
  piano: {
    attack: .003, release: .09, level: .8, sustain: .08,
    cutoff: 3000, keyTracking: 3, filterAttack: 1, filterSustain: .55,
    partials: [sine(1, 1, .8), sine(2, .55, .32), sine(3, .28, .09), sine(4.01, .12, .02)],
  },
  guitar: {
    attack: .002, release: .065, level: .7, sustain: .055,
    cutoff: 2200, keyTracking: 2.5, filterAttack: 1, filterSustain: .35,
    partials: [{ type: 'triangle', ratio: 1, weight: 1, sustain: .8 }, sine(2, .45, .14), sine(3, .2, .03)],
  },
  synth: {
    attack: .015, release: .09, level: .4, sustain: .72,
    cutoff: 1800, keyTracking: 2, filterAttack: .8, filterSustain: .75,
    partials: [
      { type: 'sawtooth', ratio: 1, weight: 1, sustain: 1, detune: -4 },
      { type: 'triangle', ratio: 1, weight: .65, sustain: .8, detune: 4 },
    ],
  },
  ghost: {
    attack: .055, release: .14, level: .38, sustain: .48,
    cutoff: 1500, keyTracking: 1, filterAttack: .55, filterSustain: .65,
    partials: [sine(1, 1), { ...sine(1.005, .65, .65), detune: 9 }, sine(2.03, .24, .2)],
  },
};
