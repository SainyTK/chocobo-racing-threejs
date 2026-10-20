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
export interface CourseObjects { stones: { id: number; s: number; x: number; kind: StoneType | 'random' }[]; pads: Pad[] }

/* Course layouts. Positions are track coordinates: `s` metres along the lap from the start line, `x` metres left (+) or right (-) of the centre line. */

/** A boost pad. Driving over it gives a short boost. */
export interface Pad { s: number; x: number }
/** What a patch of ground does to grip and speed: `slow` is mud, goo or tar, `slip` is ice, syrup or polished glass. */
export type PatchSurface = 'slow' | 'slip';
/** A rectangle of special surface from `s` for `length` metres, centred `x` across and `width` wide. */
export interface Patch { s: number; length: number; x: number; width: number; surface: PatchSurface }
/** A jump: a wedge rising over `length` metres to a lip `height` tall at `s`, `width` wide around `x`. Leaving the lip throws a racer upward at `lift` times its forward speed. */
export interface Ramp { s: number; x: number; width: number; length: number; height: number; lift: number }
/** A chasm across the whole course from `s` for `length` metres. A racer that comes down inside it falls. */
export interface Gap { s: number; length: number }
/** What happens beyond a shortcut's edge: a wall, a drop, or rough ground that slows like grass. */
export type ShortcutEdge = 'wall' | 'fall' | 'rough';
/**
 * A side route that leaves the road at `from` and rejoins it at `to`. It leaves and rejoins on `side` (+1 left, -1 right),
 * and between those it bows `bulge` metres sideways from the straight line joining its ends (positive bows further out to `side`).
 * Progress along it counts as the main-road distance it skips, so a shortcut is shorter to drive but never skips a lap gate.
 */
export interface Shortcut { from: number; to: number; side: 1 | -1; bulge: number; width: number; edge: ShortcutEdge; surface?: PatchSurface }
/**
 * A timed hazard, deterministic from race time so the server, prediction and every client agree.
 * Each `period` seconds (shifted by `phase`), it warns for `warn` seconds and then strikes for `strike` seconds; with no period it is always live.
 * `sweep` swings x by ±`amp` around `x` over the period; `cross` moves from `x` to `x + amp` during the strike window.
 */
export interface Hazard {
  kind: HazardKind; s: number; x: number; length: number; width: number;
  period?: number; phase?: number; warn?: number; strike?: number;
  motion?: 'sweep' | 'cross'; amp?: number;
  /** Stun seconds and the message shown to the struck racer. */
  stun: number; text: string;
}
/** Which model a hazard draws with; each course's scenery supplies the model. */
export type HazardKind = 'cart' | 'boulder' | 'geyser' | 'cage' | 'ghost' | 'door' | 'cutlery' | 'barrel';
/** Everything on a course that changes how it drives, apart from Magic Stones. */
export interface CourseLayout { pads: Pad[]; patches: Patch[]; ramps: Ramp[]; gaps: Gap[]; shortcuts: Shortcut[]; hazards: Hazard[] }
