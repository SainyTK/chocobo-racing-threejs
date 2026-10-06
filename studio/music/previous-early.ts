import type { TrackId } from '../../shared/track/types.ts';
import type { MusicEvent, MusicVoice, StageMusic } from '../../src/music/types.ts';

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

// Newly authored phrases, with pitch and rhythm independent of the reference tunes.
// Every melody bar contains four beats, including explicit rests.
const test: Composition = {
  id: 'test', title: 'Open Throttle', bpm: 152, lead: 'brass',
  a: [
    [[74, .5], [78, .5], [81, 1], [78, .5], [76, .5], [74, 1]],
    [[71, .5], [74, .5], [78, .75], [81, .25], [83, 1], [78, 1]],
    [[79, 1], [78, .5], [76, .5], [74, .5], [71, .5], [74, 1]],
    [[73, .5], [76, .5], [81, 1], [null, .5], [79, .5], [76, 1]],
    [[78, .75], [81, .25], [86, 1], [83, .5], [81, .5], [78, 1]],
    [[79, .5], [83, .5], [86, 1], [83, .5], [81, .5], [79, 1]],
    [[76, .5], [78, .5], [79, .5], [81, .5], [83, 1], [79, 1]],
    [[81, .5], [79, .5], [76, .5], [73, .5], [74, 1.5], [null, .5]],
  ],
  b: [
    [[83, 1.5], [81, .5], [78, 1], [74, 1]],
    [[79, .5], [78, .5], [76, 1], [71, .5], [74, .5], [79, 1]],
    [[78, 1], [76, .5], [74, .5], [73, 1], [76, 1]],
    [[81, .75], [83, .25], [85, 1], [81, 1], [null, 1]],
    [[86, 1], [83, .5], [81, .5], [79, 1], [83, 1]],
    [[78, .5], [74, .5], [71, 1], [74, .5], [78, .5], [81, 1]],
    [[79, .5], [81, .5], [83, 1], [81, .5], [79, .5], [76, 1]],
    [[73, 1], [76, .5], [79, .5], [81, 1.5], [null, .5]],
  ],
  harmonyA: [[50, 54, 57], [47, 50, 54], [43, 47, 50], [45, 49, 52],
    [50, 54, 57], [43, 47, 50], [52, 55, 59], [45, 49, 52]],
  harmonyB: [[47, 50, 54], [43, 47, 50], [42, 45, 49], [45, 49, 52],
    [43, 47, 50], [47, 50, 54], [52, 55, 59], [45, 49, 52]],
};

const forest: Composition = {
  id: 'forest', title: 'Canopy Daylight', bpm: 104, lead: 'flute',
  a: [
    [[74, 1.5], [71, .5], [69, 1], [67, 1]],
    [[69, 1], [72, .5], [76, .5], [74, 1.5], [null, .5]],
    [[71, 1], [74, 1], [79, 1], [76, 1]],
    [[78, 1.5], [76, .5], [74, 1], [69, 1]],
    [[71, .5], [74, .5], [76, 2], [74, .5], [71, .5]],
    [[72, 1.5], [71, .5], [69, 1], [67, 1]],
    [[69, .5], [71, .5], [74, 1], [72, 1], [69, 1]],
    [[71, 1], [69, .5], [66, .5], [67, 1.5], [null, .5]],
  ],
  b: [
    [[76, 2], [79, 1], [78, 1]],
    [[74, 1.5], [72, .5], [71, 1], [69, 1]],
    [[72, 1], [76, .5], [79, .5], [81, 1], [79, 1]],
    [[78, 1], [74, 1], [71, 1.5], [null, .5]],
    [[76, .5], [78, .5], [79, 1.5], [76, .5], [74, 1]],
    [[72, 1], [69, 1], [67, .5], [69, .5], [72, 1]],
    [[71, 1.5], [74, .5], [78, 1], [76, 1]],
    [[74, 1], [69, .5], [66, .5], [69, 1.5], [null, .5]],
  ],
  harmonyA: [[43, 47, 50], [45, 48, 52], [40, 43, 47], [38, 42, 45],
    [40, 43, 47], [36, 40, 43], [45, 48, 52], [38, 42, 45]],
  harmonyB: [[36, 40, 43], [43, 47, 50], [45, 48, 52], [47, 50, 54],
    [40, 43, 47], [36, 40, 43], [45, 48, 52], [38, 42, 45]],
};

