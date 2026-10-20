import { trackLength } from '../track/sampling.ts';
import type { Race, Racer } from './types.ts';

/** Total race distance, capped at the next unvisited gate so a missed checkpoint earns nothing. */
export const raceProgress = (r: Race, p: Racer) => Math.min(p.s, (p.gates + 1) * trackLength(r.track) / 12);
