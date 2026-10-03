import * as THREE from 'three';
import { Parts, type Kit } from '../kit.ts';
import { hills } from '../terrain.ts';
import { STAGE, type Layer } from '../materials.ts';
import { fbm2, smoothstep, type Rng } from '../noise.ts';
import { Shape } from '../../particles/particles.ts';
import { grandstand, tyreStack, flagPole, balloon, bunting, bush, grass, subdivide, block, prism, cone, cyl, bead, disc, ellipsoid, rbox, torus, lathe, tube, grad, xf } from '../props/common.ts';
import type { CourseArt } from '../types.ts';

const C = {
  mow: '#5a9f44', mowDark: '#4b8a3a', rough: '#5f9446', gravel: '#d8cfb4', service: '#8f9196',
  concrete: '#e6e3dc', concreteDark: '#b4b1a9', base: '#4b505c', red: '#d6402f', blue: '#2f5bb8', gold: '#f2bf3a', white: '#f6f4ee',
  steel: '#9aa6b4', steelDark: '#5d6876', glass: '#7fd0ff', wood: '#9a6338', woodDark: '#6a4024', brass: '#e2b04a', canvas: '#f1e6cf',
};
const LIVERY = [C.red, C.blue, C.gold, C.blue];

/** Flat painted board in the XY plane, finely divided so a paint function can draw crisp graphics on it. */
function painted(w: number, h: number, paint: (u: number, v: number, out: THREE.Color) => void, pos: [number, number, number], div = 4) {
  const g = subdivide(new THREE.PlaneGeometry(w, h, 2, 1).translate(pos[0], pos[1] + h / 2, pos[2]), div);
  return { g, paint: (x: number, y: number, _z: number, out: THREE.Color) => paint((x - pos[0]) / w + .5, (y - pos[1]) / h, out) };
}

/** Seven-segment digit test for painting bay numbers: true inside a lit segment. */
const SEGS = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
function digit(d: number, u: number, v: number) {
  const on = SEGS[d], t = .16, inH = (y: number) => Math.abs(v - y) < t / 2 && u > .15 && u < .85, inV = (x: number, y0: number, y1: number) => Math.abs(u - x) < t / 1.6 && v > y0 && v < y1;
  return (on.includes('a') && inH(.92)) || (on.includes('g') && inH(.5)) || (on.includes('d') && inH(.08)) ||
    (on.includes('f') && inV(.15, .5, .92)) || (on.includes('b') && inV(.85, .5, .92)) || (on.includes('e') && inV(.15, .08, .5)) || (on.includes('c') && inV(.85, .08, .5));
}

/** Abstract sponsor graphics: crystal, feather swoosh, racing chevrons and a moogle pompom. No real brands. */
const BOARD_DESIGNS: ((u: number, v: number, out: THREE.Color) => void)[] = [
  (u, v, out) => { const d = Math.abs(u - .2) * 2.6 + Math.abs(v - .5); out.set(d < .32 ? (d < .2 ? '#ffffff' : '#9fe3ff') : v > .42 && v < .58 && u > .42 ? (Math.floor(u * 14) % 2 ? C.gold : '#ffffff') : u > .4 ? '#1f3f8f' : '#2a5bc8'); },
  (u, v, out) => { const sw = .5 + Math.sin(u * 7 - 1) * .22 - v; out.set(Math.abs(sw) < .09 ? C.red : Math.abs(sw + .14) < .035 ? '#ff9a3a' : '#ffd84a'); },
  (u, v, out) => { const k = ((u * 5 - Math.abs(v - .5) * 1.4) % 1 + 1) % 1; out.set(v < .14 || v > .86 ? (Math.floor(u * 24) % 2 ? '#222233' : '#ffffff') : k < .45 ? C.red : '#ffffff'); },
  (u, v, out) => { const r = Math.hypot((u - .27) * 2.67, v - .5); out.set(r < .18 ? '#ff4a6a' : r < .36 ? '#ffffff' : u > .55 && Math.abs(v - .5) < .1 ? '#e04a8a' : '#ffe1ee'); },
  (u, v, out) => { out.set(v > .5 + Math.sin(u * 18) * .05 ? '#1c2a5a' : v > .3 ? C.gold : '#1c2a5a'); if (Math.hypot((u - .82) * 2.67, v - .62) < .12) out.set('#ffffff'); },
];

