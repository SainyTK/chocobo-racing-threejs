import { GRID_SIZE } from '../../shared/game/index.ts';
import { RoomHost } from '../../shared/room/host.ts';
import type { Connection, Link } from '../../shared/room/types.ts';
import { backgroundEvery } from './background-timer.ts';
import { LocalTransport } from './local-transport.ts';
import { parseFrame, type GuestFrame, type Pipe } from './pipe.ts';
import { RelayPipe } from './relay-pipe.ts';
import { RtcPipe, type RtcSignal } from './rtc-pipe.ts';
import type { HostTicket, SignalingEvent, Signaling } from './signaling.ts';

/** Guests may hold a stale pipe while a new one forms, so the room accepts a few more pipes than seats. */
const MAX_PIPES = GRID_SIZE * 3;
/** Lets the final `closed` message leave before the pipes close. */
const CLOSE_FLUSH_MS = 400;

/**
 * A room that runs in this page. The same room host as the game server's runs the race loop here; guests reach it over
 * WebRTC or the game server's relay, and the hosting player sits in it through a local transport.
 */
export class PeerHost {
  readonly local: LocalTransport;
  private readonly host: RoomHost;
  private readonly pipes = new Map<string, Pipe>();
  private readonly unsubscribe: () => void;
  private closed = false;

  constructor(private readonly ticket: HostTicket, private readonly signaling: Signaling) {
    this.host = new RoomHost({ maxRooms: 1, maxLinks: MAX_PIPES + 1, newCode: taken => taken(ticket.code) ? null : ticket.code, every: backgroundEvery });
    this.local = new LocalTransport(this.host);
    this.unsubscribe = signaling.subscribe(event => this.onSignaling(event));
  }
  get code() { return this.ticket.code; }

  /** Ends the room for every guest. */
  close(message: string) {
    if (this.closed) return;
    this.closed = true;
    this.local.close();
    this.host.closeRoom(this.ticket.code, message);
    this.unsubscribe();
    this.signaling.closeHost(this.ticket);
    this.host.close();
    setTimeout(() => { for (const pipe of this.pipes.values()) pipe.close(); this.pipes.clear(); }, CLOSE_FLUSH_MS);
  }

  private onSignaling(event: SignalingEvent) {
    // After this page's own server connection drops and returns, the code is claimed again so new guests can find it.
    if (event.type === 'status') { if (event.connected) void this.signaling.openHost(this.ticket).catch(() => {}); return; }
    if (event.message.code !== this.ticket.code) return;
    if (event.type === 'signal') this.signal(event.message.from, event.message.data as RtcSignal);
    if (event.type === 'relay') this.relayed(event.message.from, event.message.data);
    if (event.type === 'peer-gone') this.pipes.get(`${event.message.from}:relay`)?.close();
  }
  private signal(from: string, signal: RtcSignal) {
    if (typeof signal?.attempt !== 'string') return;
    const key = `${from}:${signal.attempt}`;
    let pipe = this.pipes.get(key) as RtcPipe | undefined;
    // A candidate can arrive before its offer; the pipe holds it until the offer sets the remote description.
    if (!pipe) {
      pipe = new RtcPipe(this.ticket.iceServers, signal.attempt, answer => this.signaling.signal(this.ticket.code, answer, from));
      if (!this.serve(key, pipe)) return;
    }
    const target = pipe;
    void target.receive(signal).catch(() => target.close());
  }
  private relayed(from: string, text: unknown) {
    const key = `${from}:relay`;
    let pipe = this.pipes.get(key) as RelayPipe | undefined;
    if (!pipe) {
      pipe = new RelayPipe((message, volatile) => this.signaling.relay(this.ticket.code, message, volatile, from));
      if (!this.serve(key, pipe)) return;
    }
    pipe.deliver(text);
  }
  /** Seats a guest once its pipe says hello. Only the hosting player may create the room. */
  private serve(key: string, pipe: Pipe) {
    if (this.closed || this.pipes.size >= MAX_PIPES) { pipe.close(); return false; }
    this.pipes.set(key, pipe);
    let connection: Connection | null = null;
    pipe.onMessage = text => {
      const frame = parseFrame<GuestFrame>(text); if (!frame || typeof frame.e !== 'string') return;
      if (frame.e === 'hello') {
        // A guest that redials through the same relay starts a fresh session link.
        connection?.closed();
        const link: Link = { wire: frame.d?.wire, send: (e, d) => pipe.send(JSON.stringify({ e, d }), false), sendVolatile: (e, d) => pipe.send(JSON.stringify({ e, d }), true), close: () => pipe.close() };
        connection = this.host.attach(link, typeof frame.d?.token === 'string' ? frame.d.token : '');
        return;
      }
      if (!connection || frame.e === 'create') return;
      const id = frame.i;
      connection.receive(frame.e, frame.d, typeof id === 'number' ? result => pipe.send(JSON.stringify({ i: id, r: result }), false) : undefined);
    };
    pipe.onClose = () => { if (this.pipes.get(key) === pipe) this.pipes.delete(key); connection?.closed(); connection = null; };
    return true;
  }
}
