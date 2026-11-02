import { SIGNAL_PATHS, type GuestInbound, type GuestOutbound, type RoomInfo } from '../../shared/signal-protocol.ts';
import { SignalSocket, UNREACHABLE, signalHttpUrl } from './signal-socket.ts';

const LOOKUP_TIMEOUT_MS = 8000;

/** Asks the signaling Worker whether `code` can be joined and which ICE servers to use. */
export async function locateRoom(code: string): Promise<RoomInfo> {
  try {
    const response = await fetch(signalHttpUrl(SIGNAL_PATHS.info(code)), { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!response.ok) return { error: UNREACHABLE, retry: true };
    return await response.json() as RoomInfo;
  } catch { return { error: UNREACHABLE, retry: true }; }
}

/** A guest's line to a room's host through the signaling Worker, for the WebRTC handshake and the relay. */
export class GuestSignaling {
  onSignal: (data: unknown) => void = () => {};
  onRelay: (data: unknown) => void = () => {};
  /** The socket closed or the host ended the room. Anything relayed through it is gone. */
  onDrop: () => void = () => {};
  private socket: SignalSocket<GuestInbound, GuestOutbound> | null = null;

  constructor(private readonly code: string) {}
  get isOpen() { return this.socket?.isOpen ?? false; }
  /** Opens the socket unless it is open. Resolves false when the Worker refuses or cannot be reached. */
  async connect() {
    if (this.socket?.isOpen) return true;
    this.socket?.close();
    const socket = new SignalSocket<GuestInbound, GuestOutbound>(SIGNAL_PATHS.guest(this.code));
    this.socket = socket;
    socket.onMessage = message => {
      if (message.t === 'signal') this.onSignal(message.data);
      else if (message.t === 'relay') this.onRelay(message.data);
      else if (message.t === 'host-gone') this.onDrop();
    };
    socket.onClose = () => { if (this.socket === socket) { this.socket = null; this.onDrop(); } };
    return socket.open();
  }
  signal(data: unknown) { this.socket?.send({ t: 'signal', data }); }
  relay(text: string, volatile: boolean) { this.socket?.send({ t: 'relay', data: text }, volatile); }
  close() { const socket = this.socket; this.socket = null; socket?.close(); }
}
