import { clamp, mod, angleDelta } from '../math.ts';
import type { TrackId, TrackPoint, Projection } from './types.ts';
import { TRACKS } from './tracks.ts';

export interface Sample { x: number; y: number; z: number; d: number }
const tables = new Map<TrackId, Sample[]>();
const N = 1600;
function raw(id: TrackId, t: number) {
  const course = TRACKS[id], pts = course.points, a = mod(t, 1) * pts.length, i = Math.floor(a), f = a - i;
  const p0 = pts[mod(i - 1, pts.length)], p1 = pts[i % pts.length], p2 = pts[(i + 1) % pts.length], p3 = pts[(i + 2) % pts.length];
  const cat = (k: number) => .5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f * f + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f * f * f);
  return { x: cat(0), z: cat(1), y: 8 + Math.sin(t * Math.PI * 4) * course.elevation + Math.sin(t * Math.PI * 6) * course.elevation * .3 };
}
export function trackTable(id: TrackId) {
  if (!tables.has(id)) {
    const table: Sample[] = []; let d = 0;
    for (let i = 0; i <= N; i++) { const p = raw(id, i / N), prev = table.at(-1); if (prev) d += Math.hypot(p.x - prev.x, p.z - prev.z); table.push({ ...p, d }); }
    tables.set(id, table);
  }
  return tables.get(id)!;
}
export function trackLength(id: TrackId) { return trackTable(id).at(-1)!.d; }
function indexAt(id: TrackId, s: number) {
  const table = trackTable(id), d = mod(s, trackLength(id)); let lo = 0, hi = N;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (table[mid].d <= d) lo = mid; else hi = mid; }
  return lo;
}
export function pointAt(id: TrackId, s: number, offset = 0): TrackPoint {
  const table = trackTable(id), d = mod(s, trackLength(id)), i = indexAt(id, s), a = table[i], b = table[i + 1], t = (d - a.d) / (b.d - a.d);
  const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz), nx = dz / length, nz = -dx / length;
  const before = table[mod(i - 3, N)], after = table[(i + 4) % N];
  const y1 = Math.atan2(a.x - before.x, a.z - before.z), y2 = Math.atan2(after.x - b.x, after.z - b.z);
  return { x: a.x + dx * t + nx * offset, y: a.y + (b.y - a.y) * t, z: a.z + dz * t + nz * offset, nx, nz, yaw: Math.atan2(dx, dz), curve: angleDelta(y2, y1) / Math.max(.01, Math.hypot(after.x - before.x, after.z - before.z)) };
}
export function projectOnTrack(id: TrackId, x: number, z: number, hint?: number): Projection {
  const table = trackTable(id), center = hint === undefined ? 0 : indexAt(id, hint), span = hint === undefined ? N : 55;
  let best = Infinity, result: Projection = { s: 0, offset: 0, distance: 0, px: 0, pz: 0, nx: 0, nz: 0 };
  for (let k = hint === undefined ? 0 : -span; k < (hint === undefined ? N : span); k++) {
    const i = mod(center + k, N), a = table[i], b = table[i + 1], dx = b.x - a.x, dz = b.z - a.z, ll = dx * dx + dz * dz;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / ll, 0, 1), px = a.x + dx * t, pz = a.z + dz * t, dist = (x - px) ** 2 + (z - pz) ** 2;
    if (dist < best) { best = dist; const l = Math.sqrt(ll), nx = dz / l, nz = -dx / l; result = { s: a.d + t * (b.d - a.d), offset: (x - px) * nx + (z - pz) * nz, distance: Math.sqrt(dist), px, pz, nx, nz }; }
  }
  return result;
}
