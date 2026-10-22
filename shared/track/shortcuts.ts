import { angleDelta, clamp, mod } from '../math.ts';
import type { Shortcut, TrackId } from './types.ts';
import { TRACKS } from './tracks.ts';
import { pointAt, trackLength } from './sampling.ts';
import { courseLayout } from './layouts/index.ts';

/**
 * A shortcut's centre line, sampled finely: world points with their height and cumulative length.
 * `lead` is how far before its mouth (as a fraction of its length) a racer can already turn into it: the road's wall opens that much early.
 */
export interface ShortcutPath { shortcut: Shortcut; x: Float64Array; y: Float64Array; z: Float64Array; d: Float64Array; length: number; skipped: number; lead: number }
/** Where a world position sits on a shortcut: `u` runs 0 at the mouth to 1 where it rejoins, `x` is metres left of its centre line. */
export interface ShortcutProjection { u: number; x: number; distance: number; px: number; pz: number; nx: number; nz: number; yaw: number }

const SAMPLES = 240;
/** Metres before a shortcut's mouth, and after its exit, where the road's wall is already open: enough for a racer to turn in early and for the chase camera behind it. */
export const OPENING = 12;
const paths = new Map<TrackId, ShortcutPath[]>();
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Heading of a shortcut's centre line at fraction `t`: an even turn from `start`, plus `bend` times a bump that vanishes, with its slope,
 * at both ends. The bump moves the turning earlier or later without changing the heading or the curvature at the ends.
 */
const heading = (start: number, turn: number, bend: number, t: number) => start + turn * t + bend * Math.sin(Math.PI * t) ** 2;

/** Points of a line of unit length with that heading, from the origin. */
function trace(start: number, turn: number, bend: number) {
  const x = new Float64Array(SAMPLES + 1), z = new Float64Array(SAMPLES + 1);
  for (let i = 1; i <= SAMPLES; i++) { const h = heading(start, turn, bend, (i - .5) / SAMPLES); x[i] = x[i - 1] + Math.sin(h) / SAMPLES; z[i] = z[i - 1] + Math.cos(h) / SAMPLES; }
  return { x, z };
}

/**
 * Builds the centre line from its heading. It turns off the road edge `join` degrees towards its side, turns evenly to meet the road
 * edge again at the same angle, and `bend` is solved so the line lands exactly on its exit. The turning spreads along the whole
 * shortcut, so neither end tightens; racers make the turn at the join on the road. Height blends between the road heights at both ends.
 */
function buildPath(id: TrackId, shortcut: Shortcut): ShortcutPath {
  const w = TRACKS[id].width, len = trackLength(id), a = pointAt(id, shortcut.from, shortcut.side * w), b = pointAt(id, shortcut.to, shortcut.side * w);
  // The road's own turn over the stretch, summed metre by metre so a bend of more than half a turn keeps its direction.
  let roadTurn = 0;
  for (let s = shortcut.from; s < shortcut.from + mod(shortcut.to - shortcut.from, len); s++) roadTurn += angleDelta(pointAt(id, s + 1).yaw, pointAt(id, s).yaw);
  const join = shortcut.side * shortcut.join * Math.PI / 180, start = a.yaw + join, turn = roadTurn - 2 * join;
  const chord = Math.hypot(b.x - a.x, b.z - a.z), want = Math.atan2(b.x - a.x, b.z - a.z);
  const miss = (bend: number) => { const e = trace(start, turn, bend); return angleDelta(Math.atan2(e.x[SAMPLES], e.z[SAMPLES]), want); };
  // Newton's method on the direction to the exit; a fixed number of steps keeps it deterministic.
  let bend = 0;
  for (let n = 0; n < 12; n++) bend -= miss(bend) / ((miss(bend + 1e-4) - miss(bend)) / 1e-4);
  const unit = trace(start, turn, bend), length = chord / Math.hypot(unit.x[SAMPLES], unit.z[SAMPLES]);
  const x = unit.x.map(v => a.x + v * length), z = unit.z.map(v => a.z + v * length);
  const y = new Float64Array(SAMPLES + 1).map((_, i) => a.y + (b.y - a.y) * smooth(i / SAMPLES)), d = new Float64Array(SAMPLES + 1).map((_, i) => i * length / SAMPLES);
  return { shortcut, x, y, z, d, length, skipped: mod(shortcut.to - shortcut.from, len), lead: OPENING / length };
}

/** Every shortcut on a course, built once. */
export function shortcutPaths(id: TrackId) {
  if (!paths.has(id)) paths.set(id, courseLayout(id).shortcuts.map(s => buildPath(id, s)));
  return paths.get(id)!;
}

/** Nearest point on a shortcut's centre line. Past either end `u` keeps counting below 0 or above 1, so callers can see a racer leave. */
export function projectOnShortcut(path: ShortcutPath, px: number, pz: number): ShortcutProjection {
  let best = Infinity, result: ShortcutProjection = { u: 0, x: 0, distance: Infinity, px: 0, pz: 0, nx: 0, nz: 0, yaw: 0 };
  for (let i = 0; i < SAMPLES; i++) {
    const dx = path.x[i + 1] - path.x[i], dz = path.z[i + 1] - path.z[i], ll = dx * dx + dz * dz;
    const raw = ((px - path.x[i]) * dx + (pz - path.z[i]) * dz) / ll, t = clamp(raw, 0, 1), qx = path.x[i] + dx * t, qz = path.z[i] + dz * t, dist = (px - qx) ** 2 + (pz - qz) ** 2;
    if (dist >= best) continue;
    best = dist;
    const l = Math.sqrt(ll), nx = dz / l, nz = -dx / l, along = path.d[i] + (i === 0 || i === SAMPLES - 1 ? raw : t) * l;
    result = { u: along / path.length, x: (px - qx) * nx + (pz - qz) * nz, distance: Math.sqrt(dist), px: qx, pz: qz, nx, nz, yaw: Math.atan2(dx, dz) };
  }
  return result;
}

/** World point `offset` metres left of a shortcut's centre line at fraction `u`, with the surface height and heading there. */
export function shortcutPoint(path: ShortcutPath, u: number, offset = 0) {
  const target = clamp(u, 0, 1) * path.length;
  let lo = 0, hi = SAMPLES;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (path.d[mid] <= target) lo = mid; else hi = mid; }
  const t = (target - path.d[lo]) / Math.max(1e-9, path.d[lo + 1] - path.d[lo]), dx = path.x[lo + 1] - path.x[lo], dz = path.z[lo + 1] - path.z[lo], l = Math.hypot(dx, dz);
  return { x: path.x[lo] + dx * t + dz / l * offset, y: path.y[lo] + (path.y[lo + 1] - path.y[lo]) * t, z: path.z[lo] + dz * t - dx / l * offset, yaw: Math.atan2(dx, dz) };
}

/** Converts between a shortcut's own fraction and main-road distance: driving the whole shortcut is worth `skipped` metres of road. */
export const shortcutS = (path: ShortcutPath, u: number) => path.shortcut.from + clamp(u, 0, 1) * path.skipped;
export const shortcutU = (id: TrackId, path: ShortcutPath, s: number) => mod(s - path.shortcut.from, trackLength(id)) / path.skipped;