/** Roadside billboard on two steel legs, raised clear of the wall. Faces +z. */
function billboard(design: number) {
  const p = new Parts(), w = 8.5, h = 3.2, y0 = 2.6;
  for (const x of [-w * .32, w * .32]) { p.add(block(.28, y0 + h * .6, .28, [x, 0, -.3]), C.steelDark); p.add(xf(new THREE.BoxGeometry(.1, 1.6, .1), [x, y0 - .3, -.9], [-.55, 0, 0]), C.steelDark, { ao: false }); }
  p.add(rbox(w + .35, h + .35, .3, .06, [0, y0 + h / 2, -.2]), '#e8e6e0', { ao: false });
  const face = painted(w, h, BOARD_DESIGNS[design % BOARD_DESIGNS.length], [0, y0, -.04], 4); p.add(face.g, face.paint, { ao: false });
  p.add(xf(new THREE.PlaneGeometry(w, h).translate(0, y0 + h / 2, -.36), [0, 0, 0], [0, Math.PI, 0]), '#c9c6be', { ao: false });
  for (const x of [-w * .3, 0, w * .3]) { p.add(cyl(.04, .04, .6, [x, y0 + h + .4, .15], [.6, 0, 0], 5), C.steelDark, { ao: false }); p.add(prism(.18, .1, .2, 6, [x, y0 + h + .58, .4], [.9, 0, 0]), '#fff6d0', { layer: 'glow', ao: false }); }
  return p;
}

/** Pit building: six garage bays with painted numbers, a hospitality deck and a gold-striped roof. Faces +z, runs along x. */
function pitGarage() {
  const p = new Parts(), bays = 6, bw = 8.4, L = bays * bw + 2, H = 7, D = 12;
  p.add(block(L + 6, .12, 14, [0, 0, 4]), '#7d7f86', { ao: false });
  p.add(block(L, H, D, [0, 0, -D / 2]), C.concrete, { ao: [0, 1.2, .7] });
  for (let i = 0; i < bays; i++) {
    const x = -L / 2 + 1 + (i + .5) * bw;
    p.add(block(bw - 1.6, 4.4, .2, [x, 0, .02]), (lx, ly, _z, out) => out.set(ly > 3.8 ? C.red : Math.floor(ly / .55) % 2 ? '#3b404c' : '#33373f'), { ao: false });
    const num = painted(1.3, 1.5, (u, v, out) => out.set(digit(i + 1, u, v) ? '#ffffff' : C.blue), [x, 5, .06], 3); p.add(num.g, num.paint, { ao: false });
    p.add(block(.5, 1.7, .4, [x - bw / 2 + .2, 4.8, .05]), C.gold, { ao: false });
  }
  p.add(block(L, .45, .7, [0, H - .5, .25]), C.blue, { ao: false }); p.add(block(L, .18, .72, [0, H - .78, .27]), C.gold, { ao: false });
  // Upper hospitality deck with glass and a sloped roof.
  p.add(block(L, 3, D - 2, [0, H, -D / 2 - 1]), C.concreteDark);
  p.add(block(L - 1, 2.2, .1, [0, H + .3, -1.9]), C.glass, { layer: 'glow', ao: false });
  for (let i = 0; i <= 14; i++) p.add(block(.18, 2.4, .2, [-L / 2 + .5 + i * (L - 1) / 14, H + .2, -1.85]), C.steelDark, { ao: false });
  p.add(xf(new THREE.BoxGeometry(L + 2, .35, D + 1.5), [0, H + 3.4, -D / 2 + .2], [.06, 0, 0]), (_x, y, _z, out) => out.set(y > H + 3.45 ? '#e8e5de' : C.blue), { ao: false });
  for (let i = 0; i < 12; i++) p.add(flagStripe(-L / 2 + 2 + i * (L - 4) / 11, H + 3.6), i % 2 ? C.red : C.gold, { ao: false });
  return p;
}
const flagStripe = (x: number, y: number) => xf(new THREE.ConeGeometry(.35, 1.2, 3).rotateX(Math.PI).translate(0, -.6, 0), [x, y + 1.2, .9]);

