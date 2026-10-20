import type { Race } from '../shared/game/index.ts';
import type { FinishView } from './gfx/finish-stage.ts';

/** Seconds of the orbit shot and of the podium shot. */
const ORBIT = 3.8, PODIUM = 5.5;
/** Slow motion right after the line: the simulation runs at SLOW speed, then eases back to normal by SLOW_END seconds. */
const SLOW = .3, SLOW_HOLD = 1.2, SLOW_END = 2.1;

/**
 * Timing of the player's finish: slow motion over the line, an orbit round the player's racer, then the podium,
 * then the results. A skip moves on to the next shot. Times are wall-clock seconds, so slow motion does not stretch them.
 */
export class FinishSequence {
  private start = -1; private slow = true; private podium = true; private podiumIds: string[] = [];
  get active() { return this.start >= 0; }
  begin(now: number, race: Race, slowMotion: boolean) {
    this.start = now; this.slow = slowMotion;
    // Time Attack is a solo run, so it goes straight from the orbit to the results.
    this.podium = race.mode !== 'time' && race.racers.length > 1; this.podiumIds = [];
  }
  stop() { this.start = -1; }
  /** Simulation speed now: 1 normally, slower just after the player crosses the line. */
  timeScale(now: number) {
    if (!this.active || !this.slow) return 1;
    const t = Math.max(this.elapsed(now), 0);
    return t < SLOW_HOLD ? SLOW : t < SLOW_END ? SLOW + (1 - SLOW) * (t - SLOW_HOLD) / (SLOW_END - SLOW_HOLD) : 1;
  }
  /** The shot to show. The last shot holds while the results are open. */
  view(now: number, race: Race): FinishView | null {
    if (!this.active) return null;
    const t = this.elapsed(now);
    if (t < ORBIT || !this.podium) return { phase: 'orbit', t };
    if (!this.podiumIds.length) this.podiumIds = [...race.racers].sort((a, b) => a.rank - b.rank).slice(0, 3).map(p => p.id);
    return { phase: 'podium', t: t - ORBIT, ids: this.podiumIds };
  }
  /** True once every shot has played and the results should open. */
  due(now: number) { return this.active && this.elapsed(now) >= ORBIT + (this.podium ? PODIUM : 0); }
  /** True during the orbit shot, while the HUD shows the finishing place. */
  orbiting(now: number) { return this.active && this.elapsed(now) < ORBIT; }
  /** Jumps to the next shot. */
  skip(now: number) { if (!this.active) return; this.start = now - (this.elapsed(now) < ORBIT ? ORBIT : ORBIT + PODIUM) * 1000; this.slow = false; }
  private elapsed(now: number) { return (now - this.start) / 1000; }
}
