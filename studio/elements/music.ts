import { TRACK_IDS, TRACKS } from '../../shared/track/index.ts';
import { MENU_MUSIC, STAGE_MUSIC } from '../../src/music/index.ts';
import { MENU_MUSIC as PREVIOUS_MENU, STAGE_MUSIC as PREVIOUS_STAGES } from '../music/previous.ts';
import type { StudioElement } from '../types.ts';
import type { StageMusic } from '../../src/music/types.ts';

const references = {
  test: { track: 17, title: "Cid's Test Track", direction: 'Bright racing hook, clipped chord hits and a punchy rhythm.' },
  forest: { track: 18, title: 'Moogle Forest', direction: 'Lower flute melody over faster, light rhythmic backing.' },
  gate: { track: 19, title: 'The Ancient Gate', direction: 'Interlocking battle riffs, string pulse and brass answers.' },
  mines: { track: 20, title: 'Mythril Mines', direction: 'Fast keyboard-led dungeon pulse and moving bass.' },
  manor: { track: 21, title: 'The Black Manor', direction: 'Chromatic keyboard phrases with quiet ghost-like accents.' },
  gardens: { track: 22, title: 'Mysidian Floating Gardens', direction: 'Lyrical synth lead and an airy, brisk racing beat.' },
  gingerbread: { track: 23, title: 'Gingerbread Land', direction: 'Swung jazz phrases, walking bass and offbeat piano chords.' },
  volcano: { track: 24, title: 'Vulcan-O Valley', direction: 'Urgent minor-key riffs, driving drums and guitar/synth answers.' },
};

function entry(id: string, name: string, score: StageMusic, previous: StageMusic,
  reference: NonNullable<StudioElement['musicReference']>): StudioElement {
  return {
    id, name, category: 'Music', music: score, previousMusic: previous, musicReference: reference,
    tags: ['soundtrack', 'bgm', score.title, reference.title],
    variants: [{ id: 'score', label: 'Revised composition', inGame: true }, { id: 'previous', label: 'Previous composition' }],
    create: () => ({}),
  };
}

/** One central player handles comparison focus; no pane creates its own audio context. */
export const music: StudioElement[] = [
  entry('music.menu', 'Menu music', MENU_MUSIC, PREVIOUS_MENU,
    { track: 2, title: "Chocobo Choosin'", direction: 'Jaunty selection groove, a bright hook and syncopated bass.' }),
  ...TRACK_IDS.map(id => entry(`music.${id}`, TRACKS[id].name, STAGE_MUSIC[id], PREVIOUS_STAGES[id], references[id])),
];
