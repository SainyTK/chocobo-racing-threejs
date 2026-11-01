import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';
import { RoomHost } from '../shared/room/host.ts';
import type { Link } from '../shared/room/types.ts';
import { randomRoomCode } from '../shared/random-id.ts';
import { RELAY_LIMIT } from '../shared/peer.ts';
import { PeerSignaling } from './peer-signaling.ts';

export async function createGameServer({ development = false, diagnostics = false } = {}) {
  const app = express(), http = createServer(app);
  app.disable('x-powered-by');
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  const io = new Server(http, {
    // Relayed player-hosted rooms carry full race states through here.
    maxHttpBufferSize: RELAY_LIMIT, perMessageDeflate: false,
    pingInterval: 10000, pingTimeout: 10000,
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      let allowed = !origin; // Native test clients carry no browser cookies or authentication.
      if (origin) { try { allowed = origins.length ? origins.includes(origin) : new URL(origin).host === req.headers.host; } catch { allowed = false; } }
      cb(null, allowed);
    },
  });
  // Server rooms and player-hosted rooms share one code space, so a code alone tells a joining player where to go.
  const taken = (code: string) => host.isTaken(code) || peers.has(code);
  const reserve = () => { for (let i = 0; i < 1000; i++) { const code = randomRoomCode(); if (!taken(code)) return code; } return null; };
  const host: RoomHost = new RoomHost({ diagnostics, newCode: reserve });
  const peers: PeerSignaling = new PeerSignaling(io, reserve, code => host.closed.set(code, Date.now()));
  io.on('connection', socket => {
    const link: Link = { wire: socket.handshake.auth?.wire, send: (event, data) => socket.emit(event, data), sendVolatile: (event, data) => socket.volatile.emit(event, data), close: () => socket.disconnect(true) };
    const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
    const connection = host.attach(link, token);
    if (!connection) return;
    socket.onAny((event: string, data: unknown, ack: unknown) => {
      const reply = typeof ack === 'function' ? ack as (result: unknown) => void : () => {};
      if (peers.handle(socket, event, data, reply)) return;
      const code = event === 'join' && typeof (data as any)?.code === 'string' ? (data as any).code.trim().toUpperCase() : '';
      if (code && peers.has(code)) { reply(peers.joinAnswer(code)); return; }
      connection.receive(event, data, typeof ack === 'function' ? reply : undefined);
    });
    socket.on('disconnect', () => { connection.closed(); peers.disconnected(socket); });
  });
  app.get('/health', (_req, res) => res.json({ ok: true, rooms: host.rooms.size, peerRooms: peers.rooms.size, players: io.engine.clientsCount }));
  let vite: Awaited<ReturnType<typeof import('vite')['createServer']>> | undefined;
  if (development) { const { createServer } = await import('vite'); vite = await createServer({ server: { middlewareMode: true, hmr: { server: http } }, appType: 'spa' }); app.use(vite.middlewares); }
  else { const dir = fileURLToPath(new URL('../dist', import.meta.url)); app.use(express.static(dir)); app.get('/{*path}', (_req, res) => res.sendFile(path.join(dir, 'index.html'))); }
  return { app, http, io, rooms: host.rooms, peers, metrics: host.metrics, close: async () => { host.close(); peers.close(); await vite?.close(); await new Promise<void>(resolve => io.close(() => resolve())); } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createGameServer({ development: process.env.NODE_ENV !== 'production' });
  const port = Number(process.env.PORT) || 3000;
  server.http.listen(port, '0.0.0.0', () => console.log(`Chocobo Racing browser remake running at http://localhost:${port}`));
  const shutdown = async () => { await server.close(); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
