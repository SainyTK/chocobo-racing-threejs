import type { AbilityId, DifficultyId, Race } from '../game/index.ts';
import type { TrackId } from '../track/index.ts';

/**
 * One player's connection to the room host, whatever carries it: a WebRTC data channel, the signaling Worker's relay,
 * or a direct in-page call for the hosting player.
 */
export interface Link {
  /** The wire version the client announced in its hello. */
  readonly wire: number | undefined;
  /** Reliable, ordered delivery. */
  send(event: string, data: unknown): void;
  /** Latest-wins delivery that may drop a message, used for snapshots. */
  sendVolatile(event: string, data: unknown): void;
  close(): void;
}
export type Reply = (result: unknown) => void;
/** What the host does with each message a link receives, and when the link goes away. */
export interface Connection { receive(event: string, data: any, reply?: Reply): void; closed(): void }

export interface Member { id: string; name: string; character: number; abilityId: AbilityId; connected: boolean; away: boolean }
export interface Room { code: string; host: string; track: TrackId; laps: number; difficulty: DifficultyId; members: Member[]; race: Race | null; lastActive: number }
/** `awayAt` is when a member stepped back to the home page. Like a dropped connection, the place is kept for `HOLD_MS`. */
export interface Session { id: string; token: string; link: Link | null; subscribed: boolean; room: string | null; seen: number; awayAt: number; inputAt: number; inputSeq: number; appliedSeq: number; actionSeq: number; pendingActions: ('item' | 'ability' | 'rescue')[] }
export interface RoomView { code: string; host: string; track: TrackId; laps: number; difficulty: DifficultyId; members: Member[]; phase: string }
export interface RoomMetrics { tickMs: number[]; loopLagMs: number[]; snapshotsPerLoop: number[]; broadcastMs: number[] }
