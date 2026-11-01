import type { IceServer } from '../../shared/peer.ts';
import type { SocketTransport } from './socket-transport.ts';

/** Messages the game server passes between a player-hosted room and its guests. `from` is the sender's socket id. */
export interface SignalMessage { code: string; from: string; data: unknown }
export type SignalingEvent =
  | { type: 'signal' | 'relay'; message: SignalMessage }
  | { type: 'peer-gone' | 'host-gone'; message: { code: string; from?: string } }
  | { type: 'status'; connected: boolean };
export interface HostTicket { code: string; secret: string; iceServers: IceServer[] }
const EVENTS = new Set(['signal', 'relay', 'peer-gone', 'host-gone']);

/** The game server's part in player-hosted rooms: reserving codes and introducing guests to hosts. */
export class Signaling {
  private readonly listeners = new Set<(event: SignalingEvent) => void>();

  constructor(private readonly server: SocketTransport) {}
  get connected() { return this.server.connected; }
  handles(event: string) { return EVENTS.has(event); }
  dispatch(event: string, message: any) { this.emit({ type: event, message } as SignalingEvent); }
  status(connected: boolean) { this.emit({ type: 'status', connected }); }
  subscribe(listener: (event: SignalingEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  /** Reserves a code for a room in this page, or reclaims it after this page's server connection dropped. */
  async openHost(reclaim?: { code: string; secret: string }): Promise<HostTicket> {
    const result = await this.server.request('host-open', reclaim ?? {}, 5000);
    if (result?.error) throw Error(result.error);
    return result;
  }
  closeHost(ticket: HostTicket) { void this.server.request('host-close', { code: ticket.code, secret: ticket.secret }, 5000).catch(() => {}); }
  /** Where `code` runs: `peer` with ICE servers for a player-hosted room. Joins a server room as a side effect. */
  locate(data: unknown) { return this.server.request('join', data, 5000); }
  signal(code: string, data: unknown, to?: string) { void this.server.request('signal', { code, to, data }, 5000).catch(() => {}); }
  relay(code: string, data: string, volatile: boolean, to?: string) {
    const message = { code, to, data, volatile };
    if (volatile) this.server.sendVolatile('relay', message); else this.server.send('relay', message);
  }
  private emit(event: SignalingEvent) { for (const listener of [...this.listeners]) listener(event); }
}
