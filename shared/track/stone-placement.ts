import type { CourseObjects, TrackId } from './types.ts';
import { TRACKS } from './tracks.ts';
import { trackLength } from './sampling.ts';
import { STONE_LAYOUTS } from './stone-layouts.ts';

/** Distance between the rows of one field. A racer cannot take two stones closer than its pickup cooldown allows. */
export const STONE_ROW_GAP = 14;
/** Lanes spread evenly across the road and stay clear of its edges. */
const laneOffset = (lane: number, lanes: number, width: number) => (lanes === 1 ? 0 : (lane / (lanes - 1) - .5) * 1.2) * width;

/** Track stones of a course, field by field and row by row; a stone's id is its index. */
export function placeStones(id: TrackId): CourseObjects['stones'] {
  const length = trackLength(id), width = TRACKS[id].width;
  return STONE_LAYOUTS[id].flatMap(field => Array.from({ length: field.rows }, (_, row) => field.lanes.map((kind, lane) => ({ s: field.at * length + row * STONE_ROW_GAP, x: laneOffset(lane, field.lanes.length, width), kind }))).flat())
    .map((stone, index) => ({ id: index, ...stone }));
}
