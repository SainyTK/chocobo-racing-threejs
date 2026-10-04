/** Opt-in bounded samples. No serialization or sample collection in normal play. */
export class NetDiagnostics {
  enabled = new URLSearchParams(location.search).has('netPerf');
  samples: Record<string, number[]> = {};
  counters: Record<string, number> = {};
  sample(name: string, value: number) { if (!this.enabled) return; const a = this.samples[name] ||= []; if (a.length < 20000) a.push(value); }
  count(name: string, amount = 1) { if (this.enabled) this.counters[name] = (this.counters[name] || 0) + amount; }
  reset() { this.samples = {}; this.counters = {}; }
}
/** Application-delivery impairment, NOT packet loss or a network emulator.
 * Seeded jitter and state drops only. Reliable control messages are unaffected. */
export class Delivery {
  private seed = 12345;
  private pending = new Set<ReturnType<typeof setTimeout>>();
  private params = new URLSearchParams(location.search);
  private random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  run(direction: 'up' | 'down', fn: () => void) {
    const delay = Math.min(500, Math.max(0, Number(this.params.get('netDelay')) || 0));
    const jitter = Math.min(200, Math.max(0, Number(this.params.get('netJitter')) || 0));
    const drop = Math.min(.5, Math.max(0, Number(this.params.get('netDrop')) || 0));
    if (direction === 'down' && this.random() < drop) return;
    const ms = Math.max(0, delay + (this.random() * 2 - 1) * jitter);
    if (!ms) { fn(); return; }
    const timer = setTimeout(() => { this.pending.delete(timer); fn(); }, ms); this.pending.add(timer);
  }
  clear() { for (const timer of this.pending) clearTimeout(timer); this.pending.clear(); }
}