/** Race control tower: concrete shaft, wraparound glass cab, a radar dish and a beacon. */
function controlTower() {
  const p = new Parts(), H = 20;
  p.add(prism(2.2, 2.6, H, 8), grad(C.concreteDark, C.concrete, 0, H), { ao: [0, 2, .7], flat: true });
  for (let y = 4; y < H; y += 4) p.add(prism(2.35, 2.35, .3, 8, [0, y, 0]), C.blue, { ao: false, flat: true });
  p.add(prism(4.6, 3.6, 1, 8, [0, H, 0]), C.concrete, { flat: true, ao: false });
  p.add(prism(4.4, 4.6, 3, 8, [0, H + 1, 0]), C.glass, { layer: 'glow', ao: false, flat: true });
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28 + .39; p.add(block(.2, 3, .2, [Math.cos(a) * 4.5, H + 1, Math.sin(a) * 4.5]), C.steelDark, { ao: false }); }
  p.add(prism(3.6, 5.2, 1.2, 8, [0, H + 4, 0]), C.red, { flat: true, ao: false }); p.add(prism(5.3, 5.3, .3, 8, [0, H + 3.9, 0]), C.gold, { flat: true, ao: false });
  p.add(cyl(.12, .12, 4, [0, H + 7, 0], [0, 0, 0], 6), C.steelDark, { ao: false }); p.add(bead(.4, [0, H + 9.2, 0]), '#ff5a3a', { layer: 'glow', ao: false });
  p.add(xf(new THREE.SphereGeometry(1.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), [1.5, H + 6.4, 0], [Math.PI / 2 + .5, 0, .4]), '#e9ecf0', { ao: false });
  return p;
}

/** Floodlight tower: lattice mast with a lit lamp bank angled at the track. Faces +z. */
function lightTower() {
  const p = new Parts(), H = 22;
  for (const [x, z] of [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]]) p.add(xf(new THREE.CylinderGeometry(.09, .12, H, 5).translate(0, H / 2, 0), [x * .6, 0, z * .6], [z * .02, 0, -x * .02]), C.steelDark, { ao: false });
  for (let y = 2; y < H; y += 2.5) for (let k = 0; k < 4; k++) p.add(xf(new THREE.BoxGeometry(1.1, .07, .07), [0, y, 0], [0, k * Math.PI / 2, .7 * (k % 2 ? 1 : -1)]).translate(...([[0, 0, .45], [.45, 0, 0], [0, 0, -.45], [-.45, 0, 0]][k] as [number, number, number])), C.steel, { ao: false });
  p.add(rbox(5, 3.4, .5, .08, [0, H + 1.4, .2], [-.35, 0, 0]), C.steelDark, { ao: false });
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) p.add(xf(new THREE.CircleGeometry(.42, 8), [-1.75 + i * 1.17, H + .5 + j * 1, .55 + j * -.34], [-.35, 0, 0]), '#fffbe6', { layer: 'glow', ao: false });
  return p;
}

/** Wooden mooring mast for the airship, with a brass cap and rope ladders. */
function mooringMast() {
  const p = new Parts(), H = 26;
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) p.add(tube([[x, 0, z], [x * .3, H, z * .3]], .3, 6), grad(C.woodDark, C.wood, 0, H), { ao: [0, 2, .6] });
  for (let y = 3; y < H; y += 4) { const k = 1 - y / H * .7; p.add(torus(2.5 * k + .2, .12, [0, y, 0], [Math.PI / 2, 0, Math.PI / 4]), C.woodDark, { ao: false }); }
  p.add(prism(1.4, 1.2, 1.4, 8, [0, H, 0]), C.brass, { ao: false }); p.add(cone(1.5, 2, 8, [0, H + 1.4, 0]), C.red, { ao: false });
  p.add(bead(.35, [0, H + 3.7, 0]), '#ffe28a', { layer: 'glow', ao: false });
  return p;
}

