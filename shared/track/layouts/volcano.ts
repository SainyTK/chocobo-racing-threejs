import type { CourseLayout } from '../types.ts';

/** Vulcan-O Valley: boulders crash onto the racing line after a shadow warns of them, and lava geysers erupt at the edges of the bends. */
export const volcano: CourseLayout = {
  pads: [{ s: 200, x: 0 }, { s: 1500, x: 0 }],
  patches: [],
  ramps: [],
  gaps: [],
  shortcuts: [],
  hazards: [
    { kind: 'boulder', s: 525, x: 3, length: 4, width: 4, period: 5.5, phase: 0, warn: 1.6, strike: .7, stun: 1.8, text: 'Flattened by a boulder!' },
    { kind: 'boulder', s: 548, x: -4, length: 4, width: 4, period: 5.5, phase: 2.7, warn: 1.6, strike: .7, stun: 1.8, text: 'Flattened by a boulder!' },
    { kind: 'boulder', s: 790, x: 0, length: 4, width: 4, period: 6.5, phase: 1, warn: 1.6, strike: .7, stun: 1.8, text: 'Flattened by a boulder!' },
    { kind: 'boulder', s: 1160, x: 2, length: 4, width: 4, period: 6, phase: 3.5, warn: 1.6, strike: .7, stun: 1.8, text: 'Flattened by a boulder!' },
    { kind: 'geyser', s: 715, x: -7.5, length: 4, width: 4, period: 4.5, phase: 0, warn: 1.2, strike: 1.1, stun: 1.4, text: 'Scorched by lava!' },
    { kind: 'geyser', s: 988, x: 7.5, length: 4, width: 4, period: 4.5, phase: 2, warn: 1.2, strike: 1.1, stun: 1.4, text: 'Scorched by lava!' },
    { kind: 'geyser', s: 1342, x: 7, length: 4, width: 4, period: 5, phase: 1, warn: 1.2, strike: 1.1, stun: 1.4, text: 'Scorched by lava!' },
  ],
};
