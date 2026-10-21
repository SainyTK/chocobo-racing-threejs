import type { CourseLayout } from '../types.ts';

/** Mythril Mines: mine carts rattle across the track, and a hidden rail bed through the rock on the left skips the double bend, with no stones on it. */
export const mines: CourseLayout = {
  pads: [{ s: 170, x: 0 }, { s: 1520, x: 0 }],
  patches: [],
  ramps: [],
  gaps: [],
  shortcuts: [{ from: 586, to: 690, side: 1, bulge: 11, width: 3.2, edge: 'wall' }],
  hazards: [
    { kind: 'cart', s: 515, x: -16.5, length: 2.6, width: 3.2, period: 7, phase: 0, warn: 1.5, strike: 2.4, motion: 'cross', amp: 33, stun: 1.4, text: 'Hit by a mine cart!' },
    { kind: 'cart', s: 1345, x: 16.5, length: 2.6, width: 3.2, period: 6, phase: 2, warn: 1.5, strike: 2.2, motion: 'cross', amp: -33, stun: 1.4, text: 'Hit by a mine cart!' },
  ],
};
