export type TrackId = 'test' | 'forest' | 'gate' | 'mines' | 'manor' | 'gardens' | 'gingerbread' | 'volcano';
export type Surface = 'asphalt' | 'grass' | 'stone' | 'wood' | 'candy';
export interface TrackDefinition {
  name: string; difficulty: number; width: number; wall: boolean; cliff: boolean; sky: string; fog: string;
  ground: string; road: string; edge: string; accent: string; surface: Surface; elevation: number;
  description: string; points: [number, number][];
}

export interface TrackPoint { x: number; y: number; z: number; nx: number; nz: number; yaw: number; curve: number }

export interface Projection { s: number; offset: number; distance: number; px: number; pz: number; nx: number; nz: number }

export type StoneType = 'fire' | 'ice' | 'thunder' | 'haste' | 'shield' | 'mini' | 'doom' | 'ultima';
/** A track stone has a fixed colour, or is a black "?" stone that rolls a random type on pickup. */
export type TrackStone = StoneType | 'random';
/** Rows of stones laid across the road. `at` is the share of the lap where the first row sits; each row repeats `lanes` from left to right. */
export interface StoneField { at: number; rows: number; lanes: TrackStone[] }
export interface CourseObjects { stones: { id: number; s: number; x: number; kind: TrackStone }[]; pads: { s: number; x: number }[]; hazards: { s: number; x: number }[] }
