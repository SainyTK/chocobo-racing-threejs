import { describe, expect, it } from 'vitest';
import { INSTRUMENTS } from '../src/music/instruments.ts';
import { MENU_MUSIC } from '../src/music/index.ts';

describe('procedural ensemble definitions', () => {
  it('keeps harmonics finite and positive, source count bounded and release tails short', () => {
    for (const instrument of Object.values(INSTRUMENTS)) {
      expect(instrument.partials.length).toBeGreaterThan(0);
      expect(instrument.partials.length).toBeLessThanOrEqual(4);
      expect(instrument.attack).toBeGreaterThan(0);
      expect(instrument.release).toBeGreaterThan(0);
      expect(instrument.release).toBeLessThanOrEqual(.16);
      expect(instrument.level).toBeGreaterThan(0);
      expect(instrument.level).toBeLessThanOrEqual(1);
      expect(instrument.sustain).toBeGreaterThan(0);
      expect(instrument.sustain).toBeLessThanOrEqual(1);
      expect(instrument.cutoff).toBeGreaterThan(0);
      expect(instrument.filterAttack).toBeGreaterThan(0);
      expect(instrument.filterAttack).toBeLessThanOrEqual(1);
      expect(instrument.filterSustain).toBeGreaterThan(0);
      expect(instrument.filterSustain).toBeLessThanOrEqual(1);
      for (const partial of instrument.partials) {
        expect(Number.isFinite(partial.ratio)).toBe(true);
        expect(partial.ratio).toBeGreaterThan(0);
        expect(Number.isFinite(partial.weight)).toBe(true);
        expect(partial.weight).toBeGreaterThan(0);
        expect(partial.sustain).toBeGreaterThan(0);
        expect(partial.sustain).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives low flute a dominant fundamental and keyboard/plucked overtones faster decay', () => {
    expect(INSTRUMENTS.flute.partials[0].weight).toBeGreaterThan(INSTRUMENTS.flute.partials[1].weight * 4);
    for (const voice of ['piano', 'guitar'] as const) {
      const partials = INSTRUMENTS[voice].partials;
      expect(partials.at(-1)!.sustain).toBeLessThan(partials[0].sustain);
      expect(INSTRUMENTS[voice].sustain).toBeLessThan(.1);
    }
  });
});

describe('selection score', () => {
  it('preserves menu metadata and writes legal events across a full loop', () => {
    expect(MENU_MUSIC).toMatchObject({ id: 'menu', title: 'A small journey', beats: 128 });
    expect(MENU_MUSIC.bpm).toBeGreaterThan(120);
    for (const event of MENU_MUSIC.events) {
      expect(Number.isFinite(event.beat)).toBe(true);
      expect(event.beat).toBeGreaterThanOrEqual(0);
      expect(event.duration).toBeGreaterThan(0);
      expect(event.beat + event.duration).toBeLessThanOrEqual(MENU_MUSIC.beats);
      expect(event.note).toBeGreaterThanOrEqual(0);
      expect(event.note).toBeLessThanOrEqual(127);
      expect(event.volume).toBeGreaterThan(0);
      expect(event.volume).toBeLessThanOrEqual(1);
      expect(Math.abs(event.pan ?? 0)).toBeLessThanOrEqual(1);
    }
  });

  it('has distinct lead sections, offbeat comping and bass/percussion in every bar', () => {
    const leads = MENU_MUSIC.events.filter(event => event.voice === 'brass' || event.voice === 'guitar');
    expect(leads.some(event => event.voice === 'brass' && event.beat < 64)).toBe(true);
    expect(leads.some(event => event.voice === 'guitar' && event.beat >= 64)).toBe(true);
    expect(leads.filter(event => event.beat < 8).map(event => event.note)).not.toEqual(
      leads.filter(event => event.beat >= 64 && event.beat < 72).map(event => event.note),
    );
    expect(MENU_MUSIC.events.some(event => event.voice === 'piano' && event.beat % 1 !== 0)).toBe(true);
    for (let bar = 0; bar < 32; bar++) {
      const voices = new Set(MENU_MUSIC.events.filter(event => event.beat >= bar * 4 && event.beat < (bar + 1) * 4).map(event => event.voice));
      for (const voice of ['bass', 'kick', 'snare', 'hat']) expect(voices.has(voice as typeof MENU_MUSIC.events[number]['voice'])).toBe(true);
    }
  });
});
