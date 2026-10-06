import type { TrackId } from '../../shared/track/types.ts';
import type { MusicEvent, MusicVoice, StageMusic } from './types.ts';

type LateTrackId = Extract<TrackId, 'manor' | 'gardens' | 'gingerbread' | 'volcano'>;
type Note = readonly [offset: number, duration: number, pitch: number];
type Harmony = readonly [bass: number, ...tones: number[]];
type AddEvent = (
  bar: number, offset: number, duration: number, note: number,
  voice: MusicVoice, volume: number, pan?: number,
) => void;

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
    if (!Number.isFinite(beat) || !Number.isFinite(duration)
      || beat < 0 || duration <= 0 || beat + duration > BEATS) {
      throw new RangeError(`${id}: event outside ${BEATS}-beat loop`);
    }
    events.push({ beat, duration, note, voice, volume, pan });
  };
  for (let bar = 0; bar < BARS; bar++) arrange(bar, add);
  events.sort((a, b) => a.beat - b.beat);
  return { id, title, bpm, beats: BEATS, events };
}

function melody(
  add: AddEvent, bar: number, notes: readonly Note[], voice: MusicVoice,
  volume: number, pan = 0,
): void {
  for (const [offset, duration, pitch] of notes) add(bar, offset, duration, pitch, voice, volume, pan);
}

function chordHits(
  add: AddEvent, bar: number, offsets: readonly number[], tones: readonly number[],
  voice: MusicVoice, duration: number, volume: number, pan: number,
): void {
  for (const offset of offsets) {
    for (const pitch of tones) add(bar, offset, duration, pitch, voice, volume, pan);
  }
}

// Newly written C-minor keyboard phrases, diminished passing chords and an Ab/Fm bridge.
// Piano and organ trade four-bar statements; ghost accents occupy short gaps at low gain.
const MANOR_HARMONY: readonly Harmony[] = [
  [36, 60, 63, 67], [35, 59, 62, 65], [34, 58, 62, 67], [43, 59, 62, 65],
  [36, 60, 63, 67], [37, 61, 64, 67], [38, 60, 65, 68], [43, 59, 62, 68],
  [44, 60, 63, 68], [41, 60, 65, 68], [42, 60, 63, 66], [43, 59, 62, 67],
  [44, 60, 63, 67], [38, 60, 65, 68], [43, 59, 62, 68], [36, 60, 63, 67],
];
const MANOR_MELODY: readonly (readonly Note[])[] = [
  [[0, .32, 72], [.5, .32, 71], [1, .7, 75], [2, .32, 74], [2.5, .7, 67]],
  [[.25, .32, 71], [.75, .32, 72], [1.25, .7, 74], [2.5, .32, 68], [3, .45, 65]],
  [[0, .7, 70], [1, .32, 69], [1.5, .32, 70], [2, .95, 74], [3.25, .3, 67]],
  [[0, .32, 71], [.5, .32, 68], [1, .7, 65], [2, .32, 66], [2.5, .7, 67]],
  [[.5, .4, 67], [1, .4, 72], [1.5, .4, 75], [2, .75, 74], [3, .4, 72]],
  [[0, .4, 73], [.5, .4, 76], [1.25, .6, 79], [2.25, .4, 78], [2.75, .7, 76]],
  [[0, .7, 77], [1, .4, 76], [1.5, .4, 74], [2.25, .6, 72], [3, .4, 68]],
  [[0, .45, 71], [.75, .45, 74], [1.5, .45, 68], [2.25, .6, 67]],
  [[0, 1.1, 75], [1.5, .4, 79], [2, .7, 80], [3, .4, 79]],
  [[0, .7, 77], [1, .4, 75], [1.5, .4, 76], [2, 1.2, 77]],
  [[.25, .4, 78], [.75, .4, 75], [1.5, .7, 72], [2.5, .7, 69]],
  [[0, .7, 71], [1, .4, 74], [1.5, .4, 73], [2, .7, 71], [3, .4, 67]],
  [[0, .4, 80], [.5, .4, 79], [1, .7, 75], [2, .4, 72], [2.5, .7, 75]],
  [[.5, .4, 77], [1, .7, 74], [2, .4, 72], [2.5, .7, 68]],
  [[0, .4, 71], [.5, .4, 74], [1, .7, 77], [2, .4, 76], [2.5, .7, 71]],
  [[0, 1.4, 72], [2, .32, 67], [2.5, .32, 70]],
];
const MANOR_TURN: readonly Note[] = [[0, .4, 71], [.5, .4, 74], [1, .4, 68], [1.5, .4, 67], [2, .7, 65], [3, .3, 71], [3.5, .3, 74]];
const MANOR_RETURN: readonly Note[] = [[0, .7, 75], [1, .4, 74], [1.5, .4, 72], [2.5, .3, 71], [3, .3, 70], [3.5, .3, 71]];

