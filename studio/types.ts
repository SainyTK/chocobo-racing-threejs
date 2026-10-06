import type * as THREE from 'three';
import type { Effects } from '../src/gfx/effects/index.ts';
import type { Environment } from '../src/gfx/stage/course.ts';
import type { ViewState } from './viewport.ts';
import type { StageMusic } from '../src/music/types.ts';

export const CATEGORIES = ['Characters', 'Items', 'Effects', 'Stage', 'Courses', 'Music'] as const;
export type Category = typeof CATEGORIES[number];

/** What an element can draw into: its pane's scene, the pane's own effects controller and camera. */
export interface StudioContext { scene: THREE.Scene; fx: Effects; camera: THREE.Camera }

/** One live element in a pane. Ground level is y = 0; the pane adds `object` to its scene and removes it on dispose. */
export interface Instance {
  object?: THREE.Object3D; update?(t: number, dt: number): void; dispose?(): void;
  /** Course light, fog and sky. The pane then hides its own ground and background. */
  env?: Environment;
  /** Orbit target and distance, for elements whose interesting spot is not at the origin. */
  focus?: { target: THREE.Vector3; distance: number; near?: number; far?: number };
  /**
   * Drives the camera itself (a race chase camera, a fly-through). The pane's orbit angles and zoom arrive as
   * `view`, so dragging still looks around. Returns the point the sun's shadows should centre on.
   */
  camera?(camera: THREE.PerspectiveCamera, view: ViewState, t: number, dt: number): THREE.Vector3;
  /** Follows the studio's quality setting the way the game does. May change `env`, which the pane then re-applies. */
  setQuality?(q: 'high' | 'low'): void;
  /** The quality last applied through `setQuality`, kept by the pane. */
  quality?: 'high' | 'low';
}

export interface Variant { id: string; label: string; /** Marks the variant the game currently uses. */ inGame?: boolean }

export interface StudioElement {
  /** Stable id used in shared links, e.g. `item.fire`. */
  id: string; name: string; category: Category; tags?: string[]; variants: Variant[];
  /** Orbit target height and distance. Elements with a bounded `object` may omit it to frame automatically. */
  view?: { y: number; distance: number };
  /** Music panes show score information and use the studio's single audio player. */
  music?: StageMusic;
  previousMusic?: StageMusic;
  musicReference?: { track: number; title: string; direction: string };
  create(variant: string, ctx: StudioContext): Instance;
}

/** Calls `fire` at t = 0 and every `period` seconds after, so one-shot effects replay in step across panes. */
export function every(period: number, fire: () => void) {
  let last = -1;
  return (t: number) => { const k = Math.floor(t / period); if (k !== last) { last = k; fire(); } };
}
