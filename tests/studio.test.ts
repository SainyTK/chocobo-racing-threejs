import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { searchElements } from '../studio/search.ts';
import { decodeState, encodeState, MAX_PANES, type StudioState } from '../studio/state.ts';
import { ELEMENTS, elementById } from '../studio/registry.ts';
import { Effects } from '../src/gfx/effects/index.ts';

const el = (id: string, name: string, category: string, variants: string[], tags: string[] = []) => ({ id, name, category, tags, variants: variants.map(label => ({ label })) });
const LIST = [el('char.chocobo', 'Chocobo', 'Characters', ['Idle']), el('item.fire', 'Fire Stone', 'Items', ['Orb', 'Crystal'], ['Firaga']), el('fx.explosion', 'Fire Explosion', 'Effects', ['Fire']), el('fx.lightning', 'Lightning Strike', 'Effects', ['Thunder'])];

describe('studio search', () => {
  it('returns everything in registry order for an empty query', () => { expect(searchElements(LIST, '  ')).toEqual(LIST); });
  it('requires every term and matches tags, categories and variant labels, ignoring case', () => {
    expect(searchElements(LIST, 'FIRAGA').map(e => e.id)).toEqual(['item.fire']);
    expect(searchElements(LIST, 'effects thunder').map(e => e.id)).toEqual(['fx.lightning']);
    expect(searchElements(LIST, 'crystal').map(e => e.id)).toEqual(['item.fire']);
    expect(searchElements(LIST, 'fire zzz')).toEqual([]);
  });
  it('ranks name word-prefix matches above matches found elsewhere', () => {
    expect(searchElements(LIST, 'fire').map(e => e.id)).toEqual(['item.fire', 'fx.explosion']);
    expect(searchElements(LIST, 'explo').map(e => e.id)).toEqual(['fx.explosion']);
  });
});

describe('studio link state', () => {
  const fallback: StudioState = { panes: [{ element: 'a', variant: '1' }], active: 0, background: 'night', ground: true, quality: 'high', link: true, spin: false, speed: 1 };
  const resolve = (element: string, variant: string) => element === 'gone' ? null : { element, variant: variant || 'default' };
  it('round-trips a comparison through the URL hash', () => {
    const s: StudioState = { panes: [{ element: 'item.fire', variant: 'orb' }, { element: 'item.fire', variant: 'crystal' }], active: 1, background: 'paper', ground: false, quality: 'low', link: false, spin: true, speed: .5 };
    const hash = encodeState(s); expect(hash).toContain('panes=item.fire:orb,item.fire:crystal');
    expect(decodeState(hash, fallback, resolve)).toEqual(s);
  });
  it('drops unknown elements, caps the pane count and falls back on bad values', () => {
    const s = decodeState('#panes=gone:x,a:1,b,c:2,d:3,e:4&active=9&bg=neon&speed=7&spin=1&quality=ultra', fallback, resolve);
    expect(s.panes).toEqual([{ element: 'a', variant: '1' }, { element: 'b', variant: 'default' }, { element: 'c', variant: '2' }]);
    expect(s.panes.length).toBeLessThanOrEqual(MAX_PANES); expect(s.active).toBe(2); expect(s.background).toBe('night'); expect(s.speed).toBe(1); expect(s.spin).toBe(true); expect(s.quality).toBe('high');
    expect(decodeState('', fallback, resolve)).toEqual(fallback);
  });
});

describe('studio registry', () => {
  it('has unique element ids and unique variant ids per element', () => {
    expect(elementById.size).toBe(ELEMENTS.length);
    for (const e of ELEMENTS) expect(new Set(e.variants.map(v => v.id)).size, e.id).toBe(e.variants.length);
  });
  it('marks the orb as the in-game Magic Stone look', () => {
    for (const e of ELEMENTS.filter(e => e.category === 'Items')) expect(e.variants.filter(v => v.inGame).map(v => v.id), e.id).toEqual(['orb']);
  });
  // Characters need a DOM canvas for some textures; the browser covers them. Everything else builds headless.
  it('creates, animates and disposes every item, effect and stage variant', () => {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), fx = new Effects(scene);
    for (const e of ELEMENTS.filter(e => e.category !== 'Characters')) for (const v of e.variants) {
      const inst = e.create(v.id, { scene, fx, camera });
      if (inst.object) scene.add(inst.object);
      for (let i = 0; i <= 90; i++) { inst.update?.(i / 30, 1 / 30); fx.preview(1 / 30, camera); }
      inst.dispose?.(); if (inst.object) scene.remove(inst.object); fx.reset();
    }
    expect(fx.stats()).toEqual({ particles: 0, fireballs: 0, ice: 0 });
  });
});