const manor = score('manor', 'The clock behind the wall', 132, (bar, add) => {
  const phrase = bar % 16;
  const [root, ...chord] = MANOR_HARMONY[phrase]!;
  const pianoLead = Math.floor(bar / 4) % 2 === 0;
  const notes = bar === 23 ? MANOR_TURN : bar === 31 ? MANOR_RETURN : MANOR_MELODY[phrase]!;
  melody(add, bar, notes, pianoLead ? 'piano' : 'organ', pianoLead ? .27 : .21, -.15);
  // Two-tone replies keep the organ out of the piano's register and leave room for the bass.
  chordHits(add, bar, [.75, 2.75], [chord[0]! - 12, chord[2]! - 12],
    pianoLead ? 'organ' : 'piano', .38, .075, .24);
  const nextRoot = MANOR_HARMONY[(phrase + 1) % 16]![0];
  for (const [offset, pitch] of [[0, root], [1.5, root + 7], [2.5, root + 12], [3.5, nextRoot - 1]]) {
    add(bar, offset!, .36, pitch!, 'bass', .22);
  }
  if (bar % 2 === 0) add(bar, 3.5, .4, chord[1]! + 12, 'ghost', .036, .55);
  if (bar >= 16 && bar % 4 === 1) add(bar, 3.5, .4, chord[0]! + 12, 'ghost', .028, -.5);
  add(bar, 0, .13, 36, 'kick', .14);
  add(bar, 2, .13, 36, 'kick', .11);
  for (const offset of [1, 3]) add(bar, offset, .12, 38, 'snare', .09, -.18);
  for (const offset of [.5, 1.5, 2.5, 3.5]) add(bar, offset, .07, 42, 'hat', .052, .3);
  if (bar % 8 === 7) {
    add(bar, 3.25, .08, 38, 'snare', .07, -.18);
    add(bar, 3.75, .08, 38, 'snare', .11, -.18);
  }
});

