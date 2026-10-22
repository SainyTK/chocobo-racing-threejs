/** How one held stack is drawn this frame: hidden while it is still on its way, or blinking at an overridden rate. */
export interface HeldCue { hidden: boolean; blink?: number }

interface Cue { racer: string; index: number; until: number; blink?: number }

const shown: HeldCue = { hidden: false }, hidden: HeldCue = { hidden: true }, blinking: HeldCue = { hidden: false, blink: 0 };

/**
 * Timed changes to how a racer's held stones are drawn. The simulation moves a stone at once; the original shows a
 * stolen or caught stone travelling first, and a stone raised by Magic Plus flickering, so the effects ask for these.
 */
export class HeldCues {
  private cues: Cue[] = [];
  /** Hides stack `index` of `racer` until `until`, while its stone is drawn travelling there. */
  arriving(racer: string, index: number, until: number) { this.cues.push({ racer, index, until }); }
  /** Blinks stack `index` of `racer` at `rate` blinks per second until `until`. */
  flicker(racer: string, index: number, until: number, rate: number) { this.cues.push({ racer, index, until, blink: rate }); }
  look(racer: string, index: number, time: number): HeldCue {
    for (const c of this.cues) if (c.racer === racer && c.index === index && time < c.until) { if (c.blink === undefined) return hidden; blinking.blink = c.blink; return blinking; }
    return shown;
  }
  /** Forgets cues that have run out. */
  prune(time: number) { if (this.cues.some(c => time >= c.until)) this.cues = this.cues.filter(c => time < c.until); }
  clear() { this.cues.length = 0; }
}
