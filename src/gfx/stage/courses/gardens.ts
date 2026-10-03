import * as THREE from 'three';
import { Parts, type Kit } from '../kit.ts';
import { makeLiquid } from '../liquid.ts';
import { STAGE, stageTime } from '../materials.ts';
import { noiseTexture } from '../textures.ts';
import { fbm2, noise3, rng, type Rng } from '../noise.ts';
import { Shape } from '../../particles/particles.ts';
import { grass, flowers, lampPost, savePoint, blob, block, prism, cone, cyl, bead, ellipsoid, rbox, rock, torus, lathe, sweep, grad, xf , disc } from '../props/common.ts';
import type { CourseArt } from '../types.ts';

const C = {
  marble: '#f3eff8', marbleShade: '#d4cbe4', gold: '#e2b85a', goldDark: '#b48a3a',
  grass: '#72b65a', grassLight: '#9fd273', grassDark: '#4a8c4a',
  earth: '#9b7354', earthDark: '#6b4a3c', rock: '#a79bc0', rockDark: '#6f6390', rockDeep: '#4f4570',
  crystal: '#9ff0ff', crystalDeep: '#5b6fe0', pink: '#ff9fd6',
  blossom: '#ef93bd', blossomLight: '#ffe2ef', bark: '#8a6a5a', cypress: '#3f7f4f', cypressLight: '#79b866', dome: '#79cbbd', roof: '#5a74d0',
};

// ---- Shapes -------------------------------------------------------------------------------------

/** Lumpy inverted cone of earth and layered rock: the underside of every floating island. Origin at its flat top. */
function rockCone(R: number, depth: number, seed: number) {
  const g = new THREE.ConeGeometry(1, 1, 14, 8, true).rotateX(Math.PI).translate(0, -.5, 0), a = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), y = a.getY(i), z = a.getZ(i), lin = Math.max(.001, 1 + y), bulge = Math.pow(lin, .55) / lin;
    const k = bulge * (1 + (noise3(x * 2.1 + seed, y * 3.3, z * 2.1) - .5) * .55 * Math.min(1, -y * 6));
    a.setXYZ(i, x * k, y + (y < -.04 ? (noise3(x * 3, seed, z * 3) - .5) * .18 : 0), z * k);
  }
  return xf(g, [0, 0, 0], [0, 0, 0], [R, depth, R]);
}
/** Earth band under the grass, then violet rock strata. */
function strata(depth: number, seed: number) {
  const earth = new THREE.Color(C.earth), dark = new THREE.Color(C.earthDark), rk = new THREE.Color(C.rock), rd = new THREE.Color(C.rockDark), deep = new THREE.Color(C.rockDeep);
  return (x: number, y: number, z: number, out: THREE.Color) => {
    const d = -y / depth, n = noise3(x * .3 + seed, y * .5, z * .3) * .12;
    if (d + n < .14) out.copy(earth).lerp(dark, Math.min(1, (d + n) / .14));
    else out.copy(Math.floor((d + n) * 9) % 2 ? rk : rd).lerp(deep, Math.min(1, d * .9));
  };
}
/** Approximate grass-cap height at radius `rho` of an island of radius R. */
const capY = (R: number, rho: number) => R * .15 * Math.sqrt(Math.max(0, 1 - (rho / R) ** 2)) - .25;

/** Classical column: square base, fluted (faceted) shaft, capital. Origin on the ground. */
function column(p: Parts, x: number, z: number, h: number, r = .55, broken = 0) {
  p.add(rbox(r * 2.7, r * .7, r * 2.7, .06, [x, r * .35, z]), C.marbleShade, { ao: [0, .5, .75] });
  const shaft = h * (1 - broken);
  p.add(prism(r * .88, r, shaft, 14, [x, r * .7, z]), C.marble, { flat: true, ao: [0, 1.4, .7] });
  if (!broken) { p.add(torus(r * .95, r * .12, [x, h + r * .55, z], [Math.PI / 2, 0, 0]), C.gold, { ao: false }); p.add(rbox(r * 2.6, r * .6, r * 2.6, .06, [x, h + r * 1, z]), C.marble, { ao: false }); }
}

// ---- Props --------------------------------------------------------------------------------------

function blossomTree(r: Rng) {
  const p = new Parts(), h = r.range(3.5, 5), lean = r.range(-.5, .5);
  p.add(sweep([[0, 0, 0], [lean * .4, h * .5, .2], [lean, h, 0]], t => .38 - t * .18, { radial: 7, segments: 6 }), grad(C.earthDark, C.bark, 0, h), { ao: [0, 1, .6] });
  for (let i = 0; i < 2; i++) { const a = r() * 6.28; p.add(sweep([[lean * .5, h * .6, 0], [lean * .5 + Math.cos(a) * 1.5, h * .9, Math.sin(a) * 1.5]], t => .14 - t * .07, { radial: 5, segments: 3 }), C.bark, { ao: false }); }
  const n = r.int(5, 7), cy = h + 1.1;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + r() * .5, d = i ? r.range(1.3, 2) : 0, s = i ? r.range(1.2, 1.7) : 2.1;
    p.add(blob(s, [lean + Math.cos(a) * d, cy + (i ? r.range(-.6, .7) : .5), Math.sin(a) * d], r() * 9, .2), grad(C.blossom, C.blossomLight, cy - 1.8, cy + 2.2), { layer: 'foliage', sway: .12, ao: false });
  }
  return p;
}

