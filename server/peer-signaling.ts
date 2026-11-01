import type { Server, Socket } from 'socket.io';
import { randomHex } from '../shared/random-id.ts';
import { HOLD_MS } from '../shared/room/host.ts';
import { DEFAULT_ICE_SERVERS, SIGNAL_LIMIT, type IceServer } from '../shared/peer.ts';

/**
 * A room that runs in a player's browser. The game server only introduces players to its host: WebRTC offers, answers
 * and ICE candidates pass through here, and so does the game traffic of a player who cannot connect directly.
 */
interface PeerRoom { code: string; secret: string; hostSocket: string | null; lostAt: number; guests: Set<string> }
type Ack = (result: unknown) => void;
/** Per-socket messages per second. Relayed rooms carry 20 snapshots or about 30 inputs a second, plus requests. */
const BUDGET = { signal: 60, relay: 150 };

function iceServers(): IceServer[] {
  try { const parsed = JSON.parse(process.env.ICE_SERVERS || ''); if (Array.isArray(parsed)) return parsed; } catch { /* Unset or invalid falls back to public STUN. */ }
  return DEFAULT_ICE_SERVERS;
}

export class PeerSignaling {
  readonly rooms = new Map<string, PeerRoom>();
  private readonly ice = iceServers();
  private readonly budgets = new WeakMap<Socket, { at: number; signal: number; relay: number }>();
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(private readonly io: Server, private readonly reserveCode: () => string | null, private readonly onClosed: (code: string) => void) {
    this.timer = setInterval(() => this.expire(), 1000);
  }
  has(code: string) { return this.rooms.has(code); }
  close() { clearInterval(this.timer); }

  /** The answer to a `join` for a player-hosted code: how to reach its host. */
  joinAnswer(code: string) {
    const room = this.rooms.get(code)!;
    if (!room.hostSocket) return { error: `The host of room ${code} is reconnecting. Try again in a moment.` };
    return { ok: true, peer: true, iceServers: this.ice };
  }

  /** Handles one signaling event from `socket`. Returns false for events that belong to the room host. */
  handle(socket: Socket, event: string, data: any, ack: Ack): boolean {
    if (event === 'host-open' || event === 'host-close' || event === 'signal' || event === 'relay') {
      if (!this.withinBudget(socket, event === 'relay' ? 'relay' : 'signal')) { if (event !== 'relay') ack({ error: 'Too many requests. Try again in a moment.' }); return true; }
    }
    if (event === 'host-open') { ack(this.open(socket, data)); return true; }
    if (event === 'host-close') { const room = this.owned(socket, data); if (room) this.remove(room); ack({ ok: true }); return true; }
    if (event === 'signal') { ack(this.forward(socket, data, 'signal', false)); return true; }
    if (event === 'relay') { this.forward(socket, data, 'relay', data?.volatile === true); return true; }
    return false;
  }
  disconnected(socket: Socket) {
    for (const room of this.rooms.values()) {
      if (room.hostSocket === socket.id) { room.hostSocket = null; room.lostAt = Date.now(); }
      if (room.guests.delete(socket.id) && room.hostSocket) this.io.to(room.hostSocket).emit('peer-gone', { code: room.code, from: socket.id });
    }
  }

  private withinBudget(socket: Socket, kind: keyof typeof BUDGET) {
    const now = Date.now();
    let budget = this.budgets.get(socket);
    if (!budget || now - budget.at > 1000) { budget = { at: now, signal: 0, relay: 0 }; this.budgets.set(socket, budget); }
    return ++budget[kind] <= BUDGET[kind];
  }
  /** Reserves a new code, or hands an existing one back to its host after the host's connection to this server dropped. */
  private open(socket: Socket, data: any) {
    const reclaim = typeof data?.code === 'string' ? this.rooms.get(data.code) : undefined;
    if (reclaim) {
      if (reclaim.secret !== data?.secret) return { error: 'This room belongs to another host.' };
      reclaim.hostSocket = socket.id; reclaim.lostAt = 0;
      return { ok: true, code: reclaim.code, secret: reclaim.secret, iceServers: this.ice };
    }
    for (const room of this.rooms.values()) if (room.hostSocket === socket.id) this.remove(room);
    const code = this.reserveCode();
    if (!code) return { error: 'The server is full. Try again shortly.' };
    const room: PeerRoom = { code, secret: randomHex(16), hostSocket: socket.id, lostAt: 0, guests: new Set() };
    this.rooms.set(code, room);
    return { ok: true, code, secret: room.secret, iceServers: this.ice };
  }
  private owned(socket: Socket, data: any) {
    const room = this.rooms.get(typeof data?.code === 'string' ? data.code : '');
    return room && room.secret === data?.secret && room.hostSocket === socket.id ? room : undefined;
  }
  /**
   * A guest's message goes to the host, tagged with the guest's socket id. The host may only answer guests that wrote
   * to it first.
   */
  private forward(socket: Socket, data: any, event: 'signal' | 'relay', volatile: boolean) {
    const room = this.rooms.get(typeof data?.code === 'string' ? data.code : '');
    if (!room?.hostSocket) return { error: 'The host is not connected.' };
    if (event === 'signal' && JSON.stringify(data?.data ?? null).length > SIGNAL_LIMIT) return { error: 'Signal too large.' };
    const fromHost = room.hostSocket === socket.id;
    const target = fromHost ? data?.to : room.hostSocket;
    if (typeof target !== 'string' || (fromHost && !room.guests.has(target))) return { error: 'Unknown player.' };
    if (!fromHost) room.guests.add(socket.id);
    const message = { code: room.code, from: socket.id, data: data?.data };
    const out = this.io.to(target);
    if (volatile) out.volatile.emit(event, message); else out.emit(event, message);
    return { ok: true };
  }
  private remove(room: PeerRoom) {
    for (const guest of room.guests) this.io.to(guest).emit('host-gone', { code: room.code });
    this.rooms.delete(room.code);
    this.onClosed(room.code);
  }
  /** A host whose tab closed never comes back; its code is released after the same hold as a dropped player. */
  private expire() { for (const room of this.rooms.values()) if (!room.hostSocket && Date.now() - room.lostAt > HOLD_MS) this.remove(room); }
}
