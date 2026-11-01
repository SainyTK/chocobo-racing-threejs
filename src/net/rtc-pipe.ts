import type { IceServer } from '../../shared/peer.ts';
import type { Pipe } from './pipe.ts';

/** One step of the WebRTC handshake, passed between the two browsers by the game server. */
export interface RtcSignal { attempt: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }

/**
 * Both sides declare the same two channels, so neither waits for the other to announce them. Snapshots and held input
 * use the unordered channel without retransmission: a late snapshot is worth less than the next one.
 */
const RELIABLE: RTCDataChannelInit = { negotiated: true, id: 0, ordered: true };
const FAST: RTCDataChannelInit = { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 };
/** Above this backlog the fast channel skips messages, as a volatile Socket.IO emit does. */
const FAST_BACKLOG_BYTES = 64 * 1024;

/** A direct browser-to-browser connection. The guest calls `offer()`; the host answers through `receive()`. */
export class RtcPipe implements Pipe {
  readonly route = 'direct';
  onMessage: Pipe['onMessage'] = () => {};
  onClose: Pipe['onClose'] = () => {};
  onOpen = () => {};
  private readonly pc: RTCPeerConnection;
  private readonly reliable: RTCDataChannel;
  private readonly fast: RTCDataChannel;
  private readonly early: RTCIceCandidateInit[] = [];
  private closed = false;

  constructor(iceServers: IceServer[], private readonly attempt: string, private readonly signal: (signal: RtcSignal) => void) {
    this.pc = new RTCPeerConnection({ iceServers });
    this.reliable = this.pc.createDataChannel('reliable', RELIABLE);
    this.fast = this.pc.createDataChannel('fast', FAST);
    for (const channel of [this.reliable, this.fast]) {
      channel.onmessage = e => { if (typeof e.data === 'string') this.onMessage(e.data); };
      channel.onopen = () => { if (this.open) this.onOpen(); };
      channel.onclose = () => this.close();
    }
    this.pc.onicecandidate = e => { if (e.candidate) this.signal({ attempt, candidate: e.candidate.toJSON() }); };
    this.pc.onconnectionstatechange = () => { if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed') this.close(); };
  }
  get open() { return this.reliable.readyState === 'open' && this.fast.readyState === 'open'; }
  async offer() {
    await this.pc.setLocalDescription();
    this.signal({ attempt: this.attempt, sdp: this.pc.localDescription!.toJSON() });
  }
  async receive(signal: RtcSignal) {
    if (this.closed) return;
    if (signal.sdp) {
      await this.pc.setRemoteDescription(signal.sdp);
      if (signal.sdp.type === 'offer') { await this.pc.setLocalDescription(); this.signal({ attempt: this.attempt, sdp: this.pc.localDescription!.toJSON() }); }
      for (const candidate of this.early.splice(0)) await this.pc.addIceCandidate(candidate);
    } else if (signal.candidate) {
      // Candidates can overtake the description they belong to.
      if (this.pc.remoteDescription) await this.pc.addIceCandidate(signal.candidate); else this.early.push(signal.candidate);
    }
  }
  send(text: string, volatile: boolean) {
    const channel = volatile ? this.fast : this.reliable;
    if (channel.readyState !== 'open' || volatile && channel.bufferedAmount > FAST_BACKLOG_BYTES) return;
    channel.send(text);
  }
  close() {
    if (this.closed) return;
    this.closed = true; this.pc.close(); this.onClose();
  }
}
