import type { EngineVoice } from './types.ts';

/** Vehicle hum per racer, in RACERS order: Jet-Blades, Mog-Mobile, roller V8, go-cart, cloud, carpet, burner and buggy. */
export const ENGINE_VOICES: EngineVoice[] = [
  { wave: 'sawtooth', idle: 70, top: 240, sub: .5, cutoff: 900, noise: .25, wobble: 0 },
  { wave: 'square', idle: 55, top: 170, sub: .5, cutoff: 700, noise: .1, wobble: 9 },
  { wave: 'sawtooth', idle: 38, top: 105, sub: .5, cutoff: 500, noise: .15, wobble: 12 },
  { wave: 'square', idle: 75, top: 260, sub: 2, cutoff: 1300, noise: .1, wobble: 18 },
  { wave: 'triangle', idle: 90, top: 210, sub: 1.5, cutoff: 1500, noise: .6, wobble: 0 },
  { wave: 'triangle', idle: 110, top: 260, sub: 1.5, cutoff: 1800, noise: .55, wobble: 0 },
  { wave: 'sawtooth', idle: 50, top: 150, sub: .5, cutoff: 650, noise: .5, wobble: 4 },
  { wave: 'sawtooth', idle: 42, top: 130, sub: .5, cutoff: 600, noise: .2, wobble: 14 },
];
