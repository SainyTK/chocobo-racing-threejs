import { EARLY_STAGE_MUSIC } from './early-stages.ts';
import { LATE_STAGE_MUSIC } from './late-stages.ts';
import type { MusicEvent, MusicVoice, StageMusic } from './types.ts';
import type { TrackId } from '../../shared/track/types.ts';

export const STAGE_MUSIC: Record<TrackId, StageMusic> = { ...EARLY_STAGE_MUSIC, ...LATE_STAGE_MUSIC };

// Original selection tune: clipped brass calls, plucked answers and offbeat comping.
// The 138 BPM tempo is an arranging choice, not a measurement of the reference.
const events: MusicEvent[] = [];
const add = (beat: number, duration: number, note: number, voice: MusicVoice, volume: number, pan = 0) => {
  events.push({ beat, duration, note, voice, volume, pan });
};
const harmonyA = [[60, 64, 67, 69], [60, 64, 67, 69], [57, 60, 64, 67], [62, 65, 69, 72],
  [53, 57, 60, 64], [54, 57, 60, 63], [55, 59, 62, 65], [55, 59, 62, 65]];
const harmonyB = [[65, 69, 72, 76], [65, 69, 72, 76], [64, 67, 71, 74], [57, 61, 64, 67],
  [62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 69], [55, 59, 62, 65]];
// Each two-bar call has repeated notes, offbeat pickups and a longer landing.
const calls = [
  [76, 76, 79, 81, 79, 76, 74, 72], [76, 79, 81, 79, 76, 74, 72, 74],
  [77, 77, 81, 84, 81, 79, 77, 76], [78, 81, 79, 77, 74, 71, 74, 79],
];
const answers = [
  [81, 79, 77, 79, 81, 84, 83, 81], [79, 76, 74, 76, 73, 76, 79, 81],
  [77, 81, 84, 81, 79, 77, 74, 71], [76, 79, 76, 74, 72, 71, 74, 72],
];
const rhythm = [0, .5, 1.25, 2, 3.5, 4.25, 5, 6.5];
for (let pair = 0; pair < 16; pair++) {
  const bSection = pair >= 8;
  const phrase = (bSection ? answers : calls)[pair % 4];
  rhythm.forEach((offset, i) => add(pair * 8 + offset, i === 7 ? 1 : .32,
    phrase[i] + (pair >= 4 && pair < 8 && i === 3 ? 12 : 0), bSection ? 'guitar' : 'brass', .46, -.12));
  // Brief answering hook leaves space between the lead phrases.
  add(pair * 8 + 2.75, .28, phrase[2] - 12, bSection ? 'synth' : 'pluck', .3, .25);
  add(pair * 8 + 3.25, .2, phrase[3] - 12, bSection ? 'synth' : 'pluck', .28, .25);
  add(pair * 8 + 7.5, .3, phrase[0] - 12, 'piano', .28, .2);
}
for (let bar = 0; bar < 32; bar++) {
  const beat = bar * 4;
  const chord = (bar < 16 ? harmonyA : harmonyB)[bar % 8];
  const nextBar = (bar + 1) % 32;
  const next = (nextBar < 16 ? harmonyA : harmonyB)[nextBar % 8];
  for (const offset of [.75, 2.5]) {
    chord.slice(1).forEach((note, i) => add(beat + offset, .3, note, 'piano', .18, .12 + i * .1));
  }
  // Root, fifth and chromatic approach define the syncopated bass line.
  [0, 1.5, 2, 3.25].forEach((offset, i) => add(beat + offset, .38,
    [chord[0] - 24, chord[2] - 24, chord[0] - 12, next[0] - 25][i], 'bass', .43));
  [0, 2.5].forEach(offset => add(beat + offset, .16, 36, 'kick', .36));
  [1, 3].forEach(offset => add(beat + offset, .14, 38, 'snare', .24));
  for (let step = 0; step < 8; step++) add(beat + step * .5, .07, 42, 'hat', step % 2 ? .12 : .09, .28);
  if (bar % 8 === 7) [3.5, 3.75].forEach(offset => add(beat + offset, .12, 38, 'snare', .2));
}
export const MENU_MUSIC: StageMusic = {
  id: 'menu', title: 'A small journey', bpm: 138, beats: 128,
  events: events.sort((a, b) => a.beat - b.beat),
};
