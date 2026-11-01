import { WIRE_VERSION } from '../../shared/wire.ts';
import type { RoomHost } from '../../shared/room/host.ts';
import type { Connection, Link } from '../../shared/room/types.ts';
import { NoResponse, type Transport } from './transport.ts';

/**
 * The hosting player's own seat in the room that runs in this page. Messages are copied, as a network would, so the
 * page never shares objects with the authoritative race, and delivered on a microtask so the order matches a real link.
 */
export class LocalTransport implements Transport {
  readonly route = 'host';
  onMessage: Transport['onMessage'] = () => {};
  onStatus: Transport['onStatus'] = () => {};
  private connection: Connection | null = null;
  private token = '';

  constructor(private readonly host: RoomHost) {}
  get connected() { return this.connection !== null; }
  connect() {
    if (this.connection) return;
    const deliver = (event: string, data: unknown) => { const copy = structuredClone(data); queueMicrotask(() => { if (this.connection === connection) this.onMessage(event, copy); }); };
    const link: Link = { wire: WIRE_VERSION, send: deliver, sendVolatile: deliver, close: () => this.close() };
    const connection = this.host.attach(link, this.token);
    this.connection = connection;
    if (connection) this.onStatus(true);
  }
  request(event: string, data: unknown, timeoutMs: number) {
    const connection = this.connection;
    if (!connection) return Promise.reject(new NoResponse('This room has closed.'));
    return new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new NoResponse('This room did not respond.')), timeoutMs);
      connection.receive(event, structuredClone(data), result => { clearTimeout(timer); const copy = structuredClone(result); queueMicrotask(() => resolve(copy)); });
    });
  }
  send(event: string, data: unknown) { this.connection?.receive(event, structuredClone(data)); }
  sendVolatile(event: string, data: unknown) { this.send(event, data); }
  setToken(token: string) { this.token = token; }
  close() {
    const connection = this.connection; if (!connection) return;
    this.connection = null; connection.closed(); this.onStatus(false);
  }
}
