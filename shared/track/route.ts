import { mod } from '../math.ts';
import type { Projection, TrackId } from './types.ts';
import { TRACKS } from './tracks.ts';
import { pointAt, projectOnTrack, trackLength } from './sampling.ts';
import { projectOnShortcut, shortcutPaths, shortcutPoint, shortcutS, type ShortcutProjection } from './shortcuts.ts';

/** The main road, as opposed to a shortcut's index. */
export const MAIN_ROUTE = -1;

/**
 * Where a racer is: on the main road (`route` -1) or on a shortcut, its lap distance `s` and offset `x` from that route's centre line,
 * and the route's heading there. `main` is always the main-road projection, for walls and edges.
 */
export interface Place { route: number; s: number; x: number; yaw: number; main: Projection; shortcut: ShortcutProjection | null }

/** How far past the mouth a racer can still turn into a shortcut, as a fraction of its length. */
const MOUTH = .35;

/**
 * Locates a world position given where the racer was last tick. A racer joins a shortcut by driving off the road edge into its mouth,
 * and leaves it at either end, or by driving back onto the road. Pure and deterministic, shared by the server and client prediction.
 */
export function locate(id: TrackId, px: number, pz: number, route: number, routeS: number): Place {
  const def = TRACKS[id], len = trackLength(id), paths = shortcutPaths(id);
  const path = route >= 0 ? paths[route] : undefined;
  const main = projectOnTrack(id, px, pz, routeS);
  const onRoad = Math.abs(main.offset) < def.width + .3;
  if (path) {
    const q = projectOnShortcut(path, px, pz), inside = Math.abs(q.x) < path.shortcut.width;
    if (q.u > -path.lead && q.u < 1 && (inside || !onRoad)) return { route, s: mod(shortcutS(path, q.u), len), x: q.x, yaw: q.yaw, main, shortcut: q };
  } else if (Math.abs(main.offset) > def.width - .5) {
    for (let k = 0; k < paths.length; k++) {
      const sc = paths[k].shortcut;
      if (Math.sign(main.offset) !== sc.side || mod(main.s - sc.from + 8, len) > paths[k].skipped * MOUTH + 8) continue;
      const q = projectOnShortcut(paths[k], px, pz);
      // A little slack beyond the shortcut's edge, so a racer turning in at an angle is caught by its walls, not the road's.
      if (q.u > -paths[k].lead && q.u < MOUTH && Math.abs(q.x) < sc.width + 1) return { route: k, s: mod(shortcutS(paths[k], q.u), len), x: q.x, yaw: q.yaw, main, shortcut: q };
    }
  }
  return { route: MAIN_ROUTE, s: main.s, x: main.offset, yaw: pointAt(id, main.s).yaw, main, shortcut: null };
}

/** Surface height under a racer on its route. */
export function routeHeight(id: TrackId, route: number, s: number) {
  const path = route >= 0 ? shortcutPaths(id)[route] : undefined;
  return path ? shortcutPoint(path, mod(s - path.shortcut.from, trackLength(id)) / path.skipped).y : pointAt(id, s).y;
}

/** World point at lap distance `s`, `offset` metres left of the route's centre line. Bots aim with it. */
export function routePoint(id: TrackId, route: number, s: number, offset = 0) {
  const path = route >= 0 ? shortcutPaths(id)[route] : undefined;
  return path ? shortcutPoint(path, mod(s - path.shortcut.from, trackLength(id)) / path.skipped, offset) : pointAt(id, s, offset);
}
