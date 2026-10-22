import * as THREE from 'three';
import { ITEMS, MEGAFLARE, crashTier, type Item } from '../../shared/game/index.ts';
import { every, type StudioContext, type StudioElement } from '../types.ts';

const at = (y = 1.5) => new THREE.Vector3(0, y, 0);
const levels = (names: string[]) => names.map((label, i) => ({ id: String(i + 1), label }));
const forward = new THREE.Vector3(0, 0, 1), KINDS = Object.keys(ITEMS) as Item[];

/** A one-shot effect replayed every `period` seconds at the pane centre. */
function oneShot(id: string, name: string, tags: string[], variants: { id: string; label: string }[], period: number, distance: number, play: (ctx: StudioContext, variant: string) => void, y = 2): StudioElement {
  return { id: `fx.${id}`, name, category: 'Effects', tags, variants, view: { y, distance }, create: (variant, ctx) => ({ update: every(period, () => play(ctx, variant)) }) };
}

export const effects: StudioElement[] = [
  ...KINDS.map(kind => oneShot(`cast.${kind}`, `${ITEMS[kind].name} Cast`, ['spell', 'cast', kind], levels(ITEMS[kind].names), kind === 'ultima' || kind === 'ice' ? 3 : 2, kind === 'ultima' ? 60 : kind === 'ice' ? 40 : 16, ({ fx }, v) => fx.spells.cast(kind, Number(v), at(), forward, 'studio', false))),
  ...(['fire', 'ice', 'thunder', 'ultima'] as Item[]).map(kind => oneShot(`hit.${kind}`, `${ITEMS[kind].name} Hit`, ['spell', 'hit', 'crash', kind], levels(ITEMS[kind].names), 2, kind === 'thunder' ? 26 : 18, ({ fx }, v) => fx.spells.impact({ kind, level: Number(v), tier: crashTier(kind, Number(v)) }, at(), 'studio', false), kind === 'thunder' ? 6 : 2)),
  oneShot('mini-hit', 'Mini Hit', ['mini', 'shrink', 'poof'], levels(ITEMS.mini.names), 1.6, 12, ({ fx }, v) => fx.spells.shrink(at(), Number(v), 'studio')),
  oneShot('megaflare', 'Megaflare Strike', ['bahamut', 'ability', 'hit', 'crash', 'flare'], [{ id: 'rival', label: 'On a rival' }, { id: 'mine', label: 'On the player' }], 2, 22, ({ fx }, v) => fx.spells.impact({ kind: 'megaflare', level: 3, tier: MEGAFLARE.tier }, at(), 'studio', v === 'mine'), 4),
  oneShot('doom', 'Doom Detonation', ['doom', 'curse', 'smoke'], [{ id: 'hit', label: 'Hit' }], 2.5, 14, ({ fx }) => fx.doomHit(at())),
  oneShot('sparkle', 'Sparkle Burst', ['pickup', 'cast', 'stars'], (Object.keys(ITEMS) as Item[]).map(k => ({ id: k, label: ITEMS[k].name })), 1.4, 9, ({ fx }, v) => fx.sparkle(at(), ITEMS[v as Item].color, 24)),
  oneShot('swirl', 'Swirl', ['haste', 'mini', 'doom', 'receive', 'spiral'], [{ id: 'haste', label: 'Haste' }, { id: 'mini', label: 'Mini' }, { id: 'doom', label: 'Doom curse (inward)' }, { id: 'receive', label: 'Receive (inward)' }], 1.4, 10,
    ({ fx }, v) => fx.swirl(at(.1), { haste: ITEMS.haste.color, mini: '#c99bff', doom: '#9b3dff', receive: '#7dffd8' }[v]!, 3.5, 50, v === 'doom' || v === 'receive')),
  oneShot('stream', 'Stone Stream', ['steal', 'mug', 'reflect', 'doom pass', 'transfer'], [{ id: 'steal', label: 'Steal' }, { id: 'reflect', label: 'Reflect' }, { id: 'doom', label: 'Doom pass' }], 1.5, 14,
    ({ fx }, v) => fx.stream(new THREE.Vector3(-4, 1.5, 0), new THREE.Vector3(4, 1.5, 0), { steal: '#ffd84a', reflect: ITEMS.shield.color, doom: '#b45cff' }[v]!, 28)),
  oneShot('confetti', 'Finish Confetti', ['finish', 'celebration'], [{ id: 'finish', label: 'Finish' }], 2.5, 18, ({ fx }) => fx.confetti(at())),
];