function cypress(r: Rng) {
  const p = new Parts(), h = r.range(6, 8.5);
  p.add(prism(.12, .2, 1.2, 6), C.bark, { ao: false });
  p.add(blob([1, h * .5, 1], [0, h * .5 + .6, 0], r() * 9, .1), grad(C.cypress, C.cypressLight, 0, h), { layer: 'foliage', sway: .06, ao: [0, h * .4, .7] });
  return p;
}

function urn(p: Parts, x: number, z: number, s = 1, bloom = C.pink) {
  p.add(lathe([[.35 * s, 0], [.42 * s, .12 * s], [.25 * s, .3 * s], [.5 * s, .75 * s], [.6 * s, 1.05 * s], [.52 * s, 1.15 * s], [0, 1.1 * s]], [x, 0, z], [0, 0, 0], 12), C.marble, { ao: [0, .6, .75] });
  p.add(torus(.58 * s, .05 * s, [x, 1.1 * s, z], [Math.PI / 2, 0, 0]), C.gold, { ao: false });
  p.add(blob([.62 * s, .4 * s, .62 * s], [x, 1.2 * s, z], x * 3, .25, 1), grad(C.grassDark, C.grassLight, 1 * s, 1.6 * s), { layer: 'foliage', sway: .1, ao: false });
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + x; p.add(bead(.1 * s, [x + Math.cos(a) * .5 * s, 1.42 * s, z + Math.sin(a) * .5 * s]), i % 2 ? bloom : '#fff3a8', { layer: 'foliage', sway: .1, ao: false }); }
}

function topiary(r: Rng) {
  const p = new Parts(), stack = r.int(2, 3);
  p.add(lathe([[.55, 0], [.7, .7], [.62, .78], [0, .76]], [0, 0, 0], [0, 0, 0], 12), C.marble, { ao: [0, .5, .75] });
  p.add(cyl(.07, .09, 1.2, [0, 1.2, 0], [0, 0, 0], 6), C.bark, { ao: false });
  for (let i = 0; i < stack; i++) { const s = .85 - i * .22; p.add(blob(s, [0, 1.6 + i * 1.25, 0], i + r() * 4, .05), grad(C.grassDark, C.grassLight, 1 + i * 1.2, 2.4 + i * 1.2), { layer: 'foliage', sway: .05, ao: false }); }
  p.add(bead(.13, [0, 1.6 + stack * 1.25 - .3, 0]), C.gold, { ao: false });
  return p;
}

function hedge(r: Rng) {
  const p = new Parts(), L = 3.6;
  p.add(rbox(.8, .85, L, .2, [0, .42, 0]), grad(C.grassDark, C.grassLight, 0, .9), { ao: [0, .5, .7] });
  for (let i = 0; i < 9; i++) p.add(bead(.09, [r.range(-.42, .42), r.range(.5, .9), r.range(-L / 2, L / 2)]), r.pick([C.pink, '#ffffff', '#fff3a8', '#c9a8ff']), { ao: false, detail: true });
  return p;
}

/** Marble moogle on a plinth, a little guardian of the gardens. Faces +z. */
function moogleStatue() {
  const p = new Parts(), m = C.marble;
  p.add(rbox(1.5, 1.2, 1.5, .08, [0, .6, 0]), C.marbleShade, { ao: [0, .6, .7] }); p.add(rbox(1.7, .2, 1.7, .05, [0, 1.25, 0]), C.gold, { ao: false });
  p.add(ellipsoid([.55, .6, .5], [0, 1.95, 0]), m, { ao: false }); p.add(ellipsoid([.62, .55, .55], [0, 2.85, .05]), m, { ao: false });
  for (const s of [-1, 1]) { p.add(cone(.2, .55, 8, [s * .38, 3.15, 0], [0, 0, s * -.35]), m, { ao: false }); p.add(xf(new THREE.CircleGeometry(.4, 8, 0, Math.PI), [s * .5, 2.1, -.35], [0, s * .9, s * .4]), m, { ao: false }); }
  p.add(ellipsoid([.17, .12, .1], [0, 2.75, .55]), '#f2c4c4', { ao: false });
  p.add(sweep([[0, 3.35, 0], [.1, 3.75, -.1], [.05, 4.1, -.05]], .03, { radial: 4, segments: 4 }), C.goldDark, { ao: false }); p.add(bead(.2, [.05, 4.25, -.05]), '#ff5c86', { layer: 'glow', ao: false });
  return p;
}

