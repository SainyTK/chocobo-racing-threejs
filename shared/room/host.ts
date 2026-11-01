import { cleanInput, createRace, makeRacer, neutralInput, stepRace, TICK, RACERS, ABILITY_IDS, GRID_SIZE, DIFFICULTY_IDS, DEFAULT_DIFFICULTY, type AbilityId, type Race } from '../game/index.ts';
import { WIRE_VERSION, encodeSnapshot } from '../wire.ts';
import { TRACKS } from '../track/index.ts';
import { randomHex, randomRoomCode, randomSeed } from '../random-id.ts';
import type { Connection, Link, Reply, Room, RoomMetrics, RoomView, Session } from './types.ts';

export const HOLD_MS = 60000;
const CLOSED_MEMORY_MS = 6 * 3600000;
export type Every = (ms: number, fn: () => void) => () => void;
export interface RoomHostOptions {
  diagnostics?: boolean;
  /** Most rooms this host runs at once. The game server runs many; a player's browser runs one. */
  maxRooms?: number;
  maxLinks?: number;
  /** Picks the code for a new room, or null when none is free. The game server reserves player-hosted codes here too. */
  newCode?: (taken: (code: string) => boolean) => string | null;
  /** Repeating timer. A browser host passes one that keeps running in a background tab. */
  every?: Every;
}
const defaultEvery: Every = (ms, fn) => { const timer = setInterval(fn, ms); return () => clearInterval(timer); };
function defaultCode(taken: (code: string) => boolean) {
  for (let i = 0; i < 1000; i++) { const code = randomRoomCode(); if (!taken(code)) return code; }
  return null;
}
function profile(data: any) {
  const character = Number.isInteger(data?.character) && data.character >= 0 && data.character < RACERS.length ? data.character : 0;
  const name = typeof data?.name === 'string' ? data.name.replace(/[<>\x00-\x1f\x7f]/g, '').trim().slice(0, 18) || 'Racer' : 'Racer';
  return { name, character, abilityId: ABILITY_IDS.includes(data?.abilityId) ? data.abilityId as AbilityId : RACERS[character].ability };
}

/**
 * Lobbies, sessions and the 60 Hz authoritative race loop, independent of how players connect. The game server attaches
 * Socket.IO sockets; a player-hosted room attaches WebRTC data channels and the hosting player's own page.
 */
export class RoomHost {
  readonly rooms = new Map<string, Room>();
  readonly sessions = new Map<string, Session>();
  /** Closed codes are remembered so an old invite link explains that its room has closed. */
  readonly closed = new Map<string, number>();
  readonly metrics: RoomMetrics = { tickMs: [], loopLagMs: [], snapshotsPerLoop: [], broadcastMs: [] };
  private links = 0;
  private previousTime = performance.now();
  private accumulator = 0;
  private ticks = 0;
  private readonly stops: (() => void)[];
  private readonly diagnostics: boolean;
  private readonly maxRooms: number;
  private readonly maxLinks: number;
  private readonly newCode: NonNullable<RoomHostOptions['newCode']>;

  constructor(options: RoomHostOptions = {}) {
    this.diagnostics = options.diagnostics ?? false;
    this.maxRooms = options.maxRooms ?? 100;
    this.maxLinks = options.maxLinks ?? 800;
    this.newCode = options.newCode ?? defaultCode;
    const every = options.every ?? defaultEvery;
    this.stops = [every(1000 / 60, () => this.loop()), every(1000, () => this.cleanup()), every(60000, () => this.forget())];
  }

  get linkCount() { return this.links; }
  isTaken(code: string) { return this.rooms.has(code) || this.closed.has(code); }
  close() { for (const stop of this.stops) stop(); }

