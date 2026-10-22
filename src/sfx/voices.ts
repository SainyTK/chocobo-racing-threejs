import type { Layer, Sound, Vowel } from './types.ts';

export type Mood = 'select' | 'cast' | 'hit' | 'win' | 'overtake';

const A: Vowel = [800, 1250], E: Vowel = [530, 1850], I: Vowel = [320, 2300], O: Vowel = [500, 900], U: Vowel = [330, 850], UH: Vowel = [620, 1200];

/** One syllable: a consonant burst, then a pitch glide between two vowels. Pitch is relative to the character's pitch. */
interface Syllable { at: number; length: number; from: Vowel; to?: Vowel; pitch: number; end: number; burst?: number }
/** A character's voice: base pitch, how much breath and growl it carries, and the syllables it says for each mood. */
interface VoiceProfile { pitch: number; wave: OscillatorType; rasp: number; tract: number; lines: Record<Mood, Syllable[]> }

const kweh = (at: number, pitch: number, end: number, length = .26): Syllable => ({ at, length, from: U, to: E, pitch, end, burst: 4200 });

/**
 * Short synthesized barks in each racer's voice, in the spirit of the original's grunts and Chocobo's "Kweh!".
 * Nothing here is sampled: each bark is an oscillator sung through two formant filters.
 */
