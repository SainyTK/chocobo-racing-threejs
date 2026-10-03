import { io, type Socket } from 'socket.io-client';
import type { AbilityId, Input, Race } from '../shared/game/index.ts';
import type { TrackId } from '../shared/track/index.ts';
import { angleDelta } from '../shared/math.ts';
export interface RoomView { code: string; host: string; track: TrackId; laps: number; members: { id: string; name: string; character: number; abilityId: AbilityId; connected: boolean }[]; phase: string }
export class Network {
  socket: Socket; id = ''; connected = false; latency = 0; room: RoomView | null = null;
  onRoom: (room: RoomView) => void = () => { }; onState: (race: Race) => void = () => { }; onStatus: (online: boolean) => void = () => { }; onExpired: () => void = () => { };
  private snapshots: { time: number; race: Race }[] = []; private lastSend = 0;
  constructor() {
    let token = ''; try { token = sessionStorage.getItem('cbr-session') || ''; } catch { /* Private browsing may disable storage. */ }
    this.socket = io({ autoConnect: false, auth: { token }, reconnectionDelay: 500, reconnectionDelayMax: 2500, timeout: 6000 });
    this.socket.on('connect', () => { this.connected = true; this.onStatus(true); });
    this.socket.on('disconnect', () => { this.connected = false; this.onStatus(false); });
    this.socket.on('welcome', data => {
      const lostRoom = this.room !== null && !data.room;
      this.id = data.id; this.socket.auth = { token: data.token }; try { sessionStorage.setItem('cbr-session', data.token); } catch { }
      if (lostRoom) { this.clear(); this.onExpired(); }
    });
    this.socket.on('room', (room: RoomView) => { this.room = room; this.onRoom(room); });
    this.socket.on('state', (race: Race) => {
      if (this.snapshots.at(-1)?.race.id !== race.id) this.snapshots = [];
      this.snapshots.push({ time: performance.now(), race }); if (this.snapshots.length > 12) this.snapshots.shift(); this.onState(race);
    });
    setInterval(() => { if (this.connected) { const start = performance.now(); this.socket.timeout(2000).emit('latency', {}, (err: unknown) => { if (!err) this.latency = Math.round(performance.now() - start); }); } }, 2500);
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
  sendInput(input: Input, force = false) {
    const now = performance.now(); if (!this.connected || (!force && now - this.lastSend < 32)) return; this.lastSend = now;
    this.socket.volatile.emit('input', input);
  }
  clear() { this.room = null; this.snapshots = []; }
  interpolated(): Race | null {
    const latest = this.snapshots.at(-1); if (!latest) return null;
    const at = performance.now() - 85;
    let before = this.snapshots[0], after = latest;
    for (let i = 1; i < this.snapshots.length; i++) if (this.snapshots[i].time >= at) { before = this.snapshots[i - 1]; after = this.snapshots[i]; break; }
    const t = Math.max(0, Math.min(1, (at - before.time) / Math.max(1, after.time - before.time)));
    return {
      ...latest.race, racers: latest.race.racers.map(p => {
        if (p.id === this.id) {
          const ahead = Math.min(.1, Math.max(0, (performance.now() - latest.time) / 1000));
          const moving = p.finishTime === null && latest.race.phase === 'racing' && p.falling <= 0 ? ahead : 0;
          return { ...p, px: p.px + p.vx * moving, pz: p.pz + p.vz * moving };
        }
        const a = before.race.racers.find(q => q.id === p.id) || p, b = after.race.racers.find(q => q.id === p.id) || p;
        if (Math.hypot(b.px - a.px, b.pz - a.pz) > 25) return { ...p };
        return { ...p, px: a.px + (b.px - a.px) * t, pz: a.pz + (b.pz - a.pz) * t, yaw: a.yaw + angleDelta(b.yaw, a.yaw) * t, s: a.s + (b.s - a.s) * t, x: a.x + (b.x - a.x) * t };
      })
    };
  }
}
