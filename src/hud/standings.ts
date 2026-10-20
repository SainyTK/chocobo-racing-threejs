import type { GameEvent, Race } from '../../shared/game/index.ts';
import { castInfo } from '../race-events.ts';

interface Cell { el: HTMLElement; rank: HTMLElement; castUntil: number }

/** How long a portrait bobs after its racer casts, in milliseconds. */
const BOB_MS = 700;

/**
 * The race-order strip of racer portraits, as in the original's HUD: portraits slide when places change,
 * bob when their racer casts a stone and spin while their racer is crashed.
 */
export class Standings {
  private cells = new Map<string, Cell>(); private order = '';
  constructor(private el: HTMLElement, private portrait: (character: number) => string, private escape: (s: string) => string) {}
  update(now: number, race: Race, fresh: GameEvent[], playerId: string) {
    if (this.cells.size !== race.racers.length) this.build(race, playerId);
    for (const e of fresh) { const cell = castInfo(e) && this.cells.get(e.player); if (cell) cell.castUntil = now + BOB_MS; }
    const sorted = [...race.racers].sort((a, b) => a.rank - b.rank), order = sorted.map(p => p.id).join();
    if (order !== this.order) { this.reorder(sorted.map(p => p.id)); this.order = order; }
    for (const p of race.racers) {
      const cell = this.cells.get(p.id)!, rank = String(p.rank);
      if (cell.rank.textContent !== rank) cell.rank.textContent = rank;
      cell.el.classList.toggle('casting', now < cell.castUntil);
      cell.el.classList.toggle('crashed', p.stun > 0 && p.finishTime === null);
      cell.el.classList.toggle('finished', p.finishTime !== null);
    }
  }
  private build(race: Race, playerId: string) {
    this.el.replaceChildren(); this.cells.clear(); this.order = '';
    for (const p of race.racers) {
      const el = document.createElement('div'); el.className = p.id === playerId ? 'you' : '';
      el.innerHTML = `<b></b><i class="portrait">${this.portrait(p.character)}</i><span>${this.escape(p.name)}</span>`;
      this.el.append(el); this.cells.set(p.id, { el, rank: el.querySelector('b')!, castUntil: 0 });
    }
  }
  /** Moves cells to their new places, then slides each from where it was (FLIP), so the layout stays responsive CSS. */
  private reorder(ids: string[]) {
    const before = new Map([...this.cells].map(([id, c]) => [id, c.el.getBoundingClientRect().left]));
    ids.forEach((id, i) => { this.cells.get(id)!.el.style.order = String(i); });
    for (const [id, c] of this.cells) {
      const dx = before.get(id)! - c.el.getBoundingClientRect().left; if (!dx || !this.order) continue;
      c.el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
}
