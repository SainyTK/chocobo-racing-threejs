import type { Hazard, HazardKind, PatchSurface } from '../../../shared/track/index.ts';
import type { Kit, Parts, PropFactory } from './kit.ts';
import type { SkySpec, MountainLayer } from './sky.ts';
import type { TerrainSpec, RoadSpec } from './terrain.ts';
import type { AmbientSpec } from './ambient.ts';

/** Light, fog and sky for one course. The sun direction also places the sun disc and orients mountain shading. */
export interface Environment {
  sky: SkySpec;
  fog: { color: string; near: number; far: number };
  hemi: { sky: string; ground: string; intensity: number };
  sun: { color: string; intensity: number; dir: [number, number, number] };
  mountains?: MountainLayer[];
  exposure?: number;
}

export interface StartGateStyle { pillar: string; trim: string; banner: string; text: string; light?: string; flags?: string[] }
/** How a slow or slippery patch looks. */
export type PatchLook = 'mud' | 'oil' | 'ice' | 'icing' | 'syrup' | 'blood' | 'goo' | 'tar';
/** Jump ramp colours: the deck, the chevrons and lip stripes, and the side panels. */
export interface RampStyle { deck: string; stripe: string; side: string }
/** Shortcut edge colours: wall faces (or the underside of a drop) and the cap or lip. */
export interface ShortcutStyle { wall: string; cap: string }
/**
 * Models for one kind of timed hazard, built for a specific hazard so they can fit its footprint. `mover` is animated from race time;
 * `base` is fixed scenery around it (rails, a gantry, a vent). `warn` colours the decal that shows where it is about to strike.
 */
export interface HazardArt { mover: (h: Hazard) => Parts; base?: (h: Hazard) => Parts; warn?: string }

/** Everything that makes a course look like itself. One file per course under courses/. */
export interface CourseArt {
  env: Environment;
  /** Null for courses with no ground below the road (they build their own underside). */
  terrain: TerrainSpec | null;
  road: RoadSpec;
  start: StartGateStyle;
  /** Looks of the course's slow and slippery patches. */
  patches: Record<PatchSurface, PatchLook>;
  /** Needed when the course layout has ramps. */
  ramp?: RampStyle;
  /** Needed when the course layout has shortcuts. */
  shortcut?: ShortcutStyle;
  /** Models for every kind of timed hazard in the course layout. */
  hazards?: Partial<Record<HazardKind, HazardArt>>;
  /** Colours for the corner warning boards. */
  signs: { board: string; arrow: string; post: string };
  ambient?: AmbientSpec[];
  /** Curbs, walls, props and landmarks. */
  build(kit: Kit): void;
  /** Named props for the studio prop sheet, in the order they should be laid out. */
  catalog?: Record<string, PropFactory>;
}
