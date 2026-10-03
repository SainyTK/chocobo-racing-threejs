import * as THREE from 'three';
import { TRACKS, type TrackId } from '../../../../shared/track/index.ts';
import { hills } from '../terrain.ts';
import { boulder } from '../props/common.ts';
import type { CourseArt } from '../types.ts';
import type { RoadKind } from '../textures.ts';

/** Minimal art derived from the track definition, used until a course gets its own file. */
export function placeholder(id: TrackId, kind: RoadKind): CourseArt {
  const t = TRACKS[id], road = new THREE.Color(t.road);
  return {
    env: { sky: { top: t.sky, horizon: t.fog }, fog: { color: t.fog, near: 150, far: 650 }, hemi: { sky: '#fff5dc', ground: '#4a4868', intensity: 1.7 }, sun: { color: '#fff2d4', intensity: 2.6, dir: [-.3, .9, .2] } },
    terrain: t.cliff ? null : { height: hills({ amp: 20 }), color: (_p, _h, _s, out) => out.set(t.ground) },
    road: { kind, palette: { base: t.road, dark: `#${road.clone().multiplyScalar(.7).getHexString()}`, light: t.edge } },
    start: { pillar: '#c0c8d2', trim: '#ffffff', banner: '#354877', text: '#ffdf62' }, hazard: 'mud', signs: { board: '#f2ce54', arrow: '#382c37', post: '#555555' },
    build(kit) { kit.scatter(80, kit.w + 8, 60, (x, z) => kit.place(kit.prop('rock', r => boulder(r, t.edge, 1.5), 0), x, kit.groundAt(x, z), z)); },
  };
}