function gazebo(R = 3.8) {
  const p = new Parts();
  p.add(cyl(R + .7, R + .9, .7, [0, .35, 0], [0, 0, 0], 18), C.marbleShade, { ao: [0, .5, .7] });
  p.add(cyl(R + .4, R + .4, .15, [0, .76, 0], [0, 0, 0], 18), C.gold, { ao: false });
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; column(p, Math.cos(a) * R, Math.sin(a) * R, 3.8, .26); }
  // Columns stand on y = 0; lift them onto the floor by building at 0 and the floor is low enough to read as a step.
  p.add(cyl(R + .45, R + .45, .55, [0, 5.05, 0], [0, 0, 0], 18), C.marble, { ao: false });
  p.add(torus(R + .45, .1, [0, 4.85, 0], [Math.PI / 2, 0, 0]), C.gold, { ao: false });
  p.add(lathe([[R + .5, 0], [R * .95, R * .45], [R * .65, R * .8], [R * .25, R * .97], [0, R]], [0, 5.3, 0], [0, 0, 0], 18), grad(C.dome, '#bff0e4', 5.3, 5.3 + R), { ao: false });
  p.add(bead(.35, [0, 5.4 + R, 0]), C.gold, { ao: false }); p.add(cone(.16, 1.2, 6, [0, 5.6 + R, 0]), C.gold, { ao: false });
  urn(p, 0, 0, 1.1);
  return p;
}

/** Hanging roots and vines under an overhang, swaying as they dangle. Origin at the attachment line. */
function roots(r: Rng) {
  const p = new Parts();
  for (let i = 0; i < r.int(3, 5); i++) {
    const x = r.range(-1.5, 1.5), L = r.range(2.5, 7), z = r.range(-1.6, 1.6), curl = r.range(-.8, .8);
    p.add(sweep([[x, .2, z], [x + curl * .5, -L * .4, z + .3], [x + curl, -L * .8, z - .2], [x + curl * .6, -L, z]], t => .14 * (1 - t) + .025, { radial: 4, segments: 7 }), r() < .4 ? C.grassDark : C.earthDark, { layer: 'foliage', sway: .18, ao: false });
    if (r() < .5) for (let k = 1; k < 4; k++) { const t = k / 4; p.add(disc(.2, 5, [x + curl * t, -L * t, z], [.5, k, 0]), C.grass, { layer: 'foliage', sway: .2, ao: false, detail: true }); }
  }
  return p;
}

/** Floating island: grass cap over a rock cone, dressed according to its size. Origin at the centre of the grass top. */
function island(r: Rng, R: number) {
  const p = new Parts(), depth = R * r.range(1.1, 1.7), seed = r() * 50;
  p.add(blob([R, R * .15, R], [0, -.02 * R, 0], seed, .1, R > 12 ? 2 : 1), grad(C.grassDark, C.grassLight, -R * .05, R * .15), { ao: false });
  p.add(rockCone(R * .97, depth, seed), strata(depth, seed), { flat: true, ao: false });
  for (let i = 0; i < Math.round(R / 3); i++) { const a = r() * 6.28; p.add(rock([R * .12, R * .2, R * .12], [Math.cos(a) * R * .55, -depth * r.range(.45, .8), Math.sin(a) * R * .55], r() * 9), C.rockDark, { flat: true, ao: false }); }
  // Crystals poking out of the underside.
  for (let i = 0; i < Math.round(R / 6) + 1; i++) {
    const a = r() * 6.28, rho = R * r.range(.25, .5), y = -depth * r.range(.4, .65), h = R * r.range(.12, .22);
    p.add(prism(0, h * .25, h, 6, [Math.cos(a) * rho, y - h * .6, Math.sin(a) * rho], [Math.PI + r.range(-.4, .4), 0, r.range(-.4, .4)]), grad(C.crystal, C.crystalDeep, y - h, y), { layer: 'glow', flat: true, ao: false });
  }
  const spots: [number, number][] = [];
  const free = (x: number, z: number, rad: number) => spots.every(([a, b]) => Math.hypot(a - x, b - z) > rad) && Math.hypot(x, z) < R * .82;
  const put = (rad: number) => { for (let k = 0; k < 20; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * R * .78, x = Math.cos(a) * d, z = Math.sin(a) * d; if (free(x, z, rad)) { spots.push([x, z]); return [x, z, capY(R, d)] as const; } } return null; };
  if (R > 13) { spots.push([0, 0]); const g = gazebo(Math.min(5, R * .25)); for (const [k, [geo]] of g.layers) p.layers.set(k, [...(p.layers.get(k) ?? []), geo.clone().translate(0, capY(R, 0) - .1, 0)]); g.dispose(); }
  else if (R > 8 && r() < .6) { const at = put(3); if (at) for (let i = 0; i < 3; i++) column(p, at[0] + (i - 1) * 1.8, at[1], 3.5, .32, i === 1 ? 0 : r.range(.35, .7)); }
  for (let i = 0; i < Math.round(R / 4); i++) { const at = put(2.5); if (!at) break; const t = r() < .55 ? blossomTree(r) : cypress(r); for (const [k, [geo]] of t.bake().layers) p.layers.set(k, [...(p.layers.get(k) ?? []), geo.clone().translate(at[0], at[2] - .1, at[1])]); t.dispose(); }
  for (let i = 0; i < Math.round(R / 3); i++) { const at = put(1); if (!at) break; const f = flowers(r, [C.pink, '#ffffff', '#fff3a8', '#c9a8ff'], C.grassDark, 5, 1.3); for (const [k, [geo]] of f.bake().layers) p.layers.set(k, [...(p.layers.get(k) ?? []), geo.clone().translate(at[0], at[2], at[1])]); f.dispose(); }
  return p;
}

