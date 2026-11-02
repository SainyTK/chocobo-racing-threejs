/** The signaling Worker's origin, set at build time. */
const SIGNAL_URL = (import.meta.env.VITE_SIGNAL_URL || '').replace(/\/$/, '');
/** Above this backlog, volatile relay messages are skipped, as a late snapshot is worth less than the next one. */
const VOLATILE_BACKLOG_BYTES = 64 * 1024;
export const UNREACHABLE = 'Cannot reach the room service. Check your connection; practice still works.';

export const signalHttpUrl = (path: string) => `${SIGNAL_URL}${path}`;
export const signalSocketUrl = (path: string) => `${SIGNAL_URL.replace(/^http/, 'ws')}${path}`;

/** A JSON WebSocket to the signaling Worker. It does not reconnect; its owner decides whether and where to. */
export class SignalSocket<Inbound, Outbound> {
  onMessage: (message: Inbound) => void = () => {};
  onClose: () => void = () => {};
  private readonly ws: WebSocket;
  private readonly opened: Promise<boolean>;

  constructor(path: string) {
    this.ws = new WebSocket(signalSocketUrl(path));
    this.opened = new Promise(resolve => {
      this.ws.onopen = () => resolve(true);
      this.ws.onclose = () => { resolve(false); this.onClose(); };
    });
    this.ws.onmessage = e => {
      if (typeof e.data !== 'string') return;
      try { this.onMessage(JSON.parse(e.data) as Inbound); } catch { /* Not JSON: ignored. */ }
    };
  }
  /** Resolves true once the socket opens, false if it closes first. */
  open() { return this.opened; }
  get isOpen() { return this.ws.readyState === WebSocket.OPEN; }
  send(message: Outbound, volatile = false) {
    if (!this.isOpen || volatile && this.ws.bufferedAmount > VOLATILE_BACKLOG_BYTES) return;
    this.ws.send(JSON.stringify(message));
  }
  close() { this.ws.close(); }
}
