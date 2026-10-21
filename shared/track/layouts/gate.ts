import type { CourseLayout } from '../types.ts';

/** The Ancient Gate: a walled fork on the long right-hander, and a pair of stone doors that close the road half at a time. */
export const gate: CourseLayout = {
  pads: [{ s: 190, x: 0 }, { s: 1600, x: 0 }],
  patches: [],
  ramps: [],
  gaps: [],
  shortcuts: [{ from: 598, to: 702, side: -1, bulge: 14, width: 4.4, edge: 'wall' }],
  hazards: [
    { kind: 'door', s: 985, x: 5.5, length: 2.4, width: 11, period: 5, phase: 0, warn: .9, strike: 2.2, stun: 1.2, text: 'Crushed by the gate!' },
    { kind: 'door', s: 985, x: -5.5, length: 2.4, width: 11, period: 5, phase: 2.5, warn: .9, strike: 2.2, stun: 1.2, text: 'Crushed by the gate!' },
  ],
};
