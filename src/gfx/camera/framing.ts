import { clamp } from '../../../shared/math.ts';

/** Where the chase camera sits behind the racer and where it aims, for one screen shape. */
export interface ChaseFraming {
  /** Camera height above the road and distance behind the racer. */
  height: number; back: number;
  /** The aim point: this far ahead of the racer, this high above the road. */
  lookAhead: number; lookHeight: number;
  /** The narrowest horizontal view the camera allows, so the road ahead stays visible on narrow screens. */
  minHorizontalFov: number;
}

const LANDSCAPE: ChaseFraming = { height: 4.2, back: 8, lookAhead: 8, lookHeight: 1.6, minHorizontalFov: 64 };
/** Tall screens raise the camera, pull it closer and aim at the road just ahead, so the horizon sits high, the racer sits
 * above the thumbs and the road ahead fills the middle. The narrower view keeps the racer large on a narrow screen. */
const PORTRAIT: ChaseFraming = { height: 6, back: 6.5, lookAhead: 5, lookHeight: 0, minHorizontalFov: 52 };
/** Square and wider screens use the landscape framing; a tall phone (19.5:9) uses the portrait one, with a blend between. */
const WIDE_ASPECT = 1, TALL_ASPECT = 9 / 19.5;

/** The chase framing for a screen of this width-to-height `aspect`. */
export function chaseFraming(aspect: number): ChaseFraming {
  const k = clamp((WIDE_ASPECT - aspect) / (WIDE_ASPECT - TALL_ASPECT), 0, 1), mix = (a: number, b: number) => a + (b - a) * k;
  return {
    height: mix(LANDSCAPE.height, PORTRAIT.height), back: mix(LANDSCAPE.back, PORTRAIT.back),
    lookAhead: mix(LANDSCAPE.lookAhead, PORTRAIT.lookAhead), lookHeight: mix(LANDSCAPE.lookHeight, PORTRAIT.lookHeight),
    minHorizontalFov: mix(LANDSCAPE.minHorizontalFov, PORTRAIT.minHorizontalFov),
  };
}
