import type { Race } from '../../../shared/game/index.ts';
import { pointAt, projectOnTrack } from '../../../shared/track/index.ts';

export const rand = (a = -1, b = 1) => a + Math.random() * (b - a);
export const floorY = (race: Race, x: number, z: number) => pointAt(race.track, projectOnTrack(race.track, x, z).s).y;
