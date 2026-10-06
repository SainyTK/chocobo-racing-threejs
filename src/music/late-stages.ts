import type { TrackId } from '../../shared/track/types.ts';
import type { MusicEvent, MusicVoice, StageMusic } from './types.ts';

type LateTrackId = Extract<TrackId, 'manor' | 'gardens' | 'gingerbread' | 'volcano'>;
type Note = readonly [offset: number, duration: number, pitch: number];
type Harmony = readonly [bass: number, ...tones: number[]];

const BARS = 32;
const BEATS = BARS * 4;

function score(
  id: LateTrackId,
  title: string,
  bpm: number,
  arrange: (bar: number, add: AddEvent) => void,
): StageMusic {
  const events: MusicEvent[] = [];
  const add: AddEvent = (bar, offset, duration, note, voice, volume, pan = 0) => {
    const beat = bar * 4 + offset;
    if (beat < 0 || duration <= 0 || beat + duration > BEATS) {
      throw new RangeError(`${id}: event outside ${BEATS}-beat loop`);
    }
    events.push({ beat, duration, note, voice, volume, pan });
  };
  for (let bar = 0; bar < BARS; bar++) arrange(bar, add);
  events.sort((a, b) => a.beat - b.beat);
  return { id, title, bpm, beats: BEATS, events };
}

type AddEvent = (
  bar: number, offset: number, duration: number, note: number,
  voice: MusicVoice, volume: number, pan?: number,
) => void;

function melody(
  add: AddEvent, bar: number, notes: readonly Note[], voice: MusicVoice,
  volume: number, transpose = 0, pan = 0,
): void {
  for (const [offset, duration, pitch] of notes) {
    add(bar, offset, duration, pitch + transpose, voice, volume, pan);
  }
}

// D minor with diminished and flat-II colors; A and B each span eight bars.
const MANOR_HARMONY: readonly Harmony[] = [
  [38, 62, 65, 69], [37, 61, 64, 67], [34, 62, 65, 70], [33, 61, 64, 69],
  [43, 62, 67, 70], [40, 61, 64, 67], [39, 63, 67, 70], [33, 61, 64, 69],
  [41, 60, 65, 68], [36, 60, 64, 67], [39, 63, 66, 70], [34, 62, 65, 70],
  [43, 62, 67, 70], [37, 61, 64, 67], [33, 61, 64, 69], [38, 62, 65, 69],
];
const MANOR_MELODY: readonly (readonly Note[])[] = [
  [[0, 1.4, 74], [1.5, .4, 73], [2, .9, 77], [3, .8, 76]],
  [[0, .8, 73], [1, .4, 72], [1.5, 1.2, 76], [3, .8, 79]],
  [[.5, .9, 77], [1.5, .4, 76], [2, 1.7, 74]],
  [[0, 1.7, 73], [2, .4, 76], [2.5, .4, 75], [3, .8, 73]],
  [[0, .8, 79], [1, .8, 77], [2, .4, 76], [2.5, 1.2, 74]],
  [[.5, .4, 76], [1, .9, 79], [2, .4, 78], [2.5, 1.2, 76]],
  [[0, 1.4, 75], [1.5, .4, 74], [2, .9, 70], [3, .8, 73]],
  [[0, .8, 73], [1, .4, 76], [1.5, .4, 73], [2, 1.6, 69]],
  [[0, .4, 80], [.5, .4, 79], [1, .8, 77], [2.5, 1.2, 72]],
  [[0, .9, 76], [1, .4, 77], [1.5, .4, 79], [2, 1.7, 76]],
  [[.5, .4, 78], [1, .9, 82], [2, .4, 81], [2.5, 1.2, 78]],
  [[0, .8, 77], [1, .4, 74], [1.5, .4, 70], [2, 1.7, 74]],
  [[0, .9, 79], [1, .4, 82], [1.5, .4, 81], [2, .8, 79], [3, .8, 77]],
  [[0, .4, 76], [.5, .4, 75], [1, .9, 73], [2.5, 1.2, 79]],
  [[0, .8, 76], [1, .4, 73], [1.5, .4, 72], [2, .9, 69], [3, .8, 73]],
  [[0, 2.7, 74], [3, .4, 77], [3.5, .4, 73]],
];

