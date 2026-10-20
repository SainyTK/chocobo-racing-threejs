/** A pair of vocal-tract resonances in Hz: the first two formants of a vowel. */
export type Vowel = readonly [number, number];

/**
 * One synthesized layer of a sound effect. Times are seconds from the start of the sound.
 * Oscillator layers glide from `freq` to `to`; noise layers ignore pitch and are shaped by `filter`.
 * A layer with `formants` is sung through two band-pass resonances, which makes vowels for character barks.
 */
export interface Layer {
  at?: number;
  length: number;
  volume: number;
  wave: OscillatorType | 'noise';
  freq?: number;
  to?: number;
  attack?: number;
  filter?: { type: BiquadFilterType; freq: number; to?: number; q?: number };
  formants?: { from: Vowel; to?: Vowel; q?: number };
  vibrato?: { rate: number; depth: number };
}

export type Sound = readonly Layer[];

/** How a racer's vehicle sounds: oscillator pitch range over the speed range, plus breath noise. */
export interface EngineVoice {
  wave: OscillatorType;
  idle: number;
  top: number;
  sub: number;
  cutoff: number;
  noise: number;
  wobble: number;
}