/** Floating crystal: a tall glowing spire with satellite shards. */
function floatCrystal(r: Rng) {
  const p = new Parts(), h = 4.5;
  p.add(prism(.9, .9, h * .55, 6, [0, 0, 0]), grad(C.crystalDeep, C.crystal, 0, h * .55), { layer: 'glow', flat: true, ao: false });
  p.add(prism(0, .9, h * .3, 6, [0, h * .55, 0]), grad(C.crystal, '#ffffff', h * .55, h * .85), { layer: 'glow', flat: true, ao: false });
  p.add(prism(.9, 0, h * .3, 6, [0, -h * .3, 0]), grad(C.crystalDeep, C.crystalDeep, 0, 1), { layer: 'glow', flat: true, ao: false });
  for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28 + r(); p.add(xf(new THREE.OctahedronGeometry(.35), [Math.cos(a) * 1.9, h * .3 + i * .6, Math.sin(a) * 1.9], [0, 0, 0], [1, 1.8, 1]), C.pink, { layer: 'glow', flat: true, ao: false }); }
  p.add(torus(1.6, .06, [0, h * .3, 0], [Math.PI / 2 + .3, 0, 0]), C.gold, { ao: false });
  return p;
}

/** Classical arch over the road, its columns standing on floating plinths beyond the edge. */
function gardenArch(w: number) {
  const p = new Parts(), span = w + 7.5, H = 13;
  for (const s of [-1, 1]) {
    const x = s * span;
    p.add(cyl(2.3, 2.5, 1.2, [x, -.6, 0], [0, 0, 0], 14), C.marbleShade, { ao: false }); p.add(torus(2.4, .1, [x, -.05, 0], [Math.PI / 2, 0, 0]), C.gold, { ao: false });
    p.add(xf(rockCone(2.3, 7, s * 3), [x, -1.2, 0]), strata(7, s * 3), { flat: true, ao: false });
    p.add(prism(0, .5, 2.2, 6, [x, -10.2, 0]), grad(C.crystal, C.crystalDeep, -10.2, -8), { layer: 'glow', flat: true, ao: false });
    column(p, x, 0, H, .95);
  }
  p.add(rbox(span * 2 + 3.4, 1.5, 2.8, .1, [0, H + 2.15, 0]), C.marble, { ao: false });
  p.add(rbox(span * 2 + 3.6, .3, 2.9, .05, [0, H + 1.45, 0]), C.gold, { ao: false });
  p.add(rbox(span * 2 + 4.2, .45, 3.3, .08, [0, H + 3.05, 0]), C.marbleShade, { ao: false });
  const tri = new THREE.Shape([new THREE.Vector2(-span * .8, 0), new THREE.Vector2(span * .8, 0), new THREE.Vector2(0, 3.2)]);
  p.add(new THREE.ExtrudeGeometry(tri, { depth: 2.4, bevelEnabled: false }).translate(0, H + 3.25, -1.2), C.marble, { ao: false, flat: true });
  p.add(xf(new THREE.OctahedronGeometry(.9), [0, H + 4.4, 1.3], [0, 0, 0], [1, 1.4, .5]), C.crystal, { layer: 'glow', flat: true, ao: false });
  // Flower garland sagging between the columns, well above the camera.
  const pts: [number, number, number][] = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([-span + t * span * 2, H + 1.1 - Math.sin(t * Math.PI) * 1.3, 1.5]); }
  p.add(sweep(pts, .22, { radial: 6, segments: 30 }), C.grassDark, { layer: 'foliage', sway: .05, ao: false });
  for (let i = 1; i < 12; i++) p.add(bead(.3, [pts[i][0], pts[i][1], 1.6]), i % 2 ? C.pink : '#ffffff', { layer: 'foliage', sway: .05, ao: false });
  return p;
}

