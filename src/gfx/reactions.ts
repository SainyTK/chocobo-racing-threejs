import type { Race } from '../../shared/game/index.ts';
import { castInfo, crashInfo } from '../race-events.ts';
import { POSE_SECONDS, type Pose } from './characters/index.ts';

interface Active { pose: Pose; start: number; until: number }

/**
 * Decides which reaction each racer is acting out: a hit by crash tier, casting, overtaking, and winning or losing once
 * finished. Reactions follow race events and places, so they look the same for every viewer of a race.
 */
export class Reactions {
  private active = new Map<string, Active>(); private ranks = new Map<string, number>(); private raceId = ''; private eventId = 0;
  update(race: Race, clock: number) {
    if (race.id !== this.raceId) { this.raceId = race.id; this.eventId = race.eventId; this.active.clear(); this.ranks.clear(); }
    for (const e of race.events) {
      if (e.id <= this.eventId) continue;
      if (e.type === 'crash') { const { tier } = crashInfo(e); this.start(e.player, { kind: 'hit', t: 0, tier }, clock, POSE_SECONDS.hit); }
      else if (castInfo(e) && this.active.get(e.player)?.pose.kind !== 'hit') this.start(e.player, { kind: 'cast', t: 0 }, clock, POSE_SECONDS.cast);
    }
    this.eventId = race.eventId;
    for (const p of race.racers) {
      const previous = this.ranks.get(p.id), current = this.active.get(p.id); this.ranks.set(p.id, p.rank);
      if (p.finishTime !== null) { const kind = p.rank <= 3 ? 'win' : 'lose'; if (current?.pose.kind !== kind) this.start(p.id, { kind, t: 0 }, clock, Infinity); continue; }
      if (previous !== undefined && p.rank < previous && race.time > 3 && (!current || clock > current.until)) this.start(p.id, { kind: 'overtake', t: 0 }, clock, POSE_SECONDS.overtake);
    }
  }
  /** The pose a racer should show now, or undefined when it is just driving. */
  pose(id: string, clock: number): Pose | undefined {
    const a = this.active.get(id); if (!a) return undefined;
    if (clock > a.until) { this.active.delete(id); return undefined; }
    a.pose.t = clock - a.start; return a.pose;
  }
  private start(id: string, pose: Pose, clock: number, seconds: number) { this.active.set(id, { pose, start: clock, until: clock + seconds }); }
}
