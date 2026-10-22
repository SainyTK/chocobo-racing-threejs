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

/** A typical racer's drawn height in metres, for meshes built in metres and sized per racer height. */
export const RACER_HEIGHT = 3.6;

/**
 * The activation flash of Grip-Up, Mug, Barrier and Magic Plus (see `activation.ts`). Windows are seconds since use and
 * must end with `rays`; sizes are in racer heights.
 */
export interface ActivationLook {
  cross: readonly [number, number]; disc: readonly [number, number]; shrink: readonly [number, number]; rays: readonly [number, number];
  centre: number; radius: number; coreRadius: number; crossLength: number; rayCount: number; rayLength: number;
  /** How far the racer's model washes toward white at the flash's height. */
  wash: number;
  /** How strongly the disc fills: the wide Magic Plus disc is fainter. Its height is `squash` of its width. */
  fill: number; squash: number;
  inner: string; rim: string; ray: string; rayTip: string;
}
/** Golem's, measured at about twice the kart's width. Barrier's is the same flash. */
export const ACTIVATION: ActivationLook = {
  cross: [.08, .45], disc: [.1, .4], shrink: [.4, 1], rays: [.15, 1.3],
  centre: .4, radius: .95, coreRadius: .14, crossLength: 1.6, rayCount: 10, rayLength: 2.6, wash: .6, fill: .6, squash: 1,
  inner: '#d6d0e8', rim: '#9a7fc4', ray: '#fff4fb', rayTip: '#e48ad8',
};
/** Mug's flash: a softer white disc with a lavender edge, a little wider. */
export const MUG_ACTIVATION: ActivationLook = { ...ACTIVATION, cross: [.05, .4], disc: [.08, .5], shrink: [.5, 1.1], rays: [.6, 1.2], radius: 1.1, inner: '#e8ebf9', rim: '#9c9ce4', ray: '#f2d4f0', rayTip: '#b049c6' };
/** Magic Plus's flash spreads to five or six kart widths before it pulls in. */
export const MAGIC_ACTIVATION: ActivationLook = { ...ACTIVATION, cross: [.13, .6], disc: [.13, .6], shrink: [.6, 1.1], rays: [.3, 1.35], radius: 2.1, coreRadius: .2, crossLength: 2.6, rayCount: 12, rayLength: 4, fill: .32, squash: .7, inner: '#f0eee8', rim: '#a5a8e8', ray: '#ffd7de', rayTip: '#e4a8c8' };

/** Grip-Up, fitted to the remake's 7 s: times since use, sizes in racer heights. */
export const GRIP = {
  /** The rings are born thin at the hubs, flung out as crescents, then snap back in. */
  hubs: [1.3, 1.37], out: [1.37, 1.75], snap: [1.93, 2.03],
  /** Seconds of the fade at the end, and the pulse of the rings' height. */
  fade: .27, period: .5, pulse: .12,
  /** Half width and half height of each ring, its centre out from the racer's middle, ahead of it and above the road. */
  width: .17, height: .17, offset: .42, ahead: -.12, hub: .17,
  /** How far beyond its rest the ring is flung. */
  fling: .55, streaks: 4,
  alpha: 1, cover: .9, rim: '#fff0fb', band: '#ea5fca', trail: '#b4468c',
} as const;

/** Goblin's helper: its build and colours. Sizes in metres for a racer of `RACER_HEIGHT`. */
export const MUG_HELPER = {
  height: 2.3, strideRate: 4,
  skin: '#cfccd6', eyeWhite: '#ffffff', pupil: '#121018', hair: '#9c24e4', hairShade: '#7a1cc0', vest: '#cc8424', shirt: '#3a3046', legs: '#2a2430', outline: '#1a1020',
} as const;

/** Mug: when each leg of the helper's trip plays, in seconds since use, and its paths as [ahead, right, up] in racer heights. */
export const MUG = {
  leave: [0, .4], pass: [.2, 1.05], ring: [.42, .72], back: [.95, 1.57], arrive: 1.57,
  leavePath: [[0, .6, .2], [.3, 1.6, 1], [.6, 2.8, 1.1], [.9, 4.5, .7]],
  passPath: [[7.5, 4.2, .3], [4, 2.2, 1.3], [.7, -.35, .35], [-3.8, -3.2, .15]],
  backPath: [[-2.5, -4.2, .2], [-1, -2.2, 1.3], [-.2, -.8, 1.1], [0, 0, .5]],
  ringHeight: .3, ringFrom: .38, ringTo: .7, ringWidth: .035, ringColor: '#fdeee6', ringFade: '#e8b5e6',
  trail: '#ffc4e8', trailEnd: '#b46ad8', trailLife: .22, carriedScale: 1.3,
} as const;

/** Barrier: a pulse every `period` seconds, each `pulse` long; sizes in racer heights. */
export const BARRIER = {
  period: .71, pulse: .3, firstPulse: .9, lastPulseDelay: .08,
  /** The share of a pulse after which the white cap lifts off and the clear sphere fades. */
  capAt: .55,
  width: 1.25, height: 1, centre: .5, forward: .6, carpet: .08, sparkleRate: 10,
  core: '#f6f7fa', rim: '#94d3dc', tint: '#a4dce8', beam: '#f2c4e0', cover: .8,
} as const;

/** Magic Plus: the green curtain and the black flicker of the raised stone. */
export const MAGIC_PLUS = {
  /** The original flips the stone black every 30 fps frame (15 blinks a second); a little slower stays visible at any frame rate. */
  curtain: [1.37, 1.87], glint: [1.8, 2.1], flicker: 2.9, flickerRate: 12.5,
  drop: 2.6, width: 1.6, glintSize: .22,
  core: '#9be698', edge: '#b7f4bc',
} as const;

/** Receive: times since the catch; sizes in racer heights. */
export const RECEIVE = {
  grow: [.13, .53], clear: [.53, .8], streak: [.1, .5], halo: [.23, .6], rays: [.36, 1.1], sink: [.95, 1.45], seated: 1.5,
  orbHeight: 1.5, orbMin: .08, orbMax: .36, orbClear: .5, stoneScale: 1.6, rayCount: 9,
  orbCore: '#fefcfd', orbFringe: '#8f86e0', pillar: '#bcb6ec', haloInner: '#d8d2f4', haloRim: '#8a7fd6', ray: '#f2bce4', rayTip: '#b88ee8',
} as const;
