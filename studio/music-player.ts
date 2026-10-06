import { AudioEngine } from '../src/audio.ts';
import type { StageMusic } from '../src/music/types.ts';

/** One player for the active music pane. Merely opening a score never unlocks audio. */
export class StudioMusicPlayer {
  private selected: StageMusic | null = null;
  private playing = false;
  private paused = false;
  private hidden = false;

  constructor(private readonly audio = new AudioEngine()) {}

  get status() {
    return { selectedId: this.selected?.id ?? null, selectedBpm: this.selected?.bpm ?? null,
      playing: this.playing, ...this.audio.playback };
  }

  select(score: StageMusic | null) {
    if (score === this.selected) return;
    this.selected = score;
    this.audio.restartMusic();
    if (!score) this.playing = false;
    this.update();
  }

  toggle() {
    if (!this.selected) return;
    this.playing = !this.playing;
    if (this.playing) this.audio.unlock();
    this.update();
  }

  restart() {
    this.audio.restartMusic();
    this.update();
  }

  setVolume(value: number) { this.audio.setVolume(value); }

  update(paused = this.paused, hidden = this.hidden) {
    this.paused = paused;
    this.hidden = hidden;
    const id = this.selected?.id;
    this.audio.update(id !== undefined && id !== 'menu', id === 'menu' ? undefined : id,
      !this.selected || !this.playing || paused || hidden, this.selected ?? undefined);
  }
}