const manor = score('manor', 'The clock behind the wall', 108, (bar, add) => {
  const phrase = bar % 16;
  const [root, ...chord] = MANOR_HARMONY[phrase]!;
  melody(add, bar, MANOR_MELODY[phrase]!, 'organ', .29, 0, -.12);
  for (const pitch of chord) add(bar, 0, 3.7, pitch - 12, 'organ', .095, .2);
  add(bar, 0, 1.8, root, 'bass', .26);
  add(bar, 2, 1.6, root + 12, 'bass', .17);
  // The second traversal adds a quiet, contrary-motion keyboard answer.
  if (bar >= 16) {
    add(bar, 1.5, .42, chord[2]! + 12, 'bell', .095, .48);
    add(bar, 3, .7, chord[0]! + 12, 'bell', .08, .48);
  }
  if (phrase >= 8) {
    add(bar, .5, 1.2, chord[1]!, 'strings', .09, -.4);
    add(bar, 2.5, 1.2, chord[0]!, 'strings', .08, -.4);
  }
  add(bar, 0, .16, 36, 'kick', .14);
  add(bar, 2, .13, 42, 'hat', .075, .3);
  if (bar % 4 === 3) add(bar, 3, .19, 38, 'snare', .09, -.2);
});

// G major opens into E minor and C lydian in the B phrase.
const GARDEN_HARMONY: readonly Harmony[] = [
  [43, 67, 71, 74], [42, 66, 69, 74], [40, 64, 67, 71], [47, 66, 71, 74],
  [36, 64, 67, 72], [45, 64, 69, 72], [38, 66, 69, 74], [43, 67, 71, 74],
  [40, 64, 67, 71], [36, 64, 67, 72], [43, 67, 71, 74], [38, 66, 69, 74],
  [36, 64, 66, 72], [45, 64, 69, 72], [38, 66, 69, 74], [43, 67, 71, 74],
];
const GARDEN_MELODY: readonly (readonly Note[])[] = [
  [[0, .8, 71], [1, .4, 74], [1.5, .4, 76], [2, 1.7, 79]],
  [[0, 1.3, 78], [1.5, .4, 76], [2, .8, 74], [3, .8, 69]],
  [[.5, .4, 71], [1, .8, 76], [2, .4, 79], [2.5, 1.2, 78]],
  [[0, 1.8, 74], [2.5, .4, 71], [3, .8, 69]],
  [[0, .8, 72], [1, .4, 76], [1.5, .4, 79], [2, 1.7, 83]],
  [[0, .8, 81], [1, .8, 79], [2, .4, 76], [2.5, 1.2, 72]],
  [[0, .4, 74], [.5, .4, 78], [1, .8, 81], [2, .8, 78], [3, .8, 74]],
  [[0, 2.7, 79], [3, .4, 74], [3.5, .4, 71]],
  [[0, 1.3, 83], [1.5, .4, 81], [2, .8, 79], [3, .8, 76]],
  [[0, .8, 79], [1, .4, 78], [1.5, .4, 76], [2, 1.7, 72]],
  [[.5, .4, 74], [1, .4, 79], [1.5, .4, 81], [2, 1.7, 83]],
  [[0, 1.3, 81], [1.5, .4, 78], [2, 1.7, 74]],
  [[0, .8, 78], [1, .4, 79], [1.5, .4, 84], [2, .8, 83], [3, .8, 79]],
  [[0, 1.3, 81], [1.5, .4, 79], [2, .8, 76], [3, .8, 72]],
  [[0, .8, 74], [1, .4, 76], [1.5, .4, 78], [2, 1.7, 81]],
  [[0, 2.7, 79], [3, .4, 76], [3.5, .4, 74]],
];

const gardens = score('gardens', 'Wind above the trellises', 120, (bar, add) => {
  const phrase = bar % 16;
  const [root, ...chord] = GARDEN_HARMONY[phrase]!;
  melody(add, bar, GARDEN_MELODY[phrase]!, 'strings', .24, 0, -.18);
  for (let step = 0; step < 8; step++) {
    const arpeggio = [0, 1, 2, 1, 0, 2, 1, 2][step]!;
    add(bar, step / 2, .38, chord[arpeggio]!, 'pluck', .105, .36);
  }
  for (const pitch of chord) add(bar, 0, 3.7, pitch - 12, 'strings', .065, .2);
  add(bar, 0, 1.7, root, 'bass', .22);
  add(bar, 2, 1.7, root + 7, 'bass', .16);
  add(bar, .5, .55, chord[1]! + 12, 'bell', .105, .5);
  if (bar >= 16) {
    add(bar, 1.5, .85, chord[2]!, 'flute', .13, -.42);
    add(bar, 2.5, 1.2, chord[0]! + 12, 'flute', .13, -.42);
  }
  add(bar, 0, .12, 36, 'kick', .11);
  add(bar, 2, .16, 38, 'snare', .085);
  for (const offset of [.5, 1.5, 2.5, 3.5]) add(bar, offset, .08, 42, 'hat', .055, .25);
});