/** The sky castle on its own great island, seen across the cloud sea. */
function skyCastle(r: Rng) {
  const p = new Parts(), R = 46;
  const isl = island(r, R); for (const [k, list] of isl.layers) p.layers.set(k, list);
  const W = '#f6f2ff', roof = C.roof;
  const tower = (x: number, z: number, h: number, rr: number) => {
    p.add(prism(rr, rr * 1.08, h, 12, [x, 0, z]), grad(C.marbleShade, W, 0, h), { flat: true, ao: [0, 3, .75] });
    p.add(cyl(rr * 1.18, rr * 1.18, 1.2, [x, h + .6, z], [0, 0, 0], 12), W, { ao: false });
    p.add(torus(rr * 1.18, .25, [x, h, z], [Math.PI / 2, 0, 0]), C.gold, { ao: false });
    p.add(cone(rr * 1.3, rr * 3.2, 12, [x, h + 1.2, z]), grad(roof, '#8fa6ff', h, h + rr * 3), { ao: false });
    p.add(bead(.6, [x, h + 1.4 + rr * 3.2, z]), C.gold, { ao: false });
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + .4, y = h * (.35 + (i % 2) * .3); p.add(rbox(.9, 1.8, .3, .05, [x + Math.cos(a) * rr * 1.03, y, z + Math.sin(a) * rr * 1.03], [0, -a + Math.PI / 2, 0]), '#ffd98a', { layer: 'glow', ao: false }); }
  };
  const y0 = capY(R, 0) - .5;
  const g = new Parts();
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; const x0 = Math.cos(a) * 24, z0 = Math.sin(a) * 24, x1 = Math.cos(a + 1.047) * 24, z1 = Math.sin(a + 1.047) * 24, L = Math.hypot(x1 - x0, z1 - z0);
    g.add(block(2.5, 10, L, [(x0 + x1) / 2, 0, (z0 + z1) / 2], [0, Math.atan2(x1 - x0, z1 - z0), 0]), W, { ao: [0, 3, .75] });
    for (let k = 0; k < 8; k++) { const t = (k + .5) / 8; g.add(block(2.7, 1.2, 1.2, [x0 + (x1 - x0) * t, 10, z0 + (z1 - z0) * t], [0, Math.atan2(x1 - x0, z1 - z0), 0]), W, { ao: false }); } }
  for (const [k, list] of g.layers) p.layers.set(k, [...(p.layers.get(k) ?? []), ...list.map(x => x.translate(0, y0, 0))]);
  const before = new Map([...p.layers].map(([k, v]) => [k, v.length]));
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; tower(Math.cos(a) * 24, Math.sin(a) * 24, 18, 3.4); }
  p.add(block(20, 26, 20), grad(C.marbleShade, W, 0, 26), { ao: [0, 4, .75] });
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + .78; tower(Math.cos(a) * 10, Math.sin(a) * 10, 34, 2.6); }
  tower(0, 0, 48, 4);
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28; p.add(rbox(2.4, 4, .3, .1, [Math.sin(a) * 10.1, 16, Math.cos(a) * 10.1], [0, a, 0]), '#ffd98a', { layer: 'glow', ao: false }); }
  // Lift everything added after the island onto its grass top.
  for (const [k, list] of p.layers) for (let i = before.get(k) ?? 0; i < list.length; i++) list[i].translate(0, y0, 0);
  return p;
}

// ---- World-space effects ------------------------------------------------------------------------

/** Waterfalls: scrolling translucent ribbons that arc off an edge and dissolve into mist. */
function waterfalls(kit: Kit, falls: { p: THREE.Vector3; dir: THREE.Vector3; w: number; L: number }[]) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], n = 14;
  for (const f of falls) {
    const across = new THREE.Vector3(-f.dir.z, 0, f.dir.x), base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const t = i / n, out = Math.sqrt(t) * f.L * .12 + t * 2, c = f.p.clone().addScaledVector(f.dir, out); c.y -= f.L * t; const hw = f.w * (1 + t * 1.4) / 2;
      for (const s of [-1, 1]) { pos.push(c.x + across.x * hw * s, c.y, c.z + across.z * hw * s); uv.push(s < 0 ? 0 : 1, t); }
    }
    for (let i = 0; i < n; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere();
  const mat = kit.own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNoise: { value: null } }]),
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform sampler2D uNoise; varying vec2 vUv; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        float n = texture2D(uNoise, vec2(vUv.x * .7 + (vW.x + vW.z) * .004, vUv.y * 2.5 - uTime * .45)).g;
        float m = texture2D(uNoise, vec2(vUv.x * 1.6 + vW.x * .01, vUv.y * 5. - uTime * .9)).b;
        float streak = smoothstep(.42, .62, n * .6 + m * .4);
        vec3 c = mix(vec3(.55, .82, 1.), vec3(1.), streak * .85 + smoothstep(.55, 1., vUv.y) * .6);
        float edge = smoothstep(0., .22, min(vUv.x, 1. - vUv.x) + (m - .5) * .15);
        float a = (.5 + .45 * streak) * edge * smoothstep(1., .55, vUv.y) * smoothstep(0., .02, vUv.y);
        gl_FragColor = vec4(c * 1.15, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }));
  mat.uniforms.uNoise.value = kit.own(noiseTexture()); mat.uniforms.uTime = stageTime;
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'waterfalls'; mesh.renderOrder = 2; kit.add(mesh);
}

