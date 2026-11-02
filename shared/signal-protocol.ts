import type { IceServer } from './peer.ts';

/**
 * Messages between browsers and the signaling Worker. Each room code has one host socket and any number of guest
 * sockets; the Worker passes WebRTC handshake steps between them, and relays game traffic for guests that cannot
 * connect directly. `from` and `to` are guest ids the Worker assigns.
 */
export type HostInbound =
  | { t: 'opened'; code: string; secret: string; iceServers: IceServer[] }
  | { t: 'signal' | 'relay'; from: string; data: unknown }
  | { t: 'peer-gone'; from: string }
  | { t: 'error'; message: string };
export type HostOutbound =
  | { t: 'signal' | 'relay'; to: string; data: unknown }
  | { t: 'close' };
export type GuestInbound =
  | { t: 'signal' | 'relay'; data: unknown }
  | { t: 'host-gone' }
  | { t: 'error'; message: string };
export type GuestOutbound = { t: 'signal' | 'relay'; data: unknown };
/** The answer to `GET /rooms/<code>`: how to reach the room, or why it cannot be joined. */
export type RoomInfo = { ok: true; iceServers: IceServer[] } | { ok?: false; error: string; retry?: boolean };

/** Paths on the signaling Worker. */
export const SIGNAL_PATHS = {
  info: (code: string) => `/rooms/${code}`,
  newHost: '/rooms/new/host',
  reclaimHost: (code: string, secret: string) => `/rooms/${code}/host?secret=${encodeURIComponent(secret)}`,
  guest: (code: string) => `/rooms/${code}/guest`,
};
