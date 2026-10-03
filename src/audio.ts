export class AudioEngine {
  context: AudioContext | null = null; master: GainNode | null = null; enabled = true; music = true;
  private nextNote = 0; private beat = 0; private racing = false;
  unlock() {
    if (!this.context) { this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = this.enabled ? .18 : 0; this.master.connect(this.context.destination); }
    if (this.context.state === 'suspended') void this.context.resume();
  }
  setEnabled(v: boolean) { this.enabled = v; if (this.master && this.context) this.master.gain.setTargetAtTime(v ? .18 : 0, this.context.currentTime, .06); }
  tone(freq: number, duration = .15, type: OscillatorType = 'sine', volume = .3, delay = 0) {
    if (!this.context || !this.master || !this.enabled) return;
    const at = this.context.currentTime + delay, osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .008); gain.gain.exponentialRampToValueAtTime(.001, at + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(at); osc.stop(at + duration + .01); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  effect(type: string) {
    if (type === 'pickup') [659, 880, 1046].forEach((f, i) => this.tone(f, .2, 'sine', .45, i * .07));
    else if (['drift', 'pad', 'haste', 'ability'].includes(type)) [330, 440, 660, 880].forEach((f, i) => this.tone(f, .22, 'triangle', .35, i * .05));
    else if (['hit', 'slow', 'fire'].includes(type)) { this.tone(110, .25, 'sawtooth', .16); this.tone(82, .3, 'triangle', .4, .08); }
    else if (type === 'finish') [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .5, 'triangle', .4, i * .15));
    else if (type === 'lap') [523, 784, 1046].forEach((f, i) => this.tone(f, .3, 'sine', .4, i * .1));
    else this.tone(660, .1, 'sine', .2);
  }
  update(racing: boolean) {
    if (!this.context || !this.music || !this.enabled) return;
    this.racing = racing;
    const time = this.context.currentTime;
    if (time < this.nextNote) return;
    this.nextNote = time + (this.racing ? .24 : .36);
    // Original pentatonic melody. No recordings or melodies from Square Enix.
    const notes = [0, 4, 7, 12, 9, 7, 4, 2, 0, 7, 9, 12, 14, 12, 7, 4, 5, 9, 12, 16, 14, 12, 9, 7, 4, 7, 11, 14, 12, 7, 4, 2];
    const semitone = notes[this.beat % notes.length]; this.tone(261.63 * 2 ** (semitone / 12), .3, 'sine', .095);
    if (this.beat % 4 === 0) this.tone(130.81 * 2 ** ([0, 0, 5, 7][Math.floor(this.beat / 8) % 4] / 12), .65, 'triangle', .11);
    this.beat++;
  }
}
