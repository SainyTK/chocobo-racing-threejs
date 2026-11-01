import type { Input, Race } from '../shared/game/index.ts';
import type { RoomView } from '../shared/room/types.ts';
import { decodeSnapshot, type Snapshot } from '../shared/wire.ts';
import { Interpolation } from './interpolation.ts';
import { Prediction } from './prediction.ts';
import { NetDiagnostics, Delivery } from './net-diagnostics.ts';
import { SocketTransport } from './net/socket-transport.ts';
import { Signaling } from './net/signaling.ts';
import { PeerHost } from './net/peer-host.ts';
import { PeerTransport } from './net/peer-transport.ts';
import { NoResponse, type Route, type Transport } from './net/transport.ts';
import { sessionStore } from './services/session-store.ts';

export { NoResponse };
export type { RoomView };
/** Where a new room runs: on the game server, or in this page with the other players connecting to it. */
export type Hosting = 'server' | 'device';
/** The game server's origin. Empty when the server also serves this page, as on Railway and in development. */
const SERVER_URL = import.meta.env.VITE_SERVER_URL || undefined;
const CONNECT_DEADLINE_MS = 20000;
const SERVER_SESSION = 'cbr-session';
const peerSession = (code: string) => `cbr-peer-${code}`;

export class Network {
  id = ''; latency = 0; room: RoomView | null = null;
  onRoom: (room: RoomView) => void = () => { }; onState: (race: Race) => void = () => { }; onStatus: (online: boolean) => void = () => { }; onExpired: () => void = () => { }; onOutdated: () => void = () => { };
  /** A player-hosted room ended: its host left, or this page lost the host for good. */
  onClosed: (message: string) => void = () => { };
  diagnostics = new NetDiagnostics(); private delivery = new Delivery(); private receivedAt = 0; private metadata: Race | null = null; private latestTick = -1; prediction = new Prediction();
  private actionSeq = 0; private actionHeld = { item: false, ability: false, rescue: false }; private pendingActions = new Map<number, ReturnType<typeof setTimeout>>();
  private interpolation = new Interpolation(); private lastSend = 0;
  /** False after stepping away, so room and race messages already in flight do not pull the player back in. */
  private listening = true;
  private readonly server: SocketTransport;
  private readonly signaling: Signaling;
  /** The transport of the current room: the game server, this page's own room, or another player's. */
  private link: Transport;
  private peerHost: PeerHost | null = null;
  private readonly welcomed = new Set<Transport>();
  private readonly waiting = new Map<Transport, (() => void)[]>();

  constructor() {
    this.server = new SocketTransport(SERVER_URL, sessionStore.get(SERVER_SESSION));
    this.signaling = new Signaling(this.server);
    this.link = this.server;
    this.server.onMessage = (event, data) => {
      if (this.signaling.handles(event)) this.signaling.dispatch(event, data);
      else if (event === 'welcome' || this.link === this.server) this.receive(this.server, event, data);
    };
    this.server.onStatus = connected => { this.signaling.status(connected); this.status(this.server, connected); };
    setInterval(() => {
      const link = this.link; if (!link.connected) return;
      const start = performance.now();
      link.request('latency', {}, 2000).then(() => { if (this.link !== link) return; this.latency = Math.round(performance.now() - start); this.diagnostics.sample('transportRttMs', this.latency); }, () => {});
    }, 2500);
  }
  get connected() { return this.link.connected; }
  get route(): Route { return this.link.route; }
  /** True when this page runs the room the player is in. */
  get hosting() { return this.peerHost !== null && this.link === this.peerHost.local; }
  /** A saved game-server session that may still hold a place in a room. */
  get hasSession() { return this.server.hasToken; }
  /** The Engine.IO transport for server rooms, otherwise the peer route. Diagnostics only. */
  get transportName() { return this.link === this.server ? this.server.engine : this.link.route; }
  dropConnection() { this.server.drop(); }