const gate: Composition = {
  id: 'gate', title: 'Stone Standard', bpm: 144, lead: 'brass',
  a: [
    [[74, .75], [69, .25], [74, .5], [77, .5], [76, 1], [74, 1]],
    [[70, 1], [74, .5], [77, .5], [81, 1], [77, 1]],
    [[79, .5], [77, .5], [74, .75], [72, .25], [70, 1], [74, 1]],
    [[73, 1], [76, .5], [81, .5], [79, 1], [76, 1]],
    [[77, .5], [76, .5], [74, 1], [69, .5], [72, .5], [74, 1]],
    [[75, 1], [79, .5], [82, .5], [81, 1], [79, 1]],
    [[77, .75], [74, .25], [70, 1], [72, .5], [74, .5], [77, 1]],
    [[76, .5], [73, .5], [69, 1], [74, 1.5], [null, .5]],
  ],
  b: [
    [[81, 1.5], [79, .5], [77, 1], [76, 1]],
    [[79, 1], [82, .5], [81, .5], [79, .5], [77, .5], [75, 1]],
    [[77, .5], [81, .5], [84, 1], [81, 1], [77, 1]],
    [[76, 1.5], [73, .5], [69, 1], [null, 1]],
    [[82, .75], [81, .25], [79, 1], [77, .5], [74, .5], [70, 1]],
    [[75, .5], [77, .5], [79, 1], [82, .5], [79, .5], [75, 1]],
    [[77, 1], [76, .5], [74, .5], [72, 1], [70, 1]],
    [[73, .5], [76, .5], [79, 1], [81, 1], [73, 1]],
  ],
  harmonyA: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52],
    [50, 53, 57], [48, 51, 55], [46, 50, 53], [45, 49, 52]],
  harmonyB: [[41, 45, 48], [48, 51, 55], [41, 45, 48], [45, 49, 52],
    [46, 50, 53], [48, 51, 55], [43, 46, 50], [45, 49, 52]],
};

const mines: Composition = {
  id: 'mines', title: 'Copper Depths', bpm: 126, lead: 'organ',
  a: [
    [[64, .5], [67, .5], [66, 1], [64, .5], [59, .5], [62, 1]],
    [[60, 1.5], [64, .5], [67, 1], [66, 1]],
    [[62, .5], [65, .5], [69, 1], [65, .5], [64, .5], [62, 1]],
    [[63, 1], [66, .5], [71, .5], [69, 1], [66, 1]],
    [[67, 1], [66, .5], [64, .5], [59, 1], [64, 1]],
    [[65, .75], [64, .25], [60, 1], [62, .5], [64, .5], [65, 1]],
    [[66, .5], [69, .5], [72, 1], [69, .5], [66, .5], [63, 1]],
    [[66, 1], [63, .5], [59, .5], [64, 1.5], [null, .5]],
  ],
  b: [
    [[72, 2], [71, .5], [67, .5], [64, 1]],
    [[69, 1], [72, .5], [76, .5], [74, 1], [72, 1]],
    [[71, 1.5], [69, .5], [67, 1], [66, 1]],
    [[69, .5], [66, .5], [63, 1], [59, 1], [null, 1]],
    [[72, .75], [71, .25], [69, 1], [65, .5], [64, .5], [60, 1]],
    [[67, 1], [71, .5], [74, .5], [72, 1], [71, 1]],
    [[69, .5], [72, .5], [75, 1], [72, .5], [69, .5], [66, 1]],
    [[71, 1], [66, .5], [63, .5], [59, 1.5], [null, .5]],
  ],
  harmonyA: [[40, 43, 47], [36, 40, 43], [38, 41, 45], [35, 39, 42],
    [40, 43, 47], [33, 36, 40], [42, 45, 48], [35, 39, 42]],
  harmonyB: [[36, 40, 43], [33, 36, 40], [43, 47, 50], [35, 39, 42],
    [38, 41, 45], [40, 43, 47], [42, 45, 48], [35, 39, 42]],
};

