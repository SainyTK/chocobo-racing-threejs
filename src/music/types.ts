import type { TrackId } from '../../shared/track/types.ts';

export type MusicVoice = 'flute' | 'brass' | 'strings' | 'bell' | 'organ' | 'pluck' | 'bass' | 'kick' | 'snare' | 'hat';

/** Times and durations are in beats; pitched events use MIDI note numbers. */
export interface MusicEvent {
  beat: number;
  duration: number;
  note: number;
  voice: MusicVoice;
  volume: number;
  pan?: number;
}

export interface StageMusic {
  id: TrackId | 'menu';
  title: string;
  bpm: number;
  beats: number;
  events: readonly MusicEvent[];
}
