import * as THREE from 'three';
import { Parts, type Kit } from '../kit.ts';
import { fbm2, ridge2, smoothstep, type Rng } from '../noise.ts';
import { Shape } from '../../particles/particles.ts';
import { crystalCluster, boulder, block, prism, cone, cyl, bead, rbox, rock, lathe, tube, blob, grad, xf } from '../props/common.ts';
import type { CourseArt } from '../types.ts';

const C = {
  rock: '#4b3b56', rockDark: '#261d33', rockLight: '#75607e', floor: '#5b4a42', vein: '#56d6e6',
  wood: '#8a6544', woodDark: '#4f3828', woodLight: '#b48a5e', iron: '#5d6270', ironDark: '#363a45', rust: '#8a5a3c',
  warn: '#f0b52e', warnDark: '#2a2228', lamp: '#ffb85a', lampHot: '#ffe2a0',
  teal: '#7ff6ff', tealShell: '#1d7c94', violet: '#d99bff', violetShell: '#5b2d9c', ore: '#6a5a72',
};

/** Timber support frame spanning the road: twin posts, a double beam, knee braces and hanging lanterns. Beams sit above 12 m. */
function frame(w: number) {
  const p = new Parts(), x = w + 1.7, h = 12.6;
  for (const s of [-1, 1]) {
    p.add(block(.75, h + 1, .75, [s * x, 0, 0]), grad(C.woodDark, C.wood, 0, h), { flat: true, ao: [0, 1.5, .6] });
    p.add(block(1.2, .5, 1.2, [s * x, 0, 0]), C.ironDark, { ao: false });
    for (const y of [3, 7.5]) p.add(xf(new THREE.BoxGeometry(.85, .16, .85), [s * x, y, 0]), C.ironDark, { ao: false });
    // Knee brace from the post up to the beam, angled in over the road but well above the camera.
    p.add(xf(new THREE.BoxGeometry(.32, 3.6, .32), [s * (x - 1.2), h - 1.3, 0], [0, 0, s * .75]), C.wood, { flat: true, ao: false });
  }
  p.add(block(x * 2 + 1.6, .7, .8, [0, h, 0]), grad(C.woodDark, C.woodLight, h, h + .7), { flat: true, ao: false });
  p.add(block(x * 2 + 2.4, .45, .55, [0, h + .7, .15]), C.woodDark, { flat: true, ao: false });
  for (const bx of [-x * .55, 0, x * .55]) p.add(xf(new THREE.BoxGeometry(.9, .9, .12), [bx, h + .35, .42]), C.ironDark, { ao: false });
  for (const lx of [-x * .55, x * .55]) {
    p.add(cyl(.02, .02, .8, [lx, h - .4, 0], [0, 0, 0], 3), C.ironDark, { ao: false });
    p.add(cone(.36, .22, 6, [lx, h - .95, 0]), C.ironDark, { ao: false });
    p.add(prism(.22, .17, .48, 6, [lx, h - 1.45, 0]), C.lamp, { layer: 'glow', ao: false });
    p.add(cyl(.22, .22, .06, [lx, h - 1.48, 0], [0, 0, 0], 6), C.ironDark, { ao: false });
  }
  return p;
}

/** Roof planks for a tunnel: laid across the frames, seen from below as a dark timber ceiling. */
function tunnel(kit: Kit, s0: number, s1: number, spanClear: (s: number) => boolean) {
  const w = kit.w + 2.4;
  kit.extrude([[w, 13.3], [-w, 13.3]], { s0, s1, offset: 0, step: 1.1, mirror: false, paint: (_s, _k, i, out) => out.set(i % 3 === 0 ? C.woodDark : i % 2 ? C.wood : '#7a5a3e') });
  kit.extrude([[-w, 13.8], [w, 13.8]], { s0, s1, offset: 0, step: 4, mirror: false, paint: C.woodDark });
  for (let s = s0; s <= s1; s += 6) if (spanClear(s)) kit.onTrack(kit.prop('frame', () => frame(kit.w)), s, 0);
}