// F jazz harmony: dominant turnarounds, a D-minor bridge, and swung pickups.
const JAZZ_HARMONY: readonly Harmony[] = [
  [41, 65, 69, 72, 76], [38, 65, 69, 72, 76], [43, 65, 69, 71, 74], [36, 64, 70, 74, 79],
  [41, 65, 69, 72, 76], [44, 66, 71, 74, 77], [43, 65, 69, 71, 74], [36, 64, 70, 73, 79],
  [38, 65, 69, 72, 76], [45, 67, 73, 76, 79], [38, 65, 69, 72, 76], [43, 65, 71, 74, 77],
  [34, 65, 69, 72, 74], [35, 65, 68, 71, 74], [36, 64, 70, 74, 79], [41, 65, 69, 72, 76],
];
const SW = 2 / 3;
const JAZZ_MELODY: readonly (readonly Note[])[] = [
  [[SW, .25, 72], [1, .55, 77], [1 + SW, .25, 76], [2, .55, 81], [3, .55, 79]],
  [[0, .55, 77], [SW, .25, 76], [1, .55, 72], [2 + SW, .25, 69], [3, .55, 72]],
  [[0, .55, 74], [1, .55, 77], [1 + SW, .25, 76], [2, .55, 74], [3 + SW, .25, 71]],
  [[0, .55, 70], [SW, .25, 69], [1, .55, 67], [2, 1.15, 64], [3 + SW, .25, 76]],
  [[0, .55, 77], [1 + SW, .25, 79], [2, .55, 81], [2 + SW, .25, 79], [3, .55, 77]],
  [[0, .55, 78], [SW, .25, 77], [1, .55, 74], [2, .55, 71], [3 + SW, .25, 74]],
  [[0, 1.15, 77], [1 + SW, .25, 76], [2, .55, 74], [2 + SW, .25, 72], [3, .55, 71]],
  [[0, .55, 70], [1, .55, 73], [1 + SW, .25, 72], [2, .55, 70], [3 + SW, .25, 73]],
  [[0, .55, 81], [SW, .25, 84], [1, .55, 83], [2, 1.15, 81], [3 + SW, .25, 77]],
  [[0, .55, 79], [1 + SW, .25, 76], [2, .55, 73], [2 + SW, .25, 76], [3, .55, 79]],
  [[0, .55, 81], [1, .55, 77], [1 + SW, .25, 76], [2, .55, 74], [3 + SW, .25, 72]],
  [[0, .55, 71], [SW, .25, 74], [1, .55, 77], [2 + SW, .25, 79], [3, .55, 77]],
  [[0, 1.15, 74], [1 + SW, .25, 77], [2, .55, 81], [3, .55, 79]],
  [[0, .55, 80], [SW, .25, 79], [1, .55, 77], [2, .55, 74], [3 + SW, .25, 71]],
  [[0, .55, 70], [1, .55, 74], [1 + SW, .25, 76], [2, .55, 79], [3 + SW, .25, 76]],
  [[0, 1.15, 77], [1 + SW, .25, 72], [2, .55, 69], [3 + SW, .25, 71]],
];

const gingerbread = score('gingerbread', 'Cookie tin cabaret', 144, (bar, add) => {
  const phrase = bar % 16;
  const [root, ...chord] = JAZZ_HARMONY[phrase]!;
  melody(add, bar, JAZZ_MELODY[phrase]!, 'brass', .245, 0, -.16);
  const nextRoot = JAZZ_HARMONY[(phrase + 1) % 16]![0];
  // Quarter-note walking bass approaches the next bar by a semitone.
  const walking = [root, chord[1]! - 24, root + 7, nextRoot + (bar % 2 ? 1 : -1)];
  walking.forEach((pitch, beat) => add(bar, beat, .78, pitch, 'bass', .28));
  for (const offset of (bar % 2 ? [SW, 2, 3 + SW] : [0, 1 + SW, 3])) {
    for (const pitch of chord) add(bar, offset, .24, pitch, 'pluck', .09, .27);
  }
  if (bar >= 16 && bar % 2 === 1) {
    add(bar, 2 + SW, .25, chord[2]! + 12, 'bell', .115, .44);
    add(bar, 3, .55, chord[0]! + 12, 'bell', .1, .44);
  }
  for (let beat = 0; beat < 4; beat++) {
    add(bar, beat, .075, 42, 'hat', beat % 2 ? .12 : .075, .22);
    add(bar, beat + SW, .06, 42, 'hat', .055, .22);
  }
  add(bar, 0, .13, 36, 'kick', .15);
  add(bar, 2, .13, 36, 'kick', .12);
  add(bar, 1, .15, 38, 'snare', .14, -.15);
  add(bar, 3, .15, 38, 'snare', .16, -.15);
});

