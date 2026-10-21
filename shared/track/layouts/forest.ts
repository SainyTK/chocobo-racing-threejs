import type { CourseLayout } from '../types.ts';

/** Moogle Forest: a narrow woodland trail cuts the double left bend, and mud pools sit on the tight apexes. */
export const forest: CourseLayout = {
  pads: [{ s: 210, x: 0 }, { s: 960, x: -4 }],
  patches: [
    { s: 470, length: 26, x: -7.5, width: 8, surface: 'slow' },
    { s: 900, length: 30, x: 7.5, width: 8, surface: 'slow' },
    { s: 1130, length: 28, x: -7.5, width: 8, surface: 'slow' },
  ],
  ramps: [],
  gaps: [],
  shortcuts: [{ from: 590, to: 766, side: 1, join: 20, width: 3.6, edge: 'rough' }],
  hazards: [],
};