  /** Starts serving one link. `token` restores an earlier session; the welcome message hands out a new one otherwise. */
  attach(link: Link, token: string): Connection | null {
    if (this.links >= this.maxLinks) { link.close(); return null; }
    // A fixed-order client from another release would misread every snapshot field, so it is told to reload instead.
    if (typeof link.wire === 'number' && link.wire !== WIRE_VERSION) { link.send('outdated', { wire: WIRE_VERSION }); link.close(); return null; }
    this.links++;
    let session = this.sessions.get(token);
    if (!session) {
      session = { id: randomHex(16), token: randomHex(24), link: null, subscribed: false, room: null, seen: Date.now(), awayAt: 0, inputAt: 0, inputSeq: 0, appliedSeq: 0, actionSeq: 0, pendingActions: [] };
      this.sessions.set(session.token, session);
    }
    const s = session;
    s.link?.close();
    s.link = link; s.subscribed = false; s.seen = Date.now(); s.inputSeq = s.appliedSeq = s.actionSeq = 0; s.pendingActions = [];
    // A member who went back to the home page returns by entering the code again, not by reloading.
    const previous = s.awayAt ? undefined : this.rooms.get(s.room || '');
    link.send('welcome', { id: s.id, token: s.token, room: previous ? previous.code : null });
    if (previous) this.restore(s, previous);
    let budgetAt = Date.now(), actions = 0, inputs = 0;
    const budget = (input = false) => {
      if (Date.now() - budgetAt > 1000) { budgetAt = Date.now(); actions = 0; inputs = 0; }
      s.seen = Date.now();
      return input ? ++inputs <= 90 : ++actions <= 12;
    };
    let open = true;
    return {
      receive: (event, data, reply) => {
        if (!open || s.link !== link) return;
        const answer: Reply = reply ?? (() => {});
        if (event === 'input') { if (budget(true)) this.input(s, data); return; }
        if (event === 'action') { this.action(s, data, budget(true), answer); return; }
        if (event === 'latency') { if (budget()) answer(Date.now()); return; }
        const handler = this.handlers[event];
        if (!handler) return;
        if (!budget()) { answer({ error: 'Too many requests. Try again in a moment.' }); return; }
        try { answer(handler(s, data)); } catch (e) { answer({ error: e instanceof Error ? e.message : 'Request failed.' }); }
      },
      closed: () => {
        if (!open) return;
        open = false; this.links--;
        if (s.link !== link) return;
        s.link = null; s.subscribed = false; s.seen = Date.now();
        const room = this.rooms.get(s.room || '');
        if (room) {
          const member = room.members.find(m => m.id === s.id); if (member) member.connected = false;
          const racer = room.race?.racers.find(p => p.id === s.id); if (racer) { racer.connected = false; racer.input = neutralInput(); }
          this.passHost(room, s.id);
          this.broadcast(room);
        }
      },
    };
  }

  /** Tells every member the room is gone and forgets it. Used when the player hosting it leaves. */
  closeRoom(code: string, message: string) {
    const room = this.rooms.get(code); if (!room) return;
    for (const s of this.members(code)) { s.link?.send('closed', { code, message }); s.room = null; s.subscribed = false; s.awayAt = 0; }
    this.rooms.delete(code); this.closed.set(code, Date.now());
  }

  private view(r: Room): RoomView { return { code: r.code, host: r.host, track: r.track, laps: r.laps, difficulty: r.difficulty, members: r.members, phase: r.race?.phase || 'lobby' }; }
  private members(code: string) { return [...this.sessions.values()].filter(s => s.room === code); }
  private listeners(code: string) { return this.members(code).filter(s => s.link && s.subscribed); }
  private v2(s: Session) { return s.link?.wire === WIRE_VERSION; }
  private broadcast(r: Room) { const view = this.view(r); for (const s of this.listeners(r.code)) s.link!.send('room', view); }
  private sendInitial(s: Session, race: Race) { s.link?.send(this.v2(s) ? 'race' : 'state', race); }
  private passHost(room: Room, from: string) { if (room.host === from) room.host = room.members.find(m => m.connected)?.id || room.host; }

  private leave(session: Session) {
    const room = this.rooms.get(session.room || '');
    session.awayAt = 0;
    if (!room) { session.room = null; return; }
    session.subscribed = false;
    room.members = room.members.filter(m => m.id !== session.id);
    if (room.race) { const p = room.race.racers.find(p => p.id === session.id); if (p) { p.connected = false; p.bot = true; p.name += ' [AI]'; } }
    if (room.host === session.id) room.host = room.members.find(m => m.connected)?.id || room.members[0]?.id || '';
    session.room = null;
    if (!room.members.length) { this.rooms.delete(room.code); this.closed.set(room.code, Date.now()); } else this.broadcast(room);
  }
  /** Puts a member back on their kept place: after a dropped connection, a reload or a return from the home page. */
  private restore(session: Session, room: Room) {
    session.awayAt = 0; session.subscribed = true;
    const member = room.members.find(m => m.id === session.id); if (member) { member.connected = true; member.away = false; }
    const racer = room.race?.racers.find(p => p.id === session.id); if (racer) { racer.connected = true; racer.input = neutralInput(); }
    if (!room.members.some(m => m.id === room.host && m.connected)) room.host = session.id;
    this.broadcast(room);
    if (room.race) this.sendInitial(session, room.race);
  }

