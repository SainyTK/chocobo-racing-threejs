import * as THREE from 'three';
import { fbm2, hash2, noise2, smoothstep } from './noise.ts';

/**
 * Procedural textures built from typed arrays, so courses build the same way in the browser, the studio and
 * headless unit tests. Every generator tiles seamlessly.
 */
type Pixel = (u: number, v: number, out: number[]) => void;
/** Pixel data by key. Generating is the slow part, so revisiting a course only re-uploads; textures are still per course and disposed with it. */
const pixels = new Map<string, Uint8Array>();
export function bake(w: number, h: number, f: Pixel, o: { srgb?: boolean; repeat?: boolean; key?: string } = {}) {
  const cached = o.key ? pixels.get(`${o.key}@${w}x${h}`) : undefined, data = cached ?? new Uint8Array(w * h * 4), px = [0, 0, 0, 1];
  if (!cached) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    px[3] = 1; f(x / w, y / h, px); const i = (y * w + x) * 4;
    data[i] = Math.max(0, Math.min(255, px[0] * 255)); data[i + 1] = Math.max(0, Math.min(255, px[1] * 255)); data[i + 2] = Math.max(0, Math.min(255, px[2] * 255)); data[i + 3] = Math.max(0, Math.min(255, px[3] * 255));
  }
  if (o.key && !cached) pixels.set(`${o.key}@${w}x${h}`, data);
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = o.repeat === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true; return t;
}

/** Tileable noise: samples a torus so the left/right and top/bottom edges meet. */
export function tileNoise(u: number, v: number, period: number, octaves = 4, seed = 0) {
  // Blend four offset samples, the classic seamless-tiling trick for lattice noise.
  const x = u * period, y = v * period, a = fbm2(x, y, octaves, seed), b = fbm2(x - period, y, octaves, seed), c = fbm2(x, y - period, octaves, seed), d = fbm2(x - period, y - period, octaves, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Tileable Worley noise. Returns distance to the nearest and second nearest feature, and the nearest cell's id. */
export function worley(u: number, v: number, cells: number, seed = 0, stretch = 1) {
  const x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y); let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = ((cx % cells) + cells) % cells, wy = ((cy % cells) + cells) % cells;
    const px = cx + .15 + .7 * hash2(wx, wy, seed), py = cy + .15 + .7 * hash2(wx, wy, seed + 1), d = Math.hypot((px - x) * stretch, py - y);
    if (d < f1) { f2 = f1; f1 = d; id = hash2(wx, wy, seed + 2); } else if (d < f2) f2 = d;
  }
  return { f1, f2, id };
}

const rgb = (c: THREE.ColorRepresentation) => { const k = new THREE.Color(c); return [k.r, k.g, k.b]; };
const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: number[], k: number) => [a[0] * k, a[1] * k, a[2] * k];
const srgb = (c: number) => c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055;
/** Writes a linear colour as sRGB, since the textures are tagged sRGB like every other colour map. */
const set = (out: number[], c: number[]) => { out[0] = srgb(c[0]); out[1] = srgb(c[1]); out[2] = srgb(c[2]); };

export type RoadKind = 'asphalt' | 'dirt' | 'cobble' | 'flagstone' | 'marble' | 'planks' | 'biscuit' | 'basalt';
export interface RoadPalette { base: string; dark: string; light: string; accent?: string; edge?: string }
/**
 * Road surface. u runs across the road (0 = left edge), v along it; one tile covers the road's width in both
 * directions, so features keep their proportions on every course.
 */