/** Squat ore cart on the side rails, heaped with ore and glowing mythril shards. */
function minecart(r: Rng, glow: string) {
  const p = new Parts();
  p.add(xf(new THREE.CylinderGeometry(1, .78, 1.05, 4, 1).rotateY(Math.PI / 4).translate(0, 1.05, 0), [0, 0, 0], [0, 0, 0], [1, 1, 1.45]), grad(C.ironDark, C.iron, .5, 1.6), { flat: true, ao: [.5, 1.2, .7] });
  p.add(xf(new THREE.BoxGeometry(1.5, .14, 2.12), [0, 1.6, 0]), C.rust, { ao: false });
  for (const z of [-.55, .55]) p.add(xf(new THREE.BoxGeometry(1.46, .12, .1), [0, 1.05, z * 1.6]), C.rust, { ao: false });
  for (const x of [-.62, .62]) for (const z of [-.6, .6]) { p.add(cyl(.3, .3, .14, [x, .32, z], [0, 0, Math.PI / 2], 10), C.ironDark, { ao: false }); p.add(cyl(.1, .1, .16, [x * 1.02, .32, z], [0, 0, Math.PI / 2], 6), C.rust, { ao: false }); }
  for (let i = 0; i < 5; i++) p.add(blob(r.range(.35, .5), [r.range(-.35, .35), 1.62, r.range(-.55, .55)], r() * 9, .3, 0), C.ore, { flat: true, ao: false });
  for (let i = 0; i < 4; i++) { const a = r() * 6.28; p.add(prism(0, .13, .55, 5, [Math.cos(a) * .35, 1.7, Math.sin(a) * .5], [Math.sin(a) * .5, 0, Math.cos(a) * .5]), glow, { layer: 'glow', ao: false, flat: true }); }
  return p;
}

/** Wooden scaffold tower with two platforms, cross braces, a ladder on the front and a lantern. */
function scaffold(r: Rng) {
  const p = new Parts(), H = r.range(7, 10), S = 1.6;
  for (const x of [-S, S]) for (const z of [-S, S]) p.add(block(.28, H, .28, [x, 0, z]), grad(C.woodDark, C.wood, 0, H), { flat: true });
  for (const y of [H * .45, H]) { p.add(block(S * 2 + .6, .18, S * 2 + .6, [0, y - .18, 0]), C.woodLight, { flat: true, ao: false }); for (const z of [-S, S]) p.add(xf(new THREE.BoxGeometry(S * 2 + .3, .1, .1), [0, y + .8, z]), C.woodDark, { ao: false }); }
  for (const [x, z, ry] of [[0, -S, 0], [-S, 0, Math.PI / 2], [S, 0, Math.PI / 2]] as const) for (const k of [-1, 1]) p.add(xf(new THREE.BoxGeometry(.14, Math.hypot(S * 2, H * .45) * .98, .14), [x, H * .225, z], [0, ry, k * Math.atan2(S * 2, H * .45)]), C.woodDark, { ao: false });
  for (const x of [-.32, .32]) p.add(xf(new THREE.BoxGeometry(.08, H + .9, .08), [x, (H + .9) / 2, S + .35]), C.wood, { ao: false });
  for (let y = .4; y < H; y += .45) p.add(xf(new THREE.BoxGeometry(.64, .06, .06), [0, y, S + .35]), C.woodLight, { ao: false });
  p.add(prism(.18, .14, .38, 6, [S - .2, H + .05, S - .2]), C.lamp, { layer: 'glow', ao: false }); p.add(cone(.28, .2, 6, [S - .2, H + .43, S - .2]), C.ironDark, { ao: false });
  p.add(block(.9, .7, .9, [-.6, H, -.6]), C.woodDark, { flat: true, ao: false });
  return p;
}

/** Heap of ore with a few glinting mythril pieces. */
function orePile(r: Rng) {
  const p = new Parts(), n = r.int(5, 8);
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = i ? r.range(.5, 1.5) : 0, s = i ? r.range(.5, .9) : 1.2; p.add(rock([s, s * .7, s], [Math.cos(a) * d, s * .35, Math.sin(a) * d], r() * 99), r() < .5 ? C.ore : C.rockLight, { flat: true, ao: [0, .6, .6] }); }
  for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = r.range(.2, 1.4); p.add(bead(r.range(.1, .18), [Math.cos(a) * d, r.range(.3, 1), Math.sin(a) * d]), r() < .5 ? C.teal : C.violet, { layer: 'glow', ao: false }); }
  return p;
}

