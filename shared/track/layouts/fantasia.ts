import type { CourseLayout } from '../types.ts';

/**
 * Fantasia: pits on both sides, a railing on one side at most (on the outside of most bends, never at the far-left hairpin),
 * a railless walkway below the road that skips the far-left spike, and a walled tunnel. Ramuh's lightning is scenery, as in the original.
 */
export const fantasia: CourseLayout = {
  pads: [],
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
    // Where the walkway rejoins, the far edge is railed, so racers crossing the road from it are caught.
    { s: 968, length: 64, side: -1 },
    { s: 1094, length: 62, side: -1 }, { s: 1224, length: 72, side: 1 }, { s: 1370, length: 72, side: -1 },
    { s: 1664, length: 50, side: -1 },
    // The tunnel is walled on both sides.
    { s: 1716, length: 80, side: 1 }, { s: 1716, length: 80, side: -1 },
    { s: 1866, length: 46, side: 1 }, { s: 1994, length: 40, side: 1 }, { s: 2034, length: 72, side: -1 },
  ],
  shortcuts: [{ from: 775, to: 965, side: 1, join: 60, width: 3.2, edge: 'fall', drop: 1.8 }],
  hazards: [],
};