const VOICES: VoiceProfile[] = [
  { pitch: 560, wave: 'sawtooth', rasp: .05, tract: 1.15, lines: { select: [kweh(0, 1, 1.25)], cast: [kweh(0, 1.15, 1.35, .2)], hit: [{ at: 0, length: .42, from: A, to: U, pitch: 1.3, end: .55, burst: 4200 }], win: [kweh(0, 1, 1.2, .2), kweh(.24, 1.2, 1.5)], overtake: [kweh(0, 1.1, 1.3, .18)] } },
  { pitch: 640, wave: 'sawtooth', rasp: .03, tract: 1.2, lines: { select: [{ at: 0, length: .14, from: U, pitch: 1, end: 1.1, burst: 3800 }, { at: .2, length: .24, from: O, pitch: 1.15, end: 1.3, burst: 1600 }], cast: [{ at: 0, length: .2, from: U, to: O, pitch: 1.2, end: 1.3, burst: 3800 }], hit: [{ at: 0, length: .35, from: U, to: O, pitch: 1.3, end: .7 }], win: [{ at: 0, length: .14, from: U, pitch: 1, end: 1.1, burst: 3800 }, { at: .2, length: .3, from: O, pitch: 1.2, end: 1.5, burst: 1600 }], overtake: [{ at: 0, length: .16, from: U, to: O, pitch: 1.2, end: 1.35 }] } },
  { pitch: 95, wave: 'sawtooth', rasp: .35, tract: .75, lines: { select: [{ at: 0, length: .45, from: O, to: UH, pitch: 1, end: .85 }], cast: [{ at: 0, length: .3, from: UH, pitch: 1.1, end: .9 }], hit: [{ at: 0, length: .4, from: O, to: U, pitch: 1.2, end: .7 }], win: [{ at: 0, length: .25, from: O, pitch: 1, end: 1.1 }, { at: .3, length: .45, from: O, to: A, pitch: 1.1, end: 1.3 }], overtake: [{ at: 0, length: .25, from: UH, pitch: 1, end: 1.05 }] } },
  { pitch: 330, wave: 'square', rasp: .12, tract: 1.05, lines: { select: [0, .14, .28].map((at, i) => ({ at, length: .1, from: E, to: I, pitch: 1 + i * .08, end: 1 + i * .08, burst: 2600 })), cast: [{ at: 0, length: .12, from: E, pitch: 1.2, end: 1.3, burst: 2600 }, { at: .15, length: .12, from: E, pitch: 1.3, end: 1.4, burst: 2600 }], hit: [{ at: 0, length: .35, from: A, to: E, pitch: 1.3, end: .7 }], win: [0, .12, .24, .36].map((at, i) => ({ at, length: .09, from: E, to: I, pitch: 1.1 + i * .1, end: 1.1 + i * .1, burst: 2600 })), overtake: [0, .13].map(at => ({ at, length: .09, from: E, pitch: 1.2, end: 1.2, burst: 2600 })) } },
  { pitch: 210, wave: 'sawtooth', rasp: .08, tract: .9, lines: { select: [{ at: 0, length: .35, from: U, to: O, pitch: 1, end: 1.15 }], cast: [{ at: 0, length: .3, from: O, to: A, pitch: 1.1, end: 1.4 }], hit: [{ at: 0, length: .3, from: U, pitch: 1.3, end: .8 }], win: [{ at: 0, length: .2, from: U, pitch: 1, end: 1.2 }, { at: .24, length: .3, from: O, to: A, pitch: 1.2, end: 1.45 }], overtake: [{ at: 0, length: .2, from: U, to: O, pitch: 1.1, end: 1.2 }] } },
  { pitch: 480, wave: 'sawtooth', rasp: .1, tract: 1.15, lines: { select: [{ at: 0, length: .3, from: A, to: E, pitch: 1, end: 1.2 }], cast: [{ at: 0, length: .22, from: E, to: A, pitch: 1.1, end: 1.3 }], hit: [{ at: 0, length: .3, from: A, pitch: 1.35, end: .85 }], win: [{ at: 0, length: .16, from: A, pitch: 1, end: 1.15 }, { at: .2, length: .3, from: A, to: E, pitch: 1.25, end: 1.5 }], overtake: [{ at: 0, length: .18, from: E, pitch: 1.1, end: 1.25 }] } },
  { pitch: 300, wave: 'sawtooth', rasp: .08, tract: .95, lines: { select: [kweh(0, 1, 1.15, .34)], cast: [kweh(0, 1.1, 1.25, .26)], hit: [{ at: 0, length: .45, from: A, to: U, pitch: 1.25, end: .6, burst: 3600 }], win: [kweh(0, 1, 1.15, .24), kweh(.3, 1.15, 1.4, .32)], overtake: [kweh(0, 1.05, 1.2, .22)] } },
  { pitch: 85, wave: 'sawtooth', rasp: .6, tract: .7, lines: { select: [{ at: 0, length: .6, from: UH, to: A, pitch: 1, end: .8 }], cast: [{ at: 0, length: .4, from: A, pitch: 1.1, end: .9 }], hit: [{ at: 0, length: .45, from: A, to: UH, pitch: 1.3, end: .7 }], win: [{ at: 0, length: .8, from: O, to: A, pitch: .9, end: 1.2 }], overtake: [{ at: 0, length: .35, from: UH, pitch: 1, end: .9 }] } },
  { pitch: 68, wave: 'sawtooth', rasp: .75, tract: .62, lines: { select: [{ at: 0, length: .8, from: O, to: A, pitch: .9, end: 1.15 }], cast: [{ at: 0, length: .3, from: UH, pitch: 1, end: 1.1 }, { at: .32, length: .7, from: O, to: A, pitch: 1.15, end: 1.45 }], hit: [{ at: 0, length: .5, from: A, to: UH, pitch: 1.35, end: .75 }], win: [{ at: 0, length: .5, from: O, to: A, pitch: 1, end: 1.25 }, { at: .6, length: .9, from: O, to: A, pitch: 1.1, end: 1.5 }], overtake: [{ at: 0, length: .4, from: UH, to: O, pitch: 1, end: .9 }] } },
  // Cloud: a young man's terse grunts, a flat "hmph" and a sharp "hah!", never cheerful.
  { pitch: 165, wave: 'sawtooth', rasp: .12, tract: .9, lines: { select: [{ at: 0, length: .22, from: UH, to: U, pitch: 1, end: .9, burst: 1200 }], cast: [{ at: 0, length: .2, from: A, pitch: 1.2, end: 1.05, burst: 1800 }], hit: [{ at: 0, length: .32, from: UH, to: U, pitch: 1.25, end: .75 }], win: [{ at: 0, length: .18, from: UH, pitch: 1, end: .95, burst: 1200 }, { at: .32, length: .3, from: A, to: E, pitch: 1.1, end: 1.2 }], overtake: [{ at: 0, length: .16, from: A, pitch: 1.15, end: 1.05, burst: 1800 }] } },
];

/** A character's bark for the given moment. */
export function bark(character: number, mood: Mood): Sound {
  const v = VOICES[character] ?? VOICES[0], layers: Layer[] = [];
  for (const s of v.lines[mood]) {
    const from: Vowel = [s.from[0] * v.tract, s.from[1] * v.tract], to: Vowel | undefined = s.to && [s.to[0] * v.tract, s.to[1] * v.tract];
    if (s.burst) layers.push({ wave: 'noise', at: s.at, length: .04, volume: .5, filter: { type: 'bandpass', freq: s.burst, q: 1.5 } });
    layers.push({ wave: v.wave, at: s.at + (s.burst ? .025 : 0), length: s.length, volume: .9, freq: v.pitch * s.pitch, to: v.pitch * s.end, attack: .02, formants: { from, to, q: 6 }, vibrato: { rate: 6.5, depth: v.pitch * .02 } });
    if (v.rasp > 0) layers.push({ wave: 'noise', at: s.at, length: s.length, volume: v.rasp, filter: { type: 'bandpass', freq: from[1], to: to?.[1], q: 3 } });
  }
  return layers;
}