/** Arched airship hangar, doors open towards +z, with a painted gold crest. */
function hangar() {
  const p = new Parts(), R = 13, L = 34;
  p.add(xf(new THREE.CylinderGeometry(R, R, L, 18, 1, true, -Math.PI / 2, Math.PI), [0, 0, 0], [Math.PI / 2, 0, 0]), (x, y, _z, out) => out.set(Math.floor((Math.atan2(y, x) + 3.2) * 4) % 2 ? '#b8c2c9' : '#a9b3bb'), { ao: [0, 3, .7] });
  p.add(xf(new THREE.CylinderGeometry(R - .3, R - .3, L - .4, 18, 1, true, -Math.PI / 2, Math.PI), [0, 0, 0], [Math.PI / 2, 0, 0]).scale(1, 1, 1), '#2a2d36', { ao: false });
  // Inner faces of the dark lining point inwards: flip winding by mirroring once.
  const lining = p.layers.get('solid')!.at(-1)!; lining.scale(-1, 1, 1);
  p.add(xf(new THREE.CircleGeometry(R, 18, 0, Math.PI), [0, 0, -L / 2]), C.concreteDark, { ao: false });
  p.add(xf(new THREE.RingGeometry(R - .1, R + .7, 18, 1, 0, Math.PI), [0, 0, L / 2 + .02]), C.red, { ao: false });
  p.add(xf(new THREE.RingGeometry(R - 1, R - .1, 18, 1, 0, Math.PI), [0, 0, L / 2 + .03]), C.gold, { ao: false });
  for (const s of [-1, 1]) p.add(block(.6, 9, 8, [s * (R + 3.5), 0, L / 2 - 1], [0, s * .9, 0]), '#8f9aa3', { ao: [0, 1, .7] });
  const crest = painted(6, 6, (u, v, out) => { const r = Math.hypot(u - .5, v - .5); out.set(r < .3 && Math.abs(Math.atan2(v - .5, u - .5) % (Math.PI / 4)) < .25 ? C.gold : r < .46 ? C.blue : r < .5 ? C.gold : '#b8c2c9'); }, [0, R - 8.5, L / 2 + .05], 4);
  p.add(crest.g, crest.paint, { ao: false });
  return p;
}

/** Cid's airship: a wooden hull with gold trim, a striped gas envelope, stub wings with propellers and tail fins. Propellers are separate parts so they can spin. */
function airship() {
  const hull = new Parts(), L = 30;
  const prof: [number, number][] = [[0, -L / 2], [2.4, -L / 2 + 2], [4, -L / 4], [4.3, 0], [4, L / 4], [2.8, L / 2 - 2], [.8, L / 2 + 1], [0, L / 2 + 1.6]];
  hull.add(xf(lathe(prof, [0, 0, 0], [0, 0, 0], 14), [0, 0, 0], [Math.PI / 2, 0, 0], [1.05, 1, .85]).translate(0, 0, 0), (x, y, z, out) => out.set(y > 1.2 ? C.wood : Math.floor((y + 10) / 1.1) % 2 ? C.wood : C.woodDark), { ao: false });
  hull.add(xf(new THREE.TorusGeometry(1, .07, 4, 28).scale(4.4, 15.5, 1), [0, .3, 0], [Math.PI / 2, 0, 0]), C.brass, { ao: false });
  hull.add(block(7, .35, 22, [0, 2.6, -1]), '#c99a62', { ao: false });
  hull.add(block(5, 3, 6, [0, 2.9, 5]), C.canvas, { ao: false }); hull.add(xf(new THREE.ConeGeometry(4.2, 2, 4).rotateY(Math.PI / 4).scale(.85, 1, 1.15), [0, 6.9, 5]), C.red, { ao: false, flat: true });
  for (const x of [-2.55, 2.55]) for (const z of [3.5, 5, 6.5]) hull.add(disc(.4, 8, [x, 4.4, z], [0, 0, x > 0 ? -Math.PI / 2 : Math.PI / 2]), '#ffe9a0', { layer: 'glow', ao: false });
  hull.add(tube([[0, 2, 15.5], [0, 3, 19], [0, 3.6, 21.5]], .22, 6), C.brass, { ao: false });
  hull.add(ellipsoid([.9, 1.2, .5], [0, 1.4, 16.3], [.3, 0, 0], .7), C.gold, { ao: false });
  // Gas envelope with red and cream gores, tied to the hull by rigging.
  hull.add(xf(new THREE.SphereGeometry(1, 16, 10), [0, 13, 0], [0, 0, 0], [7.5, 6.5, 19]), (x, y, z, out) => { const a = Math.atan2(x, y - 13); out.set(Math.floor((a + 3.2) / (Math.PI / 4)) % 2 ? C.canvas : C.red); }, { ao: false });
  hull.add(xf(new THREE.TorusGeometry(1, .09, 4, 24).scale(7.5, 19, 1), [0, 13, 0], [Math.PI / 2, 0, 0]), C.brass, { ao: false });
  for (const s of [-1, 1]) for (const z of [-9, -3, 3, 9]) hull.add(tube([[s * 3.6, 2.4, z], [s * 5.2, 8.5, z * 1.05]], .05, 3), '#5a4632', { ao: false });
  for (const [x, y] of [[0, 19.2], [6.8, 13.5], [-6.8, 13.5]] as [number, number][]) hull.add(xf(new THREE.BoxGeometry(.2, 3.4, 4.5), [x, y, -17], [0, 0, x ? Math.sign(x) * Math.PI / 2 : 0]), C.blue, { ao: false });
  // Wings with engine nacelles.
  for (const s of [-1, 1]) {
    hull.add(xf(new THREE.BoxGeometry(9, .4, 4.5), [s * 8, 1, 2], [0, 0, -s * .12]), (x, _y, _z, out) => out.set(Math.abs(x) > 10.5 ? C.red : C.wood), { ao: false });
    hull.add(xf(lathe([[0, 0], [.9, .6], [1.1, 2.5], [.8, 4.4], [0, 4.8]], [0, 0, 0], [0, 0, 0], 10), [s * 11.5, .6, 4], [-Math.PI / 2, 0, 0]), C.brass, { ao: false });
  }
  hull.add(xf(lathe([[0, 0], [.8, .5], [.9, 2.2], [0, 2.8]], [0, 0, 0], [0, 0, 0], 10), [0, 0, -16], [-Math.PI / 2, 0, 0]), C.brass, { ao: false });
  const prop = new Parts();
  prop.add(xf(new THREE.ConeGeometry(.45, 1, 8), [0, 0, .5], [Math.PI / 2, 0, 0]), C.red, { ao: false });
  for (let i = 0; i < 4; i++) prop.add(xf(new THREE.BoxGeometry(.5, 4.2, .1).translate(0, 2.1, 0), [0, 0, 0], [0, .35, i * Math.PI / 2]), C.woodDark, { ao: false });
  return { hull, prop, mounts: [[-11.5, .6, 8.9], [11.5, .6, 8.9], [0, 0, -16.2]] as [number, number, number][] };
}

