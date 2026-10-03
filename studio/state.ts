/** Studio view state, mirrored in the URL hash so a comparison can be shared as a link. Free of three.js and the DOM. */
export const BACKGROUNDS = { night: '#15172c', sky: '#64b7ed', grey: '#6b7080', paper: '#ece8df' } as const;
export type Background = keyof typeof BACKGROUNDS;
export const MAX_PANES = 4;
export const QUALITIES = ['high', 'low'] as const;
export type Quality = typeof QUALITIES[number];

export interface PaneState { element: string; variant: string }
export interface StudioState { panes: PaneState[]; active: number; background: Background; ground: boolean; quality: Quality; link: boolean; spin: boolean; speed: number }
/** Resolves a pane read from a URL to a known element and variant, or null when the element no longer exists. */
export type PaneResolver = (element: string, variant: string) => PaneState | null;

export const SPEEDS = [.25, .5, 1, 2];
const flag = (v: string | null, fallback: boolean) => v === null ? fallback : v === '1';

export function encodeState(s: StudioState) {
  const q = new URLSearchParams({ panes: s.panes.map(p => `${p.element}:${p.variant}`).join(','), active: String(s.active), bg: s.background, ground: s.ground ? '1' : '0', quality: s.quality, link: s.link ? '1' : '0', spin: s.spin ? '1' : '0', speed: String(s.speed) });
  return '#' + q.toString().replaceAll('%3A', ':').replaceAll('%2C', ',');
}

export function decodeState(hash: string, fallback: StudioState, resolve: PaneResolver): StudioState {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const panes = (q.get('panes') ?? '').split(',').filter(Boolean).slice(0, MAX_PANES).map(p => { const [element, variant = ''] = p.split(':'); return resolve(element, variant); }).filter((p): p is PaneState => !!p);
  const bg = q.get('bg'), quality = q.get('quality') as Quality, speed = Number(q.get('speed')), final = panes.length ? panes : fallback.panes;
  return {
    panes: final, active: Math.min(final.length - 1, Math.max(0, Number(q.get('active')) || 0)),
    background: bg && bg in BACKGROUNDS ? bg as Background : fallback.background,
    ground: flag(q.get('ground'), fallback.ground), quality: QUALITIES.includes(quality) ? quality : fallback.quality, link: flag(q.get('link'), fallback.link), spin: flag(q.get('spin'), fallback.spin),
    speed: SPEEDS.includes(speed) ? speed : fallback.speed,
  };
}
