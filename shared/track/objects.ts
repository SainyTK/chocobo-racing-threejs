import type { TrackId, StoneType, CourseObjects } from './types.ts';
import { TRACKS } from './tracks.ts';
import { trackLength } from './sampling.ts';
import { courseLayout } from './layouts/index.ts';

const objectCache = new Map<TrackId, CourseObjects>();
export function courseObjects(id: TrackId): CourseObjects {
  if (objectCache.has(id)) return objectCache.get(id)!;
  const length = trackLength(id), kinds: (StoneType | 'random')[] = ['fire', 'haste', 'ice', 'thunder', 'shield', 'random', 'mini', 'doom', 'fire', 'haste', 'random', 'ultima'];
  const stones = Array.from({ length: 12 }, (_, i) => [-6.5, 0, 6.5].map((x, j) => ({ id: i * 3 + j, s: 70 + i * (length - 130) / 12, x: x * TRACKS[id].width / 14, kind: kinds[(i + j * 2) % kinds.length] }))).flat();
  const objects = { stones, pads: courseLayout(id).pads }; objectCache.set(id, objects); return objects;
}