  private use(next: Transport) {
    if (this.link === next) return;
    const previous = this.link;
    this.link = next;
    if (previous !== this.server) previous.close();
    if (previous === this.peerHost?.local) this.peerHost = null;
    if (next !== this.server) {
      next.onMessage = (event, data) => this.receive(next, event, data);
      next.onStatus = connected => this.status(next, connected);
    }
    this.delivery.clear(); this.clearActions();
  }
  private receive(from: Transport, event: string, data: any) {
    if (event === 'welcome') { this.welcome(from, data); return; }
    if (from !== this.link) return;
    if (event === 'outdated') this.onOutdated();
    else if (event === 'closed') this.closedByHost(data?.message || 'This room has closed.');
    else if (event === 'room') { if (!this.listening) return; this.room = data as RoomView; this.onRoom(this.room); }
    else if (event === 'race') { if (!this.listening) return; const race = data as Race; this.delivery.clear(); this.metadata = race; this.latestTick = -1; this.interpolation.reset(); this.prediction.reset(); this.clearActions(); this.actionSeq = 0; this.prediction.reconcile(race, this.id, 0); this.accept(race); }
    else if (event === 'snapshot') this.delivery.run('down', () => this.snapshot(data as Snapshot));
    else if (event === 'state') this.delivery.run('down', () => { if (this.listening) this.accept(data as Race); });
  }
  private welcome(from: Transport, data: { id: string; token: string; room: string | null }) {
    from.setToken(data.token);
    if (from === this.server) sessionStore.set(SERVER_SESSION, data.token);
    else if (from instanceof PeerTransport) sessionStore.set(peerSession(from.code), data.token);
    this.welcomed.add(from);
    for (const resolve of this.waiting.get(from)?.splice(0) ?? []) resolve();
    if (from !== this.link) return;
    const lostRoom = this.room !== null && !data.room;
    this.id = data.id;
    if (lostRoom) { this.clear(); this.onExpired(); }
  }
  private status(from: Transport, connected: boolean) {
    if (!connected) this.welcomed.delete(from);
    if (from !== this.link) return;
    if (!connected) { this.delivery.clear(); this.clearActions(); }
    this.onStatus(connected);
  }
  private snapshot(s: Snapshot) {
    if (!this.listening || !this.metadata || s.tick <= this.latestTick) { this.diagnostics.count('staleSnapshots'); return; }
    const race = decodeSnapshot(this.metadata, s); if (!race) return;
    this.latestTick = s.tick;
    this.prediction.reconcile(race, this.id, s.ack[this.id] || 0);
    this.diagnostics.sample('correctionMeters', this.prediction.correction);
    if (this.diagnostics.enabled) this.diagnostics.sample('stateBytes', new TextEncoder().encode(JSON.stringify(s)).length);
    this.accept(race);
  }
  private accept(race: Race) {
    const now = performance.now();
    if (this.receivedAt) this.diagnostics.sample('snapshotIntervalMs', now - this.receivedAt); this.receivedAt = now;
    this.diagnostics.count('snapshots');
    this.interpolation.push(race, now); this.onState(race);
  }
  private closedByHost(message: string) { this.use(this.server); this.clear(); this.onClosed(message); }

