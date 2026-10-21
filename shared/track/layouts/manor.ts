import type { CourseLayout } from '../types.ts';

/** The Black Manor: a cage drops on the sharp left (go wide to slip past), ghosts drift across the hall, and a jump clears the blood pond. */
export const manor: CourseLayout = {
  pads: [{ s: 160, x: 0 }, { s: 1215, x: 0 }],
  patches: [{ s: 1241, length: 18, x: 0, width: 22, surface: 'slow' }],
  ramps: [{ s: 1236, x: 0, width: 22, length: 8, height: 1.2, lift: .3 }],
  gaps: [],
  shortcuts: [],
  hazards: [
    { kind: 'cage', s: 694, x: 2.25, length: 8, width: 17.5, period: 8, phase: 0, warn: 1.2, strike: 2.6, stun: 2.2, text: 'Caged!' },
    { kind: 'ghost', s: 830, x: 0, length: 2.4, width: 2.4, period: 3.2, phase: 0, motion: 'sweep', amp: 7.5, stun: 1, text: 'Spooked!' },
    { kind: 'ghost', s: 868, x: 0, length: 2.4, width: 2.4, period: 3.9, phase: 1.3, motion: 'sweep', amp: 7.5, stun: 1, text: 'Spooked!' },
  ],
};
