/** Deterministic noise and randomness for course building, so a course looks the same on every load. */

/** Seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return Object.assign(next, {
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)],
    sign: () => next() < .5 ? -1 : 1,
  });
}
export type Rng = ReturnType<typeof rng>;

/** Integer lattice hash in [0, 1). */
export function hash2(x: number, y: number, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
export function hash3(x: number, y: number, z: number, seed = 0) { return hash2(x + Math.imul(z | 0, 2246822519), y, seed); }

const fade = (t: number) => t * t * (3 - 2 * t);
/** Smooth value noise in [0, 1). */
export function noise2(x: number, y: number, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = fade(x - xi), fy = fade(y - yi);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function noise3(x: number, y: number, z: number, seed = 0) {
  const zi = Math.floor(z), fz = fade(z - zi);
  const lo = noise2(x + zi * 31.7, y + zi * 17.3, seed), hi = noise2(x + (zi + 1) * 31.7, y + (zi + 1) * 17.3, seed);
  return lo + (hi - lo) * fz;
}
/** Fractal value noise in roughly [0, 1). */
export function fbm2(x: number, y: number, octaves = 4, seed = 0) {
  let sum = 0, amp = .5, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += noise2(x, y, seed + i * 7) * amp; norm += amp; x = x * 2.03 + 17.1; y = y * 2.03 - 9.7; amp *= .5; }
  return sum / norm;
}
export function fbm3(x: number, y: number, z: number, octaves = 4, seed = 0) {
  let sum = 0, amp = .5, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += noise3(x, y, z, seed + i * 7) * amp; norm += amp; x *= 2.03; y *= 2.03; z *= 2.03; amp *= .5; }
  return sum / norm;
}
/** Ridged noise for mountain silhouettes and rock strata: sharp crests, soft valleys. */
export function ridge2(x: number, y: number, octaves = 4, seed = 0) {
  let sum = 0, amp = .5, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += (1 - Math.abs(noise2(x, y, seed + i * 7) * 2 - 1)) * amp; norm += amp; x *= 2.1; y *= 2.1; amp *= .5; }
  return sum / norm;
}
export const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
