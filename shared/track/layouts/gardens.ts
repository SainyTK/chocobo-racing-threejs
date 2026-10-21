import type { CourseLayout } from '../types.ts';

/** Floating Gardens: a ramp throws racers over a gap between islands, a railless sky bridge cuts the long left, and a hidden slick waits on the hairpin. */
export const gardens: CourseLayout = {
  pads: [{ s: 180, x: 0 }, { s: 1400, x: 0 }],
  patches: [{ s: 708, length: 30, x: 4, width: 14, surface: 'slip' }],
  ramps: [{ s: 882, x: 0, width: 22, length: 8, height: 1.2, lift: .3 }],
  gaps: [{ s: 885, length: 13 }],
  shortcuts: [{ from: 332, to: 452, side: 1, bulge: 8, width: 2.6, edge: 'fall' }],
  hazards: [],
};
