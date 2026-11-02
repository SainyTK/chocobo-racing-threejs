/** Settings shared by the signaling Worker and the browsers of player-hosted rooms. */
export interface IceServer { urls: string | string[]; username?: string; credential?: string }
export const DEFAULT_ICE_SERVERS: IceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
/** How long a dropped player's place, or a dropped host's code, is kept for them to come back. */
export const HOLD_MS = 60000;
/** How long a closed code is remembered, so an old invite link says the room has closed. */
export const CLOSED_MEMORY_MS = 6 * 3600000;
/** Largest offer, answer or ICE candidate the Worker passes on, in JSON characters. */
export const SIGNAL_LIMIT = 6000;
/** Largest relayed game message: a full race state on the busiest course is about 10 KB. */
export const RELAY_LIMIT = 32768;
/** How long a guest tries a direct connection before relaying through the signaling Worker. */
export const DIRECT_TIMEOUT_MS = 7000;
