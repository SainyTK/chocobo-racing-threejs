import type { CourseLayout } from '../types.ts';

/** Gingerbread Land: a syrup shortcut after the first right turn, a candy ramp, giant cutlery stuck in the road, and an icing slick after the tunnel. */
export const gingerbread: CourseLayout = {
  pads: [{ s: 200, x: 0 }, { s: 380, x: 0 }],
  patches: [{ s: 1410, length: 40, x: 0, width: 24, surface: 'slip' }],
  ramps: [{ s: 1215, x: 0, width: 10, length: 9, height: 1.2, lift: .3 }],
  gaps: [],
  shortcuts: [{ from: 624, to: 750, side: 1, bulge: 9, width: 3.2, edge: 'rough', surface: 'slip' }],
  hazards: [
    { kind: 'cutlery', s: 990, x: 6, length: 1.6, width: 2.6, stun: .9, text: 'Bonk!' },
    { kind: 'cutlery', s: 1012, x: -5, length: 1.6, width: 2.6, stun: .9, text: 'Bonk!' },
  ],
};
