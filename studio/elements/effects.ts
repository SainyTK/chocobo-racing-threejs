import * as THREE from 'three';
import { ITEMS, type Item } from '../../shared/game/index.ts';
import { every, type StudioContext, type StudioElement } from '../types.ts';

const at = (y = 1.5) => new THREE.Vector3(0, y, 0);
const levels = (names: string[]) => names.map((label, i) => ({ id: String(i + 1), label }));

/** A one-shot effect replayed every `period` seconds at the pane centre. */
function oneShot(id: string, name: string, tags: string[], variants: { id: string; label: string }[], period: number, distance: number, play: (ctx: StudioContext, variant: string) => void, y = 2): StudioElement {
  return { id: `fx.${id}`, name, category: 'Effects', tags, variants, view: { y, distance }, create: (variant, ctx) => ({ update: every(period, () => play(ctx, variant)) }) };
}

export const effects: StudioElement[] = [
  oneShot('explosion', 'Fire Explosion', ['fireball', 'hit', 'blast'], levels(ITEMS.fire.names), 2, 16, ({ fx }, v) => fx.explode(at(), [1, 1.15, 1.4][Number(v) - 1])),
  oneShot('lightning', 'Lightning Strike', ['thunder', 'bolt', 'hit'], levels(ITEMS.thunder.names), 1.6, 26, ({ fx }, v) => fx.strike(at(0), Number(v)), 6),
  oneShot('shatter', 'Ice Shatter', ['blizzard', 'ice', 'freeze', 'hit'], [{ id: 'hit', label: 'Hit' }, { id: 'cast', label: 'Cast' }], 1.6, 12, ({ fx }, v) => fx.shatter(at(), v === 'cast' ? 14 : 26)),
  oneShot('ultima-cast', 'Ultima Cast', ['ultima', 'nova', 'flash'], [{ id: 'cast', label: 'Cast' }], 3, 46, ({ fx }) => fx.ultimaCast(at())),
  oneShot('ultima-hit', 'Ultima Hit', ['ultima', 'pillar', 'crash'], [{ id: 'hit', label: 'Hit' }], 2, 22, ({ fx }) => fx.ultimaHit(at())),
  oneShot('doom', 'Doom Detonation', ['doom', 'curse', 'smoke'], [{ id: 'hit', label: 'Hit' }], 2.5, 14, ({ fx }) => fx.doomHit(at())),
  oneShot('sparkle', 'Sparkle Burst', ['pickup', 'cast', 'stars'], (Object.keys(ITEMS) as Item[]).map(k => ({ id: k, label: ITEMS[k].name })), 1.4, 9, ({ fx }, v) => fx.sparkle(at(), ITEMS[v as Item].color, 24)),
  oneShot('swirl', 'Swirl', ['haste', 'mini', 'doom', 'receive', 'spiral'], [{ id: 'haste', label: 'Haste' }, { id: 'mini', label: 'Mini' }, { id: 'doom', label: 'Doom curse (inward)' }, { id: 'receive', label: 'Receive (inward)' }], 1.4, 10,
    ({ fx }, v) => fx.swirl(at(.1), { haste: ITEMS.haste.color, mini: '#c99bff', doom: '#9b3dff', receive: '#7dffd8' }[v]!, 3.5, 50, v === 'doom' || v === 'receive')),
  oneShot('stream', 'Stone Stream', ['steal', 'mug', 'reflect', 'doom pass', 'transfer'], [{ id: 'steal', label: 'Steal' }, { id: 'reflect', label: 'Reflect' }, { id: 'doom', label: 'Doom pass' }], 1.5, 14,
    ({ fx }, v) => fx.stream(new THREE.Vector3(-4, 1.5, 0), new THREE.Vector3(4, 1.5, 0), { steal: '#ffd84a', reflect: ITEMS.shield.color, doom: '#b45cff' }[v]!, 28)),
  oneShot('confetti', 'Finish Confetti', ['finish', 'celebration'], [{ id: 'finish', label: 'Finish' }], 2.5, 18, ({ fx }) => fx.confetti(at())),
];
