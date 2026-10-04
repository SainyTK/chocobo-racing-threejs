import { io, type Socket } from 'socket.io-client';
import type { AbilityId, Input, Race } from '../shared/game/index.ts';
import type { TrackId } from '../shared/track/index.ts';
import { Interpolation } from './interpolation.ts';
import { decodeSnapshot, type Snapshot } from '../shared/wire.ts';
import { Prediction } from './prediction.ts';
import { NetDiagnostics, Delivery } from './net-diagnostics.ts';
export interface RoomView { code: string; host: string; track: TrackId; laps: number; members: { id: string; name: string; character: number; abilityId: AbilityId; connected: boolean }[]; phase: string }
export class Network {
  socket: Socket; id = ''; connected = false; latency = 0; room: RoomView | null = null;
  onRoom: (room: RoomView) => void = () => { }; onState: (race: Race) => void = () => { }; onStatus: (online: boolean) => void = () => { }; onExpired: () => void = () => { };
  diagnostics = new NetDiagnostics(); private delivery = new Delivery(); private receivedAt = 0; private metadata: Race | null = null; private latestTick = -1; prediction = new Prediction();
  private actionSeq = 0; private actionHeld = { item: false, ability: false, rescue: false }; private pendingActions = new Map<number, ReturnType<typeof setTimeout>>();
  private interpolation = new Interpolation(); private lastSend = 0;
  constructor() {
    let token = ''; try { token = sessionStorage.getItem('cbr-session') || ''; } catch { /* Private browsing may disable storage. */ }
    this.socket = io({ autoConnect: false, auth: { token, wire: 2 }, transports: ['websocket'], reconnectionDelay: 500, reconnectionDelayMax: 2500, timeout: 6000 });
    this.socket.on('connect', () => { this.connected = true; this.onStatus(true); });
    this.socket.on('disconnect', () => { this.connected = false; this.delivery.clear(); this.clearActions(); this.onStatus(false); });
    this.socket.on('welcome', data => {
      const lostRoom = this.room !== null && !data.room;
      this.id = data.id; this.socket.auth = { token: data.token, wire: 2 }; try { sessionStorage.setItem('cbr-session', data.token); } catch { }
      if (lostRoom) { this.clear(); this.onExpired(); }
    });
    this.socket.on('room', (room: RoomView) => { this.room = room; this.onRoom(room); });
    this.socket.on('race', (race: Race) => { this.delivery.clear(); this.metadata = race; this.latestTick = -1; this.interpolation.reset(); this.prediction.reset(); this.clearActions(); this.actionSeq = 0; this.prediction.reconcile(race, this.id, 0); this.accept(race); });
    this.socket.on('snapshot', (s: Snapshot) => this.delivery.run('down', () => {
      if (!this.metadata || s.tick <= this.latestTick) { this.diagnostics.count('staleSnapshots'); return; }
      const race = decodeSnapshot(this.metadata, s); if (!race) return;
      this.latestTick = s.tick;
      this.prediction.reconcile(race, this.id, s.ack[this.id] || 0);
      this.diagnostics.sample('correctionMeters', this.prediction.correction);
      if (this.diagnostics.enabled) this.diagnostics.sample('stateBytes', new TextEncoder().encode(JSON.stringify(s)).length);
      this.accept(race);
    }));
    this.socket.on('state', (race: Race) => this.delivery.run('down', () => this.accept(race)));
    setInterval(() => { if (this.connected) { const start = performance.now(); this.socket.timeout(2000).emit('latency', {}, (err: unknown) => { if (!err) { this.latency = Math.round(performance.now() - start); this.diagnostics.sample('transportRttMs', this.latency); } }); } }, 2500);
  }
  private accept(race: Race) {
      const now = performance.now();
      if (this.receivedAt) this.diagnostics.sample('snapshotIntervalMs', now - this.receivedAt); this.receivedAt = now;
      this.diagnostics.count('snapshots');
      this.interpolation.push(race, now); this.onState(race);
  }
  async connect() {
    if (this.connected && this.id) return;
    this.socket.connect();
    await new Promise<void>((resolve, reject) => {
      const clean = () => { clearTimeout(timer); this.socket.off('welcome', success); this.socket.off('connect_error', failure); };
      const success = () => { clean(); resolve(); };
      const failure = () => { clean(); reject(Error('Cannot reach the race server. Practice still works.')); };
      const timer = setTimeout(failure, 7000); this.socket.once('welcome', success); this.socket.once('connect_error', failure);
    });
  }
  async request(event: string, data: unknown = {}) {
    await this.connect();
    return new Promise<any>((resolve, reject) => this.socket.timeout(5000).emit(event, data, (err: unknown, result: any) => {
      if (err) reject(Error('The server did not respond. Check your connection before trying again.'));
      else if (result?.error) reject(Error(result.error)); else resolve(result);
    }));
  }
  drive(input: Input, dt: number) { this.prediction.advance(input, dt); this.sendInput(input); }
  private clearActions() { for (const timer of this.pendingActions.values()) clearTimeout(timer); this.pendingActions.clear(); this.actionHeld = { item: false, ability: false, rescue: false }; }
  private action(kind: 'item' | 'ability' | 'rescue') {
    if (!this.metadata || this.pendingActions.size >= 16) return;
    const packet = { race: this.metadata.id, seq: ++this.actionSeq, kind };
    const send = () => {
      if (!this.connected || this.metadata?.id !== packet.race) { this.pendingActions.delete(packet.seq); return; }
      this.socket.timeout(1000).emit('action', packet, (err: unknown) => {
        if (!this.pendingActions.has(packet.seq)) return;
        if (!err) { clearTimeout(this.pendingActions.get(packet.seq)); this.pendingActions.delete(packet.seq); }
      });
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
    this.delivery.run('up', () => { if (this.connected && this.metadata?.id === copy.race) this.socket.volatile.emit('input', copy); });
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
