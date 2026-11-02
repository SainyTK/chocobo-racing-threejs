import type { RoomObject } from './room.ts';

export interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
  /** See `originAllowed`. */
  ALLOWED_ORIGINS: string;
  /** Optional JSON array of ICE servers, for example a TURN server. Public STUN otherwise. */
  ICE_SERVERS?: string;
}
