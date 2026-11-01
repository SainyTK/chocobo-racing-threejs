import type { Pipe } from './pipe.ts';

/** The fallback when two browsers cannot connect directly: every message goes through the game server's socket. */
export class RelayPipe implements Pipe {
  readonly route = 'relay';
  onMessage: Pipe['onMessage'] = () => {};
  onClose: Pipe['onClose'] = () => {};
  private closed = false;

  /** `dispose` runs once when the pipe closes, whoever closes it. */
  constructor(private readonly forward: (text: string, volatile: boolean) => void, private readonly dispose: () => void = () => {}) {}
  send(text: string, volatile: boolean) { if (!this.closed) this.forward(text, volatile); }
  deliver(text: unknown) { if (!this.closed && typeof text === 'string') this.onMessage(text); }
  close() {
    if (this.closed) return;
    this.closed = true; this.dispose(); this.onClose();
  }
}
