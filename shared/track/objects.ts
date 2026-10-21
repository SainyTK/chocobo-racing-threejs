import type { TrackId, CourseObjects } from './types.ts';
import { placeStones } from './stone-placement.ts';
import { courseLayout } from './layouts/index.ts';

const objectCache = new Map<TrackId, CourseObjects>();
export function courseObjects(id: TrackId): CourseObjects {
  if (objectCache.has(id)) return objectCache.get(id)!;
  const stones = placeStones(id);
  const objects = { stones, pads: courseLayout(id).pads }; objectCache.set(id, objects); return objects;
}
