import { raceProgress } from '../progress.ts';
import type { Race, Racer } from '../types.ts';

/** Ranks racers by finish time, then by progress, and ends the race when everyone is done or time runs out. */
export function updateStandings(r: Race) {
  const progress = (p: Racer) => raceProgress(r, p);
  [...r.racers].sort((a, b) => a.finishTime !== null && b.finishTime !== null ? a.finishTime - b.finishTime : a.finishTime !== null ? -1 : b.finishTime !== null ? 1 : progress(b) - progress(a)).forEach((p, i) => p.rank = i + 1);
  if (r.racers.every(p => p.finishTime !== null) || r.firstFinish !== null && r.time - r.firstFinish > 90 || r.time > 360) r.phase = 'finished';
}
