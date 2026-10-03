import * as THREE from 'three';
import { trackTable, type TrackId } from '../../../shared/track/index.ts';
import { stageMaterial } from './materials.ts';
import { fbm2, ridge2, smoothstep, lerp } from './noise.ts';
import { roadTexture, basaltGlow, groundDetail, type RoadKind, type RoadPalette } from './textures.ts';
import type { Kit } from './kit.ts';

/** Nearest-road lookup on a 4 m grid: distance to the centre line, the road height there and its distance along the lap. */
export class TrackField {
  readonly minX: number; readonly minZ: number; readonly nx: number; readonly nz: number; readonly cx: number; readonly cz: number; readonly extent: number;
  private dist: Float32Array; private roadY: Float32Array; static readonly CELL = 4; static readonly REACH = 160;
  constructor(id: TrackId) {
    const table = trackTable(id), C = TrackField.CELL, R = TrackField.REACH;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of table) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    this.cx = (x0 + x1) / 2; this.cz = (z0 + z1) / 2; this.extent = Math.max(x1 - x0, z1 - z0) / 2;
    this.minX = x0 - R; this.minZ = z0 - R; this.nx = Math.ceil((x1 - x0 + 2 * R) / C) + 1; this.nz = Math.ceil((z1 - z0 + 2 * R) / C) + 1;
    this.dist = new Float32Array(this.nx * this.nz).fill(R); this.roadY = new Float32Array(this.nx * this.nz).fill(table[0].y);
    const reach = Math.ceil(R / C);
    // Splat every centre-line segment into the cells around it, keeping the nearest.
    for (let i = 0; i < table.length - 1; i += 2) {
      const a = table[i], b = table[Math.min(table.length - 1, i + 2)], gx = Math.round((a.x - this.minX) / C), gz = Math.round((a.z - this.minZ) / C);
      const dx = b.x - a.x, dz = b.z - a.z, ll = dx * dx + dz * dz || 1;
      for (let j = Math.max(0, gz - reach); j <= Math.min(this.nz - 1, gz + reach); j++) for (let k = Math.max(0, gx - reach); k <= Math.min(this.nx - 1, gx + reach); k++) {
        const x = this.minX + k * C, z = this.minZ + j * C, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / ll)), d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t), idx = j * this.nx + k;
        if (d < this.dist[idx]) { this.dist[idx] = d; this.roadY[idx] = a.y + (b.y - a.y) * t; }
      }
    }
  }
  /** Bilinear lookup; outside the field the road is out of reach. */
  sample(x: number, z: number) {
    const C = TrackField.CELL, fx = (x - this.minX) / C, fz = (z - this.minZ) / C;
    if (fx < 0 || fz < 0 || fx >= this.nx - 1 || fz >= this.nz - 1) return { d: TrackField.REACH + 40, y: this.roadY[0] };
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, a = j * this.nx + i, b = a + 1, c = a + this.nx, e = c + 1;
    const bl = (arr: Float32Array) => (arr[a] * (1 - u) + arr[b] * u) * (1 - v) + (arr[c] * (1 - u) + arr[e] * u) * v;
    return { d: bl(this.dist), y: bl(this.roadY) };
  }
}

/** What a course's terrain function sees at one ground point. */
export interface GroundSample { x: number; z: number; d: number; roadY: number; w: number; drive: number }
export interface TerrainSpec {
  height(p: GroundSample): number;
  color(p: GroundSample, h: number, slope: number, out: THREE.Color): void;
  detail?: 'grass' | 'rock' | 'sand' | 'candy' | 'ash';
  /** Half-size of the terrain square around the course centre. */
  size?: number;
}

/** Standard rolling-hill landscape: flat where racers can drive, rising into hills and ridges further out. */
export function hills(o: { amp: number; ridge?: number; scale?: number; flat?: number; rise?: number; dip?: number; seed?: number }) {
  return (p: GroundSample) => {
    const flat = o.flat ?? p.drive, rise = o.rise ?? 70, s = (o.scale ?? 1) / 140, k = smoothstep(flat, flat + rise, p.d);
    const n = fbm2(p.x * s, p.z * s, 4, o.seed ?? 3), rg = o.ridge ? ridge2(p.x * s * .7, p.z * s * .7, 4, (o.seed ?? 3) + 5) * o.ridge : 0;
    const far = smoothstep(260, 620, p.d);
    return lerp(p.roadY - .06 - (o.dip ?? 0) * smoothstep(p.w + 1, p.w + 6, p.d) * (1 - k), lerp(p.roadY, 8, .5 + far * .5) + (n * o.amp + rg) * (.35 + far * 1.4) - (o.dip ?? 0) * (1 - k), k);
  };
}