// D-major synth melody with long notes over a light sixteenth pickup groove.
// B opens in B minor and rises through Gmaj7 and Em7 before the A7 return.
const GARDEN_HARMONY: readonly Harmony[] = [
  [38, 62, 66, 69], [45, 61, 64, 69], [47, 62, 66, 69], [42, 61, 66, 69],
  [43, 62, 66, 71], [40, 62, 67, 71], [45, 61, 67, 69], [38, 62, 66, 69],
  [47, 62, 66, 73], [42, 61, 64, 69], [43, 62, 66, 71], [38, 62, 66, 69],
  [40, 62, 67, 71], [43, 62, 66, 71], [45, 61, 67, 69], [38, 62, 66, 69],
];
const GARDEN_MELODY: readonly (readonly Note[])[] = [
  [[0, .65, 78], [1, .35, 76], [1.5, 1.75, 81]],
  [[0, 1.35, 80], [1.75, .35, 78], [2.5, 1.15, 76]],
  [[.5, .35, 78], [1, .65, 81], [2, 1.6, 85]],
  [[0, 1.35, 81], [1.75, .35, 80], [2.5, .75, 78]],
  [[0, .65, 79], [1, .35, 78], [1.5, 1.75, 83]],
  [[0, 1.35, 81], [1.75, .35, 79], [2.5, 1.15, 78]],
  [[.5, .35, 76], [1, .65, 80], [2, .65, 83], [3, .35, 81]],
  [[0, 2.3, 78], [2.75, .35, 76]],
  [[0, .65, 85], [1, .35, 83], [1.5, 1.75, 81]],
  [[0, 1.35, 80], [1.75, .35, 81], [2.5, .75, 85]],
  [[0, .65, 83], [1, .35, 81], [1.5, 1.75, 86]],
  [[0, 1.35, 85], [1.75, .35, 83], [2.5, 1.15, 81]],
  [[.5, .35, 79], [1, .65, 83], [2, 1.6, 86]],
  [[0, .65, 85], [1, .35, 83], [1.5, 1.75, 79]],
  [[0, .65, 80], [1, .35, 83], [1.5, .65, 81], [2.5, .65, 76]],
  [[0, 2.3, 78], [2.75, .35, 81]],
];
const GARDEN_LIFT: readonly Note[] = [[0, 1.35, 78], [1.75, .35, 81], [2.5, .35, 83], [3, .35, 85], [3.5, .35, 86]];
const GARDEN_RETURN: readonly Note[] = [[0, 1.35, 81], [1.75, .35, 79], [2.5, .35, 78], [3, .35, 76], [3.5, .35, 77]];

const gardens = score('gardens', 'Wind above the trellises', 148, (bar, add) => {
  const phrase = bar % 16;
  const [root, ...chord] = GARDEN_HARMONY[phrase]!;
  const notes = bar === 23 ? GARDEN_LIFT : bar === 31 ? GARDEN_RETURN : GARDEN_MELODY[phrase]!;
  melody(add, bar, notes, 'synth', .25, -.1);
  for (const [offset, index] of [[.5, 0], [1.75, 1], [2.5, 2], [3.25, 1]]) {
    add(bar, offset!, .26, chord[index!]!, 'pluck', .065, .32);
  }
  // Soft open dyads and breath-length flute replies, with no doubled lead line.
  chordHits(add, bar, [0, 2], [chord[0]! - 12, chord[2]! - 12], 'synth', .8, .035, .35);
  if (bar % 2 === 1 && bar !== 23 && bar !== 31) {
    add(bar, 3.25, .28, chord[1]! + 12, 'flute', bar >= 16 ? .095 : .07, -.4);
    add(bar, 3.625, .28, chord[0]! + 12, 'flute', .075, -.4);
  }
  const nextRoot = GARDEN_HARMONY[(phrase + 1) % 16]![0];
  for (const [offset, pitch] of [[0, root], [1.5, root + 7], [2, root + 12], [3.5, nextRoot]]) {
    add(bar, offset!, .4, pitch!, 'bass', .19);
  }
  for (const offset of [0, 2, 2.75]) add(bar, offset, .12, 36, 'kick', .12);
  for (const offset of [1, 3]) add(bar, offset, .13, 38, 'snare', .11, -.12);
  for (let step = 0; step < 8; step++) add(bar, step / 2, .055, 42, 'hat', step % 2 ? .045 : .065, .3);
  if (bar % 8 === 7) {
    add(bar, 3.5, .09, 38, 'snare', .08, -.12);
    add(bar, 3.75, .09, 38, 'snare', .1, -.12);
  }
});

