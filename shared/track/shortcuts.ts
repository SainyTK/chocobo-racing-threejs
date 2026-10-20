import { clamp, mod } from '../math.ts';
import type { Shortcut, TrackId } from './types.ts';
import { TRACKS } from './tracks.ts';
import { pointAt, projectOnTrack, trackLength } from './sampling.ts';
import { courseLayout } from './layouts/index.ts';

/** A shortcut's centre line, sampled finely: world points with their height and cumulative length. */
export interface ShortcutPath { shortcut: Shortcut; x: Float64Array; y: Float64Array; z: Float64Array; d: Float64Array; length: number; skipped: number }
/** Where a world position sits on a shortcut: `u` runs 0 at the mouth to 1 where it rejoins, `x` is metres left of its centre line. */
export interface ShortcutProjection { u: number; x: number; distance: number; px: number; pz: number; nx: number; nz: number; yaw: number }

const SAMPLES = 240;
const paths = new Map<TrackId, ShortcutPath[]>();
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Builds the centre line: a nearly straight cubic curve that eases out of the road edge along the road's heading and back in,
 * bowed square to its chord by `bulge`. Height blends between the road heights at both ends.
 */
function buildPath(id: TrackId, shortcut: Shortcut): ShortcutPath {
  const w = TRACKS[id].width, len = trackLength(id), a = pointAt(id, shortcut.from, shortcut.side * w), b = pointAt(id, shortcut.to, shortcut.side * w);
  const chord = Math.hypot(b.x - a.x, b.z - a.z), k = chord * .18;
  // The bow pushes square to the chord, towards the shortcut's side of the road.
  const perp = { x: (b.z - a.z) / chord, z: -(b.x - a.x) / chord }, mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const away = (k: number) => shortcut.side * projectOnTrack(id, mid.x + perp.x * k, mid.z + perp.z * k).offset, flip = away(4) > away(-4) ? 1 : -1, out = { x: perp.x * flip, z: perp.z * flip };
  const c1 = { x: a.x + Math.sin(a.yaw) * k, z: a.z + Math.cos(a.yaw) * k }, c2 = { x: b.x - Math.sin(b.yaw) * k, z: b.z - Math.cos(b.yaw) * k };
  const x = new Float64Array(SAMPLES + 1), y = new Float64Array(SAMPLES + 1), z = new Float64Array(SAMPLES + 1), d = new Float64Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES, m = 1 - t, bow = Math.sin(t * Math.PI) * shortcut.bulge;
    x[i] = m * m * m * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * b.x + out.x * bow;
    z[i] = m * m * m * a.z + 3 * m * m * t * c1.z + 3 * m * t * t * c2.z + t * t * t * b.z + out.z * bow;
    y[i] = a.y + (b.y - a.y) * smooth(t);
    d[i] = i ? d[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]) : 0;
  }
  return { shortcut, x, y, z, d, length: d[SAMPLES], skipped: mod(shortcut.to - shortcut.from, len) };
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
