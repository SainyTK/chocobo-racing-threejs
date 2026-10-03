import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TRACKS, pointAt, trackLength, type TrackId, type TrackDefinition, type TrackPoint } from '../../../shared/track/index.ts';
import { STAGE, type Layer } from './materials.ts';
import { rng, smoothstep, type Rng } from './noise.ts';

export type V3 = [number, number, number];
/** Colour for one vertex from its local position, for gradients, stripes and painted details. */
export type Paint = THREE.ColorRepresentation | ((x: number, y: number, z: number, out: THREE.Color) => void);
export interface PartOptions {
  layer?: Layer;
  /** Hidden on Low quality: grass, flowers, pebbles and other small dressing. */
  detail?: boolean;
  /** Baked ambient occlusion: darkens towards `y0` by factor `k`, fully lit from `y1` up. Defaults to a soft contact shadow. */
  ao?: [y0: number, y1: number, k: number] | false;
  /** Wind weight for the foliage layer: a number, or 'height' to sway more towards `swayTop`. */
  sway?: number | 'height';
  swayTop?: number;
  /** Replaces normals with per-face normals for a chiselled, faceted look. */
  flat?: boolean;
}

const tmp = new THREE.Color(), tint = new THREE.Color();
function strip(g: THREE.BufferGeometry, flat: boolean) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (flat) { const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose(); n.deleteAttribute('normal'); n.computeVertexNormals(); return n; }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g.index ? g.toNonIndexed() : g;
}

/**
 * One prop authored in local space: y up, origin on the ground, +z facing the road when placed with `faceRoad`.
 * Parts are painted per vertex and merged by layer, so a prop costs one draw call per layer it uses.
 */
export class Parts {
  readonly layers = new Map<string, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, paint: Paint, o: PartOptions = {}) {
    const g = strip(geo, !!o.flat), pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 3), sway = new Float32Array(n);
    const ao = o.ao === undefined ? [0, .7, .72] as const : o.ao, fn = typeof paint === 'function' ? paint : null;
    if (!fn) tmp.set(paint as THREE.ColorRepresentation);
    let top = o.swayTop ?? 0; if (o.sway === 'height' && !top) { g.computeBoundingBox(); top = g.boundingBox!.max.y; }
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (fn) fn(x, y, z, tmp);
      const k = ao ? ao[2] + (1 - ao[2]) * smoothstep(ao[0], ao[1], y) : 1;
      col[i * 3] = tmp.r * k; col[i * 3 + 1] = tmp.g * k; col[i * 3 + 2] = tmp.b * k;
      sway[i] = o.sway === 'height' ? Math.max(0, y / top) ** 1.5 : o.sway ?? 0;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
    const key = `${o.layer ?? 'solid'}${o.detail ? '+' : ''}`;
    if (!this.layers.has(key)) this.layers.set(key, []); this.layers.get(key)!.push(g);
    return this;
  }
  /** Copies another prop into this one, already painted, under a transform. Lets props be assembled from props. */
  include(other: Parts, pos: V3 = [0, 0, 0], yaw = 0, scale = 1) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale));
    for (const [k, list] of other.layers) { if (!this.layers.has(k)) this.layers.set(k, []); for (const g of list) this.layers.get(k)!.push(g.clone().applyMatrix4(m)); }
    return this;
  }
  /** Merges each layer once. Placing the prop many times then only clones a few buffers. */
  bake() {
    for (const [k, list] of this.layers) if (list.length > 1) { const m = mergeGeometries(list)!; list.forEach(g => g.dispose()); this.layers.set(k, [m]); }
    return this;
  }
  /** Approximate footprint, used by the studio prop sheet to lay props out. */
  bounds() { const b = new THREE.Box3(); for (const list of this.layers.values()) for (const g of list) { g.computeBoundingBox(); b.union(g.boundingBox!); } return b; }
  dispose() { for (const list of this.layers.values()) list.forEach(g => g.dispose()); this.layers.clear(); }
}

/** Builds and caches props by key, so a forest of 300 trees generates only a handful of tree shapes. */
export type PropFactory = (r: Rng) => Parts;

export interface PlaceOptions { y?: number; yaw?: number; scale?: number | V3; tint?: THREE.ColorRepresentation; tintAmount?: number; tilt?: [number, number] }
export interface TrackPlaceOptions extends PlaceOptions {
  /** Turns the prop so its +z faces the road. Otherwise +z points along the direction of travel. */
  faceRoad?: boolean;
  /** Sits the prop on the terrain under it, not on the road's height. */
  onGround?: boolean;
}
export interface ExtrudeOptions {
  s0?: number; s1?: number; step?: number; offset?: number; layer?: Layer; detail?: boolean;
  /** Colour per profile segment and step index. */
  paint: THREE.ColorRepresentation | ((s: number, segment: number, step: number, out: THREE.Color) => void);
  /** Mirrors the profile onto both sides of the road. */
  mirror?: boolean;
}