// Bb jazz changes use sixths, ii-V motion, a chromatic dominant and a G-minor bridge.
// Every eighth-note pickup uses a 2:1 swing grid; piano and brass trade two-bar leads.
const SW = 2 / 3;
const JAZZ_HARMONY: readonly Harmony[] = [
  [34, 62, 67, 69], [43, 58, 62, 65], [36, 63, 67, 70], [41, 63, 67, 69],
  [34, 62, 65, 67], [37, 59, 65, 68], [36, 63, 67, 70], [41, 63, 66, 69],
  [43, 58, 62, 65], [36, 63, 67, 70], [41, 63, 67, 69], [34, 62, 65, 69],
  [39, 62, 67, 70], [40, 62, 67, 70], [41, 63, 66, 69], [34, 62, 65, 67],
];
const JAZZ_MELODY: readonly (readonly Note[])[] = [
  [[SW, .23, 74], [1, .5, 77], [1 + SW, .23, 76], [2, .5, 74], [3 + SW, .23, 79]],
  [[0, .5, 77], [SW, .23, 74], [1, .5, 70], [2, .5, 69], [2 + SW, .23, 70]],
  [[0, .5, 75], [SW, .23, 79], [1, .5, 82], [2 + SW, .23, 81], [3, .5, 79]],
  [[0, .5, 81], [1 + SW, .23, 79], [2, .5, 75], [2 + SW, .23, 74], [3, .5, 72]],
  [[SW, .23, 77], [1, .5, 79], [1 + SW, .23, 81], [2, 1.1, 82]],
  [[0, .5, 80], [SW, .23, 77], [1, .5, 75], [2, .5, 71], [3 + SW, .23, 74]],
  [[0, .5, 75], [1 + SW, .23, 74], [2, .5, 72], [2 + SW, .23, 70], [3, .5, 67]],
  [[0, .5, 69], [SW, .23, 72], [1, .5, 75], [2, .5, 78], [3, .5, 77]],
  [[0, 1.1, 82], [1 + SW, .23, 81], [2, .5, 79], [3 + SW, .23, 77]],
  [[0, .5, 79], [SW, .23, 82], [1, .5, 84], [2 + SW, .23, 82], [3, .5, 79]],
  [[SW, .23, 81], [1, .5, 79], [1 + SW, .23, 77], [2, .5, 75], [3 + SW, .23, 72]],
  [[0, .5, 74], [1, .5, 77], [1 + SW, .23, 81], [2, 1.1, 79]],
  [[0, .5, 79], [SW, .23, 82], [1, .5, 86], [2 + SW, .23, 84], [3, .5, 82]],
  [[0, .5, 83], [SW, .23, 82], [1, .5, 79], [2, .5, 76], [3 + SW, .23, 74]],
  [[0, .5, 75], [SW, .23, 78], [1, .5, 81], [2 + SW, .23, 79], [3, .5, 77]],
  [[0, 1.1, 74], [1 + SW, .23, 77], [2, .5, 70]],
];
const JAZZ_BREAK: readonly Note[] = [[0, .23, 81], [SW, .23, 78], [1, .5, 75], [2 + SW, .23, 74], [3, .5, 77], [3 + SW, .23, 81]];
const JAZZ_TAG: readonly Note[] = [[0, .5, 77], [SW, .23, 74], [1, .5, 70], [2 + SW, .23, 72], [3, .5, 73], [3 + SW, .23, 74]];

