import { DurableObject } from 'cloudflare:workers';
import { CLOSED_MEMORY_MS, DEFAULT_ICE_SERVERS, HOLD_MS, RELAY_LIMIT, SIGNAL_LIMIT, type IceServer } from '../../shared/peer.ts';
import type { GuestInbound, HostInbound, RoomInfo } from '../../shared/signal-protocol.ts';
import { randomHex } from '../../shared/random-id.ts';
import { GRID_SIZE } from '../../shared/game/constants.ts';
import type { Env } from './env.ts';

/** `lost`: the host's socket dropped and the code waits `HOLD_MS` for it to come back. */
interface Meta { secret: string; status: 'open' | 'lost' | 'closed'; at: number }
interface Attachment { role: 'host' | 'guest'; id: string }
/** Guests may hold a stale socket while a new one opens, so a room accepts a few more sockets than seats. */
const MAX_GUESTS = GRID_SIZE * 3;
/** Messages per second per socket. A relayed guest sends about 30 inputs, and its host about 20 snapshots, a second. */
const MESSAGE_BUDGET = 150;

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
function iceServers(env: Env): IceServer[] {
  try { const parsed = JSON.parse(env.ICE_SERVERS || ''); if (Array.isArray(parsed)) return parsed; } catch { /* Unset falls back to public STUN. */ }
  return DEFAULT_ICE_SERVERS;
}

/**
 * One room code. The room itself runs in the host's browser; this object only knows whether the code is in use,
 * holds the host's and guests' sockets, and passes messages between them. Sockets hibernate between messages.
 */
export class RoomObject extends DurableObject<Env> {
  private readonly budgets = new Map<WebSocket, { at: number; count: number }>();

  async fetch(request: Request) {
    const url = new URL(request.url);
    const [, code, kind] = url.pathname.split('/');
    const meta = await this.ctx.storage.get<Meta>('meta');
    if (kind === 'info') return json(this.info(meta, code));
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket upgrade.', { status: 426 });
    if (kind === 'host') return this.host(url, code, meta);
    const info = this.info(meta, code);
    if (!info.ok) return this.refuse(info.error);
    if (this.ctx.getWebSockets('guest').length >= MAX_GUESTS) return this.refuse(`Room ${code} is full. A room holds six racers.`);
    const id = randomHex(8);
    return this.accept(['guest', `g:${id}`], { role: 'guest', id }).response;
  }

  private async host(url: URL, code: string, existing: Meta | undefined) {
    let meta = existing;
    if (url.searchParams.has('new')) {
      if (meta) return new Response('Code in use.', { status: 409 });
      meta = { secret: randomHex(16), status: 'open', at: Date.now() };
    } else if (!meta || meta.status === 'closed' || meta.secret !== url.searchParams.get('secret')) {
      return this.refuse(meta?.status === 'closed' ? `Room ${code} has closed.` : 'This room belongs to another host.');
    }
    for (const old of this.ctx.getWebSockets('host')) old.close(1000, 'Replaced by a new host connection.');
    meta.status = 'open'; meta.at = Date.now();
    await this.ctx.storage.put('meta', meta);
    await this.ctx.storage.deleteAlarm();
    const { server, response } = this.accept(['host'], { role: 'host', id: 'host' });
    this.send(server, { t: 'opened', code, secret: meta.secret, iceServers: iceServers(this.env) });
    return response;
  }
  private info(meta: Meta | undefined, code: string): RoomInfo {
    if (!meta) return { error: `Room ${code} was not found. Check the six-character code.` };
    if (meta.status === 'closed') return { error: `Room ${code} has closed. Ask the host for a new invite.` };
    if (meta.status === 'lost') return { error: `The host of room ${code} is reconnecting. Try again in a moment.`, retry: true };
    return { ok: true, iceServers: iceServers(this.env) };
  }
  /** Hands the client its socket. The server end hibernates with its tags and attachment. */
  private accept(tags: string[], attachment: Attachment) {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, tags);
    server.serializeAttachment(attachment);
    return { server, response: new Response(null, { status: 101, webSocket: client }) };
  }
  /** A browser only sees a WebSocket's close code, so a refusal is sent as a message before closing. */
  private refuse(message: string) {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    server.send(JSON.stringify({ t: 'error', message }));
    server.close(1008, 'Refused');
    return new Response(null, { status: 101, webSocket: client });
  }
  private send(ws: WebSocket, message: HostInbound | GuestInbound) { try { ws.send(JSON.stringify(message)); } catch { /* Already closing. */ } }
  private withinBudget(ws: WebSocket) {
    const now = Date.now();
    let budget = this.budgets.get(ws);
    if (!budget || now - budget.at > 1000) { budget = { at: now, count: 0 }; this.budgets.set(ws, budget); }
    return ++budget.count <= MESSAGE_BUDGET;
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > RELAY_LIMIT + 1024 || !this.withinBudget(ws)) return;
    let message: any;
    try { message = JSON.parse(raw); } catch { return; }
    const from = ws.deserializeAttachment() as Attachment;
    if (from.role === 'host') {
      if (message?.t === 'close') { await this.close(); return; }
      if ((message?.t === 'signal' || message?.t === 'relay') && typeof message.to === 'string') {
        for (const guest of this.ctx.getWebSockets(`g:${message.to}`)) this.send(guest, { t: message.t, data: message.data });
      }
      return;
    }
    if (message?.t !== 'signal' && message?.t !== 'relay') return;
    if (message.t === 'signal' && JSON.stringify(message.data ?? null).length > SIGNAL_LIMIT) return;
    for (const host of this.ctx.getWebSockets('host')) this.send(host, { t: message.t, from: from.id, data: message.data });
  }
  async webSocketClose(ws: WebSocket) { await this.closed(ws); }
  async webSocketError(ws: WebSocket) { await this.closed(ws); }
  private async closed(ws: WebSocket) {
    this.budgets.delete(ws);
    try { ws.close(1000, 'Closed'); } catch { /* Already closed. */ }
    const who = ws.deserializeAttachment() as Attachment;
    if (who.role === 'guest') { for (const host of this.ctx.getWebSockets('host')) this.send(host, { t: 'peer-gone', from: who.id }); return; }
    if (this.ctx.getWebSockets('host').some(other => other !== ws && other.readyState === WebSocket.OPEN)) return;
    const meta = await this.ctx.storage.get<Meta>('meta');
    if (meta?.status !== 'open') return;
    meta.status = 'lost'; meta.at = Date.now();
    await this.ctx.storage.put('meta', meta);
    await this.ctx.storage.setAlarm(Date.now() + HOLD_MS);
  }
  /** Ends the code for good: guests are told, and the code is remembered for a while as closed. */
  private async close() {
    const meta = await this.ctx.storage.get<Meta>('meta'); if (!meta) return;
    meta.status = 'closed'; meta.at = Date.now();
    await this.ctx.storage.put('meta', meta);
    for (const guest of this.ctx.getWebSockets('guest')) { this.send(guest, { t: 'host-gone' }); guest.close(1000, 'Room closed'); }
    for (const host of this.ctx.getWebSockets('host')) host.close(1000, 'Room closed');
    await this.ctx.storage.setAlarm(Date.now() + CLOSED_MEMORY_MS);
  }
  async alarm() {
    const meta = await this.ctx.storage.get<Meta>('meta'); if (!meta) return;
    if (meta.status === 'lost' && Date.now() - meta.at >= HOLD_MS) await this.close();
    else if (meta.status === 'closed' && Date.now() - meta.at >= CLOSED_MEMORY_MS) await this.ctx.storage.deleteAll();
  }
}