/** Real meshes for parts that move (the airship), using the shared stage materials. */
function meshes(p: Parts) {
  const g = new THREE.Group();
  for (const [layer, [geo]] of p.bake().layers) { const m = new THREE.Mesh(geo, STAGE[layer.replace('+', '') as Layer]); m.castShadow = false; g.add(m); }
  return g;
}

/** Catalog wrapper for the airship, flattened into one static prop for the studio sheet. */
function airshipProp() {
  const a = airship(), p = new Parts();
  for (const [k, [g]] of a.hull.bake().layers) p.layers.set(k, [g.clone().translate(0, 6, 0)]);
  const prop = a.prop.bake().layers.get('solid')![0];
  for (const m of a.mounts) p.layers.get('solid')!.push(prop.clone().translate(m[0], m[1] + 6, m[2]));
  return p;
}

/** Concrete barrier with livery, an inner face at w + 0.65, matching the physics wall, plus a catch fence. */
function walls(kit: Kit) {
  const block = (s: number) => Math.floor(s / 34);
  kit.extrude([[.65, -.4], [.65, .14], [.65, .52], [.65, 1.05], [.8, 1.32], [1.25, 1.32], [1.25, -.4]], {
    mirror: true, step: 2, paint: (s, k, _i, out) => out.set([C.base, LIVERY[block(s) % LIVERY.length], C.white, C.concrete, C.concreteDark, '#a9a69e'][k]),
  });
  // Red and white rumble curbs, white edge lines on the straights.
  kit.extrude([[-1.25, .05], [-1.05, .1], [.05, .12], [.3, .05], [.65, .05]], {
    mirror: true, step: 1.6, paint: (s, k, i, out) => {
      const bend = Math.abs(kit.at(s).curve) > .006 || Math.abs(kit.at(s + 12).curve) > .006 || Math.abs(kit.at(s - 12).curve) > .006;
      out.set(k === 3 ? '#62656d' : bend ? (i % 2 ? C.red : C.white) : k === 1 ? C.white : '#e8e6e0');
    },
  });
  // Catch fence: posts on the wall top and two thin rails.
  for (const y of [2.2, 3.4]) kit.extrude([[1.05, y], [1.05, y + .07], [1.12, y + .07], [1.12, y]], { mirror: true, step: 4, paint: C.steel });
  const post = kit.prop('fence post', () => new Parts().add(cyl(.05, .06, 2.3, [0, 1.15, 0], [0, 0, 0], 5), C.steel, { ao: false }));
  for (let s = 0; s < kit.len; s += 5) for (const side of [-1, 1]) kit.onTrack(post, s, side * (kit.w + 1.08), { y: 1.3 });
}