const gingerbread = score('gingerbread', 'Cookie tin cabaret', 156, (bar, add) => {
  const phrase = bar % 16;
  const [root, ...chord] = JAZZ_HARMONY[phrase]!;
  const pianoLead = Math.floor(bar / 2) % 2 === (bar >= 16 ? 1 : 0);
  const notes = bar === 23 ? JAZZ_BREAK : bar === 31 ? JAZZ_TAG : JAZZ_MELODY[phrase]!;
  melody(add, bar, notes, pianoLead ? 'piano' : 'brass', pianoLead ? .25 : .22, -.15);
  const nextRoot = JAZZ_HARMONY[(phrase + 1) % 16]![0];
  const third = root + [4, 3, 3, 4, 4, 4, 3, 4, 3, 3, 4, 4, 4, 3, 4, 4][phrase]!;
  // Each quarter note changes pitch; the fourth approaches the next root chromatically.
  [root, third, root + 7, nextRoot + (phrase % 2 ? 1 : -1)]
    .forEach((pitch, beat) => add(bar, beat, .72, pitch, 'bass', .25));
  const compOffsets = bar % 8 === 7 ? [SW, 2 + SW] : bar % 2 ? [SW, 2 + SW, 3 + SW] : [1 + SW, 3 + SW];
  chordHits(add, bar, compOffsets, chord, 'piano', .18, .055, .3);
  // One muted pluck reply per two bars; the second chorus swaps the lead order.
  if (bar % 2 === 1 && bar !== 23 && bar !== 31) {
    add(bar, 3, .18, chord[1]! + 12, 'pluck', .095, .45);
    add(bar, 3 + SW, .18, chord[0]! + 12, 'pluck', .075, .45);
  }
  for (let beat = 0; beat < 4; beat++) {
    add(bar, beat, .065, 42, 'hat', beat % 2 ? .085 : .055, .2);
    add(bar, beat + SW, .055, 42, 'hat', .04, .2);
  }
  add(bar, 0, .1, 36, 'kick', .12);
  add(bar, 2, .1, 36, 'kick', .1);
  for (const offset of [1, 3]) add(bar, offset, .11, 38, 'snare', .12, -.2);
  if (bar % 8 === 7) {
    add(bar, 2 + SW, .07, 38, 'snare', .065, -.2);
    add(bar, 3 + SW, .07, 38, 'snare', .1, -.2);
  }
});

// D-minor battle riff with Eb and A7(b9) tension, followed by a Bb/Gm response section.
// Guitar handles the short A riff; synth carries B and brass answers in the final beat.
const VOLCANO_HARMONY: readonly Harmony[] = [
  [38, 62, 65, 69], [38, 62, 65, 69], [39, 63, 67, 70], [45, 61, 64, 70],
  [38, 62, 65, 69], [41, 60, 65, 69], [43, 62, 67, 70], [45, 61, 64, 70],
  [34, 62, 65, 70], [36, 60, 64, 67], [43, 62, 67, 70], [38, 62, 65, 69],
  [39, 63, 67, 70], [34, 62, 65, 70], [45, 61, 64, 70], [45, 61, 64, 70],
];
const VOLCANO_MELODY: readonly (readonly Note[])[] = [
  [[0, .18, 62], [.25, .18, 62], [.75, .18, 69], [1.25, .4, 65], [2, .18, 62], [2.25, .18, 63], [2.75, .18, 62]],
  [[0, .18, 62], [.25, .18, 62], [.75, .18, 65], [1.25, .4, 67], [2, .18, 69], [2.5, .4, 65]],
  [[0, .18, 63], [.25, .18, 63], [.75, .18, 70], [1.25, .4, 67], [2, .18, 65], [2.25, .18, 64], [2.75, .18, 63]],
  [[0, .4, 61], [.75, .18, 64], [1.25, .4, 70], [2, .18, 69], [2.5, .4, 64]],
  [[0, .18, 62], [.25, .18, 65], [.75, .18, 69], [1.25, .4, 72], [2, .18, 69], [2.25, .18, 67], [2.75, .18, 65]],
  [[0, .4, 65], [.75, .18, 69], [1.25, .4, 72], [2, .18, 74], [2.5, .4, 72]],
  [[0, .18, 67], [.25, .18, 67], [.75, .18, 70], [1.25, .4, 74], [2, .18, 72], [2.25, .18, 70], [2.75, .18, 67]],
  [[0, .4, 69], [.75, .18, 70], [1.25, .4, 73], [2, .18, 76], [2.5, .4, 73]],
  [[0, .65, 77], [.75, .18, 74], [1.25, .4, 82], [2, .18, 81], [2.5, .4, 77]],
  [[0, .4, 79], [.75, .18, 76], [1.25, .4, 72], [2, .18, 74], [2.5, .4, 76]],
  [[0, .18, 79], [.25, .18, 79], [.75, .18, 82], [1.25, .4, 86], [2, .18, 84], [2.5, .4, 82]],
  [[0, .65, 81], [.75, .18, 77], [1.25, .4, 74], [2, .18, 76], [2.5, .4, 77]],
  [[0, .18, 82], [.25, .18, 81], [.75, .18, 79], [1.25, .4, 75], [2, .18, 77], [2.5, .4, 79]],
  [[0, .4, 77], [.75, .18, 74], [1.25, .4, 70], [2, .18, 74], [2.5, .4, 77]],
  [[0, .18, 76], [.25, .18, 73], [.75, .18, 70], [1.25, .4, 69], [2, .18, 73], [2.5, .4, 76]],
  [[0, .4, 73], [.75, .18, 70], [1.25, .4, 69], [2, .18, 67], [2.5, .4, 64]],
];
const VOLCANO_BREAK: readonly Note[] = [[0, .18, 69], [.25, .18, 70], [.75, .18, 73], [1.25, .4, 76], [2, .18, 77], [2.25, .18, 76], [2.5, .18, 73], [2.75, .18, 70]];
const VOLCANO_RETURN: readonly Note[] = [[0, .4, 76], [.75, .18, 73], [1.25, .4, 70], [2, .18, 69], [2.25, .18, 67], [2.5, .18, 65], [2.75, .18, 61]];

