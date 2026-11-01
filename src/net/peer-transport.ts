import { DIRECT_TIMEOUT_MS, type IceServer } from '../../shared/peer.ts';
import { WIRE_VERSION } from '../../shared/wire.ts';
import { randomHex } from '../../shared/random-id.ts';
import { parseFrame, type HostFrame, type Pipe } from './pipe.ts';
import { RelayPipe } from './relay-pipe.ts';
import { RtcPipe } from './rtc-pipe.ts';
import type { Signaling } from './signaling.ts';
import { NoResponse, type Route, type Transport } from './transport.ts';

/** How long a guest keeps trying to get back to a host it lost before telling the player the room is gone. */
const RECONNECT_DEADLINE_MS = 30000;
const RETRY_MS = 1500;
/** A pipe counts only once the host answers its hello. A relay pipe forms even when the host is gone, so it must prove itself. */
const WELCOME_TIMEOUT_MS = 8000;

/**
 * A guest's connection to a room that runs in another player's browser. It connects directly over WebRTC when the two
 * networks allow it and through the game server's relay otherwise, and redials after a drop with the same session.
 */
export class PeerTransport implements Transport {
  onMessage: Transport['onMessage'] = () => {};
  onStatus: Transport['onStatus'] = () => {};
  private pipe: Pipe | null = null;
  /** The host has answered on the current pipe. */
  private live = false;
  private welcomeTimer: ReturnType<typeof setTimeout> | undefined;
  private dialing = false;
  private closed = false;
  private lostAt = 0;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();

  constructor(readonly code: string, private readonly iceServers: IceServer[], private readonly signaling: Signaling, private token: string) {}
  get connected() { return this.pipe !== null && this.live; }
  get route(): Route { return this.pipe?.route ?? 'direct'; }

  connect() {
    if (this.pipe || this.dialing || this.closed) return;
    this.dialing = true;
    void this.dial().then(pipe => {
      this.dialing = false;
      if (this.closed) { pipe?.close(); return; }
      if (!pipe) { this.retry(); return; }
      this.pipe = pipe;
      pipe.onMessage = text => this.receive(text);
      pipe.onClose = () => this.lost(pipe);
      this.welcomeTimer = setTimeout(() => pipe.close(), WELCOME_TIMEOUT_MS);
      pipe.send(JSON.stringify({ e: 'hello', d: { token: this.token, wire: WIRE_VERSION } }), false);
    });
  }
  request(event: string, data: unknown, timeoutMs: number) {
    const pipe = this.pipe;
    if (!pipe || !this.live) return Promise.reject(new NoResponse('The host did not respond. Check your connection before trying again.'));
    const id = this.nextId++;
    return new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new NoResponse('The host did not respond. Check your connection before trying again.')); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      pipe.send(JSON.stringify({ e: event, d: data, i: id }), false);
    });
  }
  send(event: string, data: unknown) { this.pipe?.send(JSON.stringify({ e: event, d: data }), false); }
  sendVolatile(event: string, data: unknown) { this.pipe?.send(JSON.stringify({ e: event, d: data }), true); }
  setToken(token: string) { this.token = token; }
  close() {
    this.closed = true;
    clearTimeout(this.welcomeTimer);
    const pipe = this.pipe; this.pipe = null; this.live = false; pipe?.close();
    this.failPending();
  }

  private receive(text: string) {
    const frame = parseFrame<HostFrame>(text); if (!frame) return;
    if (!this.live) { this.live = true; this.lostAt = 0; clearTimeout(this.welcomeTimer); this.onStatus(true); }
    if ('i' in frame) { const waiting = this.pending.get(frame.i); if (waiting) { clearTimeout(waiting.timer); this.pending.delete(frame.i); waiting.resolve(frame.r); } return; }
    this.onMessage(frame.e, frame.d);
  }
  private lost(pipe: Pipe) {
    if (this.pipe !== pipe) return;
    const wasLive = this.live;
    this.pipe = null; this.live = false; this.lostAt ||= Date.now(); clearTimeout(this.welcomeTimer);
    this.failPending();
    if (wasLive) this.onStatus(false);
    if (this.closed) return;
    // A pipe that never reached the host goes through the room lookup, which notices a room that has closed.
    if (wasLive) this.connect(); else this.retry();
  }
  private failPending() {
    for (const waiting of this.pending.values()) { clearTimeout(waiting.timer); waiting.reject(new NoResponse('The connection to the host dropped.')); }
    this.pending.clear();
  }
  /** Tries again shortly, unless the room is gone or the host has been unreachable for too long. */
  private retry() {
    this.lostAt ||= Date.now();
    if (Date.now() - this.lostAt > RECONNECT_DEADLINE_MS) { this.giveUp(`Lost the connection to the host of room ${this.code}.`); return; }
    setTimeout(() => {
      if (this.closed) return;
      void this.signaling.locate({ code: this.code }).then(answer => {
        if (answer?.peer || /reconnecting/.test(answer?.error || '')) this.connect();
        else this.giveUp(answer?.error || `Room ${this.code} has closed.`);
      }, () => this.connect());
    }, RETRY_MS);
  }
  private giveUp(message: string) { this.close(); this.onMessage('closed', { code: this.code, message }); }

  /** A direct connection first; the game server's relay if none forms in time. Null when neither is possible now. */
  private async dial(): Promise<Pipe | null> {
    const attempt = randomHex(8);
    let rtc: RtcPipe;
    // Some browsers and privacy settings turn WebRTC off; those players still get in through the relay.
    try { rtc = new RtcPipe(this.iceServers, attempt, signal => this.signaling.signal(this.code, signal)); }
    catch { return this.signaling.connected && !this.closed ? this.relay() : null; }
    const unsubscribe = this.signaling.subscribe(event => {
      if (event.type === 'signal' && event.message.code === this.code && (event.message.data as { attempt?: string })?.attempt === attempt) void rtc.receive(event.message.data as never).catch(() => rtc.close());
    });
    const direct = await new Promise<boolean>(resolve => {
      const timer = setTimeout(() => resolve(false), DIRECT_TIMEOUT_MS);
      rtc.onOpen = () => { clearTimeout(timer); resolve(true); };
      rtc.onClose = () => { clearTimeout(timer); resolve(false); };
      rtc.offer().catch(() => resolve(false));
    });
    unsubscribe();
    if (direct && !this.closed) return rtc;
    rtc.onClose = () => {}; rtc.close();
    if (!this.signaling.connected || this.closed) return null;
    return this.relay();
  }
  private relay() {
    let unsubscribe = () => {};
    const pipe = new RelayPipe((text, volatile) => this.signaling.relay(this.code, text, volatile), () => unsubscribe());
    unsubscribe = this.signaling.subscribe(event => {
      if (event.type === 'relay' && event.message.code === this.code) pipe.deliver(event.message.data);
      else if (event.type === 'host-gone' && event.message.code === this.code) pipe.close();
      else if (event.type === 'status' && !event.connected) pipe.close();
    });
    return pipe;
  }
}
