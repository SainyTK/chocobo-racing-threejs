/**
 * Colours, sizes and phase times of the rebuilt ability effects, measured from PS1 footage (see docs/research.md).
 * Sizes are in racer heights (`c.height`); times are seconds since the effect started.
 */

/** A pair of camera-facing spike fans beside a boosting racer: Dash, Haste, Charge and boost pads. */
export interface FanLook {
  /** Root, middle and tip colours of a spike, drawn additively. */
  root: string; mid: string; tip: string;
  /** Spikes per side, the longest spike and how far from the racer's centre each fan is rooted. */
  spikes: number; length: number; offset: number;
  /** Lowest and highest spike angle above the road, in radians. */
  low: number; high: number;
  /** Tint mixed into the racer's model while the boost lasts, and how strongly. The mix happens in linear colour, so tints are darker than the colour they produce. */
  tint: string; tintAmount: number;
}

export const DASH_FAN: FanLook = { root: '#ffffff', mid: '#a8dcff', tip: '#3f78ff', spikes: 8, length: 2.3, offset: .14, low: .04, high: 1.25, tint: '#0a3a8c', tintAmount: .5 };
export const HASTE_FAN: FanLook = { root: '#d8ffcc', mid: '#7ee860', tip: '#2fd814', spikes: 7, length: 2, offset: .14, low: .04, high: 1.2, tint: '#1f9a10', tintAmount: .45 };
export const CHARGE_FAN: FanLook = { root: '#fffbe8', mid: '#ffe070', tip: '#ff8030', spikes: 9, length: 1.45, offset: .26, low: .12, high: 1.3, tint: '#c04010', tintAmount: .45 };

/** Seconds a spike keeps its random length and angle: the original re-rolls them every 30 fps frame. */
export const SPIKE_HOLD = 1 / 30;
/** After a boost ends the fans hold, then fade, while the tint is already gone. */
export const FAN_END = { hold: .1, fade: .13 } as const;
/** Fans grow to full size over this many seconds when a boost starts. */
export const FAN_GROW = { dash: .35, haste: .13, charge: .07 } as const;

/** The Dash burst, scaled from the original's 1.6 s to fit the remake's 2 s Dash. */
export const DASH_BURST = {
  cross: [.03, .3], glow: [.1, .55], core: [.45, .8], rays: [.45, .95],
  crossColor: '#ffffff', glowInner: '#c9cbea', glowRim: '#6b5cd8', coreColor: '#ffffff', rayColor: '#ffa8ee', rayTip: '#c08cf7',
} as const;
/** Haste: a thin blue-white ring circles the racer for its first frames. */
export const HASTE_RING = { life: .2, color: '#cfe6ff' } as const;

/** Charge: a light column, a pink dome with a flare line, a white-pink sphere and long rays, fitted to the 1 s Charge. */
export const CHARGE_BURST = {
  column: [.02, .12], dome: [.08, .3], sphere: [.28, .55], rays: [.4, .75],
  /** The fans swell and fade in bursts this many seconds apart. */
  pulse: .37,
  columnColor: '#ffd9ec', domeInner: '#ffe2ef', domeRim: '#ff9ccf', sphereColor: '#ffe2c3', rayColor: '#fff0f4', rayTip: '#ee8aa0',
} as const;
/** The ram: sparks at the contact point and stars round the victim. */
export const CHARGE_RAM = { spark: '#ffcf5a', sparkEnd: '#ff7a20', star: '#ffc84a', twinkle: '#8fc8ff' } as const;

/** Flap's glowing feathered wings, fitted to the remake's 5 s Flap. */
export const FLAP = {
  cross: [0, .18], glow: [.06, .6], ball: [.3, .6], rays: [.08, .55],
  /** Wings appear inside the glow already full size, then settle from a raised V to level. */
  wingsIn: .38, wingsLevel: .9,
  /** Seconds of the lilac fade at the end, and the visual rise and drop. */
  fade: .6, rise: [.35, .95], drop: .3, lift: 2.4,
  /** One wing beat: a slow sweep down, then a snap back up. */
  beat: .535, sweep: .43, up: .62, down: -.42,
  /** Each wing is this long, in racer heights, rooted this high on the racer. */
  length: 1.25, shoulder: .55,
  core: '#fdf2fd', edge: '#f07cc8', glowColor: '#7d6ec8', fadeCore: '#edd1fb', fadeEdge: '#a98fc3',
  flashColor: '#ffffff', ballInner: '#eceff6', ballRim: '#9a8ee6', rayColor: '#ffd2f2',
} as const;
/** Feather plumes of one wing: angle from the wing's main line, length and width, all relative. */
export const FEATHERS = [
  { angle: .36, length: 1, width: .2 },
  { angle: .14, length: .95, width: .19 },
  { angle: -.08, length: .86, width: .18 },
  { angle: -.3, length: .75, width: .16 },
  { angle: -.52, length: .62, width: .14 },
] as const;

/** Megaflare on Bahamut, fitted to the remake's 1.5 s warning: glow, ring of orbs, beams, then warning shots on rivals. */
export const FLARE_CAST = {
  glow: [0, .32], orbs: [.16, .72], beams: [.62, .92], shots: [.9, 1.5],
  /** Orbs in the ring, and its radius from start to end, in racer heights. */
  orbCount: 7, ringFrom: .8, ringTo: 2.6, orbSize: .4,
  glowColor: '#e8e2ff', orbCore: '#ffffff', orbRim: '#ff2a5a', orbMid: '#ffc89a',
  beamCore: '#fff2e8', beamEdge: '#d0407a', rayColor: '#ffc6e8',
  /** Warning shots per second on each rival, their fall speed, life and how far from the rival they land. */
  shotRate: 10, shotSpeed: 70, shotLife: .14, missFrom: 1.8, missTo: 4.5,
  shotCore: '#fffcf4', shotRing: '#ffd66b', shotRay: '#ff7754', shotTip: '#d0281c',
} as const;
/** The strike on each rival: a flame starburst, a fire cone with red streaks, smoke and falling stars, then charring. */
export const FLARE_STRIKE = {
  life: .8, streaks: 14, width: 2.4, height: 4.6, burn: 1.4,
  flash: '#f2d93e', fire: '#fbeea4', fireEdge: '#f79961', streakRoot: '#ffb070', streak: '#ff2a1a', charred: '#ff6420',
} as const;
