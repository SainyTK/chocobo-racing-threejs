import type { TrackId } from '../shared/track/types.ts';
import { MENU_MUSIC, STAGE_MUSIC } from './music/index.ts';
import type { MusicEvent, StageMusic } from './music/types.ts';
import { INSTRUMENTS } from './music/instruments.ts';

const LOOK_AHEAD = .12;
const START_LEAD = .015;
const MAX_MUSIC_VOICES = 48;
const MAX_EFFECT_VOICES = 32;
const MAX_NOTE_SECONDS = 4;

type Source = OscillatorNode | AudioBufferSourceNode;
interface Voice { sources: Source[]; nodes: AudioNode[]; released: boolean }

export class AudioEngine {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  enabled = true;
  music = true;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private score: StageMusic | null = null;
  private sortedEvents: readonly MusicEvent[] = [];
  private eventCache = new WeakMap<StageMusic, readonly MusicEvent[]>();
  private origin = 0;
  private position = 0;
  private cursor = 0;
  private cycle = 0;
  private running = false;
  private musicVoices = new Set<Voice>();
  private effectVoices = new Set<Voice>();
  private scheduledNotes = 0;
  private volume = 1;

  get playback() {
    return {
      scoreId: this.score?.id ?? null,
      scoreBpm: this.score?.bpm ?? null,
      running: this.running,
      activeMusicVoices: this.musicVoices.size,
      activeEffectVoices: this.effectVoices.size,
      scheduledNotes: this.scheduledNotes,
      positionSeconds: this.score ? (this.running
        ? Math.max(0, ((this.context?.currentTime ?? 0) - this.origin) * this.score.bpm / 60) % this.score.beats
        : this.position) * 60 / this.score.bpm : 0,
    };
  }

