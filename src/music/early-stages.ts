import type { TrackId } from '../../shared/track/types.ts';
import type { MusicEvent, MusicVoice, StageMusic } from './types.ts';

type MelodyNote = readonly [note: number | null, duration: number];
type MelodyBar = readonly MelodyNote[];
type Chord = readonly [root: number, third: number, fifth: number];
type EarlyTrackId = Extract<TrackId, 'test' | 'forest' | 'gate' | 'mines'>;

interface Composition {
  id: EarlyTrackId;
  title: string;
  bpm: number;
  lead: MusicVoice;
  a: readonly MelodyBar[];
  b: readonly MelodyBar[];
  harmonyA: readonly Chord[];
  harmonyB: readonly Chord[];
}

// Original four-beat phrases; the brief informs instrument roles and grooves.
// Tempos are arrangement decisions, with no transcription of reference melodies.
const test: Composition = {
  id: 'test', title: 'Open Throttle', bpm: 164, lead: 'brass',
  a: [
    [[null, .25], [79, .25], [79, .5], [76, .75], [77, .25], [79, .5], [null, .5], [72, 1]],
    [[74, .75], [76, .25], [74, .5], [null, .5], [71, .5], [72, .5], [74, .75], [null, .25]],
    [[76, .5], [null, .25], [79, .25], [81, 1], [79, .5], [76, .5], [74, .5], [null, .5]],
    [[77, .25], [76, .25], [74, .5], [71, .5], [null, .5], [74, .75], [79, .25], [77, .5], [null, .5]],
    [[79, .5], [79, .25], [null, .25], [84, .75], [83, .25], [81, .5], [79, .5], [76, 1]],
    [[77, .75], [81, .25], [79, .5], [null, .5], [76, .25], [77, .25], [74, 1], [null, .5]],
    [[74, .5], [76, .5], [79, .75], [81, .25], [79, .5], [null, .5], [77, .5], [76, .5]],
    [[74, .75], [71, .25], [74, .5], [null, .5], [79, .5], [77, .25], [74, .25], [71, .5], [null, .5]],
  ],
  b: [
    [[81, 1.25], [79, .25], [76, .5], [null, .5], [79, .75], [81, .25], [83, .5]],
    [[84, .75], [83, .25], [79, 1], [76, .5], [null, .5], [74, 1]],
    [[77, .5], [81, .5], [84, .75], [83, .25], [81, .75], [79, .25], [77, .5], [null, .5]],
    [[76, 1], [74, .25], [76, .25], [79, .5], [77, .5], [74, .5], [null, 1]],
    [[81, .5], [null, .5], [79, .75], [76, .25], [74, .5], [76, .5], [79, 1]],
    [[77, .75], [79, .25], [81, 1], [84, .5], [83, .5], [81, .5], [null, .5]],
    [[79, .5], [76, .25], [74, .25], [72, 1], [74, .75], [76, .25], [77, .5], [79, .5]],
    [[83, .5], [81, .5], [79, .75], [77, .25], [74, .5], [71, .5], [null, .5], [79, .5]],
  ],
  harmonyA: [[48, 52, 55], [55, 59, 62], [45, 48, 52], [55, 59, 62],
    [48, 52, 55], [53, 57, 60], [50, 53, 57], [55, 59, 62]],
  harmonyB: [[45, 48, 52], [52, 56, 59], [53, 57, 60], [48, 52, 55],
    [50, 53, 57], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
};

const forest: Composition = {
  id: 'forest', title: 'Canopy Daylight', bpm: 142, lead: 'flute',
  a: [
    [[65, 1.5], [67, .5], [69, 1.5], [null, .5]],
    [[67, .5], [65, 1], [62, .5], [64, 1], [null, 1]],
    [[62, 1], [65, .5], [67, .5], [69, 1], [67, 1]],
    [[64, 1.5], [62, .5], [60, 1.5], [null, .5]],
    [[65, .5], [69, 1.5], [70, .5], [69, 1], [null, .5]],
    [[67, 1], [65, .5], [62, .5], [60, 1], [62, 1]],
    [[64, 1.5], [65, .5], [67, 1.5], [null, .5]],
    [[64, .5], [62, .5], [60, 1], [62, .5], [64, .5], [null, 1]],
  ],
  b: [
    [[69, 2], [72, .5], [70, .5], [69, 1]],
    [[67, 1.5], [65, .5], [64, 1], [null, 1]],
    [[65, 1], [69, 1.5], [67, .5], [65, 1]],
    [[62, 1.5], [64, .5], [65, 1.5], [null, .5]],
    [[70, 1], [69, .5], [67, .5], [65, 1.5], [null, .5]],
    [[64, .5], [65, .5], [67, 1.5], [69, .5], [67, 1]],
    [[65, 1], [62, 1], [64, .5], [65, .5], [67, 1]],
    [[64, 1.5], [60, .5], [62, 1], [null, .5], [64, .5]],
  ],
  harmonyA: [[41, 45, 48], [48, 52, 55], [38, 41, 45], [45, 48, 52],
    [46, 50, 53], [41, 45, 48], [43, 46, 50], [48, 52, 55]],
  harmonyB: [[46, 50, 53], [48, 52, 55], [41, 45, 48], [38, 41, 45],
    [46, 50, 53], [43, 46, 50], [41, 45, 48], [48, 52, 55]],
};

const gate: Composition = {
  id: 'gate', title: 'Stone Standard', bpm: 156, lead: 'brass',
  a: [
    [[null, .5], [69, .5], [69, .25], [70, .25], [69, .5], [null, 1], [64, .5], [67, .5]],
    [[68, .75], [64, .25], [null, .5], [68, .5], [71, .5], [68, .5], [null, 1]],
    [[72, .5], [71, .25], [69, .25], [null, 1], [67, .5], [69, .5], [72, .5], [null, .5]],
    [[71, .75], [68, .25], [64, .5], [null, .5], [65, .25], [64, .25], [68, .5], [null, 1]],
    [[69, .5], [null, .5], [76, .75], [74, .25], [72, .5], [null, .5], [69, 1]],
    [[70, .25], [69, .25], [65, .5], [null, 1], [70, .75], [72, .25], [74, .5], [null, .5]],
    [[71, .5], [69, .5], [67, .75], [65, .25], [64, .5], [67, .5], [null, 1]],
    [[68, .5], [71, .5], [68, .5], [null, .5], [64, .75], [65, .25], [68, .5], [null, .5]],
  ],
  b: [
    [[72, 1], [76, .5], [74, .5], [72, .75], [71, .25], [null, 1]],
    [[74, .75], [77, .25], [76, .5], [74, .5], [null, .5], [72, .5], [69, 1]],
    [[71, .5], [74, .5], [77, 1], [76, .5], [74, .5], [71, .5], [null, .5]],
    [[68, 1], [71, .5], [76, .5], [74, .5], [71, .5], [null, 1]],
    [[77, .75], [76, .25], [72, .5], [null, .5], [74, .75], [72, .25], [69, 1]],
    [[74, .5], [72, .5], [70, .75], [69, .25], [65, .5], [69, .5], [null, 1]],
    [[71, .5], [74, .5], [71, .5], [67, .5], [65, .75], [64, .25], [null, 1]],
    [[68, .75], [71, .25], [76, .5], [null, .5], [74, .5], [71, .5], [68, .5], [null, .5]],
  ],
  harmonyA: [[45, 48, 52], [40, 44, 47], [48, 52, 55], [40, 44, 47],
    [45, 48, 52], [46, 50, 53], [43, 47, 50], [40, 44, 47]],
  harmonyB: [[41, 45, 48], [38, 41, 45], [43, 47, 50], [40, 44, 47],
    [41, 45, 48], [46, 50, 53], [43, 47, 50], [40, 44, 47]],
};

const mines: Composition = {
  id: 'mines', title: 'Copper Depths', bpm: 172, lead: 'organ',
  a: [
    [[72, .25], [71, .25], [72, .5], [67, .5], [null, .25], [70, .25], [68, .5], [67, .5], [65, .5], [null, .5]],
    [[63, .5], [65, .25], [67, .25], [68, .75], [67, .25], [65, .5], [63, .5], [62, .5], [null, .5]],
    [[65, .25], [67, .25], [65, .5], [72, .75], [70, .25], [68, .5], [67, .25], [65, .25], [62, .5], [null, .5]],
    [[71, .5], [67, .25], [66, .25], [67, .5], [null, .5], [74, .75], [71, .25], [67, .5], [null, .5]],
    [[72, .5], [75, .25], [74, .25], [72, .75], [70, .25], [67, .5], [68, .25], [67, .25], [65, .5], [null, .5]],
    [[68, .75], [67, .25], [63, .5], [65, .5], [68, .25], [70, .25], [72, .5], [70, .5], [null, .5]],
    [[65, .5], [62, .25], [65, .25], [68, .5], [71, .5], [74, .75], [72, .25], [71, .5], [null, .5]],
    [[74, .25], [71, .25], [67, .5], [66, .25], [67, .25], [71, .5], [70, .5], [67, .5], [62, .5], [null, .5]],
  ],
  b: [
    [[75, .75], [74, .25], [72, .5], [70, .5], [72, .25], [74, .25], [75, .5], [72, .5], [null, .5]],
    [[77, .5], [75, .25], [74, .25], [72, 1], [68, .5], [70, .5], [72, .5], [null, .5]],
    [[74, .25], [75, .25], [74, .5], [70, .5], [67, .5], [70, .75], [72, .25], [74, .5], [null, .5]],
    [[71, .75], [74, .25], [77, .5], [74, .5], [71, .25], [70, .25], [67, .5], [62, .5], [null, .5]],
    [[72, .5], [75, .5], [79, .75], [77, .25], [75, .5], [74, .5], [72, .5], [null, .5]],
    [[77, .25], [75, .25], [72, .5], [68, .75], [70, .25], [72, .5], [70, .5], [68, .5], [null, .5]],
    [[74, .5], [71, .5], [68, .25], [65, .25], [62, .5], [65, .75], [68, .25], [71, .5], [null, .5]],
    [[74, .5], [71, .25], [67, .25], [62, .5], [null, .5], [67, .25], [68, .25], [71, .5], [74, .5], [null, .5]],
  ],
  harmonyA: [[48, 51, 55], [44, 48, 51], [41, 44, 48], [43, 47, 50],
    [48, 51, 55], [44, 48, 51], [38, 41, 44], [43, 47, 50]],
  harmonyB: [[51, 55, 58], [41, 44, 48], [46, 50, 53], [43, 47, 50],
    [48, 51, 55], [44, 48, 51], [38, 41, 44], [43, 47, 50]],
};

function compose(piece: Composition): StageMusic {
  const beats = 128;
  const events: MusicEvent[] = [];
  const add = (beat: number, duration: number, note: number, voice: MusicVoice,
    volume: number, pan = 0): void => {
    events.push({ beat, duration, note, voice, volume, pan });
  };

  // A, answered A, contrasting B, then a fuller A with a loop turnaround.
  for (let bar = 0; bar < 32; bar++) {
    const start = bar * 4;
    const phraseBar = bar % 8;
    const bridge = bar >= 16 && bar < 24;
    const answered = bar >= 8 && bar < 16;
    const closing = bar >= 24;
    const transition = phraseBar === 7;
    const chord = (bridge ? piece.harmonyB : piece.harmonyA)[phraseBar];
    const melody = (bridge ? piece.b : piece.a)[phraseBar];
    const [root, third, fifth] = chord;
    const nextRoot = (bridge ? piece.harmonyB : piece.harmonyA)[(phraseBar + 1) % 8][0];
    let cursor = start;
    for (const [pitch, duration] of melody) {
      if (pitch !== null) {
        const voice = answered && phraseBar % 2 === 1
          ? piece.id === 'test' ? 'synth' : piece.id === 'mines' ? 'piano' : piece.lead
          : piece.lead;
        const length = piece.id === 'forest' ? .92 : piece.id === 'gate' ? .6 : .7;
        add(cursor, duration * length, pitch, voice, piece.id === 'forest' ? .46 : .48,
          piece.id === 'mines' ? -.14 : -.06);
      }
      cursor += duration;
    }

    if (piece.id === 'test') {
      const bass = [root - 12, root - 12, fifth - 12, root, third - 12, fifth - 12, nextRoot - 13];
      const offsets = [0, .75, 1.5, 2, 2.75, 3, 3.5];
      bass.forEach((pitch, index) => add(start + offsets[index], .3, pitch, 'bass', .34));
      for (const offset of [.5, 1.75, 2.5]) {
        add(start + offset, .18, third + 12, 'piano', .16, .3);
        add(start + offset, .18, fifth + 12, 'piano', .13, .3);
      }
      // A compact answering cell occupies the tail of every other bar.
      if (phraseBar % 2 === 1) {
        for (const [offset, pitch] of [[3, fifth + 12], [3.5, third + 12], [3.75, fifth + 12]]) {
          add(start + offset, .16, pitch, 'synth', closing ? .2 : .15, .24);
        }
      }
    } else if (piece.id === 'forest') {
      const backing = [fifth + 12, third + 12, root + 24, fifth + 12,
        third + 12, fifth + 12, root + 24, third + 12];
      backing.forEach((pitch, index) => add(start + index * .5 + .25, .2,
        pitch, 'pluck', index % 2 ? .11 : .14, .32));
      // A moving, quiet bass makes the flute's longer notes float over a fast beat.
      [root - 12, fifth - 12, third - 12, nextRoot - 13].forEach((pitch, index) =>
        add(start + index, .48, pitch, 'bass', index === 0 ? .29 : .24));
      if (bridge || closing) {
        add(start, 1.7, third + 12, 'strings', .075, -.32);
        add(start + 2, 1.7, fifth + 12, 'strings', .075, -.32);
      }
      if (answered || closing) add(start + 3.5, .3, fifth + 24, 'bell', .075, -.25);
    } else if (piece.id === 'gate') {
      // Short lower strings interlock with the brass's rests, without a chord pad.
      const riff = [root + 12, fifth + 12, root + 12, third + 12,
        root + 12, root + 13, fifth + 12, third + 12];
      riff.forEach((pitch, index) => add(start + index * .5, .22, pitch,
        'strings', index % 4 === 0 ? .26 : .18, -.3));
      for (const offset of [0, .75, 1.5, 2, 2.75, 3.5]) {
        add(start + offset, .25, (offset === 3.5 ? nextRoot - 13 : root - 12), 'bass', .36);
      }
      if (answered || bridge || closing) {
        for (const offset of [.25, 1.25, 2.25, 3.25]) {
          add(start + offset, .17, offset < 2 ? fifth + 12 : third + 12, 'organ', .13, .3);
        }
      }
    } else {
      // Eighth-note bass with a chromatic approach, under clipped keyboard phrases.
      const walking = [root - 12, fifth - 12, root, third - 12,
        root - 12, fifth - 12, nextRoot - 14, nextRoot - 13];
      walking.forEach((pitch, index) => add(start + index * .5, .29, pitch, 'bass', .34));
      for (const offset of [.75, 1.75, 2.75]) {
        add(start + offset, .19, third + 12, 'piano', .16, .3);
        add(start + offset, .19, fifth + 12, 'piano', .12, .3);
      }
      if (bridge || closing) {
        add(start + .5, .25, fifth + 12, 'synth', .12, .25);
        add(start + 2.5, .25, third + 12, 'synth', .12, .25);
      }
      if (transition) {
        [fifth + 12, fifth + 13, fifth + 14, fifth + 15].forEach((pitch, index) =>
          add(start + 3 + index * .25, .13, pitch, 'piano', .16 + index * .015, .3));
      }
    }

    const light = piece.id === 'forest';
    const kickOffsets = light ? [0, 2, 2.75]
      : piece.id === 'gate' ? [0, .75, 2, 2.75]
        : piece.id === 'mines' ? [0, 1.5, 2, 3.25] : [0, 1.5, 2];
    for (const offset of kickOffsets) add(start + offset, .14, 36, 'kick', light ? .18 : .34);
    for (const offset of [1, 3]) add(start + offset, .12, 38, 'snare', light ? .11 : .25);
    for (let step = 0; step < 8; step++) {
      const volume = light ? .075 : step % 2 ? .1 : .13;
      add(start + step * .5, .07, 42, 'hat', volume * (bridge ? .8 : 1), .18);
    }
    // A softer middle section and increasing fills mark the phrase boundaries.
    if (transition) {
      const offsets = light ? [3.5, 3.75] : closing ? [2.75, 3.25, 3.5, 3.75] : [3.25, 3.5, 3.75];
      offsets.forEach((offset, index) => add(start + offset, .08, light ? 42 : 38,
        light ? 'hat' : 'snare', light ? .08 * (bridge ? .8 : 1) : .13 + index * .035, -.12));
    }
  }

  events.sort((a, b) => a.beat - b.beat);
  return { id: piece.id, title: piece.title, bpm: piece.bpm, beats, events };
}

export const EARLY_STAGE_MUSIC = {
  test: compose(test),
  forest: compose(forest),
  gate: compose(gate),
  mines: compose(mines),
} satisfies Record<EarlyTrackId, StageMusic>;
