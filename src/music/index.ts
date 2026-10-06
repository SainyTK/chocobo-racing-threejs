import { EARLY_STAGE_MUSIC } from './early-stages.ts';
import { LATE_STAGE_MUSIC } from './late-stages.ts';
import type { MusicEvent, StageMusic } from './types.ts';
import type { TrackId } from '../../shared/track/types.ts';

export const STAGE_MUSIC: Record<TrackId, StageMusic> = { ...EARLY_STAGE_MUSIC, ...LATE_STAGE_MUSIC };

// Original menu score: two sixteen-bar phrases with a quieter answering phrase.
const events: MusicEvent[] = [];
const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
const phrases = [
  [72, 76, 79, 76, 74, 72, 69, 71, 72, 74, 76, 79, 77, 76, 74, 72],
  [79, 81, 79, 76, 77, 76, 72, 74, 76, 74, 72, 69, 71, 74, 71, 72],
];
for (let bar = 0; bar < 32; bar++) {
  const beat = bar * 4;
  const chord = chords[Math.floor(bar / 2) % chords.length];
  chord.forEach((note, i) => events.push({ beat, duration: 3.7, note, voice: 'strings', volume: .16, pan: (i - 1) * .3 }));
  events.push({ beat, duration: 2.8, note: chord[0] - 12, voice: 'bass', volume: .3 });
  for (let step = 0; step < 4; step++) {
    events.push({ beat: beat + step, duration: .7, note: chord[step % 3] + 12, voice: 'pluck', volume: .22, pan: .3 });
  }
  const melody = phrases[Math.floor(bar / 16)];
  const note = melody[bar % 16];
  events.push({ beat: beat + .5, duration: 1.3, note, voice: 'flute', volume: .42, pan: -.15 });
  if (bar % 2 === 1) events.push({ beat: beat + 2.5, duration: 1.1, note: melody[(bar + 1) % 16], voice: 'bell', volume: .24, pan: .2 });
}
export const MENU_MUSIC: StageMusic = {
  id: 'menu', title: 'A small journey', bpm: 96, beats: 128,
  events: events.sort((a, b) => a.beat - b.beat),
};