const volcano = score('volcano', 'Under the caldera', 180, (bar, add) => {
  const phrase = bar % 16;
  const [root, ...chord] = VOLCANO_HARMONY[phrase]!;
  const build = (bar % 8) / 7;
  const notes = bar === 23 ? VOLCANO_BREAK : bar === 31 ? VOLCANO_RETURN : VOLCANO_MELODY[phrase]!;
  melody(add, bar, notes, phrase < 8 ? 'guitar' : 'synth', .22 + build * .055, -.15);
  // Responses replace the lead at beat three, leaving a deliberate call/answer gap.
  const answerVoice = bar % 2 === 0 ? 'synth' : 'brass';
  add(bar, 3, .28, chord[2]! + 12, answerVoice, .16 + build * .035, .3);
  add(bar, 3.5, .28, chord[1]! + 12, answerVoice, .14 + build * .035, .3);
  chordHits(add, bar, [.5, 1.5, 2.5], [root + 12, root + 19], 'guitar', .14, .06, -.32);
  // Sixteenths enter in the last two bars of each phrase; eighths leave headroom elsewhere.
  const steps = bar % 8 >= 6 ? 16 : 8;
  for (let step = 0; step < steps; step++) {
    const pitch = step === steps - 1 ? VOLCANO_HARMONY[(phrase + 1) % 16]![0] - 1
      : step % 4 === 3 ? root + 7 : root;
    add(bar, step * 4 / steps, steps === 16 ? .16 : .3, pitch, 'bass', step % 2 ? .19 : .25);
  }
  for (let step = 0; step < 8; step++) add(bar, step / 2, .055, 42, 'hat', step % 2 ? .06 : .085, .4);
  const kicks = bar % 8 === 7 ? [0, .75, 1.5, 2] : [0, .75, 2, 2.5];
  for (const offset of kicks) add(bar, offset, .13, 36, 'kick', .2 + build * .025);
  for (const offset of [1, 3]) add(bar, offset, .14, 38, 'snare', .2, -.18);
  if (bar % 4 === 3) {
    for (const offset of [3.25, 3.5, 3.75]) {
      add(bar, offset, .085, 38, 'snare', .09 + (offset - 3) * .15, -.18);
    }
  }
});

export const LATE_STAGE_MUSIC = {
  manor,
  gardens,
  gingerbread,
  volcano,
} satisfies Record<LateTrackId, StageMusic>;
