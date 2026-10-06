import { describe, expect, it, vi } from 'vitest';
import { StudioMusicPlayer } from '../studio/music-player.ts';
import { MENU_MUSIC, STAGE_MUSIC } from '../src/music/index.ts';
import { MENU_MUSIC as PREVIOUS_MENU, STAGE_MUSIC as PREVIOUS_STAGES } from '../studio/music/previous.ts';
import { musicForVariant } from '../studio/music/review.ts';
import type { AudioEngine } from '../src/audio.ts';
import { music } from '../studio/elements/music.ts';
import { TRACK_IDS } from '../shared/track/index.ts';

function setup() {
  const audio = { unlock: vi.fn(), restartMusic: vi.fn(), setVolume: vi.fn(), update: vi.fn(),
    playback: { scoreId: null, running: false, positionSeconds: 0, activeMusicVoices: 0, activeEffectVoices: 0, scheduledNotes: 0 } };
  return { audio, player: new StudioMusicPlayer(audio as unknown as AudioEngine) };
}

describe('studio music', () => {
  it('registers the menu and every course with game scores and studio-only previous versions', () => {
    expect(music.map(e => e.id)).toEqual(['music.menu', ...TRACK_IDS.map(id => `music.${id}`)]);
    expect(music[0].music).toBe(MENU_MUSIC); expect(music[0].previousMusic).toBe(PREVIOUS_MENU);
    for (const id of TRACK_IDS) {
      const entry = music.find(e => e.id === `music.${id}`)!;
      expect(entry.music).toBe(STAGE_MUSIC[id]); expect(entry.previousMusic).toBe(PREVIOUS_STAGES[id]);
    }
    for (const entry of music) {
      expect(entry.category).toBe('Music');
      expect(entry.variants.filter(v => v.inGame).map(v => v.id)).toEqual(['score']);
      expect(musicForVariant(entry, 'score')).toBe(entry.music);
      expect(musicForVariant(entry, 'previous')).toBe(entry.previousMusic);
      expect(entry.musicReference?.track).toBeGreaterThan(0);
    }
  });

  it('does not autoplay on selection or playback updates', () => {
    const { audio, player } = setup();
    player.select(STAGE_MUSIC.forest); player.update();
    expect(audio.unlock).not.toHaveBeenCalled();
    expect(audio.update).toHaveBeenLastCalledWith(true, 'forest', true, STAGE_MUSIC.forest);
    player.toggle();
    expect(audio.unlock).toHaveBeenCalledOnce();
    expect(audio.update).toHaveBeenLastCalledWith(true, 'forest', false, STAGE_MUSIC.forest);
    player.toggle();
    expect(audio.update).toHaveBeenLastCalledWith(true, 'forest', true, STAGE_MUSIC.forest);
  });

  it('plays only the selected pane, and stops when leaving music', () => {
    const { audio, player } = setup();
    player.select(STAGE_MUSIC.test); player.toggle();
    player.select(STAGE_MUSIC.volcano);
    expect(audio.update).toHaveBeenLastCalledWith(true, 'volcano', false, STAGE_MUSIC.volcano);
    expect(audio.restartMusic).toHaveBeenCalledTimes(2);
    player.select(null);
    expect(audio.update).toHaveBeenLastCalledWith(false, undefined, true, undefined);
    expect(player.status.playing).toBe(false);
    player.select(MENU_MUSIC);
    expect(audio.update).toHaveBeenLastCalledWith(false, undefined, true, MENU_MUSIC);
    player.toggle(); expect(audio.update).toHaveBeenLastCalledWith(false, undefined, false, MENU_MUSIC);
  });

  it('switches between old and revised scores with the same course ID', () => {
    const { audio, player } = setup();
    player.select(STAGE_MUSIC.forest); player.toggle(); player.select(PREVIOUS_STAGES.forest);
    expect(audio.update).toHaveBeenLastCalledWith(true, 'forest', false, PREVIOUS_STAGES.forest);
    expect(player.status.selectedBpm).toBe(PREVIOUS_STAGES.forest.bpm);
    expect(audio.restartMusic).toHaveBeenCalledTimes(2);
    player.select(PREVIOUS_STAGES.forest);
    expect(audio.restartMusic).toHaveBeenCalledTimes(2);
  });

  it('freezes music for global pause or hidden documents without losing play intent', () => {
    const { audio, player } = setup();
    player.select(MENU_MUSIC); player.toggle();
    player.update(true, false); expect(audio.update).toHaveBeenLastCalledWith(false, undefined, true, MENU_MUSIC);
    player.update(false, true); expect(audio.update).toHaveBeenLastCalledWith(false, undefined, true, MENU_MUSIC);
    player.update(false, false); expect(audio.update).toHaveBeenLastCalledWith(false, undefined, false, MENU_MUSIC);
    expect(player.status.playing).toBe(true);
  });

  it('restarts without autoplay and forwards volume changes', () => {
    const { audio, player } = setup();
    player.select(MENU_MUSIC); audio.restartMusic.mockClear(); player.restart();
    expect(audio.restartMusic).toHaveBeenCalledOnce();
    expect(audio.update).toHaveBeenLastCalledWith(false, undefined, true, MENU_MUSIC);
    expect(audio.unlock).not.toHaveBeenCalled();
    player.setVolume(.4); expect(audio.setVolume).toHaveBeenCalledWith(.4);
  });
});
