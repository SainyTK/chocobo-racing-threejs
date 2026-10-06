import { describe, expect, it, vi } from 'vitest';
import { StudioMusicPlayer } from '../studio/music-player.ts';
import { MENU_MUSIC, STAGE_MUSIC } from '../src/music/index.ts';
import type { AudioEngine } from '../src/audio.ts';
import { music } from '../studio/elements/music.ts';
import { TRACK_IDS } from '../shared/track/index.ts';

function setup() {
  const audio = { unlock: vi.fn(), restartMusic: vi.fn(), setVolume: vi.fn(), update: vi.fn(),
    playback: { scoreId: null, running: false, positionSeconds: 0, activeMusicVoices: 0, activeEffectVoices: 0, scheduledNotes: 0 } };
  return { audio, player: new StudioMusicPlayer(audio as unknown as AudioEngine) };
}

describe('studio music', () => {
  it('registers the menu and every course with the exact game scores', () => {
    expect(music.map(e => e.id)).toEqual(['music.menu', ...TRACK_IDS.map(id => `music.${id}`)]);
    expect(music[0].music).toBe(MENU_MUSIC);
    for (const id of TRACK_IDS) expect(music.find(e => e.id === `music.${id}`)?.music).toBe(STAGE_MUSIC[id]);
    expect(music.every(e => e.category === 'Music')).toBe(true);
  });

  it('does not autoplay on selection or playback updates', () => {
    const { audio, player } = setup();
    player.select(STAGE_MUSIC.forest); player.update();
    expect(audio.unlock).not.toHaveBeenCalled();
    expect(audio.update).toHaveBeenLastCalledWith(true, 'forest', true);
    player.toggle();
    expect(audio.unlock).toHaveBeenCalledOnce();
    expect(audio.update).toHaveBeenLastCalledWith(true, 'forest', false);
    player.toggle();
    expect(audio.update).toHaveBeenLastCalledWith(true, 'forest', true);
  });

  it('plays only the selected pane, and stops when leaving music', () => {
    const { audio, player } = setup();
    player.select(STAGE_MUSIC.test); player.toggle();
    player.select(STAGE_MUSIC.volcano);
    expect(audio.update).toHaveBeenLastCalledWith(true, 'volcano', false);
    expect(audio.restartMusic).toHaveBeenCalledTimes(2);
    player.select(null);
    expect(audio.update).toHaveBeenLastCalledWith(false, undefined, true);
    expect(player.status.playing).toBe(false);
    player.select(MENU_MUSIC);
    expect(audio.update).toHaveBeenLastCalledWith(false, undefined, true);
    player.toggle(); expect(audio.update).toHaveBeenLastCalledWith(false, undefined, false);
  });

  it('freezes music for global pause or hidden documents without losing play intent', () => {
    const { audio, player } = setup();
    player.select(MENU_MUSIC); player.toggle();
    player.update(true, false); expect(audio.update).toHaveBeenLastCalledWith(false, undefined, true);
    player.update(false, true); expect(audio.update).toHaveBeenLastCalledWith(false, undefined, true);
    player.update(false, false); expect(audio.update).toHaveBeenLastCalledWith(false, undefined, false);
    expect(player.status.playing).toBe(true);
  });

  it('restarts without autoplay and forwards volume changes', () => {
    const { audio, player } = setup();
    player.select(MENU_MUSIC); audio.restartMusic.mockClear(); player.restart();
    expect(audio.restartMusic).toHaveBeenCalledOnce();
    expect(audio.update).toHaveBeenLastCalledWith(false, undefined, true);
    expect(audio.unlock).not.toHaveBeenCalled();
    player.setVolume(.4); expect(audio.setVolume).toHaveBeenCalledWith(.4);
  });
});
