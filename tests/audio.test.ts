import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MusicEvent, MusicVoice, StageMusic } from '../src/music/types.ts';

const fixtures = vi.hoisted(() => {
  const event = (beat: number, note: number, voice: MusicVoice = 'flute'): MusicEvent => ({ beat, note, voice, duration: .2, volume: .5, pan: -.2 });
  const score = (id: StageMusic['id'], events: MusicEvent[], beats = 8): StageMusic => ({ id, title: id, bpm: 120, beats, events });
  const voices: MusicVoice[] = ['flute', 'brass', 'strings', 'bell', 'organ', 'pluck', 'bass', 'kick', 'snare', 'hat'];
  return {
    menu: score('menu', [event(0, 72), event(.5, 74), event(1, 76), event(2, 77)]),
    test: score('test', [event(0, 60), event(0, 64), event(.5, 67), event(1, 69), event(2, 71)]),
    forest: score('forest', voices.map((voice, i) => event(0, 60 + i, voice))),
    gate: score('gate', Array.from({ length: 150 }, (_, i) => event(0, 40 + i % 40, 'strings'))),
    mines: score('mines', [event(0, 48, 'bass'), event(3.9, 50, 'pluck')], 4),
  };
});
vi.mock('../src/music/index.ts', () => ({
  MENU_MUSIC: fixtures.menu,
  STAGE_MUSIC: { test: fixtures.test, forest: fixtures.forest, gate: fixtures.gate, mines: fixtures.mines },
}));
import { AudioEngine } from '../src/audio.ts';

class Param {
  value = 0;
  setValueAtTime = vi.fn((value: number, _at: number) => { this.value = value; });
  setTargetAtTime = vi.fn((value: number, _at: number, _constant: number) => { this.value = value; });
  linearRampToValueAtTime = vi.fn((_value: number, _at: number) => {});
  exponentialRampToValueAtTime = vi.fn((_value: number, _at: number) => {});
  cancelScheduledValues = vi.fn((_at: number) => {});
}
class Node {
  connections: Node[] = [];
  disconnect = vi.fn(() => {});
  connect(node: Node) { this.connections.push(node); return node; }
}
class Gain extends Node { gain = new Param(); }
class Filter extends Node { type = 'lowpass'; frequency = new Param(); }
class Panner extends Node { pan = new Param(); }
class Source extends Node {
  type = 'sine'; frequency = new Param(); detune = new Param(); buffer: Buffer | null = null;
  onended: (() => void) | null = null;
  start = vi.fn((_at: number) => {});
  stop = vi.fn((_at: number) => {});
  finish() { this.onended?.(); }
}
class Buffer {
  data: Float32Array;
  constructor(length: number) { this.data = new Float32Array(length); }
  getChannelData() { return this.data; }
}
class Context {
  currentTime = 0;
  state = 'running';
  sampleRate = 48000;
  destination = new Node();
  gains: Gain[] = []; sources: Source[] = []; filters: Filter[] = []; panners: Panner[] = []; buffers: Buffer[] = [];
  resume = vi.fn(async () => {});
  createGain() { const node = new Gain(); this.gains.push(node); return node; }
  createOscillator() { const node = new Source(); this.sources.push(node); return node; }
  createBufferSource() { const node = new Source(); this.sources.push(node); return node; }
  createBiquadFilter() { const node = new Filter(); this.filters.push(node); return node; }
  createStereoPanner() { const node = new Panner(); this.panners.push(node); return node; }
  createBuffer(_channels: number, length: number, _sampleRate: number) { const buffer = new Buffer(length); this.buffers.push(buffer); return buffer; }
  advance(time: number) {
    this.currentTime = time;
    for (const source of this.sources) {
      const end = source.stop.mock.calls.at(-1)?.[0];
      if (end !== undefined && end <= time && !source.disconnect.mock.calls.length) source.finish();
    }
  }
}
function setup() {
  const engine = new AudioEngine(); engine.unlock();
  return { engine, ctx: engine.context as unknown as Context };
}
function starts(ctx: Context) { return ctx.sources.map(source => source.start.mock.calls[0][0]); }

