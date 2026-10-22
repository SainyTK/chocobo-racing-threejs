import type { CourseLayout } from '../types.ts';

/** Cid's Test Track teaches the basics: pads on the straights, one jump, and an oil slick that punishes clipping the hairpin's apex. */
export const test: CourseLayout = {
  pads: [{ s: 170, x: 0 }, { s: 470, x: 5 }, { s: 470, x: -5 }, { s: 1180, x: 0 }],
  patches: [{ s: 962, length: 34, x: -9, width: 10, surface: 'slip' }],
  ramps: [{ s: 640, x: 0, width: 10, length: 9, height: 1.1, lift: .3 }],
  gaps: [],
  rails: [],
  shortcuts: [],
  hazards: [],
};
