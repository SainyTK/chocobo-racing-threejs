import { mod } from '../math.ts';
import type { Hazard } from './types.ts';

/** A timed hazard at one moment: where it is across the road, whether it strikes, and how far into its warning or strike it is (0 to 1). */
export interface HazardState { x: number; live: boolean; warning: number; progress: number }

/** Pure function of race time, so every machine draws and resolves the same hazard at the same instant. */
export function hazardState(h: Hazard, time: number): HazardState {
  if (!h.period) return { x: h.x, live: true, warning: 0, progress: 0 };
  const u = mod(time + (h.phase ?? 0), h.period), strike = h.strike ?? h.period, warn = h.warn ?? 0;
  const live = u < strike, progress = live ? u / strike : 0, warning = !live && u > h.period - warn ? 1 - (h.period - u) / warn : 0;
  const x = h.motion === 'sweep' ? h.x + (h.amp ?? 0) * Math.sin(u / h.period * Math.PI * 2) : h.motion === 'cross' ? h.x + (h.amp ?? 0) * (live ? progress : warning > 0 ? 0 : 1) : h.x;
  return { x, live, warning, progress };
}