/** Finds the infield point furthest from any road, for the hangar and the airship's orbit. */
function infieldHeart(kit: Kit) {
  let best = { x: kit.bounds.cx, z: kit.bounds.cz, d: 0 };
  const ring = Array.from({ length: 401 }, (_, i) => kit.at(i / 400 * kit.len));
  for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) {
    const x = kit.bounds.cx + i * kit.bounds.extent / 20, z = kit.bounds.cz + j * kit.bounds.extent / 20, d = kit.road(x, z).d;
    if (d > best.d && inside(ring, x, z)) best = { x, z, d };
  }
  return best;
}
/** Inside the lap: a ray towards +x crosses the centre line an odd number of times. */
function inside(ring: { x: number; z: number }[], x: number, z: number) {
  let n = 0;
  for (let i = 0; i < ring.length - 1; i++) { const a = ring[i], b = ring[i + 1]; if ((a.z > z) !== (b.z > z) && x < a.x + (z - a.z) / (b.z - a.z) * (b.x - a.x)) n++; }
  return n % 2 === 1;
}

export const test: CourseArt = {
  env: {
    sky: { top: '#2a7fe0', horizon: '#c6e6f6', band: { color: '#fff2d6', height: .07, strength: .3 }, sun: { color: '#fff3d0', size: .05, glow: .75 },
      clouds: { lit: '#ffffff', shade: '#c4d8f0', cover: .32, scale: .85, speed: 1.3 }, cumulus: { lit: '#ffffff', shade: '#b4cbe6', height: .22, amount: .7 } },
    fog: { color: '#c6e6f6', near: 180, far: 820 },
    hemi: { sky: '#e2f2ff', ground: '#5d7a44', intensity: 1.6 },
    sun: { color: '#fff3d8', intensity: 2.7, dir: [.4, .78, .45] },
    mountains: [
      { color: '#6d8fb4', radius: 1000, height: 260, rough: .85, snow: '#f4f8ff', snowLine: .58, haze: .55, seed: 11 },
      { color: '#557d6a', radius: 780, height: 95, rough: .35, haze: .4, seed: 4 },
    ],
  },
  terrain: {
    height: hills({ amp: 34, ridge: 22, scale: .9, flat: 75, rise: 140, seed: 9 }),
    color(p, h, slope, out) {
      // Mowed stripes in the infield and verges, rougher grass further out.
      // Stripes are a gentle tone shift that fades out where the mowers stop, not two separate greens.
      const n = fbm2(p.x * .02, p.z * .02, 3, 4), m = fbm2(p.x * .006, p.z * .006, 2, 8), band = Math.sin((p.x * .8 + p.z * .6) / 9 * Math.PI) * .5 + .5;
      out.set(C.mow).lerp(new THREE.Color(C.mowDark), smoothstep(.35, .65, band) * .55 * (1 - smoothstep(60, 110, p.d)));
      out.lerp(new THREE.Color(C.rough), smoothstep(70, 140, p.d) * .8 + (n - .5) * .3).lerp(new THREE.Color('#3f7434'), smoothstep(.55, .3, m) * .4);
      out.lerp(new THREE.Color(C.gravel), smoothstep(p.w + 6, p.w + 4.5, p.d) * .9);
      out.lerp(new THREE.Color(C.service), smoothstep(p.w + 2.2, p.w + 1.6, p.d));
      out.lerp(new THREE.Color('#8a8f78'), smoothstep(.5, .9, slope) * .7);
      void h;
    },
    detail: 'grass',
  },
  road: { kind: 'asphalt', palette: { base: '#6e717c', dark: '#4a4d57', light: '#f2efe6' } },
  start: { pillar: '#2f5bb8', trim: '#f2bf3a', banner: '#c8372d', text: '#fff4d0', light: '#fff1a8', flags: [C.red, C.blue, C.gold, '#ffffff'] },
  hazard: 'water',
  signs: { board: '#ffd84a', arrow: '#2a2a3a', post: '#5d6876' },
  ambient: [
    { color: '#fff6c8', rate: 6, size: .09, life: 5, glow: true, height: [.5, 5], wander: .3, drift: [.4, .05, .2], radius: 30, alpha: .55 },
    { color: '#ffd84a', endColor: '#ffb02e', rate: 2.5, size: .26, life: 6, height: [5, 11], drift: [.9, -.6, .4], wander: .5, shape: Shape.Shard, radius: 30, alpha: .9 },
  ],
  catalog: {
    Grandstand: r => grandstand(r, { w: 20, rows: 6, frame: C.concreteDark, seat: C.blue, roof: '#f4f2ec', trim: C.red, crowd: [C.red, C.blue, C.gold, '#ffffff', '#3fae5a', '#ff8fc0'] }),
    'Pit garage': pitGarage, 'Control tower': controlTower, 'Light tower': lightTower, 'Mooring mast': mooringMast, Hangar: hangar, Airship: airshipProp,
    'Tyre stack': () => tyreStack(['#2a2a30', '#2a2a30', C.red]), Billboard: () => billboard(0), 'Billboard 2': () => billboard(1), 'Billboard 3': () => billboard(2), 'Billboard 4': () => billboard(3),
    Balloon: () => balloon(C.red, 1.4), Flag: () => flagPole(C.blue, C.gold, 8),
  },
  build(kit) {
    const r = kit.r, w = kit.w, crowd = [C.red, C.blue, C.gold, '#ffffff', '#3fae5a', '#ff8fc0', '#ff9a3a'];
    walls(kit);
    // Start straight: grandstands outside, pits and control tower inside.
    for (const [i, s] of [12, 40, 68, 96, 124].entries()) kit.onTrack(kit.prop('stand', rr => grandstand(rr, { w: 24, rows: 7, frame: C.concreteDark, seat: i % 2 ? C.blue : C.red, roof: '#f4f2ec', trim: C.gold, crowd }), i % 2), s + 12, -(w + 4.2), { faceRoad: true, onGround: true });
    kit.onTrack(kit.prop('pits', pitGarage), 70, w + 9, { faceRoad: true, onGround: true });
    kit.onTrack(kit.prop('tower', controlTower), 128, w + 13, { onGround: true });
    for (let i = 0; i < 6; i++) kit.onTrack(kit.prop('flag', rr => flagPole([C.red, C.blue, C.gold][i % 3], '#ffffff', 9), i % 3), 30 + i * 14, w + 3.2, { onGround: true, yaw: Math.PI });
    for (let i = 0; i < 5; i++) { const p = kit.at(20 + i * 28, -(w + 18)); kit.place(kit.prop('balloon', () => balloon([C.red, C.blue, C.gold][i % 3], 1.4), i % 3), p.x, kit.groundAt(p.x, p.z) + 17 + (i % 2) * 3, p.z); }
    const a = kit.at(-26, -w - 1.1), b = kit.at(-26, w + 1.1);
    bunting(kit, new THREE.Vector3(a.x, a.y + 13.5, a.z), new THREE.Vector3(b.x, b.y + 13.5, b.z), [C.red, C.white, C.blue, C.gold], 1);
    // Billboards on the outside, floodlights spaced around the lap, tyre walls at the bends.
    let board = 0;
    for (let s = 170; s < kit.len - 40; s += r.range(70, 110)) { const p = kit.at(s, -(w + 3.4)); if (kit.road(p.x, p.z).d < w + 2.5) continue; kit.onTrack(kit.prop('board', () => billboard(board % 5), board % 5), s, -(w + 3.4), { faceRoad: true, onGround: true }); board++; }
    for (let s = 150; s < kit.len; s += 125) for (const side of [-1, 1]) { const off = side * (w + 6.5), p = kit.at(s + side * 30, off); if (kit.road(p.x, p.z).d < w + 4) continue; kit.onTrack(kit.prop('light', lightTower), s + side * 30, off, { faceRoad: true, onGround: true }); }
    for (let s = 0; s < kit.len; s += 7) {
      const c = kit.at(s).curve; if (Math.abs(c) < .012) continue;
      const off = -Math.sign(c) * (w + 2.3 + r.range(0, .6)), p = kit.at(s, off); if (kit.road(p.x, p.z).d < w + 1.6) continue;
      kit.onTrack(kit.prop('tyres', rr => tyreStack(rr() < .5 ? ['#2a2a30', '#2a2a30', C.red] : ['#2a2a30', C.white, '#2a2a30'], 3), r.int(0, 1)), s, off, { onGround: true, yaw: r() * 6 });
      kit.onTrack(kit.prop('tyres', rr => tyreStack(['#2a2a30', '#2a2a30', C.red], 3), 0), s + 1, off - Math.sign(off) * .9, { onGround: true });
    }
    // Infield: hangar, mooring mast, trees and hedges around the edges.
    const heart = infieldHeart(kit), toward = Math.atan2(kit.bounds.cx - heart.x, kit.bounds.cz - heart.z);
    kit.place(kit.prop('hangar', hangar), heart.x, kit.groundAt(heart.x, heart.z), heart.z, { yaw: toward });
    const mx = heart.x + Math.sin(toward) * 34 + Math.cos(toward) * 18, mz = heart.z + Math.cos(toward) * 34 - Math.sin(toward) * 18;
    kit.place(kit.prop('mast', mooringMast), mx, kit.groundAt(mx, mz), mz);
    kit.scatter(160, w + 14, 150, (x, z, d) => {
      const y = kit.groundAt(x, z); if (Math.hypot(x - heart.x, z - heart.z) < 30 || (d < 40 && r() < .6)) return;
      kit.place(kit.prop('tree', rr => roundTree(rr), r.int(0, 3)), x, y, z, { yaw: r() * 6, scale: r.range(.9, 1.4) });
    });
    // Wooded hills around the circuit, so the horizon is not bare grass.
    kit.scatter(420, 150, 430, (x, z) => { const y = kit.groundAt(x, z); kit.place(kit.prop('tree', rr => roundTree(rr), r.int(0, 3)), x, y - .3, z, { yaw: r() * 6, scale: r.range(1.2, 2.2), tint: r() < .5 ? '#c8e0a0' : undefined, tintAmount: .3 }); });
    kit.scatter(500, w + 8, 120, (x, z) => kit.place(kit.prop('grass', rr => grass(rr, C.mowDark, '#9ccf6a', 1, 8), r.int(0, 2)), x, kit.groundAt(x, z), z, { yaw: r() * 6 }));
    kit.scatter(60, w + 10, 90, (x, z) => kit.place(kit.prop('bush', rr => bush(rr, '#6cb048', '#2f6a34', 1.2), r.int(0, 2)), x, kit.groundAt(x, z), z, { yaw: r() * 6 }));
    // Cid's airship circles slowly over the infield; its propellers spin.
    const ship = airship(), group = new THREE.Group(), props: THREE.Group[] = []; group.name = 'airship';
    group.add(meshes(ship.hull));
    for (const m of ship.mounts) { const pg = meshes(cloneParts(ship.prop)); pg.position.set(...m); props.push(pg); group.add(pg); }
    group.scale.setScalar(1.3); kit.add(group);
    const R = Math.min(70, heart.d * .9), base = kit.groundAt(heart.x, heart.z) + 52;
    kit.onUpdate(t => {
      const a2 = t * .045; group.position.set(heart.x + Math.cos(a2) * R, base + Math.sin(t * .4) * 1.4, heart.z + Math.sin(a2) * R);
      group.rotation.set(Math.sin(t * .5) * .03, Math.atan2(-Math.sin(a2), Math.cos(a2)), Math.sin(t * .33) * .04 - .06);
      props.forEach((p, i) => { p.rotation.z = t * (11 + i); });
    });
  },
};

/** Parts are baked in place, so every propeller needs its own copy of the geometry. */
function cloneParts(p: Parts) { const c = new Parts(); for (const [k, list] of p.layers) c.layers.set(k, list.map(g => g.clone())); return c; }

/** Neat park tree for the infield: straight trunk, round clipped canopy. */
function roundTree(r: Rng) {
  const p = new Parts(), h = r.range(3, 4.2);
  p.add(prism(.22, .32, h, 6), '#6a4a32', { ao: [0, 1, .6] });
  p.add(xf(new THREE.IcosahedronGeometry(1, 1), [0, h + 1.6, 0], [0, r() * 6, 0], [2.3, 2.6, 2.3]), grad('#2f6e34', '#8cc65a', h, h + 4), { layer: 'foliage', sway: .1, ao: false });
  if (r() < .5) p.add(xf(new THREE.IcosahedronGeometry(1, 1), [1.2, h + .9, .4], [0, 0, 0], [1.4, 1.5, 1.4]), grad('#2f6e34', '#7cbc4a', h, h + 3), { layer: 'foliage', sway: .12, ao: false });
  return p;
}
