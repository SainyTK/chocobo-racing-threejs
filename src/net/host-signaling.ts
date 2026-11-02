import type { IceServer } from '../../shared/peer.ts';
import { SIGNAL_PATHS, type HostInbound, type HostOutbound } from '../../shared/signal-protocol.ts';
import { SignalSocket, UNREACHABLE } from './signal-socket.ts';

const OPEN_TIMEOUT_MS = 10000;
const RECLAIM_RETRY_MS = 2000;
export interface HostTicket { code: string; secret: string; iceServers: IceServer[] }

/**
 * The hosting page's line to the signaling Worker: it holds the room code, and guests' handshakes and relayed traffic
 * arrive through it. After a drop it reclaims the code with the secret, so new guests can still find the room.
 */
export class HostSignaling {
  onSignal: (from: string, data: unknown) => void = () => {};
  onRelay: (from: string, data: unknown) => void = () => {};
  onPeerGone: (from: string) => void = () => {};
  private closed = false;

  private constructor(readonly ticket: HostTicket, private socket: SignalSocket<HostInbound, HostOutbound>) { this.adopt(socket); }

  /** Reserves a new room code. */
  static async open() {
    const socket = new SignalSocket<HostInbound, HostOutbound>(SIGNAL_PATHS.newHost);
    const opened = await new Promise<HostInbound>((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(Error(UNREACHABLE)); }, OPEN_TIMEOUT_MS);
      socket.onMessage = message => { clearTimeout(timer); resolve(message); };
      socket.onClose = () => { clearTimeout(timer); reject(Error(UNREACHABLE)); };
    });
    if (opened.t !== 'opened') { socket.close(); throw Error(opened.t === 'error' ? opened.message : UNREACHABLE); }
    return new HostSignaling({ code: opened.code, secret: opened.secret, iceServers: opened.iceServers }, socket);
  }
  get code() { return this.ticket.code; }
  signal(to: string, data: unknown) { this.socket.send({ t: 'signal', to, data }); }
  relay(to: string, text: string, volatile: boolean) { this.socket.send({ t: 'relay', to, data: text }, volatile); }
  /** Ends the code for good; the Worker tells any guests still connected through it. */
  close() {
    if (this.closed) return;
    this.closed = true;
    this.socket.send({ t: 'close' });
    this.socket.close();
  }

  private adopt(socket: SignalSocket<HostInbound, HostOutbound>) {
    this.socket = socket;
    socket.onMessage = message => {
      if (message.t === 'signal') this.onSignal(message.from, message.data);
      else if (message.t === 'relay') this.onRelay(message.from, message.data);
      else if (message.t === 'peer-gone') this.onPeerGone(message.from);
    };
    socket.onClose = () => { if (this.socket === socket && !this.closed) setTimeout(() => this.reclaim(), RECLAIM_RETRY_MS); };
  }
  /** Guests already connected directly keep playing meanwhile; only new joins and relayed guests wait for this. */
  private reclaim() {
    if (this.closed) return;
    const socket = new SignalSocket<HostInbound, HostOutbound>(SIGNAL_PATHS.reclaimHost(this.ticket.code, this.ticket.secret));
    this.adopt(socket);
    const onMessage = socket.onMessage;
    // A refusal means the code has closed; there is nothing left to reclaim.
    socket.onMessage = message => { if (message.t === 'error') { this.closed = true; socket.close(); return; } onMessage(message); };
  }
}