// E minor, with flat-II and dominant tension and a wider B-phrase register.
const VOLCANO_HARMONY: readonly Harmony[] = [
  [40, 64, 67, 71], [40, 64, 67, 71], [36, 64, 67, 72], [38, 62, 66, 69],
  [40, 64, 67, 71], [41, 65, 69, 72], [35, 63, 66, 71], [35, 63, 66, 69],
  [45, 64, 69, 72], [43, 62, 67, 71], [41, 65, 69, 72], [40, 64, 67, 71],
  [36, 64, 67, 72], [38, 62, 66, 69], [35, 63, 66, 71], [40, 64, 67, 71],
];
const VOLCANO_MELODY: readonly (readonly Note[])[] = [
  [[0, .35, 76], [.5, .35, 76], [1, .7, 79], [2, .35, 78], [2.5, .35, 76], [3, .7, 71]],
  [[0, .7, 74], [1, .35, 76], [1.5, .35, 79], [2, .7, 83], [3, .7, 81]],
  [[0, .7, 79], [1, .35, 76], [1.5, .35, 79], [2, .7, 84], [3, .7, 83]],
  [[0, .35, 81], [.5, .35, 78], [1, .7, 74], [2, .35, 78], [2.5, .35, 76], [3, .7, 74]],
  [[0, .7, 76], [1.5, .35, 79], [2, .35, 83], [2.5, .35, 81], [3, .7, 79]],
  [[0, .35, 77], [.5, .35, 76], [1, .7, 81], [2, .35, 84], [2.5, .35, 83], [3, .7, 81]],
  [[0, .7, 78], [1, .35, 75], [1.5, .35, 78], [2, .7, 83], [3, .7, 78]],
  [[0, .35, 75], [.5, .35, 74], [1, .7, 71], [2, .35, 75], [2.5, .35, 78], [3, .7, 75]],
  [[0, 1.2, 84], [1.5, .35, 83], [2, .7, 81], [3, .7, 76]],
  [[0, .7, 83], [1, .35, 81], [1.5, .35, 79], [2, 1.5, 86]],
  [[0, .35, 84], [.5, .35, 83], [1, .7, 81], [2, .35, 77], [2.5, .35, 81], [3, .7, 84]],
  [[0, .7, 83], [1, .35, 79], [1.5, .35, 78], [2, 1.5, 76]],
  [[0, .7, 84], [1, .35, 83], [1.5, .35, 79], [2, .7, 76], [3, .7, 79]],
  [[0, .7, 81], [1, .35, 78], [1.5, .35, 74], [2, .35, 78], [2.5, .35, 81], [3, .7, 86]],
  [[0, .35, 83], [.5, .35, 81], [1, .7, 78], [2, .35, 75], [2.5, .35, 74], [3, .7, 75]],
  [[0, 1.5, 76], [2, .35, 71], [2.5, .35, 74], [3, .35, 75], [3.5, .35, 78]],
];

const volcano = score('volcano', 'Under the caldera', 168, (bar, add) => {
  const phrase = bar % 16;
  const [root, ...chord] = VOLCANO_HARMONY[phrase]!;
  melody(add, bar, VOLCANO_MELODY[phrase]!, 'brass', .285, 0, -.12);
  for (let step = 0; step < 8; step++) {
    const pitch = chord[[0, 2, 1, 2, 0, 1, 2, 1][step]!]!;
    add(bar, step / 2, .3, pitch, 'strings', .13, .3);
    add(bar, step / 2, .32, step % 4 === 3 ? root + 7 : root, 'bass', step % 2 ? .22 : .3);
    add(bar, step / 2, .065, 42, 'hat', step % 2 ? .075 : .105, .4);
  }
  for (const pitch of chord) add(bar, 0, 1.5, pitch - 12, 'brass', .075, -.35);
  if (bar >= 16) {
    add(bar, 1, .7, chord[2]! + 12, 'strings', .13, .45);
    add(bar, 3, .7, chord[0]! + 12, 'strings', .13, .45);
  }
  for (const offset of [0, 1.5, 2, 2.5]) add(bar, offset, .17, 36, 'kick', .24);
  for (const offset of [1, 3]) add(bar, offset, .18, 38, 'snare', .23, -.15);
  if (bar % 4 === 3) {
    for (const offset of [3.25, 3.5, 3.75]) add(bar, offset, .1, 38, 'snare', .12 + (offset - 3) * .1, -.15);
  }
});

export const LATE_STAGE_MUSIC = {
  manor,
  gardens,
  gingerbread,
  volcano,
} satisfies Record<LateTrackId, StageMusic>;
