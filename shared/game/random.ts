import type { Race } from './types.ts';

/** Deterministic LCG stored on the race, so every peer rolls the same random stones. */
export function random(r: Race) { r.seed = (Math.imul(r.seed, 1664525) + 1013904223) >>> 0; return r.seed / 4294967296; }
