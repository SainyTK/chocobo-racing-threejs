/** The other side never answered a request. It may still have handled it, so only idempotent requests are sent again. */
export class NoResponse extends Error {}

/**
 * How this page reaches its room: the game server, its own in-page host, a direct WebRTC connection to the hosting
 * player, or that player's room relayed through the game server.
 */
export type Route = 'server' | 'host' | 'direct' | 'relay';

export interface Transport {
  readonly connected: boolean;
  readonly route: Route;
  onMessage: (event: string, data: any) => void;
  onStatus: (connected: boolean) => void;
  connect(): void;
  /** Resolves with the raw reply, which may carry `error`; rejects with `NoResponse` after `timeoutMs`. */
  request(event: string, data: unknown, timeoutMs: number): Promise<any>;
  /** Reliable, ordered delivery without a reply. */
  send(event: string, data: unknown): void;
  /** May drop the message, used for held input. */
  sendVolatile(event: string, data: unknown): void;
  /** The session token the next connection presents, from the last welcome. */
  setToken(token: string): void;
  close(): void;
}
