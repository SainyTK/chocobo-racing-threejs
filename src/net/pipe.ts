/** A text message channel between a guest and the hosting player, carried directly by WebRTC or relayed by the game server. */
export interface Pipe {
  readonly route: 'direct' | 'relay';
  /** `volatile` messages may be dropped or reordered; the others arrive reliably and in order. */
  send(text: string, volatile: boolean): void;
  onMessage: (text: string) => void;
  onClose: () => void;
  close(): void;
}

/** What a guest sends: an event, with a request id when it waits for a reply. The first frame is always `hello`. */
export interface GuestFrame { e: string; d?: any; i?: number }
/** What the host sends: an event, or the reply to request `i`. */
export type HostFrame = { e: string; d?: unknown } | { i: number; r: unknown };

export function parseFrame<T extends object>(text: string): T | null {
  try { const frame = JSON.parse(text); return frame && typeof frame === 'object' ? frame as T : null; } catch { return null; }
}