/** Stalagmite group: knobbly lathe spires in rock strata. */
function stalagmite(r: Rng) {
  const p = new Parts(), n = r.int(1, 3);
  for (let i = 0; i < n; i++) {
    const h = r.range(3, 7) * (i ? .55 : 1), R = h * .2, a = r() * 6.28, d = i ? r.range(1, 2) : 0;
    p.add(lathe([[R * 1.2, 0], [R, h * .2], [R * .82, h * .3], [R * .78, h * .5], [R * .5, h * .62], [R * .42, h * .8], [R * .12, h * .95], [0, h]], [Math.cos(a) * d, 0, Math.sin(a) * d], [0, r() * 6, 0], 7), grad(C.rockDark, C.rockLight, 0, h), { flat: true, ao: [0, 1.4, .6] });
  }
  return p;
}

/** Hanging rock spire, origin at its root high above, with a crystal glint at the tip. */
function stalactite(r: Rng) {
  const p = new Parts(), L = r.range(14, 34), R = L * .14;
  p.add(lathe([[0, -L], [R * .2, -L * .9], [R * .5, -L * .65], [R * .7, -L * .4], [R, -L * .1], [R * 1.4, 0]], [0, 0, 0], [0, r() * 6, 0], 7), grad(C.rock, C.rockDark, -L, 0), { flat: true, ao: false });
  p.add(xf(new THREE.OctahedronGeometry(R * .32), [0, -L - R * .1, 0], [0, 0, 0], [1, 1.8, 1]), r() < .5 ? C.teal : C.violet, { layer: 'glow', ao: false });
  return p;
}

/** Barrier post with a cap and, on some posts, a small warm lantern. */
function railPost(lantern: boolean) {
  const p = new Parts();
  p.add(block(.32, 1.5, .32), grad(C.woodDark, C.wood, 0, 1.5), { flat: true }); p.add(cone(.26, .3, 4, [0, 1.5, 0], [0, Math.PI / 4, 0]), C.woodDark, { flat: true, ao: false });
  if (lantern) { p.add(cyl(.015, .015, .9, [0, 2.2, 0], [0, 0, 0], 3), C.ironDark, { ao: false }); p.add(prism(.16, .12, .34, 6, [0, 2.65, 0]), C.lamp, { layer: 'glow', ao: false }); p.add(cone(.24, .18, 6, [0, 2.99, 0]), C.ironDark, { ao: false }); p.add(tube([[0, 1.5, 0], [0, 2.2, 0], [-.25, 2.75, 0], [0, 3.2, 0]], .04, 4), C.ironDark, { ao: false }); }
  return p;
}

function crates(r: Rng) {
  const p = new Parts(), n = r.int(2, 4);
  for (let i = 0; i < n; i++) {
    const s = r.range(.8, 1.1), x = (i % 2) * 1.1 - .5, y = i > 1 ? 1 : 0, z = r.range(-.2, .2);
    p.add(rbox(s, s, s, .04, [x, y + s / 2, z], [0, r.range(-.3, .3), 0]), C.woodLight, { ao: [0, .5, .7] });
    p.add(rbox(s + .04, s * .14, s + .04, .02, [x, y + s * .5, z], [0, 0, 0]), C.woodDark, { ao: false });
  }
  const bx = 1.5;
  p.add(lathe([[.38, 0], [.46, .45], [.38, .9], [0, .9]], [bx, 0, .4], [0, 0, 0], 10), C.wood); for (const y of [.15, .75]) p.add(cyl(.43, .43, .06, [bx, y, .4], [0, 0, 0], 10), C.ironDark, { ao: false });
  return p;
}

