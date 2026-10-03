export type TrackId = 'test' | 'forest' | 'gate' | 'mines' | 'manor' | 'gardens' | 'gingerbread' | 'volcano';
export type Surface = 'asphalt' | 'grass' | 'stone' | 'wood' | 'candy';
export interface TrackDefinition {
  name: string; difficulty: number; width: number; wall: boolean; cliff: boolean; sky: string; fog: string;
  ground: string; road: string; edge: string; accent: string; surface: Surface; elevation: number;
  description: string; points: [number, number][];
}
// Hand-built browser interpretations of the original course themes. These are not extracted track meshes.
export const TRACKS: Record<TrackId, TrackDefinition> = {
  test: { name: "Cid's Test Track", difficulty: 1, width: 14, wall: true, cliff: false, sky: '#64b7ed', fog: '#a2cbee', ground: '#499348', road: '#686c81', edge: '#f6eded', accent: '#ef6148', surface: 'asphalt', elevation: 0,
    description: 'A fast circuit. Long straights, broad turns, and a technical infield.',
    points: [[-160,155],[0,155],[155,145],[210,85],[205,-70],[130,-140],[10,-145],[-55,-100],[-55,-20],[-100,5],[-150,-30],[-205,-20],[-215,70]] },
  forest: { name: 'Moogle Forest', difficulty: 2, width: 12, wall: false, cliff: false, sky: '#7bcde8', fog: '#92c4a5', ground: '#4b983c', road: '#b89754', edge: '#e8c681', accent: '#dd835e', surface: 'grass', elevation: 3,
    description: 'Woodland bends and grassy shoulders. Keep your wheels on the path.',
    points: [[-150,130],[0,170],[135,125],[190,45],[130,-10],[170,-100],[75,-165],[-30,-110],[-100,-170],[-195,-90],[-160,-5],[-205,60]] },
  gate: { name: 'The Ancient Gate', difficulty: 2, width: 11, wall: true, cliff: false, sky: '#e9c797', fog: '#baa583', ground: '#a89b5b', road: '#b6a477', edge: '#ded0ab', accent: '#9986b8', surface: 'stone', elevation: 5,
    description: 'Stone walls and tight corners through a forgotten city.',
    points: [[-190,130],[-30,140],[165,140],[180,20],[70,10],[75,-70],[180,-85],[165,-165],[-20,-170],[-20,-55],[-110,-55],[-105,-145],[-205,-130],[-200,0]] },
  mines: { name: 'Mythril Mines', difficulty: 3, width: 10.5, wall: true, cliff: false, sky: '#303451', fog: '#51445c', ground: '#514754', road: '#8c7770', edge: '#aaa0a4', accent: '#83deee', surface: 'wood', elevation: 7,
    description: 'A winding mining railway. Brake before the switchbacks.',
    points: [[-160,155],[15,155],[180,125],[190,25],[115,-30],[180,-110],[100,-170],[-10,-105],[-70,-170],[-170,-145],[-145,-45],[-65,-15],[-130,45],[-210,50]] },
  manor: { name: 'The Black Manor', difficulty: 3, width: 11, wall: true, cliff: false, sky: '#252649', fog: '#494463', ground: '#493747', road: '#736277', edge: '#b6a3b4', accent: '#be87d5', surface: 'stone', elevation: 2,
    description: 'Haunted courtyards and narrow corridors beneath the moon.',
    points: [[-160,130],[20,145],[170,130],[175,40],[90,25],[100,-65],[175,-75],[165,-160],[45,-165],[5,-85],[-70,-80],[-75,-165],[-190,-140],[-185,-40],[-100,-10],[-100,65]] },
  gardens: { name: 'Floating Gardens', difficulty: 3, width: 11, wall: false, cliff: true, sky: '#79c4f2', fog: '#d0ddf1', ground: '#99bedd', road: '#b6b2d8', edge: '#eee6fb', accent: '#79ded8', surface: 'stone', elevation: 8,
    description: 'A road above the clouds. There are no walls to save a missed turn.',
    points: [[-170,150],[0,170],[145,120],[170,30],[65,-10],[75,-90],[155,-135],[75,-205],[-35,-130],[-115,-180],[-200,-100],[-135,-30],[-180,40]] },
  gingerbread: { name: 'Gingerbread Land', difficulty: 3, width: 12, wall: false, cliff: false, sky: '#e49ecb', fog: '#eec6cf', ground: '#c5997c', road: '#d7b171', edge: '#fae0cf', accent: '#ed658b', surface: 'candy', elevation: 3,
    description: 'Candy arches and cake tunnels hide a deceptively long circuit.',
    points: [[-210,135],[-30,180],[150,160],[225,75],[145,25],[220,-65],[130,-130],[30,-80],[-20,-180],[-115,-200],[-175,-100],[-105,-25],[-215,0]] },
  volcano: { name: 'Vulcan-O Valley', difficulty: 4, width: 10.5, wall: false, cliff: true, sky: '#803e45', fog: '#b56e53', ground: '#e0602b', road: '#68535b', edge: '#ad8376', accent: '#ffb247', surface: 'stone', elevation: 11,
    description: 'Cliff edges, hairpins, and lava. Save your Dash for the exits.',
    points: [[-200,135],[-40,175],[145,150],[190,60],[80,10],[185,-60],[110,-165],[0,-100],[-65,-190],[-180,-145],[-125,-50],[-210,0]] },
};
export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const mod = (v: number, m: number) => ((v % m) + m) % m;
export const angleDelta = (to: number, from: number) => mod(to - from + Math.PI, Math.PI * 2) - Math.PI;
export interface TrackPoint { x: number; y: number; z: number; nx: number; nz: number; yaw: number; curve: number }
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
export interface Projection { s: number; offset: number; distance: number; px: number; pz: number; nx: number; nz: number }
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
export type StoneType = 'fire' | 'ice' | 'thunder' | 'haste' | 'shield' | 'mini' | 'doom' | 'ultima';
export interface CourseObjects { stones: { id: number; s: number; x: number; kind: StoneType | 'random' }[]; pads: { s: number; x: number }[]; hazards: { s: number; x: number }[] }
const objectCache = new Map<TrackId, CourseObjects>();
export function courseObjects(id: TrackId): CourseObjects {
  if (objectCache.has(id)) return objectCache.get(id)!;
  const length = trackLength(id), kinds: (StoneType | 'random')[] = ['fire', 'haste', 'ice', 'thunder', 'shield', 'random', 'mini', 'doom', 'fire', 'haste', 'random', 'ultima'];
  const stones = Array.from({ length: 12 }, (_, i) => [-6.5, 0, 6.5].map((x, j) => ({ id: i * 3 + j, s: 70 + i * (length - 130) / 12, x: x * TRACKS[id].width / 14, kind: kinds[(i + j * 2) % kinds.length] }))).flat();
  const pads = id === 'test' ? [{ s: length * .34, x: 0 }, { s: length * .77, x: 0 }] : [];
  const hazards = id === 'test' ? [] : Array.from({ length: 5 }, (_, i) => ({ s: 200 + i * (length - 250) / 5, x: Math.sin(i * 2.7 + 1) * 5 }));
  const objects = { stones, pads, hazards }; objectCache.set(id, objects); return objects;
}
