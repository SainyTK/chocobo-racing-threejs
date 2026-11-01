import { io, type Socket } from 'socket.io-client';
import { WIRE_VERSION } from '../../shared/wire.ts';
import { NoResponse, type Transport } from './transport.ts';

/** The game server over Socket.IO: server-hosted rooms, and introductions to player-hosted ones. */
export class SocketTransport implements Transport {
  readonly route = 'server';
  onMessage: Transport['onMessage'] = () => {};
  onStatus: Transport['onStatus'] = () => {};
  private readonly socket: Socket;

  constructor(url: string | undefined, token: string) {
    this.socket = io(url, { autoConnect: false, auth: { token, wire: WIRE_VERSION }, transports: ['websocket'], reconnectionDelay: 500, reconnectionDelayMax: 2500, timeout: 6000 });
    this.socket.on('connect', () => this.onStatus(true));
    this.socket.on('disconnect', () => this.onStatus(false));
    this.socket.onAny((event: string, data: unknown) => this.onMessage(event, data));
  }
  get connected() { return this.socket.connected; }
  get hasToken() { return !!(this.socket.auth as { token?: string }).token; }
  /** The Engine.IO transport name, shown in diagnostics. */
  get engine() { return this.socket.io.engine?.transport.name; }
  connect() { this.socket.connect(); }
  request(event: string, data: unknown, timeoutMs: number) {
    return new Promise<any>((resolve, reject) => this.socket.timeout(timeoutMs).emit(event, data, (err: unknown, result: unknown) => {
      if (err) reject(new NoResponse('The server did not respond. Check your connection before trying again.'));
      else resolve(result);
    }));
  }
  send(event: string, data: unknown) { this.socket.emit(event, data); }
  sendVolatile(event: string, data: unknown) { this.socket.volatile.emit(event, data); }
  setToken(token: string) { this.socket.auth = { token, wire: WIRE_VERSION }; }
  close() { this.socket.disconnect(); }
  /** Drops the connection without ending the session, as a network failure would. Diagnostics only. */
  drop() { this.socket.io.engine?.close(); }
}