const GRID = 210;
/**
 * Heightfield around the course. Rows are spaced densely near the track and stretch towards the horizon,
 * and the mesh is split into tiles so off-screen ground is culled.
 */
export function buildTerrain(kit: Kit, field: TrackField, spec: TerrainSpec) {
  const half = spec.size ?? 1100, inner = field.extent + 170, w = kit.w, drive = kit.def.wall ? w + .7 : kit.def.cliff ? w + 5 : w + 35;
  const map = (t: number) => { const a = Math.abs(t), k = .72; return Math.sign(t) * (a <= k ? a / k * inner : inner + ((a - k) / (1 - k)) ** 1.5 * (half - inner)); };
  const xs = Array.from({ length: GRID + 1 }, (_, i) => field.cx + map(i / GRID * 2 - 1)), zs = Array.from({ length: GRID + 1 }, (_, i) => field.cz + map(i / GRID * 2 - 1));
  const H = new Float32Array((GRID + 1) * (GRID + 1)), S: GroundSample[] = [];
  for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) { const f = field.sample(xs[i], zs[j]), p = { x: xs[i], z: zs[j], d: f.d, roadY: f.y, w, drive }; S.push(p); H[j * (GRID + 1) + i] = spec.height(p); }
  const heightAt = (x: number, z: number) => { const f = field.sample(x, z); return spec.height({ x, z, d: f.d, roadY: f.y, w, drive }); };
  const detail = kit.own(groundDetail(spec.detail ?? 'grass')), mat = kit.own(stageMaterial({ ground: true, map: detail, rim: .08 }));
  const TILE = 30, c = new THREE.Color();
  for (let tj = 0; tj < GRID; tj += TILE) for (let ti = 0; ti < GRID; ti += TILE) {
    const n = Math.min(TILE, GRID - ti) + 1, m = Math.min(TILE, GRID - tj) + 1, pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
      const gi = ti + i, gj = tj + j, k = gj * (GRID + 1) + gi, h = H[k];
      const hx = H[gj * (GRID + 1) + Math.min(GRID, gi + 1)] - H[gj * (GRID + 1) + Math.max(0, gi - 1)], hz = H[Math.min(GRID, gj + 1) * (GRID + 1) + gi] - H[Math.max(0, gj - 1) * (GRID + 1) + gi];
      const dx = xs[Math.min(GRID, gi + 1)] - xs[Math.max(0, gi - 1)], dz = zs[Math.min(GRID, gj + 1)] - zs[Math.max(0, gj - 1)], slope = Math.hypot(hx / dx, hz / dz);
      spec.color(S[k], h, slope, c); pos.push(xs[gi], h, zs[gj]); col.push(c.r, c.g, c.b); uv.push(xs[gi] / 9, zs[gj] / 9);
    }
    for (let j = 0; j < m - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, d = a + n, e = d + 1; idx.push(a, d, b, b, d, e); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.name = 'terrain'; kit.add(mesh);
  }
  kit.groundAt = heightAt;
  return heightAt;
}

/** `glow` lights the road's cracks (basalt only) at the given strength, 1 being a gentle ember glow. */
export interface RoadSpec { kind: RoadKind; palette: RoadPalette; glow?: number }
/** Textured road ribbon, slightly above the ground under it and split into culled sections. */
export function buildRoad(kit: Kit, spec: RoadSpec) {
  const w = kit.w, tex = kit.own(roadTexture(spec.kind, spec.palette)), glow = spec.glow ? kit.own(basaltGlow()) : null;
  const mat = kit.own(stageMaterial({ ground: true, map: tex, vertexColors: false, rim: 0 }));
  if (glow) { mat.emissiveMap = glow; mat.emissive.set('#ffffff'); mat.emissiveIntensity = spec.glow!; }
  mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -2;
  const step = 2, rows = Math.round(kit.len / step), per = 40, across = 6, tiles = Math.max(1, Math.round(kit.len / (2 * w)));
  for (let r0 = 0; r0 < rows; r0 += per) {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [], n = Math.min(per, rows - r0);
    for (let i = 0; i <= n; i++) {
      const s = (r0 + i) * kit.len / rows;
      for (let k = 0; k <= across; k++) { const off = -w + 2 * w * k / across, p = kit.at(s, off); pos.push(p.x, p.y + .02, p.z); uv.push(k / across, s / kit.len * tiles); }
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < across; k++) { const a = i * (across + 1) + k, b = a + 1, c = a + across + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.name = 'road'; kit.add(mesh);
  }
}
