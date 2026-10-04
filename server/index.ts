import express from 'express';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';
import { cleanInput, createRace, makeRacer, neutralInput, stepRace, TICK, RACERS, ABILITY_IDS, GRID_SIZE, type AbilityId, type Race } from '../shared/game/index.ts';
import { encodeSnapshot } from '../shared/wire.ts';
import { TRACKS, type TrackId } from '../shared/track/index.ts';

interface Member { id: string; name: string; character: number; abilityId: AbilityId; connected: boolean }
interface Room { code: string; host: string; track: TrackId; laps: number; members: Member[]; race: Race | null; lastActive: number }
interface Session { id: string; token: string; socket: string | null; room: string | null; seen: number; inputAt: number; inputSeq: number; appliedSeq: number; actionSeq: number; pendingActions: ('item' | 'ability' | 'rescue')[] }
export async function createGameServer({ development = false, diagnostics = false } = {}) {
  const app = express(), http = createServer(app);
  app.disable('x-powered-by');
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  const io = new Server(http, {
    maxHttpBufferSize: 4096, perMessageDeflate: false,
    pingInterval: 10000, pingTimeout: 10000,
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      let allowed = !origin; // Native test clients carry no browser cookies or authentication.
      if (origin) { try { allowed = origins.length ? origins.includes(origin) : new URL(origin).host === req.headers.host; } catch { allowed = false; } }
      cb(null, allowed);
    },
  });
  const rooms = new Map<string, Room>(), sessions = new Map<string, Session>();
  const view = (r: Room) => ({ code: r.code, host: r.host, track: r.track, laps: r.laps, members: r.members, phase: r.race?.phase || 'lobby' });
  const broadcast = (r: Room) => io.to(r.code).emit('room', view(r));
  const channel = (socket: any) => socket.handshake.auth?.wire === 2 ? 'v2' : 'v1';
  const sendInitial = (socket: any, race: Race) => socket.emit(channel(socket) === 'v2' ? 'race' : 'state', race);
  const join = (socket: any, code: string) => { socket.join(code); socket.join(`${code}:${channel(socket)}`); };
  function leave(session: Session) {
    const room = rooms.get(session.room || '');
    if (!room) { session.room = null; return; }
    if (session.socket) { const socket = io.sockets.sockets.get(session.socket); socket?.leave(room.code); if (socket) socket.leave(`${room.code}:${channel(socket)}`); }
    room.members = room.members.filter(m => m.id !== session.id);
    if (room.race) { const p = room.race.racers.find(p => p.id === session.id); if (p) { p.connected = false; p.bot = true; p.name += ' [AI]'; } }
    if (room.host === session.id) room.host = room.members.find(m => m.connected)?.id || room.members[0]?.id || '';
    session.room = null;
    if (!room.members.length) rooms.delete(room.code); else broadcast(room);
  }
  io.on('connection', socket => {
    if (io.engine.clientsCount > 800) { socket.disconnect(true); return; }
    const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
    let session = sessions.get(token);
    if (!session) { session = { id: randomUUID(), token: randomBytes(24).toString('hex'), socket: null, room: null, seen: Date.now(), inputAt: 0, inputSeq: 0, appliedSeq: 0, actionSeq: 0, pendingActions: [] }; sessions.set(session.token, session); }
    const s = session;
    if (s.socket) io.sockets.sockets.get(s.socket)?.disconnect(true);
    s.socket = socket.id; s.seen = Date.now(); s.inputSeq = s.appliedSeq = s.actionSeq = 0; s.pendingActions = [];
    socket.emit('welcome', { id: s.id, token: s.token, room: rooms.has(s.room || '') ? s.room : null });
    const previous = rooms.get(s.room || '');
    if (previous) {
      join(socket, previous.code);
      const member = previous.members.find(m => m.id === s.id); if (member) member.connected = true;
      const racer = previous.race?.racers.find(p => p.id === s.id); if (racer) { racer.connected = true; racer.input = neutralInput(); }
      broadcast(previous);
      if (previous.race) sendInitial(socket, previous.race);
    }
    let budgetAt = Date.now(), actions = 0, inputs = 0;
    const budget = (input = false) => {
      if (Date.now() - budgetAt > 1000) { budgetAt = Date.now(); actions = 0; inputs = 0; }
      s.seen = Date.now();
      return input ? ++inputs <= 90 : ++actions <= 12;
    };
    const profile = (data: any) => {
      const character = Number.isInteger(data?.character) && data.character >= 0 && data.character < RACERS.length ? data.character : 0;
      return { name: typeof data?.name === 'string' ? data.name.replace(/[<>\x00-\x1f\x7f]/g, '').trim().slice(0, 18) || 'Racer' : 'Racer', character, abilityId: ABILITY_IDS.includes(data?.abilityId) ? data.abilityId as AbilityId : RACERS[character].ability };
    };
    const handle = (event: string, fn: (data: any) => unknown) => socket.on(event, (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      if (!budget()) return reply({ error: 'Too many requests. Try again in a moment.' });
      try { reply(fn(data)); } catch (e) { reply({ error: e instanceof Error ? e.message : 'Request failed.' }); }
    });
    handle('create', data => {
      if (rooms.size >= 100) throw Error('The server is full. Try again shortly.');
      leave(s);
      let code: string; do { code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (rooms.has(code));
      const room: Room = { code, host: s.id, track: typeof data?.track === 'string' && Object.hasOwn(TRACKS, data.track) ? data.track : 'test', laps: [1, 2, 3].includes(data?.laps) ? data.laps : 3, members: [{ id: s.id, ...profile(data), connected: true }], race: null, lastActive: Date.now() };
      rooms.set(code, room); s.room = code; join(socket, code); broadcast(room); return { ok: true, code };
    });
    handle('join', data => {
      const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
      const room = rooms.get(code);
      if (!room) throw Error('Room not found. Check the six-character code.');
      if (room.code === s.room) { broadcast(room); return { ok: true }; }
      if (room.race) throw Error('This race has already started. Join after the host returns to the lobby.');
      if (room.members.length >= GRID_SIZE) throw Error('This room is full. Maximum six racers.');
      leave(s); s.room = code; join(socket, code);
      room.members.push({ id: s.id, ...profile(data), connected: true }); room.lastActive = Date.now(); broadcast(room); return { ok: true };
    });
    handle('configure', data => {
      const room = rooms.get(s.room || '');
      if (!room || room.host !== s.id || room.race) throw Error('Only the host can change a lobby.');
      if (typeof data?.track === 'string' && Object.hasOwn(TRACKS, data.track)) room.track = data.track;
      if ([1, 2, 3].includes(data?.laps)) room.laps = data.laps;
      broadcast(room); return { ok: true };
    });
    handle('start', () => {
      const room = rooms.get(s.room || '');
      if (!room || room.host !== s.id) throw Error('Only the host can start the race.');
      if (room.race) throw Error('A race is already running.');
      room.race = createRace(room.track, room.members.map(m => makeRacer(m.id, m.name, m.character, false, m.abilityId)), room.laps, randomBytes(4).readUInt32LE());
      for (const member of room.members) { const session = [...sessions.values()].find(s => s.id === member.id); if (session) { session.inputSeq = session.appliedSeq = session.actionSeq = 0; session.pendingActions = []; } const racer = room.race.racers.find(p => p.id === member.id); if (racer) racer.connected = member.connected; }
      broadcast(room); for (const socket of io.sockets.sockets.values()) if (socket.rooms.has(room.code)) sendInitial(socket, room.race); return { ok: true };
    });
    handle('rematch', () => {
      const room = rooms.get(s.room || '');
      if (!room || room.host !== s.id) throw Error('Only the host can return everyone to the lobby.');
      if (room.race?.phase !== 'finished') throw Error('Wait for the race to finish.');
      room.race = null; broadcast(room); return { ok: true };
    });
    handle('leave', () => { leave(s); return { ok: true }; });
    socket.on('input', data => {
      if (!budget(true)) return;
      const r = rooms.get(s.room || '')?.race;
      const p = r?.racers.find(p => p.id === s.id);
      if (p && r?.phase !== 'finished') {
        if (channel(socket) === 'v2') {
          if (data?.race !== r?.id || !Number.isSafeInteger(data?.seq) || data.seq <= s.inputSeq) return;
          s.inputSeq = data.seq;
          p.input = { ...cleanInput(data.input), item: false, ability: false, rescue: false };
        } else p.input = cleanInput(data);
        s.inputAt = Date.now();
      }
    });
    socket.on('action', (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const race = rooms.get(s.room || '')?.race;
      if (!budget(true) || channel(socket) !== 'v2' || !race || data?.race !== race.id || !Number.isSafeInteger(data?.seq) || data.seq < 1 || !['item','ability','rescue'].includes(data?.kind)) return reply({ error: 'Invalid action' });
      if (data.seq > s.actionSeq) {
        if (s.pendingActions.length >= 16) return reply({ error: 'Action queue full' });
        s.actionSeq = data.seq; s.pendingActions.push(data.kind);
      }
      reply({ ok: true });
    });
    socket.on('latency', (_data, ack) => { if (budget() && typeof ack === 'function') ack(Date.now()); });
    socket.on('disconnect', () => {
      if (s.socket !== socket.id) return;
      s.socket = null; s.seen = Date.now();
      const room = rooms.get(s.room || '');
      if (room) {
        const member = room.members.find(m => m.id === s.id); if (member) member.connected = false;
        const racer = room.race?.racers.find(p => p.id === s.id); if (racer) { racer.connected = false; racer.input = neutralInput(); }
        if (room.host === s.id) room.host = room.members.find(m => m.connected)?.id || s.id;
        broadcast(room);
      }
    });
  });
  const metrics = { tickMs: [] as number[], loopLagMs: [] as number[], snapshotsPerLoop: [] as number[], broadcastMs: [] as number[] };
  const sample = (a: number[], v: number) => { if (diagnostics && a.length < 20000) a.push(v); };
  let previousTime = performance.now(), accumulator = 0, ticks = 0;
  const timer = setInterval(() => {
    const now = performance.now(); sample(metrics.loopLagMs, Math.max(0, now - previousTime - 1000 / 60)); let snapshots = 0; accumulator += Math.min((now - previousTime) / 1000, .25); previousTime = now;
    const tickBefore = ticks;
    while (accumulator >= TICK) {
      const start = diagnostics ? performance.now() : 0;
      for (const room of rooms.values()) if (room.race) {
        for (const session of sessions.values()) if (session.room === room.code) {
          const p = room.race.racers.find(p=>p.id===session.id); if (!p) continue;
          const action = session.pendingActions.shift();
          if (action) { p.input = { ...p.input, [action]: true }; if (action === 'item') p.lastItem = false; if (action === 'ability') p.lastAbility = false; }
        }
        stepRace(room.race);
        for (const session of sessions.values()) if (session.room === room.code) {
          session.appliedSeq = session.inputSeq;
          const socket = session.socket ? io.sockets.sockets.get(session.socket) : null;
          const p = room.race.racers.find(p=>p.id===session.id);
          if (p && socket && channel(socket) === 'v2') p.input = { ...p.input, item: false, ability: false, rescue: false };
        }
      }
      if (diagnostics) sample(metrics.tickMs, performance.now() - start);
      accumulator -= TICK; ticks++;
    }
    const broadcastStart = diagnostics ? performance.now() : 0;
    // One newest snapshot per room, never stale intermediate catch-up states.
    if (Math.floor(ticks / 3) > Math.floor(tickBefore / 3)) for (const room of rooms.values()) if (room.race) {
      if (io.sockets.adapter.rooms.has(`${room.code}:v1`)) io.to(`${room.code}:v1`).volatile.emit('state', room.race);
      if (io.sockets.adapter.rooms.has(`${room.code}:v2`)) io.to(`${room.code}:v2`).volatile.emit('snapshot', encodeSnapshot(room.race, ticks, Object.fromEntries([...sessions.values()].filter(s=>s.room===room.code).map(s=>[s.id,s.appliedSeq]))));
      snapshots++;
    }
    if (snapshots && diagnostics) sample(metrics.broadcastMs, performance.now() - broadcastStart);
    sample(metrics.snapshotsPerLoop, snapshots);
  }, 1000 / 60);
  const cleanup = setInterval(() => {
    for (const s of sessions.values()) {
      if (!s.socket && Date.now() - s.seen > 60000) { leave(s); sessions.delete(s.token); }
      // A backgrounded browser must not leave a steering or item button held forever.
      if (s.socket && Date.now() - s.inputAt > 1000) { const p = rooms.get(s.room || '')?.race?.racers.find(p => p.id === s.id); if (p) p.input = neutralInput(); }
    }
  }, 1000);
  app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size, players: io.engine.clientsCount }));
  let vite: Awaited<ReturnType<typeof import('vite')['createServer']>> | undefined;
  if (development) { const { createServer } = await import('vite'); vite = await createServer({ server: { middlewareMode: true, hmr: { server: http } }, appType: 'spa' }); app.use(vite.middlewares); }
  else { const dir = fileURLToPath(new URL('../dist', import.meta.url)); app.use(express.static(dir)); app.get('/{*path}', (_req, res) => res.sendFile(path.join(dir, 'index.html'))); }
  return { app, http, io, rooms, metrics, close: async () => { clearInterval(timer); clearInterval(cleanup); await vite?.close(); await new Promise<void>(resolve => io.close(() => resolve())); } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createGameServer({ development: process.env.NODE_ENV !== 'production' });
  const port = Number(process.env.PORT) || 3000;
  server.http.listen(port, '0.0.0.0', () => console.log(`Chocobo Racing browser remake running at http://localhost:${port}`));
  const shutdown = async () => { await server.close(); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