  private readonly handlers: Record<string, (s: Session, data: any) => unknown> = {
    create: (s, data) => {
      if (this.rooms.size >= this.maxRooms) throw Error('The server is full. Try again shortly.');
      const code = this.newCode(code => this.isTaken(code));
      if (!code) throw Error('The server is full. Try again shortly.');
      this.leave(s);
      const room: Room = { code, host: s.id, track: typeof data?.track === 'string' && Object.hasOwn(TRACKS, data.track) ? data.track : 'test', laps: [1, 2, 3].includes(data?.laps) ? data.laps : 3, difficulty: DIFFICULTY_IDS.includes(data?.difficulty) ? data.difficulty : DEFAULT_DIFFICULTY, members: [{ id: s.id, ...profile(data), connected: true, away: false }], race: null, lastActive: Date.now() };
      this.rooms.set(code, room); s.room = code; s.subscribed = true; this.broadcast(room); return { ok: true, code };
    },
    join: (s, data) => {
      const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
      const room = this.rooms.get(code);
      if (!room && this.closed.has(code)) throw Error(`Room ${code} has closed. Ask the host for a new invite.`);
      if (!code) throw Error('Enter the six-character room code.');
      if (!room) throw Error(`Room ${code} was not found. Check the six-character code.`);
      if (room.code === s.room) { this.restore(s, room); return { ok: true }; }
      if (room.race) throw Error(`Room ${code} is already racing. Try again when the host returns to the lobby.`);
      if (room.members.length >= GRID_SIZE) throw Error(`Room ${code} is full. A room holds six racers.`);
      this.leave(s); s.room = code; s.subscribed = true;
      room.members.push({ id: s.id, ...profile(data), connected: true, away: false }); room.lastActive = Date.now(); this.broadcast(room); return { ok: true };
    },
    profile: (s, data) => {
      const room = this.rooms.get(s.room || ''), member = room?.members.find(m => m.id === s.id);
      if (!room || !member || s.awayAt) throw Error('Join a room first.');
      if (room.race) throw Error('Change racers in the lobby, between races.');
      Object.assign(member, profile(data));
      this.broadcast(room); return { ok: true };
    },
    away: s => {
      const room = this.rooms.get(s.room || ''), member = room?.members.find(m => m.id === s.id);
      if (!room || !member) return { ok: true };
      s.awayAt = Date.now(); s.subscribed = false;
      member.connected = false; member.away = true;
      const racer = room.race?.racers.find(p => p.id === s.id); if (racer) { racer.connected = false; racer.input = neutralInput(); }
      this.passHost(room, s.id); this.broadcast(room); return { ok: true };
    },
    configure: (s, data) => {
      const room = this.rooms.get(s.room || '');
      if (!room || room.host !== s.id || room.race) throw Error('Only the host can change a lobby.');
      if (typeof data?.track === 'string' && Object.hasOwn(TRACKS, data.track)) room.track = data.track;
      if ([1, 2, 3].includes(data?.laps)) room.laps = data.laps;
      if (DIFFICULTY_IDS.includes(data?.difficulty)) room.difficulty = data.difficulty;
      this.broadcast(room); return { ok: true };
    },
    start: s => {
      const room = this.rooms.get(s.room || '');
      if (!room || room.host !== s.id) throw Error('Only the host can start the race.');
      if (room.race) throw Error('A race is already running.');
      const race = createRace(room.track, room.members.map(m => makeRacer(m.id, m.name, m.character, false, m.abilityId)), room.laps, randomSeed(), 'race', 1, room.difficulty);
      room.race = race;
      for (const member of room.members) {
        const session = [...this.sessions.values()].find(s => s.id === member.id);
        if (session) { session.inputSeq = session.appliedSeq = session.actionSeq = 0; session.pendingActions = []; }
        const racer = race.racers.find(p => p.id === member.id); if (racer) racer.connected = member.connected;
      }
      this.broadcast(room); for (const listener of this.listeners(room.code)) this.sendInitial(listener, race); return { ok: true };
    },
    rematch: s => {
      const room = this.rooms.get(s.room || '');
      if (!room || room.host !== s.id) throw Error('Only the host can return everyone to the lobby.');
      if (room.race?.phase !== 'finished') throw Error('Wait for the race to finish.');
      room.race = null; this.broadcast(room); return { ok: true };
    },
    leave: s => { this.leave(s); return { ok: true }; },
  };