export function roadTexture(kind: RoadKind, p: RoadPalette, size = 512) {
  const base = rgb(p.base), dark = rgb(p.dark), light = rgb(p.light), accent = rgb(p.accent ?? p.light), edge = rgb(p.edge ?? p.light);
  const f: Record<RoadKind, Pixel> = {
    asphalt(u, v, out) {
      const n = tileNoise(u, v, 6, 4), grit = hash2(u * size | 0, v * size | 0, 3), line = Math.min(Math.abs(u - .33), Math.abs(u - .67));
      let c = mix(dark, base, .55 + n * .7); c = mul(c, .93 + grit * .14);
      c = mix(c, mul(dark, .7), smoothstep(.07, .0, line) * .35); // worn racing lines
      if (Math.abs(u - .5) < .006 && v % .5 < .22) c = mix(c, light, .9); // centre dashes
      set(out, c);
    },
    dirt(u, v, out) {
      const n = tileNoise(u, v, 5, 5, 1), fine = tileNoise(u, v, 24, 3, 6), ruts = Math.min(Math.abs(u - .3), Math.abs(u - .7)), pebble = worley(u, v, 56, 4), big = worley(u, v, 13, 8);
      let c = mix(dark, base, .3 + n * .8 + (fine - .5) * .35);
      c = mix(c, mul(dark, .85), smoothstep(.07, 0, ruts + (fine - .5) * .04) * .3);
      // Scattered pebbles of varied size and tone, more of them near the edges where wheels do not reach.
      const edge = smoothstep(.25, .02, Math.min(u, 1 - u)), pick = hash2(pebble.id * 1e4 | 0, 3);
      if (pick < .35 + edge * .4) c = mix(c, mix(light, mul(dark, .9), hash2(pebble.id * 999 | 0, 1)), smoothstep(.2, .12, pebble.f1) * .75);
      if (hash2(big.id * 1e4 | 0, 5) < .1) { const k = smoothstep(.13, .08, big.f1); c = mix(c, mul(mix(dark, light, .35 + big.id * .3), .95 + (1 - big.f1 / .13) * .12), k * .85); c = mix(c, mul(dark, .7), smoothstep(.15, .13, big.f1) * (1 - k) * .5); }
      c = mix(c, mul(dark, .8), edge * .35 * (.5 + fine));
      set(out, c);
    },
    cobble(u, v, out) {
      // Hand-laid setts: small stones with thin, soft joints and a worn sheen down the racing lines.
      const w = worley(u, v, 30, 7), mortar = smoothstep(.02, .09, w.f2 - w.f1), n = tileNoise(u, v, 8, 3, 2), lines = Math.min(Math.abs(u - .33), Math.abs(u - .67));
      let c = mix(mix(dark, base, .45), mix(base, light, w.id * .7), mortar);
      c = mul(c, .88 + n * .24 + (1 - w.f1) * .06 + smoothstep(.12, 0, lines) * .05);
      set(out, c);
    },
    flagstone(u, v, out) {
      const w = worley(u, v, 12, 11, 1.4), mortar = smoothstep(.025, .07, w.f2 - w.f1), n = tileNoise(u, v, 10, 4, 5), crack = smoothstep(.012, 0, Math.abs(noise2(u * 40, v * 40, 3) - .5)) * (hash2(w.id * 1e3 | 0, 2) > .6 ? 1 : 0);
      let c = mix(dark, mix(base, light, w.id * .6 + n * .3), mortar); c = mix(c, dark, crack * .5);
      set(out, c);
    },
    marble(u, v, out) {
      const tu = Math.floor(u * 4), tv = Math.floor(v * 4), fu = u * 4 - tu, fv = v * 4 - tv, grout = smoothstep(.0, .03, Math.min(fu, 1 - fu, fv, 1 - fv));
      const vein = Math.pow(1 - Math.abs(Math.sin((u * 6 + tileNoise(u, v, 4, 5, 8) * 3) * Math.PI)), 12), alt = (tu + tv) % 2;
      let c = mix(base, light, alt * .6); c = mix(c, accent, vein * .35); c = mix(dark, c, grout);
      set(out, c);
    },
    planks(u, v, out) {
      const rows = 14, k = v * rows, row = Math.floor(k), fv = k - row, id = hash2(row, 7), seam = smoothstep(0, .07, Math.min(fv, 1 - fv));
      const grain = noise2(u * 3 + id * 50, fv * 30, 2) * .5 + noise2(u * 40, fv * 4 + id * 9, 4) * .5, nail = Math.min(Math.hypot((u - .08) * 14, fv - .5), Math.hypot((u - .92) * 14, fv - .5));
      let c = mix(dark, mix(base, light, id * .55), .45 + grain * .6); c = mix(mul(dark, .5), c, seam);
      if (nail < .09) c = mix(c, rgb('#2c2622'), .8);
      set(out, c);
    },
    biscuit(u, v, out) {
      const n = tileNoise(u, v, 6, 4, 3), dot = worley(u, v, 26, 9), sprinkle = smoothstep(.07, .05, dot.f1) * (dot.id > .55 ? 1 : 0);
      const stripe = Math.min(u, 1 - u), icing = smoothstep(.075, .065, stripe + Math.sin(v * Math.PI * 16) * .012);
      let c = mix(dark, base, .45 + n * .8);
      c = mix(c, mul(dark, .7), smoothstep(.07, .04, worley(u, v, 9, 4).f1) * .5); // baked dimples
      if (sprinkle) c = rgb(['#ff6fa8', '#7de0ff', '#fff27a', '#9dff8a'][Math.floor(dot.id * 40) % 4]);
      c = mix(c, edge, icing);
      set(out, c);
    },
    basalt(u, v, out) {
      const w = worley(u, v, 12, 21), mortar = smoothstep(.04, .1, w.f2 - w.f1), n = tileNoise(u, v, 9, 3, 6);
      let c = mix(base, light, w.id * .45 + n * .25); c = mix(accent, c, mortar);
      set(out, c);
    },
  };
  return bake(size, size, f[kind], { key: `road:${kind}:${JSON.stringify(p)}` });
}

