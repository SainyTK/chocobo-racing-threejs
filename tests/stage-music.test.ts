import { describe, expect, it } from 'vitest';
import { TRACK_IDS } from '../shared/track/tracks.ts';
import { MENU_MUSIC, STAGE_MUSIC } from '../src/music/index.ts';
import type { MusicVoice, MusicEvent } from '../src/music/types.ts';
import { MENU_MUSIC as PREVIOUS_MENU, STAGE_MUSIC as PREVIOUS_STAGES } from '../studio/music/previous.ts';

const voices: MusicVoice[] = ['flute', 'brass', 'strings', 'bell', 'organ', 'pluck', 'bass', 'kick', 'snare', 'hat', 'piano', 'guitar', 'synth', 'ghost'];
const percussion = new Set<MusicVoice>(['kick', 'snare', 'hat']);

describe('original stage scores', () => {
  it('covers exactly the eight playable stages with separate compositions', () => {
    expect(Object.keys(STAGE_MUSIC).sort()).toEqual([...TRACK_IDS].sort());
    expect(new Set(Object.values(STAGE_MUSIC).map(score => score.title)).size).toBe(8);
    expect(new Set(Object.values(STAGE_MUSIC).map(score => JSON.stringify(score.events))).size).toBe(8);
  });

  for (const id of TRACK_IDS) {
    it(`${id} has a complete, valid multi-part loop`, () => {
      const score = STAGE_MUSIC[id];
      expect(score.id).toBe(id);
      expect(score.bpm).toBeGreaterThanOrEqual(60);
      expect(score.bpm).toBeLessThanOrEqual(200);
      expect(score.beats).toBeGreaterThanOrEqual(128);
      expect(score.beats % 4).toBe(0);
      expect(score.events.length).toBeGreaterThan(100);
      const used = new Set(score.events.map(event => event.voice));
      expect(used.has('bass')).toBe(true);
      expect([...used].some(voice => percussion.has(voice))).toBe(true);
      expect([...used].filter(voice => !percussion.has(voice)).length).toBeGreaterThanOrEqual(3);
      for (const event of score.events) {
        expect(Number.isFinite(event.beat)).toBe(true);
        expect(event.beat).toBeGreaterThanOrEqual(0);
        expect(event.duration).toBeGreaterThan(0);
        expect(event.beat + event.duration).toBeLessThanOrEqual(score.beats + 1e-8);
        expect(voices).toContain(event.voice);
        expect(Number.isInteger(event.note)).toBe(true);
        expect(event.note).toBeGreaterThanOrEqual(0);
        expect(event.note).toBeLessThanOrEqual(127);
        expect(event.volume).toBeGreaterThan(0);
        expect(event.volume).toBeLessThanOrEqual(1);
        expect(Math.abs(event.pan ?? 0)).toBeLessThanOrEqual(1);
      }
      // Each quarter of the loop contains pitched material, not just a long silent tail.
      for (let quarter = 0; quarter < 4; quarter++) {
        expect(score.events.some(event => !percussion.has(event.voice)
          && event.beat >= quarter * score.beats / 4
          && event.beat < (quarter + 1) * score.beats / 4)).toBe(true);
      }
    });
  }

  it('changes the writing of every score, not just its title or tempo', () => {
    for (const id of TRACK_IDS) {
      expect(STAGE_MUSIC[id].title).toBe(PREVIOUS_STAGES[id].title);
      expect(STAGE_MUSIC[id].events).not.toEqual(PREVIOUS_STAGES[id].events);
      const pitched = (events: readonly MusicEvent[]) => events
        .filter(event => !percussion.has(event.voice) && event.voice !== 'bass')
        .map(event => [event.beat, event.duration, event.note, event.voice]);
      expect(pitched(STAGE_MUSIC[id].events)).not.toEqual(pitched(PREVIOUS_STAGES[id].events));
    }
    expect(MENU_MUSIC.events).not.toEqual(PREVIOUS_MENU.events);
    expect(MENU_MUSIC.bpm).toBeGreaterThan(PREVIOUS_MENU.bpm);
    expect(STAGE_MUSIC.forest.bpm).toBeGreaterThan(PREVIOUS_STAGES.forest.bpm);
    expect(STAGE_MUSIC.mines.bpm).toBeGreaterThan(PREVIOUS_STAGES.mines.bpm);
  });

  it('uses the distinct instrument roles requested for the revision', () => {
    expect(STAGE_MUSIC.forest.events.some(event => event.voice === 'flute' && event.note < 72)).toBe(true);
    expect(STAGE_MUSIC.gardens.events.some(event => event.voice === 'synth')).toBe(true);
    expect(STAGE_MUSIC.manor.events.some(event => event.voice === 'ghost')).toBe(true);
    expect(STAGE_MUSIC.gingerbread.events.some(event => event.voice === 'piano')).toBe(true);
    expect(STAGE_MUSIC.volcano.events.some(event => event.voice === 'guitar')).toBe(true);
    expect(MENU_MUSIC.events.some(event => percussion.has(event.voice))).toBe(true);
  });

  it('keeps the menu composition separate from course music', () => {
    expect(MENU_MUSIC.id).toBe('menu');
    expect(MENU_MUSIC.events.length).toBeGreaterThan(0);
    for (const score of Object.values(STAGE_MUSIC)) expect(MENU_MUSIC.events).not.toBe(score.events);
  });
});