  unlock() {
    if (!this.context) {
      const Constructor = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return;
      try {
        this.context = new Constructor();
        this.master = this.context.createGain();
        this.musicBus = this.context.createGain();
        this.effectsBus = this.context.createGain();
        this.master.gain.value = this.enabled ? .18 * this.volume : 0;
        this.musicBus.gain.value = .65;
        this.musicBus.connect(this.master);
        this.effectsBus.connect(this.master);
        this.master.connect(this.context.destination);
      } catch { return; }
    }
    // A gesture can retry resume after an autoplay rejection.
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(value ? .18 * this.volume : 0, now);
    if (!value) this.freeze(now);
  }

  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(value, 1));
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.enabled ? .18 * this.volume : 0, this.context.currentTime, .02);
    }
  }

  restartMusic() {
    this.freeze(this.context?.currentTime ?? 0);
    this.position = 0;
  }

  tone(freq: number, duration = .15, type: OscillatorType = 'sine', volume = .3, delay = 0) {
    if (!this.context || !this.effectsBus || !this.enabled || this.context.state !== 'running') return;
    if (this.effectVoices.size >= MAX_EFFECT_VOICES || !Number.isFinite(freq) || freq <= 0) return;
    const at = this.context.currentTime + Math.max(0, Math.min(delay, 2));
    const length = Math.max(.02, Math.min(duration, MAX_NOTE_SECONDS));
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(Math.max(.001, Math.min(volume, 1)), at + .008);
    gain.gain.exponentialRampToValueAtTime(.001, at + length);
    osc.connect(gain);
    gain.connect(this.effectsBus);
    this.startVoice([osc], [gain], this.effectVoices, at, at + length + .01);
  }

  effect(type: string) {
    if (type === 'pickup') [659, 880, 1046].forEach((f, i) => this.tone(f, .2, 'sine', .45, i * .07));
    else if (['drift', 'pad', 'haste', 'ability'].includes(type)) [330, 440, 660, 880].forEach((f, i) => this.tone(f, .22, 'triangle', .35, i * .05));
    else if (['hit', 'slow', 'fire'].includes(type)) { this.tone(110, .25, 'sawtooth', .16); this.tone(82, .3, 'triangle', .4, .08); }
    else if (type === 'finish') [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .5, 'triangle', .4, i * .15));
    else if (type === 'lap') [523, 784, 1046].forEach((f, i) => this.tone(f, .3, 'sine', .4, i * .1));
    else this.tone(660, .1, 'sine', .2);
  }

  update(racing: boolean, track: TrackId = 'test', paused = false, override?: StageMusic) {
    const wanted = override ?? (racing ? STAGE_MUSIC[track] : MENU_MUSIC);
    const now = this.context?.currentTime ?? 0;
    if (wanted !== this.score) {
      this.clearMusic(now);
      this.score = wanted;
      let sorted = this.eventCache.get(wanted);
      if (!sorted) {
        sorted = [...wanted.events].sort((a, b) => a.beat - b.beat);
        this.eventCache.set(wanted, sorted);
      }
      this.sortedEvents = sorted;
      this.position = 0;
      this.running = false;
    }
    if (!this.context || this.context.state !== 'running' || !this.enabled || !this.music || paused) {
      this.freeze(now);
      return;
    }
    const secondsPerBeat = 60 / wanted.bpm;
    if (!this.running) {
      this.origin = now + START_LEAD - this.position * secondsPerBeat;
      this.seek(this.position);
      this.running = true;
    }
    // Jump to the present after a slow/background frame; never replay missed beats.
    const currentBeat = Math.max(0, (now - this.origin) / secondsPerBeat);
    const next = this.sortedEvents[this.cursor];
    if (next && this.cycle * wanted.beats + next.beat < currentBeat) this.seek(currentBeat);
    const horizon = now + LOOK_AHEAD;
    let scheduled = 0;
    while (this.sortedEvents.length && scheduled < MAX_MUSIC_VOICES) {
      const event = this.sortedEvents[this.cursor];
      const at = this.origin + (this.cycle * wanted.beats + event.beat) * secondsPerBeat;
      if (at > horizon) break;
      if (at >= now && this.musicVoices.size < MAX_MUSIC_VOICES) this.playEvent(event, at, secondsPerBeat);
      scheduled++;
      if (++this.cursor === this.sortedEvents.length) { this.cursor = 0; this.cycle++; }
    }
  }

  private seek(beat: number) {
    if (!this.score) return;
    this.cycle = Math.floor(beat / this.score.beats);
    const local = beat - this.cycle * this.score.beats;
    // Scores are sorted once. Seeking never scans or schedules a missed loop.
    let low = 0, high = this.sortedEvents.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.sortedEvents[mid].beat < local) low = mid + 1;
      else high = mid;
    }
    this.cursor = low;
    if (this.cursor === this.sortedEvents.length) { this.cursor = 0; this.cycle++; }
  }

  private freeze(now: number) {
    if (this.running && this.score) this.position = Math.max(0, (now - this.origin) * this.score.bpm / 60) % this.score.beats;
    this.running = false;
    this.clearMusic(now);
  }

  private clearMusic(now: number) {
    for (const voice of this.musicVoices) {
      for (const source of voice.sources) { try { source.stop(now); } catch { /* Already ended. */ } }
      this.releaseVoice(voice, this.musicVoices);
    }
  }

  private startVoice(sources: Source[], nodes: AudioNode[], pool: Set<Voice>, at: number, end: number) {
    const voice: Voice = { sources, nodes, released: false };
    pool.add(voice);
    let remaining = sources.length;
    for (const source of sources) {
      source.onended = () => { if (--remaining === 0) this.releaseVoice(voice, pool); };
      source.start(at);
      source.stop(end);
    }
  }

  private releaseVoice(voice: Voice, pool: Set<Voice>) {
    if (voice.released) return;
    voice.released = true;
    voice.sources.forEach(source => source.disconnect());
    voice.nodes.forEach(node => node.disconnect());
    pool.delete(voice);
  }

  private noiseBuffer() {
    if (this.noise) return this.noise;
    const ctx = this.context!;
    this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .5), ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 0x43ab17;
    for (let i = 0; i < data.length; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      data[i] = (seed >>> 0) / 0x80000000 - 1;
    }
    return this.noise;
  }

  private playEvent(event: MusicEvent, at: number, secondsPerBeat: number) {
    this.scheduledNotes++;
    const ctx = this.context!, bus = this.musicBus!;
    const gain = ctx.createGain(), pan = ctx.createStereoPanner(), filter = ctx.createBiquadFilter();
    const nodes: AudioNode[] = [gain, pan, filter];
    pan.pan.value = Math.max(-1, Math.min(event.pan ?? 0, 1));
    filter.connect(gain); gain.connect(pan); pan.connect(bus);
    const sources: Source[] = [];
    let duration = Math.max(.03, Math.min(event.duration * secondsPerBeat, MAX_NOTE_SECONDS));
    let attack = .003, release = .04, level = .6, sustain = .75;
    const frequency = 440 * 2 ** ((event.note - 69) / 12);
    if (event.voice === 'snare' || event.voice === 'hat') {
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer();
      source.connect(filter); sources.push(source);
      filter.type = 'highpass';
      filter.frequency.value = event.voice === 'hat' ? 7000 : 1300;
      duration = Math.min(duration, event.voice === 'hat' ? .08 : .18);
      level = event.voice === 'hat' ? .24 : .65;
      sustain = .01;
    } else if (event.voice === 'kick') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, at);
      osc.frequency.exponentialRampToValueAtTime(45, at + .12);
      osc.connect(filter); sources.push(osc);
      filter.frequency.value = 800;
      duration = Math.min(duration, .22);
      level = .95; sustain = .01;
    } else {
      const timbre = INSTRUMENTS[event.voice];
      attack = timbre.attack; release = timbre.release; level = timbre.level; sustain = timbre.sustain;
      filter.type = 'lowpass';
      // Open the filter on each attack, then close it to the sustained tone.
      const cutoff = Math.min(ctx.sampleRate * .45, timbre.cutoff + frequency * timbre.keyTracking);
      filter.frequency.setValueAtTime(cutoff * timbre.filterAttack, at);
      filter.frequency.linearRampToValueAtTime(cutoff, at + Math.min(.08, duration / 2));
      filter.frequency.exponentialRampToValueAtTime(cutoff * timbre.filterSustain, at + duration);
      const weight = timbre.partials.reduce((sum, partial) => sum + partial.weight, 0);
      for (const harmonic of timbre.partials) {
        const osc = ctx.createOscillator(), partial = ctx.createGain();
        osc.type = harmonic.type;
        osc.frequency.value = Math.min(ctx.sampleRate * .45, frequency * harmonic.ratio);
        osc.detune.value = harmonic.detune ?? 0;
        partial.gain.setValueAtTime(harmonic.weight / weight, at);
        partial.gain.exponentialRampToValueAtTime(
          Math.max(.0001, harmonic.weight / weight * harmonic.sustain), at + duration,
        );
        osc.connect(partial); partial.connect(filter);
        sources.push(osc); nodes.push(partial);
      }
    }
    attack = Math.min(attack, duration / 3);
    const peak = Math.max(.0001, Math.min(event.volume, 1) * level * .4);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * sustain), at + duration);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration + release);
    this.startVoice(sources, nodes, this.musicVoices, at, at + duration + release + .01);
  }
}