const CHUNK = 128;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), vp = new THREE.Vector3(), vs = new THREE.Vector3();

/**
 * Course construction kit. Props, extrusions and custom meshes are collected in world space, then merged per
 * 128 m chunk and layer, so the camera culls whole sections of scenery and a course draws in a couple of hundred calls at most.
 */
export class Kit {
  readonly def: TrackDefinition; readonly len: number; readonly w: number; readonly r: Rng;
  readonly root = new THREE.Group();
  /** Terrain height under a world position. Set by the terrain builder; floating courses return the void level. */
  groundAt: (x: number, z: number) => number = () => 0;
  /** Distance from a world position to the nearest point of the centre line, and the road height there. */
  road: (x: number, z: number) => { d: number; y: number } = () => ({ d: 999, y: 0 });
  /** Centre and half-size of the course's bounding square. */
  bounds = { cx: 0, cz: 0, extent: 250 };
  private chunks = new Map<string, Map<string, THREE.BufferGeometry[]>>();
  private cache = new Map<string, Parts>();
  private updates: ((t: number, dt: number, camera: THREE.Camera) => void)[] = [];
  readonly owned: { dispose(): void }[] = [];
  constructor(readonly id: TrackId, seed = 1) { this.def = TRACKS[id]; this.len = trackLength(id); this.w = this.def.width; this.r = rng(seed * 7919 + id.length * 104729); }

  at(s: number, offset = 0): TrackPoint { return pointAt(this.id, s, offset); }
  /** Returns a cached prop, building it on first use. `variant` lets one factory make several distinct shapes. */
  prop(key: string, factory: PropFactory, variant = 0) {
    const k = `${key}#${variant}`; let p = this.cache.get(k);
    if (!p) { p = factory(rng(variant * 977 + key.length * 131 + key.charCodeAt(0))).bake(); this.cache.set(k, p); }
    return p;
  }

