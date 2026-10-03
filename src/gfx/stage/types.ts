import type { Kit, PropFactory } from './kit.ts';
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
export type HazardKind = 'mud' | 'lava' | 'goo' | 'ink' | 'water';

/** Everything that makes a course look like itself. One file per course under courses/. */
export interface CourseArt {
  env: Environment;
  /** Null for courses with no ground below the road (they build their own underside). */
  terrain: TerrainSpec | null;
  road: RoadSpec;
  start: StartGateStyle;
  hazard: HazardKind;
  /** Colours for the corner warning boards. */
  signs: { board: string; arrow: string; post: string };
  ambient?: AmbientSpec[];
  /** Curbs, walls, props and landmarks. */
  build(kit: Kit): void;
  /** Named props for the studio prop sheet, in the order they should be laid out. */
  catalog?: Record<string, PropFactory>;
}
