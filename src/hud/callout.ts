import type { GameEvent, Race } from '../../shared/game/index.ts';
import { messageFor, type Message } from './messages.ts';

/** How long an event message stays up, in milliseconds. */
const SHOW_MS = 1700;

/**
 * The one HUD callout. A new event message replaces the current one unless the current one matters more and is still fresh;
 * between events it shows the player's lasting status, such as a Doom countdown or "WRONG WAY!".
 */
export class Callout {
  private current: Message | null = null; private until = 0; private shown = '';
  constructor(private el: HTMLElement) {}
  update(now: number, race: Race, fresh: GameEvent[], playerId: string, status: string) {
    for (const e of fresh) {
      const m = messageFor(e, race, playerId); if (!m) continue;
      if (!this.current || now > this.until - SHOW_MS / 2 || m.priority >= this.current.priority) { this.current = m; this.until = now + SHOW_MS; }
    }
    if (this.current && now > this.until) this.current = null;
    const text = this.current?.text ?? status, kind = this.current ? this.current.tone : status ? 'status' : '', key = `${kind}|${text}`;
    if (key === this.shown) return;
    const restart = !!this.current && this.shown.split('|')[1] !== text;
    this.shown = key; this.el.textContent = text; this.el.className = `callout ${kind}${text ? '' : ' hidden'}`;
    if (restart) { void this.el.offsetWidth; this.el.classList.add('pop'); }
  }
}
