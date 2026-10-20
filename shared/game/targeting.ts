import { raceProgress } from './progress.ts';
import type { Race, Racer } from './types.ts';

/** Every rival still racing. */
export const activeRivals = (r: Race, p: Racer) => r.racers.filter(q => q !== p && q.finishTime === null);
/** The closest rival ahead by total race progress, never wrapping round the lap. */
export function racerAhead(r: Race, p: Racer) {
  const mine = raceProgress(r, p);
  return activeRivals(r, p).filter(q => raceProgress(r, q) > mine).sort((a, b) => raceProgress(r, a) - raceProgress(r, b))[0];
}
/** The closest rival behind by total race progress. */
export function racerBehind(r: Race, p: Racer) {
  const mine = raceProgress(r, p);
  return activeRivals(r, p).filter(q => raceProgress(r, q) <= mine).sort((a, b) => raceProgress(r, b) - raceProgress(r, a))[0];
}
/** Every rival ahead by total race progress; from first place, every rival. */
export function rivalsAhead(r: Race, p: Racer) {
  const mine = raceProgress(r, p), ahead = activeRivals(r, p).filter(q => raceProgress(r, q) > mine);
  return ahead.length ? ahead : activeRivals(r, p);
}
/** Single-target spells hit the racer ahead. From first place they hit second place, as in the original. */
export const spellTarget = (r: Race, p: Racer) => racerAhead(r, p) ?? racerBehind(r, p);