/** Basalt road glow: only the cracks between stones, used as an emissive map. */
export function basaltGlow(size = 512) {
  return bake(size, size, (u, v, out) => { const w = worley(u, v, 12, 21), k = smoothstep(.1, .02, w.f2 - w.f1) * (.6 + .4 * tileNoise(u, v, 5, 2, 4)); out[0] = k; out[1] = k * .38; out[2] = k * .08; }, { key: 'basalt-glow' });
}

/** Neutral detail map multiplied over vertex-coloured terrain: blotches, blades and grit, centred near 1. */
export function groundDetail(kind: 'grass' | 'rock' | 'sand' | 'candy' | 'ash' = 'grass', size = 256) {
  return bake(size, size, (u, v, out) => {
    const n = tileNoise(u, v, 4, 4, 2), fine = hash2(u * size | 0, v * size | 0, 9), blade = tileNoise(u, v, 32, 2, 5);
    let k = .8 + n * .25;
    if (kind === 'grass') k += (blade - .5) * .22 + (fine - .5) * .06;
    if (kind === 'rock') k += (smoothstep(.52, .5, tileNoise(u, v, 12, 3, 7)) - .5) * .12 + (fine - .5) * .1;
    if (kind === 'sand') k += Math.sin((u * 9 + n * 2) * Math.PI * 2) * .05 + (fine - .5) * .08;
    if (kind === 'candy') k += (fine > .985 ? .25 : 0);
    if (kind === 'ash') k += (fine - .5) * .16;
    out[0] = out[1] = out[2] = Math.min(1, k);
  }, { srgb: false, key: `ground:${kind}` });
}

/** Smooth tileable noise used by sky and liquid shaders. Thresholding it on the GPU gives crisp edges at any distance. */
export function noiseTexture(size = 256) {
  return bake(size, size, (u, v, out) => { out[0] = tileNoise(u, v, 5, 5, 1); out[1] = tileNoise(u, v, 9, 4, 2); out[2] = tileNoise(u, v, 17, 3, 3); out[3] = tileNoise(u, v, 3, 2, 4); }, { srgb: false, key: 'noise' });
}