function compose(piece: Composition): StageMusic {
  const beats = 128;
  const events: MusicEvent[] = [];
  const add = (beat: number, duration: number, note: number, voice: MusicVoice,
    volume: number, pan = 0): void => {
    events.push({ beat, duration, note, voice, volume, pan });
  };

  for (let bar = 0; bar < 32; bar++) {
    const start = bar * 4;
    const phraseBar = bar % 8;
    const bridge = bar >= 16 && bar < 24;
    const varied = bar >= 8 && bar < 16;
    const closing = bar >= 24;
    const chord = (bridge ? piece.harmonyB : piece.harmonyA)[phraseBar];
    const melody = (bridge ? piece.b : piece.a)[phraseBar];
    const [root, third, fifth] = chord;
    let cursor = start;
    for (const [pitch, duration] of melody) {
      if (pitch !== null) {
        // The second A answers the brass with a pluck; the return adds a quiet octave.
        const voice = varied && piece.id === 'test' ? 'pluck' : piece.lead;
        const gateLength = piece.id === 'forest' ? .93 : piece.id === 'mines' ? .82 : .72;
        add(cursor, duration * gateLength, pitch, voice, piece.id === 'forest' ? .48 : .53, -.08);
        if (closing && phraseBar >= 4) {
          add(cursor, duration * .65, pitch - 12, 'strings', .13, .2);
        }
      }
      cursor += duration;
    }

    if (piece.id === 'test') {
      // Alternating root/fifth bass and clipped offbeats leave space for the lead.
      for (let beat = 0; beat < 4; beat++) {
        add(start + beat, .65, (beat % 2 ? fifth : root) - 12, 'bass', .4);
        for (const pitch of chord) add(start + beat + .5, .28, pitch + 12, 'pluck', .18, .3);
      }
      if (bridge || closing) {
        add(start, 1.6, third + 12, 'strings', .14, -.35);
        add(start + 2, 1.6, fifth + 12, 'strings', .14, -.35);
      }
    } else if (piece.id === 'forest') {
      const arpeggio = [root, fifth, third + 12, fifth, root + 12, fifth, third + 12, fifth];
      arpeggio.forEach((pitch, index) => add(start + index * .5, .42, pitch + 12,
        'pluck', index % 2 ? .12 : .16, .35));
      add(start, 1.8, root - 12, 'bass', .28);
      add(start + 2, 1.7, fifth - 12, 'bass', .24);
      for (const pitch of chord) add(start, 3.75, pitch + 12, 'strings', .085, -.3);
      if (bridge || (closing && phraseBar % 2 === 1)) {
        add(start + 2.5, .8, fifth + 24, 'bell', .09, -.4);
      }
    } else if (piece.id === 'gate') {
      for (let step = 0; step < 8; step++) {
        add(start + step * .5, .34, (step % 4 === 3 ? fifth : root) - 12, 'bass', .4);
      }
      for (const offset of [0, 1.5, 2, 3.5]) {
        for (const pitch of chord) add(start + offset, .3, pitch + 12, 'brass', .14, .35);
      }
      for (const pitch of chord) add(start, 3.8, pitch, 'strings', bridge ? .14 : .1, -.35);
      if (varied || closing) {
        add(start + 1, .75, fifth + 12, 'organ', .12, -.3);
        add(start + 3, .65, third + 12, 'organ', .12, -.3);
      }
    } else {
      const ostinato = [root, fifth, root + 12, third, fifth, third, root + 12, fifth];
      ostinato.forEach((pitch, index) => add(start + index * .5, .34, pitch,
        'strings', index % 2 ? .2 : .26, -.25));
      add(start, 1.7, root - 12, 'bass', .4);
      add(start + 2, 1.7, root - 12, 'bass', .36);
      add(start + (phraseBar % 2 ? 2.75 : .75), .65, fifth + 24, 'bell', .16, .4);
      if (bridge || closing) add(start + 1.5, .45, third + 24, 'bell', .11, -.4);
      if (varied || bridge) {
        for (const pitch of chord) add(start, 3.6, pitch + 12, 'organ', .075, .25);
      }
    }

    // Each course uses its own groove, with short fills at phrase boundaries.
    if (piece.id === 'forest') {
      add(start, .16, 36, 'kick', .2);
      add(start + 2, .14, 38, 'snare', .12);
      for (const offset of [.5, 1.5, 2.5, 3.5]) add(start + offset, .1, 42, 'hat', .1, .2);
    } else if (piece.id === 'mines') {
      for (const offset of [0, 1.75, 2.5]) add(start + offset, .18, 36, 'kick', .36);
      add(start + 2, .17, 38, 'snare', .22);
      for (const offset of [.5, 1.5, 3, 3.5]) add(start + offset, .1, 42, 'hat', .16, .25);
    } else {
      for (const offset of piece.id === 'gate' ? [0, .75, 2, 2.75] : [0, 2]) {
        add(start + offset, .18, 36, 'kick', .37);
      }
      for (const offset of [1, 3]) add(start + offset, .16, 38, 'snare', .29);
      for (let step = 0; step < 8; step++) {
        add(start + step * .5, .09, 42, 'hat', step % 2 ? .12 : .16, .2);
      }
    }
    if (phraseBar === 7) {
      const voice = piece.id === 'forest' ? 'hat' : 'snare';
      for (const offset of [3.25, 3.5, 3.75]) add(start + offset, .1, 38, voice, .15, -.15);
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
