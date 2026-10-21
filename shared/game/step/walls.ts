import type { Racer } from '../types.ts';

/** Share of speed kept after hitting a wall at `outward` m/s: 2% to 45% is lost, a third of that with Grip-Up. */
export const wallKeep = (p: Racer, outward: number) => 1 - Math.min(.45, .02 + outward * .024) * (p.gripUp > 0 ? .3 : 1);