describe('score playback', () => {
  beforeEach(() => { vi.stubGlobal('AudioContext', Context); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('defers context creation until unlock and safely tolerates unavailable autoplay APIs', () => {
    const engine = new AudioEngine();
    engine.update(true, 'forest'); engine.effect('pickup');
    expect(engine.context).toBeNull();
    expect(engine.playback.scoreId).toBe('forest');
    vi.stubGlobal('AudioContext', undefined); vi.stubGlobal('webkitAudioContext', undefined);
    expect(() => engine.unlock()).not.toThrow();
    expect(engine.context).toBeNull();
  });

  it('restarts the current score at beat zero without stopping effects', () => {
    const { engine, ctx } = setup();
    engine.update(true, 'test'); ctx.advance(.4); engine.update(true, 'test');
    engine.effect('pickup');
    expect(engine.playback.positionSeconds).toBeGreaterThan(.3);
    engine.restartMusic();
    expect(engine.playback.positionSeconds).toBe(0);
    expect(engine.playback.activeMusicVoices).toBe(0);
    expect(engine.playback.activeEffectVoices).toBe(3);
    engine.update(true, 'test');
    expect(engine.playback.scoreId).toBe('test');
    expect(engine.playback.activeMusicVoices).toBe(2);
  });

  it('preserves volume across unlock and mute, and clamps invalid settings', () => {
    const engine = new AudioEngine(); engine.setVolume(.5); engine.unlock();
    const ctx = engine.context as unknown as Context;
    expect(ctx.gains[0].gain.value).toBe(.09);
    engine.setVolume(5); expect(ctx.gains[0].gain.value).toBe(.18);
    engine.setVolume(NaN); expect(ctx.gains[0].gain.value).toBe(.18);
    engine.setVolume(-2); expect(ctx.gains[0].gain.value).toBe(0);
    engine.setVolume(.25); engine.setEnabled(false); engine.setVolume(.5);
    expect(ctx.gains[0].gain.value).toBe(0);
    engine.setEnabled(true); expect(ctx.gains[0].gain.value).toBe(.09);
  });

  it('handles resume rejection and permits the next gesture to retry', async () => {
    const { engine, ctx } = setup();
    ctx.state = 'suspended'; ctx.resume.mockRejectedValueOnce(new Error('Gesture required'));
    engine.unlock(); await Promise.resolve();
    engine.update(true, 'test');
    expect(ctx.sources).toHaveLength(0);
    engine.unlock(); await Promise.resolve();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    ctx.state = 'running'; engine.update(true, 'test');
    expect(ctx.sources.length).toBeGreaterThan(0);
  });

  it('routes menu and stage music separately from effects and switches without stopping effects', () => {
    const { engine, ctx } = setup();
    engine.update(false);
    expect(engine.playback.scoreId).toBe('menu');
    const menu = [...ctx.sources];
    engine.effect('pickup');
    const effects = ctx.sources.slice(menu.length);
    const master = ctx.gains[0], musicBus = ctx.gains[1], effectsBus = ctx.gains[2];
    expect(master.connections).toEqual([ctx.destination]);
    expect(musicBus.connections).toEqual([master]);
    expect(effectsBus.connections).toEqual([master]);
    expect(ctx.panners.every(pan => pan.connections[0] === musicBus)).toBe(true);
    for (const effect of effects) expect((effect.connections[0] as Gain).connections[0]).toBe(effectsBus);
    engine.update(true, 'test');
    expect(engine.playback.scoreId).toBe('test');
    expect(menu.every(source => source.stop.mock.calls.at(-1)?.[0] === 0)).toBe(true);
    expect(menu.every(source => source.disconnect.mock.calls.length === 1)).toBe(true);
    expect(effects.every(source => source.stop.mock.calls.length === 1)).toBe(true);
    const course = ctx.sources.slice(menu.length + effects.length);
    engine.update(true, 'forest');
    expect(engine.playback.scoreId).toBe('forest');
    expect(course.every(source => source.disconnect.mock.calls.length === 1)).toBe(true);
    engine.update(false);
    expect(engine.playback.scoreId).toBe('menu');
  });

  it('plays chords together, schedules each note once, and keeps all starts within the horizon', () => {
    const { engine, ctx } = setup();
    engine.update(true, 'test');
    expect(engine.playback.activeMusicVoices).toBe(2);
    expect(new Set(starts(ctx)).size).toBe(1);
    const count = ctx.sources.length;
    for (let frame = 0; frame < 10; frame++) engine.update(true, 'test');
    expect(ctx.sources).toHaveLength(count);
    ctx.advance(.16); engine.update(true, 'test');
    const newStarts = starts(ctx).slice(count);
    expect(newStarts.length).toBeGreaterThan(0);
    expect(newStarts.every(at => at >= ctx.currentTime && at <= ctx.currentTime + .12)).toBe(true);
  });

  it('freezes race position on pause, keeps its score selected, and resumes at the next beat', () => {
    const { engine, ctx } = setup();
    engine.update(true, 'test'); ctx.advance(.1); engine.update(true, 'test', true);
    expect(engine.playback).toMatchObject({ scoreId: 'test', running: false, activeMusicVoices: 0 });
    const count = ctx.sources.length;
    ctx.advance(90); engine.update(true, 'test', true);
    expect(ctx.sources).toHaveLength(count);
    engine.update(true, 'test');
    expect(ctx.sources).toHaveLength(count);
    ctx.advance(90.17); engine.update(true, 'test');
    const resumed = ctx.sources.slice(count);
    expect(resumed).toHaveLength(2);
    expect(resumed[0].frequency.value).toBeCloseTo(440 * 2 ** ((67 - 69) / 12));
    expect(starts(ctx).slice(count).every(at => at >= 90.17 && at <= 90.29)).toBe(true);
  });

  it('honors the hidden-document pause flag on menu and handles track changes while paused', () => {
    const { engine, ctx } = setup();
    engine.update(false); engine.update(false, 'test', true);
    expect(engine.playback).toMatchObject({ scoreId: 'menu', activeMusicVoices: 0, running: false });
    engine.update(true, 'forest', true);
    expect(engine.playback.scoreId).toBe('forest');
    const count = ctx.sources.length;
    ctx.advance(20); engine.update(true, 'forest');
    expect(ctx.sources.length).toBeGreaterThan(count);
    expect(starts(ctx).slice(count).every(at => at === 20.015)).toBe(true);
  });

  it('mutes master immediately, cancels future music, and resumes without a backlog', () => {
    const { engine, ctx } = setup();
    engine.update(true, 'test'); ctx.advance(.16); engine.update(true, 'test');
    engine.effect('lap');
    engine.setEnabled(false);
    expect(ctx.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0, .16);
    expect(engine.playback.activeMusicVoices).toBe(0);
    expect(engine.playback.activeEffectVoices).toBe(3);
    const count = ctx.sources.length;
    ctx.advance(100); engine.update(true, 'test'); engine.effect('pickup');
    expect(ctx.sources).toHaveLength(count);
    engine.setEnabled(true); engine.update(true, 'test');
    expect(ctx.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(.18, 100);
    ctx.advance(100.05); engine.update(true, 'test');
    expect(starts(ctx).slice(count).every(at => at >= 100 && at <= 100.17)).toBe(true);
    expect(ctx.sources.length - count).toBeLessThanOrEqual(2);
  });

  it('freezes disabled music and a suspended context without disabling sound effects', () => {
    const { engine, ctx } = setup();
    engine.update(true, 'test'); engine.music = false; engine.update(true, 'test');
    expect(engine.playback.activeMusicVoices).toBe(0);
    engine.effect('pickup'); expect(engine.playback.activeEffectVoices).toBe(3);
    ctx.advance(30); engine.music = true; engine.update(true, 'test');
    expect(engine.playback.running).toBe(true);
    ctx.state = 'suspended'; engine.update(true, 'test');
    expect(engine.playback.activeMusicVoices).toBe(0);
  });

  it('skips stalled-frame catchup, seeks across many loops, and schedules loop seams once', () => {
    const { engine, ctx } = setup();
    engine.update(true, 'mines');
    ctx.advance(1.9); engine.update(true, 'mines');
    const firstLoop = starts(ctx);
    expect(firstLoop.some(at => Math.abs(at - 1.965) < 1e-8)).toBe(true);
    ctx.advance(1.96); engine.update(true, 'mines');
    expect(starts(ctx).filter(at => at === 2.015)).toHaveLength(1);
    const count = ctx.sources.length;
    ctx.advance(1000); engine.update(true, 'mines');
    expect(ctx.sources.length - count).toBe(1);
    expect(starts(ctx).slice(count).every(at => at >= 1000 && at <= 1000.12)).toBe(true);
  });

  it('bounds polyphony, scheduling work, effect count, and note lifetime', () => {
    const { engine, ctx } = setup();
    engine.update(true, 'gate');
    expect(engine.playback.activeMusicVoices).toBe(48);
    expect(ctx.sources).toHaveLength(96);
    engine.update(true, 'gate'); engine.update(true, 'gate');
    expect(ctx.sources).toHaveLength(96);
    expect(starts(ctx).every(at => at <= .12)).toBe(true);
    for (let i = 0; i < 100; i++) engine.tone(440, 100);
    expect(engine.playback.activeEffectVoices).toBe(32);
    expect(ctx.sources.every(source => source.stop.mock.calls[0][0] - source.start.mock.calls[0][0] <= 4.2)).toBe(true);
    ctx.advance(5);
    expect(engine.playback).toMatchObject({ activeMusicVoices: 0, activeEffectVoices: 0 });
    expect(ctx.sources.every(source => source.disconnect.mock.calls.length === 1)).toBe(true);
    expect(ctx.filters.every(filter => filter.disconnect.mock.calls.length === 1)).toBe(true);
    expect(ctx.panners.every(pan => pan.disconnect.mock.calls.length === 1)).toBe(true);
  });

  it('differentiates every instrument and reuses deterministic percussion noise', () => {
    const { engine, ctx } = setup(); engine.update(true, 'forest');
    expect(engine.playback.activeMusicVoices).toBe(10);
    expect(ctx.sources.filter(source => source.buffer)).toHaveLength(2);
    expect(ctx.buffers).toHaveLength(1);
    expect(ctx.sources.filter(source => source.buffer).every(source => source.buffer === ctx.buffers[0])).toBe(true);
    expect(ctx.filters.map(filter => [filter.type, filter.frequency.value])).toEqual([
      ['lowpass', 3600], ['lowpass', 1800], ['lowpass', 2500], ['lowpass', 9000],
      ['lowpass', 5000], ['lowpass', 4200], ['lowpass', 700], ['lowpass', 800],
      ['highpass', 1300], ['highpass', 7000],
    ]);
    expect(ctx.sources.some(source => source.frequency.exponentialRampToValueAtTime.mock.calls.length > 0)).toBe(true);
    expect(ctx.sources.some(source => Math.abs(source.detune.value) === 7)).toBe(true);
    expect(ctx.panners.every(pan => pan.pan.value === -.2)).toBe(true);
    engine.update(false); engine.update(true, 'forest');
    expect(ctx.buffers).toHaveLength(1);
    const second = setup(); second.engine.update(true, 'forest');
    expect(second.ctx.buffers[0].data).toEqual(ctx.buffers[0].data);
  });

  it('disconnects every part of a finished voice and never double-disconnects canceled nodes', () => {
    const { engine, ctx } = setup(); engine.update(true, 'test');
    const sources = [...ctx.sources];
    sources[0].finish(); expect(engine.playback.activeMusicVoices).toBe(2);
    sources[1].finish(); expect(engine.playback.activeMusicVoices).toBe(1);
    engine.update(false);
    sources.slice(2).forEach(source => source.finish());
    expect(sources.every(source => source.disconnect.mock.calls.length === 1)).toBe(true);
  });
});
