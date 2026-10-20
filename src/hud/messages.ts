import { spellName, type GameEvent, type Race } from '../../shared/game/index.ts';
import { castInfo } from '../race-events.ts';

/** A HUD callout. Higher priority wins when several events land in the same moment. */
export interface Message { text: string; priority: number; tone: 'good' | 'bad' | 'info' }

/** The callout an event deserves from the player's point of view, or null when it is not worth a message. */
export function messageFor(e: GameEvent, race: Race, playerId: string): Message | null {
  const name = (id?: string) => race.racers.find(p => p.id === id)?.name ?? 'A rival', mine = e.player === playerId, targeted = e.target === playerId;
  if (!mine && !targeted) return null;
  const cast = castInfo(e);
  if (cast) return mine ? { text: `${spellName(cast.kind, cast.level)}!`, priority: 2, tone: 'good' } : null;
  switch (e.type) {
    case 'hit': return { text: `Hit ${name(e.target)}!`, priority: 3, tone: 'good' };
    case 'crash': return { text: e.text, priority: 4, tone: 'bad' };
    case 'mini': return targeted ? { text: `${name(e.player)} shrank you!`, priority: 4, tone: 'bad' } : null;
    case 'doom': return targeted ? { text: 'Doomed! Bump a rival to pass it', priority: 4, tone: 'bad' } : { text: `Doom on ${name(e.target)}!`, priority: 3, tone: 'good' };
    case 'doom-pass': return mine ? { text: `Doom passed to ${name(e.target)}!`, priority: 4, tone: 'good' } : { text: `${name(e.player)} passed you Doom!`, priority: 4, tone: 'bad' };
    case 'reflect': return mine ? { text: 'Reflected!', priority: 4, tone: 'good' } : { text: `${name(e.player)} reflected it!`, priority: 3, tone: 'bad' };
    case 'block': return mine ? { text: e.text, priority: 4, tone: 'good' } : { text: `${name(e.player)} blocked it`, priority: 3, tone: 'info' };
    case 'steal': return mine ? { text: e.text, priority: 3, tone: 'good' } : { text: `${name(e.player)} took your stones!`, priority: 4, tone: 'bad' };
    case 'receive': case 'ability': case 'start': case 'spindash': return mine ? { text: e.text, priority: 2, tone: 'good' } : null;
    case 'pickup': case 'pad': return mine ? { text: e.text, priority: 1, tone: 'info' } : null;
    case 'lap': return mine ? { text: e.text, priority: 3, tone: 'info' } : null;
    case 'fall': return mine ? { text: e.text, priority: 3, tone: 'bad' } : null;
    case 'recover': return mine ? { text: e.text, priority: 2, tone: 'info' } : null;
    default: return null;
  }
}

/** The lasting condition of the player's racer, shown when no event message is up. */
export function statusFor(race: Race, playerId: string, checkpointMissed: boolean): string {
  const p = race.racers.find(q => q.id === playerId);
  if (!p || p.finishTime !== null) return '';
  return p.falling > 0 ? 'FALLING!' : p.doom > 0 ? `DOOM ${Math.ceil(p.doom)} · BUMP A RIVAL` : p.wrongWay ? 'WRONG WAY!' : checkpointMissed ? 'MISSED CHECKPOINT · PRESS R' : '';
}
