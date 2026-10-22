import type { CourseLayout } from '../types.ts';

/**
 * Fantasia: pits on both sides, a railing on one side at most (on the outside of most bends, never at the far-left hairpin),
 * a railless walkway that skips the far-left spike, a walled tunnel, and Ramuh's lightning striking the semicircle's edges.
 */
export const fantasia: CourseLayout = {
  pads: [{ s: 530, x: 0 }, { s: 1452, x: 0 }],
  patches: [],
  ramps: [],
  gaps: [],
  rails: [
    // Leviathan's coils: each lobe railed on its outside, switching sides lobe by lobe.
    { s: 10, length: 52, side: 1 }, { s: 92, length: 84, side: -1 }, { s: 198, length: 96, side: 1 }, { s: 326, length: 96, side: -1 },
    // The top straight and the hard left at its end, railed on the right; the right hairpin railed on its outside.
    { s: 442, length: 160, side: -1 }, { s: 674, length: 46, side: 1 },
    // The upper arm of the spike: a rail on the right that ends before the sharpest hairpin, which has none.
    { s: 760, length: 88, side: -1 },
    { s: 988, length: 44, side: 1 }, { s: 1094, length: 62, side: -1 }, { s: 1224, length: 72, side: 1 }, { s: 1370, length: 72, side: -1 },
    { s: 1664, length: 50, side: -1 },
    // The tunnel is walled on both sides.
    { s: 1716, length: 80, side: 1 }, { s: 1716, length: 80, side: -1 },
    { s: 1866, length: 46, side: 1 }, { s: 1994, length: 40, side: 1 }, { s: 2034, length: 72, side: -1 },
  ],
  shortcuts: [{ from: 765, to: 975, side: 1, join: 50, width: 2.8, edge: 'fall' }],
  hazards: [
    { kind: 'bolt', s: 1822, x: 5.5, length: 4.5, width: 4.5, period: 4.8, phase: 0, warn: 1.2, strike: .55, stun: 1.3, text: 'Struck by lightning!' },
    { kind: 'bolt', s: 1848, x: -5.5, length: 4.5, width: 4.5, period: 4.8, phase: 2.4, warn: 1.2, strike: .55, stun: 1.3, text: 'Struck by lightning!' },
  ],
};
