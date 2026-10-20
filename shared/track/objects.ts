import type { TrackId, CourseObjects } from './types.ts';
import { trackLength } from './sampling.ts';
import { placeStones } from './stone-placement.ts';

const objectCache = new Map<TrackId, CourseObjects>();
export function courseObjects(id: TrackId): CourseObjects {
  if (objectCache.has(id)) return objectCache.get(id)!;
  const length = trackLength(id), stones = placeStones(id);
  const pads = id === 'test' ? [{ s: length * .34, x: 0 }, { s: length * .77, x: 0 }] : [];
  const hazards = id === 'test' ? [] : Array.from({ length: 5 }, (_, i) => ({ s: 200 + i * (length - 250) / 5, x: Math.sin(i * 2.7 + 1) * 5 }));
  const objects = { stones, pads, hazards }; objectCache.set(id, objects); return objects;
}
