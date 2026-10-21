import { mod } from '../math.ts';
import type { CourseObjects, TrackId } from './types.ts';
import { TRACKS } from './tracks.ts';
import { trackLength } from './sampling.ts';
import { STONE_LAYOUTS } from './stone-layouts.ts';
import { shortcutPaths } from './shortcuts.ts';

/** Distance between the rows of one field. A racer cannot take two stones closer than its pickup cooldown allows. */
export const STONE_ROW_GAP = 14;
/** Lanes spread evenly across the road, clear of its edges. A positive offset is on the left as the racer sees it. */
const laneOffset = (lane: number, lanes: number, width: number) => (lanes === 1 ? 0 : (.5 - lane / (lanes - 1)) * 1.2) * width;

/** Track stones of a course, field by field and row by row; a stone's id is its index. */
export function placeStones(id: TrackId): CourseObjects['stones'] {
  const length = trackLength(id), paths = shortcutPaths(id);
  return STONE_LAYOUTS[id].flatMap(field => {
    // A field on a shortcut spreads across the shortcut, `at` along it; any other spreads across the road, `at` along the lap.
    const path = field.route === undefined ? undefined : paths[field.route], route = field.route === undefined ? {} : { route: field.route };
    const start = path ? mod(path.shortcut.from + field.at * path.skipped, length) : field.at * length, width = path ? path.shortcut.width : TRACKS[id].width;
    return Array.from({ length: field.rows }, (_, row) => field.lanes.map((kind, lane) => ({ s: start + row * STONE_ROW_GAP, x: laneOffset(lane, field.lanes.length, width), kind, ...route }))).flat();
  })
    .map((stone, index) => ({ id: index, ...stone }));
}
