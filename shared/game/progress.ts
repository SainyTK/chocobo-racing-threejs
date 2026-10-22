import { mod } from '../math.ts';
import { trackLength } from '../track/sampling.ts';
import { routeHeight, type Place } from '../track/route.ts';
import type { TrackId } from '../track/types.ts';
import type { Race, Racer } from './types.ts';

/** Total race distance, capped at the next unvisited gate so a missed checkpoint earns nothing. */
export const raceProgress = (r: Race, p: Racer) => Math.min(p.s, (p.gates + 1) * trackLength(r.track) / 12);

/** Largest lap-distance change a tick of slow driving may make; faster racers may move up to four ticks' travel. */
export const DRIVEN_STEP = 8;

/** Smallest step down in the surface, in one tick, that a racer falls off rather than follows. Slopes and crests drop far less per tick. */
const LEDGE = .5;

/**
 * Moves a racer to its new place and its lap distance `s` with it, the same way on the server and in client prediction.
 * A tick of driving moves `s` a few metres. Switching between the road and a shortcut is the one place it may jump; any other jump,
 * like a cut across open ground, earns nothing.
 */
export function followPlace(track: TrackId, p: Racer, place: Place, dt: number) {
  const len = trackLength(track), delta = mod(place.s - p.routeS + len / 2, len) - len / 2, floor = routeHeight(track, p.route, p.routeS);
  if (Math.abs(delta) < Math.max(DRIVEN_STEP, p.speed * dt * 4) || place.route !== p.route) p.s += delta;
  p.routeS = place.s; p.x = place.x; p.route = place.route;
  // Driving off a ledge, such as the mouth of a dropped shortcut, leaves the racer in the air above the lower surface to fall onto it.
  const below = floor - routeHeight(track, p.route, p.routeS);
  if (below > LEDGE) p.alt += below;
}