/** Pale rainbow arcing out of the cloud sea behind the course. */
function rainbow(kit: Kit, at: THREE.Vector3, facing: number) {
  const mat = kit.own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec3 vP;
      vec3 hue(float h){ return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
      void main(){ float t = (length(vP.xy) - 230.) / 34.; float a = pow(sin(clamp(t, 0., 1.) * 3.14159), .8) * smoothstep(0., 90., vP.y) * .3;
        gl_FragColor = vec4(hue(.8 - t * .8) * a, 1.); }`,
  }));
  const geo = new THREE.RingGeometry(230, 264, 96, 1, 0, Math.PI), m = new THREE.Mesh(geo, mat);
  m.position.copy(at); m.rotation.y = facing; m.name = 'rainbow'; m.renderOrder = -4; kit.add(m);
}

/** Crystals that hover beside the road, bobbing and turning slowly. */
function hoveringCrystals(kit: Kit) {
  const parts = floatCrystal(rng(5)).bake(), group = new THREE.Group(), items: { o: THREE.Object3D; y: number; ph: number }[] = [];
  group.name = 'hovering crystals';
  for (let s = 40, i = 0; s < kit.len - 20; s += kit.r.range(70, 120), i++) {
    const side = i % 2 ? 1 : -1, off = side * (kit.w + kit.r.range(13, 24)), p = kit.at(s, off);
    if (kit.road(p.x, p.z).d < kit.w + 10) continue;
    const o = new THREE.Group(); for (const [k, [g]] of parts.layers) o.add(new THREE.Mesh(g, STAGE[k.replace('+', '') as keyof typeof STAGE]));
    o.position.set(p.x, p.y + kit.r.range(4, 9), p.z); o.scale.setScalar(kit.r.range(.9, 1.5)); group.add(o); items.push({ o, y: o.position.y, ph: kit.r() * 6 });
  }
  kit.add(group);
  kit.onUpdate(t => { for (const it of items) { it.o.position.y = it.y + Math.sin(t * .8 + it.ph) * .7; it.o.rotation.y = t * .3 + it.ph; } });
}

// ---- Causeway -----------------------------------------------------------------------------------

/** Underside profile from the outer lip down to the keel under the road centre, relative to the road edge. */
const keel = (w: number): [number, number][] => [[4.7, 0], [4.7, .12], [5.25, .12], [5.25, -.7], [5.7, -1.8], [4.6, -4.5], [2, -8], [-w * .45, -12], [-w, -14.5]];
const keelY = (w: number, px: number) => { const k = keel(w).slice(4); for (let i = 0; i < k.length - 1; i++) if (px <= k[i][0] && px >= k[i + 1][0]) return k[i][1] + (k[i + 1][1] - k[i][1]) * (k[i][0] - px) / (k[i][0] - k[i + 1][0]); return -14; };

function causeway(kit: Kit) {
  const w = kit.w, marble = new THREE.Color(C.marble), shade = new THREE.Color(C.marbleShade), gold = new THREE.Color(C.gold);
  const earth = new THREE.Color(C.earth), rk = new THREE.Color(C.rock), rd = new THREE.Color(C.rockDark), deep = new THREE.Color(C.rockDeep);
  const g1 = new THREE.Color(C.grass), g2 = new THREE.Color(C.grassLight), g3 = new THREE.Color(C.grassDark);
  // Grass shoulder out to the lip, mottled along its length.
  kit.extrude([[0, 0], [1.6, 0], [3.2, 0], [4.7, 0]], { mirror: true, step: 2, paint: (s, seg, _i, out) => { const n = fbm2(s * .04, seg * 1.7, 2, 3); out.copy(g1).lerp(n > .55 ? g2 : g3, Math.abs(n - .5) * 1.6); } });
  // Marble curb at the road edge, white and pale gold blocks.
  kit.extrude([[-.55, .02], [-.3, .16], [.3, .16], [.45, .01]], { mirror: true, step: 1.5, paint: (_s, seg, i, out) => out.copy(Math.floor(i / 2) % 2 ? marble : new THREE.Color('#f0dfae')).multiplyScalar(seg === 1 ? 1 : .88) });
  kit.extrude(keel(w), { mirror: true, step: 2.5, paint: (s, seg, _i, out) => {
    if (seg < 2) { out.copy(marble); return; } if (seg === 2) { out.copy(gold); return; } if (seg === 3) { out.copy(shade); return; }
    const n = fbm2(s * .03, seg, 2, 9); out.copy(seg === 4 ? earth : n > .5 ? rk : rd).lerp(deep, (seg - 4) / 6);
  } });
}

function decorateCauseway(kit: Kit) {
  const r = kit.r, w = kit.w;
  // Verge dressing on the shoulder: grass, flowers, hedges, topiary and urns. Kept low so racers can still use the shoulder.
  for (let s = 0; s < kit.len; s += 3.4) for (const side of [-1, 1]) {
    kit.onTrack(kit.prop('grass', rr => grass(rr, C.grassDark, C.grassLight, 1, 7), r.int(0, 3)), s + r() * 2, side * (w + r.range(.8, 4.4)), { yaw: r() * 6 });
    if (r() < .35) kit.onTrack(kit.prop('flowers', rr => flowers(rr, [C.pink, '#ffffff', '#fff3a8', '#c9a8ff', '#ff9b7a'], C.grassDark), r.int(0, 3)), s, side * (w + r.range(1, 4.3)), { yaw: r() * 6 });
  }
  for (let s = 20; s < kit.len - 10; s += r.range(12, 22)) {
    const side = r.sign(), k = r(), off = side * (w + 4.25), p = kit.at(s, off);
    if (kit.road(p.x, p.z).d < w + 3.5) continue;
    if (k < .4) kit.onTrack(kit.prop('hedge', hedge, r.int(0, 2)), s, off);
    else if (k < .6) kit.onTrack(kit.prop('topiary', topiary, r.int(0, 2)), s, off);
    else if (k < .75) { const u = new Parts(); urn(u, 0, 0, 1.1); kit.onTrack(u.bake(), s, off); u.dispose(); }
  }
  for (let s = 10, i = 0; s < kit.len; s += 42, i++) kit.onTrack(kit.prop('lamp', () => lampPost(C.gold, '#c8f6ff', 4.4)), s, (i % 2 ? 1 : -1) * (w + 4.4), { faceRoad: true });
  // Roots and crystals hanging under the causeway edges.
  for (let s = 0; s < kit.len; s += r.range(5, 9)) {
    const side = r.sign();
    kit.onTrack(kit.prop('roots', roots, r.int(0, 4)), s, side * (w + 5.3), { y: -.9, yaw: r() * .4 });
    if (r() < .35) { const px = r.range(-w * .5, 3); kit.onTrack(kit.prop('under crystal', rr => { const q = new Parts(); const h = rr.range(2, 4); q.add(prism(0, h * .28, h, 6, [0, -h, 0]), grad(C.crystal, C.crystalDeep, -h, 0), { layer: 'glow', flat: true, ao: false }); q.add(prism(0, h * .16, h * .6, 6, [h * .3, -h * .6, .2], [0, 0, .4]), grad(C.pink, '#a05ce0', -h * .6, 0), { layer: 'glow', flat: true, ao: false }); return q; }, r.int(0, 3)), s, side * (w + px), { y: keelY(w, px) + .6, yaw: r() * 6 }); }
    if (r() < .3) { const px = r.range(-w * .3, 4); kit.onTrack(kit.prop('stalactite', rr => { const q = new Parts(); q.add(rockCone(rr.range(1.2, 2), rr.range(3, 6), rr() * 9), strata(5, 3), { flat: true, ao: false }); return q; }, r.int(0, 3)), s, side * (w + px), { y: keelY(w, px) + .5, yaw: r() * 6 }); }
  }
}

export const gardens: CourseArt = {
  env: {
    sky: { top: '#4f9fee', horizon: '#e6ecfb', band: { color: '#fff1e2', height: .06, strength: .45 }, below: '#f4f2fc', sun: { color: '#fff2d6', size: .05, glow: .8 },
      clouds: { lit: '#ffffff', shade: '#d4d4f2', cover: .3, scale: .8 }, cumulus: { lit: '#ffffff', shade: '#cdc6ec', height: .24, amount: .75 } },
    fog: { color: '#e6ecfb', near: 170, far: 820 },
    hemi: { sky: '#eef4ff', ground: '#d6c8ee', intensity: 1.75 },
    sun: { color: '#fff3dc', intensity: 2.5, dir: [-.4, .72, .55] },
  },
  terrain: null,
  road: { kind: 'flagstone', palette: { base: '#e9dfcf', dark: '#a8977e', light: '#fbf6ec', accent: '#d8c8b0' } },
  start: { pillar: '#f4f0fa', trim: '#e2b85a', banner: '#5b74c8', text: '#fff6d0', light: '#bff4ff', flags: ['#c9a8ff', '#e2b85a', '#79ded8', '#ff9fd6'] },
  hazard: 'water',
  signs: { board: '#f6f2ff', arrow: '#5b74c8', post: '#c9a54e' },
  ambient: [
    { color: '#ffc2dc', endColor: '#ffffff', rate: 12, size: .2, life: 6, height: [1, 10], drift: [1.3, -.45, .5], wander: .6, shape: Shape.Shard, radius: 34, alpha: .95 },
    { color: '#c8f6ff', endColor: '#ffffff', rate: 10, size: .14, life: 3, glow: true, height: [.5, 8], wander: .3, shape: Shape.Star, radius: 30, alpha: .9 },
  ],
  catalog: {
    'Island (small)': r => island(r, 7), 'Island (large)': r => island(r, 16), 'Blossom tree': blossomTree, Cypress: cypress, Topiary: topiary, Hedge: hedge,
    Urn: () => { const p = new Parts(); urn(p, 0, 0, 1.2); return p; }, Gazebo: () => gazebo(), 'Moogle statue': moogleStatue, 'Floating crystal': floatCrystal, Roots: roots,
    'Ruined columns': () => { const p = new Parts(); for (let i = 0; i < 3; i++) column(p, (i - 1) * 2, 0, 3.5, .35, i === 1 ? 0 : .5); return p; }, 'Garden arch': () => gardenArch(11),
  },
  build(kit) {
    const r = kit.r, w = kit.w;
    makeLiquid(kit, { y: -46, deep: '#dcd7f4', shallow: '#ffffff', foam: '#fbfaff', sky: '#f2efff', scale: .3, speed: .6, swell: 1.2 });
    causeway(kit);
    decorateCauseway(kit);
    for (const f of [.18, .5, .78]) { let s = kit.len * f, best = s, low = 9; for (let k = -60; k <= 60; k += 6) { const c = Math.abs(kit.at(s + k).curve); if (c < low) { low = c; best = s + k; } } kit.onTrack(kit.prop('arch', () => gardenArch(w)), best, 0); s = best; }
    for (const side of [-1, 1]) kit.onTrack(kit.prop('moogle', moogleStatue), -34, side * (w + 3.6), { faceRoad: true });
    kit.onTrack(kit.prop('save', () => savePoint('#c8f6ff')), -52, -(w + 2.6));
    // Floating islands: low beside the road so the view stays open, freer further out.
    const placed: { x: number; z: number; R: number }[] = [], falls: { p: THREE.Vector3; dir: THREE.Vector3; w: number; L: number }[] = [];
    const { cx, cz, extent } = kit.bounds;
    for (let tries = 0; placed.length < 70 && tries < 2400; tries++) {
      const big = placed.length < 11, R = big ? r.range(17, 26) : r.range(6, 16), x = cx + (r() * 2 - 1) * (extent + 220), z = cz + (r() * 2 - 1) * (extent + 220), road = kit.road(x, z);
      if (road.d < w + 12 + R * 1.15 || (big && road.d > 170) || placed.some(q => Math.hypot(q.x - x, q.z - z) < q.R + R + 10)) continue;
      const near = road.d < R + 60, y = near ? road.y - r.range(5, 18) : road.y + r.range(-30, 28), yaw = r() * 6.28;
      kit.place(kit.prop(`island${big ? 'L' : 'S'}`, rr => island(rr, big ? 20 : 10), r.int(0, 3)), x, y, z, { yaw, scale: R / (big ? 20 : 10) });
      placed.push({ x, z, R });
      for (let k = 0; k < (big ? 2 : r() < .55 ? 1 : 0); k++) { const a = r() * 6.28, dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); falls.push({ p: new THREE.Vector3(x + dir.x * R * .96, y - .1, z + dir.z * R * .96), dir, w: R * .22 + 1, L: R * 4 + 25 }); }
    }
    // Thin streams spilling off the causeway's edge.
    for (let i = 0; i < 9; i++) { const s = (i + .5) / 9 * kit.len, side = i % 2 ? 1 : -1, p = kit.at(s, side * (w + 5.35)); falls.push({ p: new THREE.Vector3(p.x, p.y - .5, p.z), dir: new THREE.Vector3(p.nx * side, 0, p.nz * side), w: 1.6, L: 42 }); }
    // Sky castle across the cloud sea, with its own falls.
    const ca = 2.3, cr = extent + 330, castle = new THREE.Vector3(cx + Math.cos(ca) * cr, 40, cz + Math.sin(ca) * cr);
    kit.place(kit.prop('castle', skyCastle), castle.x, castle.y, castle.z, { yaw: .3 });
    for (const a of [ca + Math.PI + .5, ca + Math.PI - .7, ca + Math.PI + 1.6]) { const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); falls.push({ p: castle.clone().addScaledVector(dir, 44), dir, w: 9, L: 150 }); }
    waterfalls(kit, falls);
    rainbow(kit, new THREE.Vector3(cx + Math.cos(ca - .9) * (extent + 260), -40, cz + Math.sin(ca - .9) * (extent + 260)), -(ca - .9) + Math.PI / 2);
    hoveringCrystals(kit);
  },
};