  async connect() { await this.ready(this.link); }
  /**
   * Waits for `transport`'s welcome. A failed attempt is not the end: the transports retry with backoff, which a slow
   * phone still loading the page needs. Only the deadline gives up. Requests wait for the welcome, so a retried
   * connection cannot send a join twice.
   */
  private async ready(transport: Transport) {
    if (transport.connected && this.welcomed.has(transport)) return;
    transport.connect();
    await new Promise<void>((resolve, reject) => {
      const list = this.waiting.get(transport) ?? []; this.waiting.set(transport, list);
      const done = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => { list.splice(list.indexOf(done), 1); reject(Error(transport === this.server ? 'Cannot reach the race server. Practice still works.' : 'Cannot reach the host of this room.')); }, CONNECT_DEADLINE_MS);
      list.push(done);
    });
  }
  private async call(transport: Transport, event: string, data: unknown, timeoutMs = 5000) {
    const result = await transport.request(event, data, timeoutMs);
    if (result?.error) throw Error(result.error);
    return result;
  }
  async request(event: string, data: Record<string, unknown> = {}) {
    if (event === 'create') return this.create(data);
    if (event === 'join') return this.join(data);
    await this.ready(this.link);
    return this.call(this.link, event, data);
  }
  private async create(data: Record<string, unknown>) {
    this.listening = true;
    await this.ready(this.server);
    if (data.hosting !== 'device') { await this.exitPeerRoom(); return this.call(this.server, 'create', data); }
    const ticket = await this.signaling.openHost();
    await this.exitPeerRoom();
    if (this.room) await this.call(this.server, 'leave', {}).catch(() => {});
    const host = new PeerHost(ticket, this.signaling);
    this.use(host.local); this.peerHost = host;
    await this.ready(host.local);
    return this.call(host.local, 'create', data);
  }
  /** One request to the game server answers both cases: it joins a server room, or says the code runs in a player's page. */
  private async join(data: Record<string, unknown>) {
    this.listening = true;
    const code = typeof data.code === 'string' ? data.code.trim().toUpperCase() : '';
    await this.ready(this.server);
    const answer = await this.signaling.locate(data);
    if (answer?.error) throw Error(answer.error);
    if (!answer?.peer) { await this.exitPeerRoom(); return answer; }
    if (this.link instanceof PeerTransport && this.link.code === code) return this.call(this.link, 'join', data);
    await this.exitPeerRoom();
    if (this.room) await this.call(this.server, 'leave', {}).catch(() => {});
    const transport = new PeerTransport(code, answer.iceServers, this.signaling, sessionStore.get(peerSession(code)));
    this.use(transport);
    await this.ready(transport);
    return this.call(transport, 'join', data);
  }
  /** Leaves a player-hosted room, closing it for everyone when this page hosts it. */
  private async exitPeerRoom() {
    if (this.link === this.server) return;
    if (this.peerHost) this.peerHost.close(`The host closed room ${this.peerHost.code}.`);
    else if (this.link.connected) await this.call(this.link, 'leave', {}, 2000).catch(() => {});
    if (this.link instanceof PeerTransport) sessionStore.remove(peerSession(this.link.code));
    this.use(this.server);
  }
  /**
   * Goes back to the home page. A server room or another player's room keeps this player's place for a while; a room
   * in this page cannot outlive the player who hosts it, so it closes.
   */
  async stepAway() {
    this.listening = false; this.clear();
    if (this.peerHost) { await this.exitPeerRoom(); return; }
    if (this.link !== this.server) { await this.call(this.link, 'away', {}, 2000).catch(() => {}); this.use(this.server); return; }
    await this.request('away');
  }
  /** Leaves the room for good. */
  async leave() {
    if (this.link !== this.server) await this.exitPeerRoom();
    else if (this.server.connected) await this.call(this.server, 'leave', {});
    else { this.server.close(); sessionStore.remove(SERVER_SESSION); this.server.setToken(''); }
    this.clear();
  }
  drive(input: Input, dt: number) { this.prediction.advance(input, dt); this.sendInput(input); }
  private clearActions() { for (const timer of this.pendingActions.values()) clearTimeout(timer); this.pendingActions.clear(); this.actionHeld = { item: false, ability: false, rescue: false }; }
  private action(kind: 'item' | 'ability' | 'rescue') {
    if (!this.metadata || this.pendingActions.size >= 16) return;
    const packet = { race: this.metadata.id, seq: ++this.actionSeq, kind };
    const send = () => {
      if (!this.connected || this.metadata?.id !== packet.race) { this.pendingActions.delete(packet.seq); return; }
      this.link.request('action', packet, 1000).then(() => {
        if (!this.pendingActions.has(packet.seq)) return;
        clearTimeout(this.pendingActions.get(packet.seq)); this.pendingActions.delete(packet.seq);
      }, () => {});
      this.pendingActions.set(packet.seq, setTimeout(send, 1200));
    }; send();
  }
  sendInput(input: Input, force = false) {
    if (!this.connected || !this.metadata) return;
    for (const kind of ['item','ability','rescue'] as const) { if (input[kind] && !this.actionHeld[kind]) this.action(kind); this.actionHeld[kind] = input[kind]; }
    const now = performance.now(); if (!force && now - this.lastSend < 32) return; this.lastSend = now;
    if (force) this.prediction.advance(input, 0);
    const copy = { race: this.metadata.id, seq: this.prediction.seq, input: { ...input, item: false, ability: false, rescue: false } };
    this.diagnostics.count('inputs'); if (this.diagnostics.enabled) this.diagnostics.sample('inputBytes', JSON.stringify(copy).length);
    const link = this.link;
    this.delivery.run('up', () => { if (link.connected && this.link === link && this.metadata?.id === copy.race) link.sendVolatile('input', copy); });
  }
  clear() { this.delivery.clear(); this.clearActions(); this.prediction.reset(); this.room = null; this.interpolation.reset(); this.metadata = null; this.latestTick = -1; }
  interpolated(): Race | null {
    const now = performance.now(), view = this.interpolation.sample(now); if (!view) return null;
    this.diagnostics.sample('snapshotArrivalAgeMs', now - this.receivedAt);
    this.diagnostics.sample('estimatedSnapshotAgeMs', view.ageMs);
    this.diagnostics.sample('interpolationBufferMs', this.interpolation.bufferMs);
    if (view.underrun) this.diagnostics.count('interpolationUnderrunFrames');
    return { ...view.race, racers: view.race.racers.map(p => p.id === this.id ? this.prediction.render(p) : p) };
  }
}
