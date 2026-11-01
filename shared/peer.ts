/** Settings shared by the game server's signaling and the browsers of player-hosted rooms. */
export interface IceServer { urls: string | string[]; username?: string; credential?: string }
export const DEFAULT_ICE_SERVERS: IceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
/** Largest offer, answer or ICE candidate the server passes on, in JSON characters. */
export const SIGNAL_LIMIT = 6000;
/** Largest relayed game message: a full race state on the busiest course is about 10 KB. */
export const RELAY_LIMIT = 32768;
/** How long a guest tries a direct connection before relaying through the game server. */
export const DIRECT_TIMEOUT_MS = 7000;
