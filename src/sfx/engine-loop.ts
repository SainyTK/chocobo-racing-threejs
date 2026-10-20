import type { EngineVoice } from './types.ts';

/** What a vehicle is doing this frame. `speed` runs from 0 at rest to 1 at top speed; `gain` and `pan` place it around the listener. */
export interface DriveState { character: number; speed: number; boost: boolean; skid: boolean; gain?: number; pan?: number }

const GLIDE = .06;

/**
 * A vehicle's continuous sound: two oscillators and engine breath whose pitch follows speed, plus a tyre skid.
 * It runs until `stop`, which fades it out and frees every node.
 */
export class EngineLoop {
  private sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private nodes: AudioNode[] = [];
  private main: OscillatorNode; private sub: OscillatorNode; private wobble: GainNode;
  private tone: BiquadFilterNode; private hum: GainNode; private breath: GainNode; private skid: GainNode; private pan: StereoPannerNode;
  constructor(private ctx: AudioContext, bus: AudioNode, noise: AudioBuffer, readonly character: number, private voice: EngineVoice) {
    const now = ctx.currentTime;
    this.main = this.osc(voice.wave, voice.idle); this.sub = this.osc(voice.wave, voice.idle * voice.sub);
    const lfo = this.osc('sine', 7); this.wobble = this.gain(voice.wobble); lfo.connect(this.wobble); this.wobble.connect(this.main.frequency);
    this.tone = this.filter('lowpass', voice.cutoff, .8); this.hum = this.gain(0); this.breath = this.gain(0); this.skid = this.gain(0);
    this.pan = ctx.createStereoPanner(); this.nodes.push(this.pan); this.pan.connect(bus);
    const mix = this.gain(.5); this.main.connect(mix); this.sub.connect(mix); mix.connect(this.tone); this.tone.connect(this.hum); this.hum.connect(this.pan);
    const air = this.loop(noise), airBand = this.filter('bandpass', voice.cutoff, .7); air.connect(airBand); airBand.connect(this.breath); this.breath.connect(this.pan);
    const tyre = this.loop(noise), tyreBand = this.filter('bandpass', 2300, 1.6); tyre.connect(tyreBand); tyreBand.connect(this.skid); this.skid.connect(this.pan);
    for (const s of this.sources) s.start(now);
  }
  set(s: DriveState) {
    const now = this.ctx.currentTime, k = Math.max(0, Math.min(1, s.speed)), v = this.voice, pitch = v.idle + (v.top - v.idle) * k * (s.boost ? 1.12 : 1), gain = s.gain ?? 1;
    this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, s.pan ?? 0)), now, GLIDE);
    this.main.frequency.setTargetAtTime(pitch, now, GLIDE); this.sub.frequency.setTargetAtTime(pitch * v.sub, now, GLIDE);
    this.tone.frequency.setTargetAtTime(v.cutoff * (.6 + k * .9 + (s.boost ? .5 : 0)), now, GLIDE);
    this.hum.gain.setTargetAtTime((.07 + k * .1 + (s.boost ? .05 : 0)) * gain, now, GLIDE);
    this.breath.gain.setTargetAtTime(v.noise * (.05 + k * .3 + (s.boost ? .25 : 0)) * gain, now, GLIDE);
    this.skid.gain.setTargetAtTime(s.skid ? (.22 + k * .15) * gain : 0, now, .04);
  }
  stop() {
    const now = this.ctx.currentTime;
    for (const g of [this.hum, this.breath, this.skid]) g.gain.setTargetAtTime(0, now, .05);
    for (const s of this.sources) { s.onended = null; s.stop(now + .3); }
    const sources = this.sources, nodes = this.nodes; sources[0].onended = () => { sources.forEach(s => s.disconnect()); nodes.forEach(n => n.disconnect()); };
  }
  private osc(type: OscillatorType, freq: number) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq; this.sources.push(o); return o; }
  private loop(buffer: AudioBuffer) { const s = this.ctx.createBufferSource(); s.buffer = buffer; s.loop = true; this.sources.push(s); return s; }
  private gain(value: number) { const g = this.ctx.createGain(); g.gain.value = value; this.nodes.push(g); return g; }
  private filter(type: BiquadFilterType, freq: number, q: number) { const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; this.nodes.push(f); return f; }
}