  private input(s: Session, data: any) {
    const r = this.rooms.get(s.room || '')?.race;
    const p = r?.racers.find(p => p.id === s.id);
    if (!p || r?.phase === 'finished') return;
    if (this.v2(s)) {
      if (data?.race !== r?.id || !Number.isSafeInteger(data?.seq) || data.seq <= s.inputSeq) return;
      s.inputSeq = data.seq;
      p.input = { ...cleanInput(data.input), item: false, ability: false, rescue: false };
    } else p.input = cleanInput(data);
    s.inputAt = Date.now();
  }
  private action(s: Session, data: any, withinBudget: boolean, reply: Reply) {
    const race = this.rooms.get(s.room || '')?.race;
    if (!withinBudget || !this.v2(s) || !race || data?.race !== race.id || !Number.isSafeInteger(data?.seq) || data.seq < 1 || !['item', 'ability', 'rescue'].includes(data?.kind)) { reply({ error: 'Invalid action' }); return; }
    if (data.seq > s.actionSeq) {
      if (s.pendingActions.length >= 16) { reply({ error: 'Action queue full' }); return; }
      s.actionSeq = data.seq; s.pendingActions.push(data.kind);
    }
    reply({ ok: true });
  }

  private sample(a: number[], v: number) { if (this.diagnostics && a.length < 20000) a.push(v); }
  private loop() {
    const now = performance.now();
    this.sample(this.metrics.loopLagMs, Math.max(0, now - this.previousTime - 1000 / 60));
    let snapshots = 0;
    this.accumulator += Math.min((now - this.previousTime) / 1000, .25); this.previousTime = now;
    const tickBefore = this.ticks;
    while (this.accumulator >= TICK) {
      const start = this.diagnostics ? performance.now() : 0;
      for (const room of this.rooms.values()) if (room.race) this.stepRoom(room, room.race);
      if (this.diagnostics) this.sample(this.metrics.tickMs, performance.now() - start);
      this.accumulator -= TICK; this.ticks++;
    }
    const broadcastStart = this.diagnostics ? performance.now() : 0;
    // One newest snapshot per room, never stale intermediate catch-up states.
    if (Math.floor(this.ticks / 3) > Math.floor(tickBefore / 3)) for (const room of this.rooms.values()) if (room.race) { this.snapshot(room, room.race); snapshots++; }
    if (snapshots && this.diagnostics) this.sample(this.metrics.broadcastMs, performance.now() - broadcastStart);
    this.sample(this.metrics.snapshotsPerLoop, snapshots);
  }
  private stepRoom(room: Room, race: Race) {
    const members = this.members(room.code);
    for (const session of members) {
      const p = race.racers.find(p => p.id === session.id); if (!p) continue;
      const action = session.pendingActions.shift();
      if (action) { p.input = { ...p.input, [action]: true }; if (action === 'item') p.lastItem = false; if (action === 'ability') p.lastAbility = false; }
    }
    stepRace(race);
    for (const session of members) {
      session.appliedSeq = session.inputSeq;
      const p = race.racers.find(p => p.id === session.id);
      if (p && session.link && this.v2(session)) p.input = { ...p.input, item: false, ability: false, rescue: false };
    }
  }
  private snapshot(room: Room, race: Race) {
    const listeners = this.listeners(room.code);
    const modern = listeners.filter(s => this.v2(s)), legacy = listeners.filter(s => !this.v2(s));
    for (const s of legacy) s.link!.sendVolatile('state', race);
    if (!modern.length) return;
    const snapshot = encodeSnapshot(race, this.ticks, Object.fromEntries(this.members(room.code).map(s => [s.id, s.appliedSeq])));
    for (const s of modern) s.link!.sendVolatile('snapshot', snapshot);
  }
  private cleanup() {
    for (const s of this.sessions.values()) {
      if (!s.link && Date.now() - s.seen > HOLD_MS) { this.leave(s); this.sessions.delete(s.token); }
      else if (s.awayAt && Date.now() - s.awayAt > HOLD_MS) this.leave(s);
      // A backgrounded browser must not leave a steering or item button held forever.
      if (s.link && Date.now() - s.inputAt > 1000) { const p = this.rooms.get(s.room || '')?.race?.racers.find(p => p.id === s.id); if (p) p.input = neutralInput(); }
    }
  }
  private forget() { for (const [code, at] of this.closed) if (Date.now() - at > CLOSED_MEMORY_MS) this.closed.delete(code); }
}
