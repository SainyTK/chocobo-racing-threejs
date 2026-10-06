import { TRACK_IDS, TRACKS } from '../../shared/track/index.ts';
import { MENU_MUSIC, STAGE_MUSIC } from '../../src/music/index.ts';
import type { StudioElement } from '../types.ts';

/** Audio is controlled centrally by the studio, so comparison panes never play over each other. */
export const music: StudioElement[] = [
  { id: 'music.menu', name: 'Menu music', category: 'Music', music: MENU_MUSIC,
    tags: ['soundtrack', 'bgm', MENU_MUSIC.title], variants: [{ id: 'score', label: 'Original score', inGame: true }], create: () => ({}) },
  ...TRACK_IDS.map(id => ({
    id: `music.${id}`, name: TRACKS[id].name, category: 'Music' as const, music: STAGE_MUSIC[id],
    tags: ['soundtrack', 'bgm', STAGE_MUSIC[id].title],
    variants: [{ id: 'score', label: 'Original score', inGame: true }], create: () => ({}),
  })),
];