/** Natural stone arch over the road, its underside studded with glowing crystals. Inner edge stays above 12 m over the barriers. */
function geodeArch(r: Rng, w: number) {
  const p = new Parts(), R = w + 9, n = 17;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI, x = Math.cos(a) * R, y = Math.sin(a) * R * .95, s = r.range(2.8, 3.8);
    p.add(rock([s, s * .9, s * 1.3], [x, y + 1, r.range(-.5, .5)], r() * 99, [r(), r(), r()]), grad(C.rockDark, C.rock, 0, R), { flat: true, ao: false });
    if (i > 1 && i < n - 1) for (let k = 0; k < 2; k++) {
      const len = r.range(1.4, 3), ox = -Math.cos(a), oy = -Math.sin(a), px = x + ox * (s * .55), py = y + 1 + oy * (s * .55), core = r() < .5 ? C.teal : C.violet;
      p.add(xf(new THREE.CylinderGeometry(0, .32, len, 6).translate(0, len / 2, 0), [px, py, r.range(-1.6, 1.6)], [0, 0, a + Math.PI / 2 + r.range(-.4, .4)]), core, { layer: 'glow', flat: true, ao: false });
    }
  }
  return p;
}

export const mines: CourseArt = {
  env: {
    sky: { top: '#0b0819', horizon: '#3a2852', below: '#2a1d3c', band: { color: '#4a3070', height: .25, strength: .6 }, stars: 2.4, aurora: '#2fc8c0' },
    fog: { color: '#3a2852', near: 70, far: 400 },
    hemi: { sky: '#a596e8', ground: '#2c2238', intensity: 1.45 },
    sun: { color: '#b9d6ff', intensity: 1.9, dir: [-.35, .88, .3] },
    mountains: [
      { color: '#1c1428', radius: 640, height: 330, rough: .9, haze: .28, seed: 4 },
      { color: '#2a1e3a', radius: 500, height: 220, rough: .8, haze: .35, seed: 9 },
    ],
  },
  terrain: {
    height(p) {
      const shelf = p.w + 10, k = smoothstep(shelf, shelf + 20, p.d), far = smoothstep(70, 220, p.d);
      const wall = 16 + ridge2(p.x / 60, p.z / 60, 4, 11) * 30 + fbm2(p.x / 25, p.z / 25, 3, 7) * 10 + far * 45;
      return p.roadY - .06 + k * wall;
    },
    color(p, h, slope, out) {
      const strata = Math.sin(h * .9 + fbm2(p.x * .05, p.z * .05, 2, 3) * 6) * .5 + .5;
      out.set(C.rock).lerp(new THREE.Color(C.rockLight), strata * .35).lerp(new THREE.Color(C.rockDark), smoothstep(.5, 1.2, slope) * .45);
      out.lerp(new THREE.Color(C.floor), smoothstep(p.w + 12, p.w + 6, p.d) * .9);
    },
    detail: 'rock',
  },
  road: { kind: 'planks', palette: { base: '#8f6a4a', dark: '#4a3424', light: '#b9916a' } },
  start: { pillar: '#5a3f2c', trim: '#c9a35a', banner: '#2b1f4c', text: '#8ff6ff', light: '#8ff6ff', flags: ['#7ff6ff', '#b07aff', '#f0b52e', '#5a3fa0'] },
  hazard: 'ink',
  signs: { board: '#f0c548', arrow: '#2a1f2e', post: '#4f3828' },
  ambient: [
    { color: '#cbb9f0', rate: 14, size: .09, life: 6, height: [.5, 9], wander: .25, drift: [.15, .05, 0], radius: 32, alpha: .45 },
    { color: '#a8fbff', endColor: '#c48bff', rate: 9, size: .32, life: 2.2, glow: true, shape: Shape.Star, height: [.5, 6], wander: .3, drift: [0, .25, 0], radius: 28, alpha: .9 },
  ],
  catalog: {
    'Support frame': () => frame(10.5), 'Crystal (teal)': r => crystalCluster(r, C.teal, C.tealShell, 1.2, C.rock), 'Crystal (violet)': r => crystalCluster(r, C.violet, C.violetShell, 1.2, C.rock),
    Minecart: r => minecart(r, C.teal), Scaffold: scaffold, 'Ore pile': orePile, Stalagmite: stalagmite, Stalactite: stalactite, 'Rail post': () => railPost(true), Crates: crates,
    Boulder: r => boulder(r, C.rockLight, 1.4), 'Geode arch': r => geodeArch(r, 10.5),
  },
  build(kit) {
    const r = kit.r, w = kit.w, len = kit.len;
    const clear = (s: number, off: number, margin: number) => { const p = kit.at(s, off); return kit.road(p.x, p.z).d > w + margin; };
    // A spanning structure fits only where every point across it is as far from the road as its own offset says.
    const spanClear = (s: number) => [-1, 1].every(side => [0, 2, 4, 6, 8, 10, 12, 13.5].every(o => { const p = kit.at(s, side * o); return kit.road(p.x, p.z).d > o - 1.2; }));

    // Barrier: kickboard, a hazard-striped top rail and posts, inner face on the physical wall at w + 0.7.
    // Pieces on the inside of the tightest hairpins would fold back over the road, so those are left out.
    const kick: [number, number][] = [[.62, 0], [.62, .32], [.86, .32], [.86, 0]], rail: [number, number][] = [[.64, .78], [.64, 1.12], [.86, 1.12], [.86, .78], [.64, .78]];
    const flip = (pr: [number, number][]) => pr.map(([x, y]) => [-x, y] as [number, number]).reverse();
    for (const side of [-1, 1]) for (let s = 0; s < len; s += 8) {
      if (![0, 4, 8].every(d => clear(s + d, side * (w + .8), .4))) continue;
      kit.extrude(side > 0 ? kick : flip(kick), { s0: s, s1: s + 8, offset: side * w, mirror: false, step: 2, paint: (_s, k, i, out) => out.set((side > 0 ? k === 0 : k === kick.length - 2) ? (i % 2 ? C.wood : '#7d5c3e') : C.woodDark) });
      kit.extrude(side > 0 ? rail : flip(rail), { s0: s, s1: s + 8, offset: side * w, mirror: false, step: 1.5, paint: (_s, k, i, out) => { const kk = side > 0 ? k : rail.length - 2 - k; out.set(kk === 0 ? (i % 2 ? C.warn : C.warnDark) : kk === 1 ? C.woodLight : C.woodDark); } });
    }
    for (let s = 0, i = 0; s < len; s += 4, i++) for (const side of [-1, 1]) if (clear(s, side * (w + 1.02), .6)) { const lamp = i % 5 === (side > 0 ? 0 : 2); kit.onTrack(kit.prop(lamp ? 'post lamp' : 'post', () => railPost(lamp)), s, side * (w + 1.02)); }

    // Minecart rails on the shelf, in pieces that stop wherever another section of road comes close.
    for (const side of [-1, 1]) for (let s = 0; s < len; s += 16) {
      if (![0, 8, 16].every(d => clear(s + d, side * (w + 5), 4.5))) continue;
      // Positive offsets sweep the profile outward; on the left the profile runs mirrored so faces still point out.
      for (const x of [3.7, 5.15]) kit.extrude(side > 0 ? [[x, .12], [x, .3], [x + .15, .3], [x + .15, .12]] : [[-x - .15, .3], [-x - .15, .12], [-x, .12], [-x, .3]], { s0: s, s1: s + 16, offset: side * w, mirror: false, step: 2, paint: C.iron });
      for (let k = 0; k < 16; k += 1.4) kit.onTrack(kit.prop('sleeper', () => new Parts().add(block(2.3, .14, .42), (_x, _y, _z, out) => out.set(C.woodDark), { ao: false })), s + k, side * (w + 4.5), { yaw: Math.PI / 2 });
      if (r() < .3) { const n = r.int(1, 3); for (let c = 0; c < n; c++) kit.onTrack(kit.prop('cart', rr => minecart(rr, rr() < .5 ? C.teal : C.violet), r.int(0, 3)), s + 4 + c * 2.6, side * (w + 4.5)); }
    }

    // Timber frames over the road, with three timbered tunnel sections.
    const tunnels = [[len * .12, len * .12 + 36], [len * .38, len * .38 + 48], [len * .74, len * .74 + 40]];
    for (const [a, b] of tunnels) tunnel(kit, a, b, spanClear);
    for (let s = 40; s < len - 10; s += 44) if (!tunnels.some(([a, b]) => s > a - 10 && s < b + 10) && spanClear(s)) kit.onTrack(kit.prop('frame', () => frame(w)), s, 0);

    // The geode: giant crystals leaning in from both sides and two stone arches.
    const g0 = len * .52, g1 = g0 + 110;
    for (let s = g0; s < g1; s += r.range(6, 11)) for (const side of [-1, 1]) {
      const off = side * (w + r.range(7, 14)); if (!clear(s, off, Math.abs(off) - w - 3)) continue;
      const teal = r() < .5;
      kit.onTrack(kit.prop(teal ? 'giant teal' : 'giant violet', rr => crystalCluster(rr, teal ? C.teal : C.violet, teal ? C.tealShell : C.violetShell, 1, C.rock), r.int(0, 2)), s, off, { onGround: true, faceRoad: true, scale: r.range(3, 5.5), tilt: [r.range(.15, .4), 0] });
    }
    for (const s of [g0 + 25, g0 + 80]) if (spanClear(s)) kit.onTrack(kit.prop('geode arch', rr => geodeArch(rr, w), s > g0 + 50 ? 1 : 0), s, 0);

    // Trackside dressing on the shelf.
    for (let s = 20; s < len - 10; s += r.range(9, 16)) {
      const side = r.sign(), k = r(), tall = k >= .6 && k < .72, off = side * (tall ? w + 10.5 : w + r.range(7.5, 9.5)); if (!clear(s, off, Math.abs(off) - w - (tall ? 4.5 : 2.5))) continue;
      if (k < .3) kit.onTrack(kit.prop('crystal', rr => crystalCluster(rr, rr() < .5 ? C.teal : C.violet, rr() < .5 ? C.tealShell : C.violetShell, 1.1, C.rock), r.int(0, 5)), s, off, { onGround: true, yaw: r() * 6, scale: r.range(.9, 1.6) });
      else if (k < .45) kit.onTrack(kit.prop('ore', orePile, r.int(0, 3)), s, off, { onGround: true, yaw: r() * 6 });
      else if (k < .6) kit.onTrack(kit.prop('crates', crates, r.int(0, 3)), s, off, { onGround: true, faceRoad: true });
      else if (tall) kit.onTrack(kit.prop('scaffold', scaffold, r.int(0, 2)), s, off, { onGround: true, faceRoad: true });
      else kit.onTrack(kit.prop('stalagmite', stalagmite, r.int(0, 4)), s, off, { onGround: true, yaw: r() * 6 });
    }
    // Canyon walls: stalagmites, boulders and crystal seams climbing the slopes.
    kit.scatter(260, w + 24, 120, (x, z) => {
      const y = kit.groundAt(x, z), k = r();
      if (k < .45) kit.place(kit.prop('stalagmite', stalagmite, r.int(0, 4)), x, y - .5, z, { yaw: r() * 6, scale: r.range(1.2, 2.6) });
      else if (k < .75) kit.place(kit.prop('crystal', rr => crystalCluster(rr, rr() < .5 ? C.teal : C.violet, rr() < .5 ? C.tealShell : C.violetShell, 1.1, C.rock), r.int(0, 5)), x, y - .3, z, { yaw: r() * 6, scale: r.range(1.5, 3.5), tilt: [r.range(-.3, .3), r.range(-.3, .3)] });
      else kit.place(kit.prop('boulder', rr => boulder(rr, C.rockLight, 1.6), r.int(0, 3)), x, y - .4, z, { yaw: r() * 6, scale: r.range(1, 2.5) });
    });
    // The cavern ceiling: hanging spires and pinpricks of crystal light high above.
    kit.scatter(170, 0, 260, (x, z) => { const y = kit.road(x, z).y + r.range(62, 95); kit.place(kit.prop('stalactite', stalactite, r.int(0, 5)), x, y, z, { yaw: r() * 6, scale: r.range(.8, 1.4) }); });
    kit.scatter(420, 0, 300, (x, z) => { const y = kit.road(x, z).y + r.range(55, 110); kit.place(kit.prop('ceiling glint', () => new Parts().add(xf(new THREE.OctahedronGeometry(.7)), C.teal, { layer: 'glow', ao: false }).add(xf(new THREE.OctahedronGeometry(.55), [2, -.6, 1]), C.violet, { layer: 'glow', ao: false })), x, y, z, { yaw: r() * 6, scale: r.range(.6, 1.6) }); });
  },
};
