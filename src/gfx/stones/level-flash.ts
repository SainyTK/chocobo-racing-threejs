/**
 * How a held stack shows its level, read frame by frame from 30 fps footage of the original. Times in seconds, sizes in
 * stone radii. A level 1 stone is steady.
 * - Level 2: a bright band sweeps down the ball from top to bottom over `sweep[0]`, once every `period[0]`.
 * - Level 3: once every `period[1]` a white disc swells from the ball's size to `flashRadius[1]` over `flash`, opens
 *   into a pale yellow ring that keeps growing to `ringRadius` and fades over `ring`, and then a quicker band sweeps
 *   down the ball over `sweep[1]`, ending just before the next flash.
 */
export const LEVEL_FLASH = {
  period: [.53, .44], sweep: [.3, .12], band: .5,
  flash: .13, flashRadius: [1, 1.3], ring: .13, ringRadius: 1.55, ringWidth: .14,
} as const;

const f = (x: number) => x.toFixed(3);
/** The level 3 band starts here in its cycle, so it ends just before the next flash. */
const SWEEP_START_3 = LEVEL_FLASH.period[1] - LEVEL_FLASH.sweep[1] - .01;

/** GLSL shared by the stone and halo shaders. The including shader declares `uniform float uTime`. */
export const LEVEL_FLASH_GLSL = /* glsl */ `
const float PERIOD_2 = ${f(LEVEL_FLASH.period[0])}, PERIOD_3 = ${f(LEVEL_FLASH.period[1])}, SWEEP_2 = ${f(LEVEL_FLASH.sweep[0])}, SWEEP_3 = ${f(LEVEL_FLASH.sweep[1])}, SWEEP_START_3 = ${f(SWEEP_START_3)}, BAND = ${f(LEVEL_FLASH.band)};
const float FLASH = ${f(LEVEL_FLASH.flash)}, FLASH_FROM = ${f(LEVEL_FLASH.flashRadius[0])}, FLASH_TO = ${f(LEVEL_FLASH.flashRadius[1])}, RING = ${f(LEVEL_FLASH.ring)}, RING_TO = ${f(LEVEL_FLASH.ringRadius)}, RING_WIDTH = ${f(LEVEL_FLASH.ringWidth)};
/** Seconds into a stack's flash cycle; each stack runs on its own phase. */
float flashClock(float phase, float period) { return mod(uTime + phase * .16, period); }
/** Brightness of the band sweeping down a level 2 or 3 ball at screen height y (1 top, -1 bottom) and s seconds into the cycle. */
float sweepBand(float level, float y, float s) {
  float u = level > 2.5 ? (s - SWEEP_START_3) / SWEEP_3 : s / SWEEP_2;
  return u > 0. && u < 1. ? 1. - smoothstep(0., BAND, abs(y - mix(1.15, -1.15, u))) : 0.;
}
`;