  /** Places a prop at a world position. */
  place(parts: Parts, x: number, y: number, z: number, o: PlaceOptions = {}) {
    const sc = o.scale ?? 1;
    e.set(o.tilt?.[0] ?? 0, o.yaw ?? 0, o.tilt?.[1] ?? 0, 'YXZ'); q.setFromEuler(e);
    m4.compose(vp.set(x, y + (o.y ?? 0), z), q, typeof sc === 'number' ? vs.setScalar(sc) : vs.set(...sc));
    const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    let chunk = this.chunks.get(key); if (!chunk) { chunk = new Map(); this.chunks.set(key, chunk); }
    if (o.tint) tint.set(o.tint);
    for (const [layer, [g]] of parts.layers) {
      const c = g.clone().applyMatrix4(m4);
      if (o.tint) { const a = c.attributes.color as THREE.BufferAttribute, k = o.tintAmount ?? 1; for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * (1 - k + tint.r * k), a.getY(i) * (1 - k + tint.g * k), a.getZ(i) * (1 - k + tint.b * k)); }
      if (!chunk.has(layer)) chunk.set(layer, []); chunk.get(layer)!.push(c);
    }
  }
  /** Places a prop `offset` metres from the centre line at distance `s`. */
  onTrack(parts: Parts, s: number, offset: number, o: TrackPlaceOptions = {}) {
    const p = this.at(s, offset), y = o.onGround ? this.groundAt(p.x, p.z) : p.y;
    this.place(parts, p.x, y, p.z, { ...o, yaw: p.yaw + (o.faceRoad ? (offset > 0 ? -Math.PI / 2 : Math.PI / 2) : 0) + (o.yaw ?? 0) });
  }
  /** Adds a ready-made geometry in world space, painted and chunked like a prop. */
  addWorld(geo: THREE.BufferGeometry, paint: Paint, o: PartOptions = {}) { const p = new Parts().add(geo, paint, { ao: false, ...o }); this.place(p, 0, 0, 0); p.dispose(); }

  /**
   * Sweeps a cross-section along the road. Profile points are [offset from the road edge outward, height]; with
   * `mirror` it runs on both sides. Each quad gets its own vertices, so colours can change sharply (curbs, stripes).
   */
  extrude(profile: [number, number][], o: ExtrudeOptions) {
    const s0 = o.s0 ?? 0, s1 = o.s1 ?? this.len, step = o.step ?? 2, base = o.offset ?? this.w, sides = o.mirror === false ? [1] : o.mirror ? [-1, 1] : [1];
    const steps = Math.max(1, Math.round((s1 - s0) / step)), ds = (s1 - s0) / steps, c = new THREE.Color();
    const piece = 12; // steps per chunked piece
    for (const side of sides) for (let p0 = 0; p0 < steps; p0 += piece) {
      const pos: number[] = [], col: number[] = [], pts: TrackPoint[] = [];
      for (let i = p0; i <= Math.min(steps, p0 + piece); i++) pts.push(this.at(s0 + i * ds));
      for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < profile.length - 1; k++) {
        const a = pts[i], b = pts[i + 1], [x0, y0] = profile[k], [x1, y1] = profile[k + 1];
        // On the inside of a bend tighter than the profile's reach, points fold across another stretch of road.
        // Those sink below the surface so walls and curbs never stand on the track.
        const v = (p: TrackPoint, x: number, y: number) => {
          const o = base + x, px = p.x + p.nx * side * o, pz = p.z + p.nz * side * o, r = this.road(px, pz);
          return [px, r.d < Math.min(o - .6, this.w - .2) ? Math.min(p.y + y, r.y - 3) : p.y + y, pz];
        };
        const A = v(a, x0, y0), B = v(a, x1, y1), C = v(b, x0, y0), D = v(b, x1, y1);
        if (side > 0) pos.push(...A, ...C, ...B, ...B, ...C, ...D); else pos.push(...A, ...B, ...C, ...B, ...D, ...C);
        if (typeof o.paint === 'function') o.paint(s0 + (p0 + i) * ds, k, p0 + i, c); else c.set(o.paint);
        for (let j = 0; j < 6; j++) col.push(c.r, c.g, c.b);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('sway', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
      const mid = pts[pts.length >> 1], key = `${Math.floor(mid.x / CHUNK)},${Math.floor(mid.z / CHUNK)}`, layer = `${o.layer ?? 'solid'}${o.detail ? '+' : ''}`;
      let chunk = this.chunks.get(key); if (!chunk) { chunk = new Map(); this.chunks.set(key, chunk); }
      if (!chunk.has(layer)) chunk.set(layer, []); chunk.get(layer)!.push(g);
    }
  }
  /**
   * Calls `fn` for `count` random ground points whose distance from the centre line lies in [minD, maxD].
   * Points closer than `minD` to any part of the course are rejected, so props never land on another section of road.
   */
  scatter(count: number, minD: number, maxD: number, fn: (x: number, z: number, d: number, i: number) => void, r: Rng = this.r) {
    const { cx, cz, extent } = this.bounds, half = extent + maxD;
    for (let i = 0, tries = 0; i < count && tries < count * 40; tries++) {
      const x = cx + (r() * 2 - 1) * half, z = cz + (r() * 2 - 1) * half, d = this.road(x, z).d;
      if (d >= minD && d <= maxD) fn(x, z, d, i++);
    }
  }
  /** Adds a custom mesh or group (water, lava, an airship) straight to the course. */
  add(o: THREE.Object3D) { this.root.add(o); return o; }
  /** Runs every frame with the course clock, for animated landmarks and shader time. */
  onUpdate(fn: (t: number, dt: number, camera: THREE.Camera) => void) { this.updates.push(fn); }
  /** Registers a resource the course owns (a texture or material) for disposal with the course. */
  own<T extends { dispose(): void }>(x: T) { this.owned.push(x); return x; }

  /** Merges everything placed so far into chunk meshes. Detail meshes are tagged so Low quality can hide them. */
  finish() {
    for (const [key, layers] of this.chunks) {
      const group = new THREE.Group(); group.name = `chunk ${key}`;
      for (const [layer, list] of layers) {
        const g = mergeGeometries(list); list.forEach(x => x.dispose()); if (!g) continue;
        const name = layer.replace('+', '') as Layer, mesh = new THREE.Mesh(g, STAGE[name]);
        mesh.castShadow = name !== 'glow'; mesh.receiveShadow = name !== 'glow'; mesh.userData.detail = layer.endsWith('+');
        g.computeBoundingSphere(); group.add(mesh);
      }
      this.root.add(group);
    }
    this.chunks.clear(); this.cache.forEach(p => p.dispose()); this.cache.clear();
    return this.root;
  }
  update(t: number, dt: number, camera: THREE.Camera) { for (const f of this.updates) f(t, dt, camera); }
}
