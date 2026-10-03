import * as THREE from 'three';
import { Parts, type Kit } from '../kit.ts';
import { hills } from '../terrain.ts';
import { fbm2, hash2, smoothstep, type Rng } from '../noise.ts';
import { Shape } from '../../particles/particles.ts';
import { arch } from '../props/shapes.ts';
import { banner, brazier, flagPole, bunting, block, prism, cone, cyl, bead, disc, ellipsoid, rbox, rock, torus, lathe, sweep, grad, xf } from '../props/common.ts';
import type { CourseArt } from '../types.ts';

const C = {
  sand: '#e4bf82', sandLight: '#f2d6a0', sandDark: '#c99a5e', plaza: '#cdb084', plazaDark: '#b39265',
  stone: '#dcc292', stoneLight: '#efdcb2', stoneDark: '#b0895a', carve: '#9e7a4e', shadow: '#8a6844',
  purple: '#5b3a8e', purpleLight: '#8a5cc8', gold: '#e8b443', goldLight: '#ffd877', rune: '#b98cff', runeHot: '#e6d2ff',
  palm: '#8a6a44', palmDark: '#6a4c30', frond: '#5f9a3a', frondLight: '#9cc957', clay: '#c4724a', flame: '#ffb347',
};

/** Sandstone that varies block to block, so long surfaces read as masonry. */
const masonry = (base: string, k = .08) => { const c = new THREE.Color(base); return (x: number, y: number, z: number, out: THREE.Color) => { const v = 1 + (hash2(Math.floor(x / 1.1 + 100), Math.floor(y / .55 + 100) * 7 + Math.floor(z / 1.1 + 100), 3) - .5) * 2 * k; out.copy(c).multiplyScalar(v); }; };

/** Fluted column: plinth, base moulding, faceted shaft and a flared capital. `broken` snaps the shaft off. */
function addColumn(p: Parts, r: Rng, x: number, y: number, h = 7, broken = false) {
  const R = .55, shaft = broken ? h * r.range(.3, .6) : h, t = (g: THREE.BufferGeometry) => g.translate(x, y, 0);
  p.add(t(block(1.5, .5, 1.5)), C.stoneDark, { flat: true, ao: [y, y + .5, .65] });
  p.add(t(lathe([[R * 1.3, .5], [R * 1.3, .65], [R * 1.12, .8], [R, .9]], [0, 0, 0], [0, 0, 0], 12)), C.stone, { ao: false });
  p.add(t(prism(R * .9, R, shaft - .9, 12, [0, .9, 0])), grad(C.stoneDark, C.stoneLight, y, y + h), { flat: true, ao: [y, y + 1.5, .7] });
  if (broken) p.add(t(rock([R * 1.05, .45, R * 1.05], [0, shaft, 0], r() * 9)), C.stone, { flat: true, ao: false });
  else {
    p.add(t(lathe([[R * .9, h], [R * 1.15, h + .3], [R * 1.4, h + .55], [0, h + .55]], [0, 0, 0], [0, 0, 0], 12)), C.stoneLight, { ao: false });
    p.add(t(block(1.6, .35, 1.6, [0, h + .55, 0])), C.stone, { flat: true, ao: false });
  }
  return p;
}
const column = (r: Rng, h = 7, broken = false) => addColumn(new Parts(), r, 0, 0, h, broken);

/** Row of columns under a carved lintel; ruined rows lose columns and the lintel ends. */
function colonnade(r: Rng, n = 4, ruined = false) {
  const p = new Parts(), gap = 3.4, h = 7, L = (n - 1) * gap;
  p.add(block(L + 3, .6, 2.6, [0, 0, 0]), C.plazaDark, { flat: true, ao: [0, .6, .7] });
  for (let i = 0; i < n; i++) {
    addColumn(p, r, -L / 2 + i * gap, .6, h, ruined && r() < .45);
  }
  if (!ruined || r() < .6) {
    const span = ruined ? L * r.range(.5, .8) : L + 1.6, x0 = ruined ? -L / 2 - .8 + r() * (L + 1.6 - span) : -(L + 1.6) / 2;
    p.add(block(span, .9, 1.7, [x0 + span / 2, h + 1.5, 0]), masonry(C.stone), { flat: true, ao: false });
    p.add(block(span, .3, 1.9, [x0 + span / 2, h + 2.4, 0]), C.stoneLight, { flat: true, ao: false });
    p.add(block(span, .22, 1.75, [x0 + span / 2, h + 1.95, .01]), C.purple, { ao: false });
  }
  return p;
}

/** Obelisk on a stepped plinth, with rune columns glowing on all four faces and a gold cap. */
function obelisk(r: Rng, h = 13) {
  const p = new Parts();
  p.add(block(3.2, .6, 3.2), C.stoneDark, { flat: true, ao: [0, .6, .6] }); p.add(block(2.4, .6, 2.4, [0, .6, 0]), C.stone, { flat: true, ao: false });
  p.add(xf(new THREE.CylinderGeometry(.62, .95, h, 4).translate(0, h / 2 + 1.2, 0), [0, 0, 0], [0, Math.PI / 4, 0]), grad(C.stoneDark, C.stoneLight, 1.2, h), { flat: true, ao: false });
  p.add(xf(new THREE.ConeGeometry(.88, 1.6, 4).translate(0, h + 2, 0), [0, 0, 0], [0, Math.PI / 4, 0]), C.gold, { flat: true, ao: false });
  for (let f = 0; f < 4; f++) {
    const a = f * Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const y = 2.6 + i * (h - 3.2) / 6, t = (y - 1.2) / h, rr = .95 - .33 * t + .02, sz = .4 - t * .12;
      p.add(xf(new THREE.BoxGeometry(sz * (i % 2 ? .6 : 1), sz * .7, .05), [Math.sin(a) * rr, y, Math.cos(a) * rr], [0, a, 0]), i === 2 ? C.runeHot : C.rune, { layer: 'glow', ao: false });
    }
  }
  void r; return p;
}

/** Date palm: ringed, gently curved trunk and a crown of drooping fronds. */
function palm(r: Rng) {
  const p = new Parts(), h = r.range(7, 10), lean = r.range(.6, 1.8), top: [number, number, number] = [lean, h, 0];
  const trunk = sweep([[0, 0, 0], [lean * .15, h * .5, 0], top], t => .38 - t * .14, { radial: 7, segments: 10 });
  p.add(trunk, (x, y, z, out) => out.set(Math.floor(y / .45) % 2 ? C.palm : C.palmDark), { ao: [0, 1, .6] });
  const n = r.int(8, 10);
  for (let i = 0; i < n; i++) {
    const yaw = i / n * 6.28 + r() * .3, len = r.range(3.4, 4.6), pitch = r.range(.25, .7), droop = r.range(1.3, 2.1), W = .7;
    const g = new THREE.PlaneGeometry(W, len, 2, 8), a = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < a.count; k++) {
      const t = a.getY(k) / len + .5, x = a.getX(k) * (1 - t * .75) * (1 + (k % 3 === 0 ? .25 : 0)), fwd = t * len * .92, up = Math.sin(pitch) * t * len - droop * t * t * 1.4;
      const fold = Math.abs(x) * .45;
      a.setXYZ(k, Math.cos(yaw) * x + Math.sin(yaw) * fwd, h + up + fold, -Math.sin(yaw) * x + Math.cos(yaw) * fwd);
    }
    g.translate(lean, 0, 0); g.computeVertexNormals();
    p.add(g, grad(C.frond, C.frondLight, h - 1.5, h + 1), { layer: 'foliage', sway: 0, ao: false });
    const fg = p.layers.get('foliage')!.at(-1)!, sw = fg.attributes.sway as THREE.BufferAttribute, gp = fg.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < sw.count; k++) sw.setX(k, Math.min(1, Math.hypot(gp.getX(k) - lean, gp.getZ(k)) / len) * .45);
  }
  for (let i = 0; i < 4; i++) { const a = r() * 6.28; p.add(bead(.18, [lean + Math.cos(a) * .35, h - .3, Math.sin(a) * .35]), '#7a5a2a', { ao: false }); }
  return p;
}

/** Guardian sphinx: an original lion-bodied sentinel with a striped headdress and a glowing brow gem. Faces +z. */
function sphinx(r: Rng) {
  const p = new Parts(), s = masonry(C.stone, .05);
  p.add(block(4.4, 1.2, 8, [0, 0, -.6]), C.stoneDark, { flat: true, ao: [0, 1.2, .6] });
  p.add(block(4.8, .25, 8.4, [0, 1.2, -.6]), C.stoneLight, { flat: true, ao: false });
  p.add(rbox(3, 2.1, 5.6, .6, [0, 2.45, -1.2]), s, { ao: [1.4, 3, .75] });
  for (const x of [-1, 1]) { p.add(rbox(.9, .8, 3, .3, [x * .95, 1.85, 2.4]), s, { ao: false }); p.add(rbox(1, .9, 2.2, .35, [x * 1.1, 2.1, -3.2]), s, { ao: false }); }
  p.add(rbox(2.4, 2.6, 2.2, .5, [0, 3.8, 1.2]), s, { ao: false });
  p.add(rbox(1.5, 1.8, 1.6, .35, [0, 5.6, 1.6]), C.stone, { ao: false });
  // Headdress: flared side lappets and a striped hood.
  p.add(xf(new THREE.CylinderGeometry(.95, 1.55, 2.2, 4, 1).translate(0, 5.5, 1.3), [0, 0, 0], [0, Math.PI / 4, 0]), (x, y, z, out) => out.set(Math.floor(y / .28) % 2 ? C.gold : C.purple), { flat: true, ao: false });
  p.add(rbox(1.2, .45, .2, .08, [0, 5.2, 2.42]), C.carve, { ao: false });
  p.add(bead(.18, [0, 6.2, 2.45]), C.runeHot, { layer: 'glow', ao: false });
  p.add(sweep([[0, 2.2, -3.8], [.8, 1.6, -4.3], [1.4, 1.5, -3.4]], .18, { radial: 5, segments: 6 }), s, { ao: false });
  void r; return p;
}

/** Ruined house: thick walls with a doorway, a half-fallen flat roof, a parapet and a purple awning. Faces +z. */
function ruin(r: Rng) {
  const p = new Parts(), W = r.range(7, 11), D = r.range(6, 9), H = r.range(4.5, 7), s = masonry(r() < .5 ? C.stone : C.plaza);
  p.add(block(W, H, .8, [0, 0, -D / 2]), s, { flat: true, ao: [0, 1.5, .65] });
  for (const x of [-1, 1]) p.add(block(.8, H * r.range(.6, 1), D, [x * (W / 2 - .4), 0, 0]), s, { flat: true, ao: [0, 1.5, .65] });
  const door = 2.2, side = (W - door) / 2;
  for (const x of [-1, 1]) p.add(block(side, H, .8, [x * (door / 2 + side / 2), 0, D / 2]), s, { flat: true, ao: [0, 1.5, .65] });
  p.add(block(door + .6, .6, 1, [0, H - .6 > 3.4 ? 3.4 : H - .6, D / 2]), C.stoneDark, { flat: true, ao: false });
  p.add(block(W, .4, D * r.range(.4, .7), [0, H, -D * .2]), C.stoneDark, { flat: true, ao: false });
  for (let i = 0; i < Math.floor(W / 1.4); i++) if (r() < .7) p.add(block(.7, .6, .7, [-W / 2 + .5 + i * 1.4, H + .4, -D / 2]), s, { flat: true, ao: false });
  if (r() < .7) { const g = new THREE.PlaneGeometry(door + 1.6, 1.8, 6, 2).rotateX(-Math.PI / 2.6).translate(0, 3.7, D / 2 + .9); p.add(g, (x, y, z, out) => out.set(Math.floor((x + 5) / .55) % 2 ? C.purple : C.goldLight), { layer: 'foliage', sway: .08, ao: false }); }
  for (let i = 0; i < 4; i++) p.add(rock([r.range(.4, .9), r.range(.3, .6), r.range(.4, .8)], [r.range(-W / 2, W / 2), .2, D / 2 + r.range(.8, 2.5)], r() * 9), C.stone, { flat: true, ao: [0, .4, .7] });
  return p;
}

/** Clay urns and amphorae, some tipped over. */
function urns(r: Rng) {
  const p = new Parts();
  for (let i = 0; i < r.int(2, 4); i++) {
    const h = r.range(.8, 1.3), x = r.range(-.9, .9), z = r.range(-.9, .9), tipped = r() < .25;
    const g = lathe([[.05, 0], [.32, .1], [.42, h * .45], [.24, h * .85], [.18, h * .95], [.26, h]], [0, 0, 0], [0, 0, 0], 9);
    if (tipped) g.rotateZ(Math.PI / 2).translate(h / 2, .38, 0);
    p.add(g.translate(x, 0, z), (_px, py, _pz, out) => out.set(Math.abs(py - h * .5) < .08 && !tipped ? C.purple : C.clay), { ao: [0, .4, .7] });
  }
  return p;
}

function rubble(r: Rng, size = 1) {
  const p = new Parts();
  for (let i = 0; i < r.int(4, 7); i++) p.add(rock([r.range(.35, .9) * size, r.range(.25, .6) * size, r.range(.35, .8) * size], [r.range(-1.6, 1.6) * size, .15 * size, r.range(-1.6, 1.6) * size], r() * 9, [0, r() * 6, 0]), i % 3 ? C.stone : C.stoneDark, { flat: true, ao: [0, .4 * size, .65] });
  if (r() < .6) p.add(xf(new THREE.CylinderGeometry(.55 * size, .55 * size, 1.1 * size, 12).rotateZ(Math.PI / 2), [r.range(-1, 1) * size, .55 * size, r.range(-1, 1) * size], [0, r() * 6, 0]), C.stone, { flat: true, ao: [0, .5, .7] });
  return p;
}

/** Wall pilaster with a brazier on top, set into the inner face of the course wall. Faces +z. */
function pilaster() {
  const p = new Parts();
  p.add(block(1.5, 4.2, .6, [0, 0, -.1]), masonry(C.stone), { flat: true, ao: [0, 1, .7] });
  p.add(block(1.8, .35, .9, [0, 4.2, 0]), C.stoneLight, { flat: true, ao: false });
  p.add(xf(new THREE.CircleGeometry(.45, 8), [0, 2.7, .21]), C.gold, { ao: false });
  p.add(xf(new THREE.CircleGeometry(.26, 6), [0, 2.7, .23]), C.rune, { layer: 'glow', ao: false });
  return p;
}

/** The Ancient Gate: a towering arch over the road between two pylons, crowned by a carved crest ringed with runes. */
function ancientGate(w: number) {
  const p = new Parts(), span = (w + 2.2) * 2, thick = 4.2, H = 21, depth = 6, s = masonry(C.stone, .06);
  p.add(arch(span, H, thick, depth, true, 14), s, { flat: true, ao: [0, 3, .65] });
  const ox = span / 2 + thick;
  for (const x of [-1, 1]) {
    const cx = x * (ox + 2.2);
    p.add(block(5.6, 27, 8, [cx, 0, 0]), s, { flat: true, ao: [0, 3, .6] });
    p.add(block(6.4, 1.2, 8.8, [cx, 27, 0]), C.stoneLight, { flat: true, ao: false });
    p.add(xf(new THREE.CylinderGeometry(.4, 3.4, 5, 4).translate(0, 30.7, 0), [cx, 0, 0], [0, Math.PI / 4, 0]), C.gold, { flat: true, ao: false });
    p.add(block(6, 1.6, 8.6, [cx, 0, 0]), C.stoneDark, { flat: true, ao: false });
    for (const z of [-1, 1]) {
      for (let i = 0; i < 7; i++) p.add(xf(new THREE.BoxGeometry(.5, .5, .06), [cx, 7 + i * 2.6, z * 4.04]), i % 2 ? C.rune : C.runeHot, { layer: 'glow', ao: false });
      p.add(block(5.7, .5, .2, [cx, 5.2, z * 4.05]), C.carve, { ao: false }); p.add(block(5.7, .5, .2, [cx, 25.4, z * 4.05]), C.carve, { ao: false });
    }
  }
  // Attic over the arch and the crest medallion, front and back.
  const attic = H + 1.2;
  p.add(block(span + thick * 2, 4, depth + .4, [0, H - 1.8, 0]), s, { flat: true, ao: false });
  p.add(block(span + thick * 2 + .8, .7, depth + 1, [0, attic + .8, 0]), C.stoneLight, { flat: true, ao: false });
  for (let i = 0; i < 11; i++) p.add(block(1.3, 1.2, depth * .7, [-(span / 2 + thick) + .7 + i * (span + thick * 2 - 1.4) / 10, attic + 1.5, 0]), s, { flat: true, ao: false });
  for (const z of [-1, 1]) {
    const f = z * (depth / 2 + .25), cy = H + 4.6;
    p.add(xf(new THREE.CircleGeometry(4.2, 24), [0, cy, f], [0, z < 0 ? Math.PI : 0, 0]), C.stoneDark, { ao: false });
    p.add(torus(4.2, .35, [0, cy, f], [0, 0, 0]), C.gold, { ao: false });
    p.add(torus(3.2, .12, [0, cy, f + z * .1], [0, 0, 0]), C.rune, { layer: 'glow', ao: false });
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; p.add(xf(new THREE.BoxGeometry(.42, .7, .08), [Math.cos(a) * 3.7, cy + Math.sin(a) * 3.7, f + z * .12], [0, 0, a]), C.runeHot, { layer: 'glow', ao: false }); }
    // Crest: a winged crystal emblem.
    p.add(xf(new THREE.OctahedronGeometry(1.4).scale(.8, 1.5, .3), [0, cy, f + z * .3]), C.runeHot, { layer: 'glow', ao: false, flat: true });
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) p.add(xf(new THREE.BoxGeometry(2.2 - k * .5, .38, .12), [sx * (1.9 + k * .15), cy + .9 - k * .7, f + z * .2], [0, 0, sx * (.35 + k * .15)]), C.gold, { ao: false });
    p.add(block(span * .8, .45, .25, [0, H - 3.2, f]), C.purple, { ao: false });
  }
  return p;
}

/** Step pyramid on the horizon with a glowing shrine on top. */
function ziggurat() {
  const p = new Parts(), s = masonry(C.stone, .05), tiers = 6;
  for (let i = 0; i < tiers; i++) { const W = 80 - i * 12, h = 7; p.add(block(W, h, W, [0, i * h, 0]), i % 2 ? s : masonry(C.stoneDark, .05), { flat: true, ao: i ? false : [0, 6, .7] }); }
  for (let i = 0; i < 21; i++) p.add(block(10, 2, 3, [0, i * 2, 40 - i * 2.85]), C.stoneLight, { flat: true, ao: false });
  p.add(block(14, 9, 14, [0, tiers * 7, 0]), C.stoneLight, { flat: true, ao: false });
  p.add(xf(new THREE.CylinderGeometry(0, 9.5, 7, 4).translate(0, tiers * 7 + 12.5, 0), [0, 0, 0], [0, Math.PI / 4, 0]), C.gold, { flat: true, ao: false });
  p.add(xf(new THREE.OctahedronGeometry(3).scale(1, 1.8, 1), [0, tiers * 7 + 22, 0]), C.runeHot, { layer: 'glow', ao: false, flat: true });
  p.add(block(5, 6, .4, [0, tiers * 7, 7.1]), C.rune, { layer: 'glow', ao: false });
  return p;
}

/** Seated colossus, weathered and missing an arm, gazing over the city. Faces +z. */
function colossus() {
  const p = new Parts(), s = masonry(C.stone, .07);
  p.add(block(36, 8, 30), masonry(C.stoneDark, .05), { flat: true, ao: [0, 8, .6] });
  p.add(block(28, 10, 16, [0, 8, -4]), s, { flat: true, ao: false });
  for (const x of [-1, 1]) { p.add(block(7, 9, 18, [x * 6, 18, 4]), s, { flat: true, ao: false }); p.add(block(6.5, 26, 7, [x * 6, 0, 12]), s, { flat: true, ao: false }); p.add(rbox(7, 3, 9, 1, [x * 6, 1.5, 15]), s, { flat: true, ao: false }); }
  p.add(rbox(18, 24, 11, 2.5, [0, 38, -3]), s, { flat: true, ao: false });
  p.add(xf(new THREE.CylinderGeometry(11, 14, 6, 6).translate(0, 49, -3), [0, 0, 0], [0, Math.PI / 6, 0]), C.stoneLight, { flat: true, ao: false });
  p.add(rbox(6, 6, 10, 1.5, [-11, 42, -1], [-.9, 0, 0]), s, { flat: true, ao: false });
  p.add(rbox(6, 16, 6, 1.5, [-11, 30, 5]), s, { flat: true, ao: false });
  p.add(rbox(5, 7, 5, 1.2, [11, 46, -3], [0, 0, -.3]), s, { flat: true, ao: false });
  p.add(rbox(10, 11, 9, 2.5, [0, 57, -2]), s, { flat: true, ao: false });
  p.add(xf(new THREE.CylinderGeometry(6.5, 5, 7, 6).translate(0, 66, -2), [0, 0, 0], [0, 0, .12]), C.gold, { flat: true, ao: false });
  for (const x of [-2.2, 2.2]) p.add(xf(new THREE.BoxGeometry(1.6, .7, .3), [x, 58.5, 2.6]), C.runeHot, { layer: 'glow', ao: false });
  for (let i = 0; i < 6; i++) p.add(rock([4, 3, 4], [-16 + i * 6, 1, 22 + (i % 2) * 4], i * 3), s, { flat: true, ao: [0, 3, .7] });
  return p;
}

export const gate: CourseArt = {
  env: {
    sky: { top: '#4f72b8', horizon: '#f6c88c', below: '#e2b47c', band: { color: '#ff9a4a', height: .1, strength: .75 }, sun: { color: '#ffcf88', size: .07, glow: 1.1 },
      clouds: { lit: '#ffe2bc', shade: '#c792a2', cover: .3, scale: .8, speed: .7 }, cumulus: { lit: '#ffdcae', shade: '#c58f8f', height: .16, amount: .55 } },
    fog: { color: '#f6c88c', near: 160, far: 820 },
    hemi: { sky: '#ffe2b8', ground: '#8a6440', intensity: 1.45 },
    sun: { color: '#ffd29a', intensity: 3, dir: [-.75, .38, .55] },
    mountains: [
      { color: '#a8735a', radius: 1000, height: 150, rough: .15, haze: .6, seed: 11 },
      { color: '#c98d5c', radius: 820, height: 70, rough: .35, haze: .45, seed: 4 },
    ],
  },
  terrain: {
    height: hills({ amp: 34, ridge: 8, scale: .75, flat: 11 + 26, rise: 85, seed: 9 }),
    color(p, h, slope, out) {
      const n = fbm2(p.x * .05, p.z * .05, 3, 4), ripple = Math.sin(p.x * .35 + p.z * .2 + n * 6) * .5 + .5;
      const plaza = smoothstep(p.w + 30, p.w + 22, p.d);
      out.set(C.sand).lerp(new THREE.Color(C.sandLight), ripple * .35 + smoothstep(.5, .75, n) * .3).lerp(new THREE.Color(C.sandDark), smoothstep(.25, .7, slope) * .7);
      const tile = (Math.floor(p.x / 2.4) + Math.floor(p.z / 2.4)) % 2 ? C.plaza : C.plazaDark;
      out.lerp(new THREE.Color(tile), plaza * .55).lerp(new THREE.Color(C.plaza), plaza * .3);
    },
    detail: 'sand',
  },
  road: { kind: 'cobble', palette: { base: '#b4a68e', dark: '#6e6152', light: '#d6c9ad' } },
  start: { pillar: '#d9c08e', trim: '#f5ecd4', banner: '#5a3a8a', text: '#ffd86a', light: '#ffb347', flags: [C.purple, C.gold, '#b8402e', C.purpleLight] },
  hazard: 'mud',
  signs: { board: '#efdcb2', arrow: '#5b3a8e', post: '#8a6a4a' },
  ambient: [
    { color: '#f7deae', endColor: '#e8c48a', rate: 22, size: .1, life: 5, height: [.3, 5], drift: [2.2, .15, .8], wander: .5, radius: 32, alpha: .7, shape: Shape.Smoke },
    { color: '#ffe6a8', endColor: '#ffb86a', rate: 9, size: .09, life: 4.5, glow: true, height: [1, 7], drift: [.4, .25, .2], wander: .3, radius: 26, alpha: .8 },
  ],
  catalog: {
    'Ancient Gate': () => ancientGate(11), Column: r => column(r), 'Broken column': r => column(r, 7, true), Colonnade: r => colonnade(r, 4), 'Ruined colonnade': r => colonnade(r, 5, true),
    Obelisk: r => obelisk(r), Palm: palm, Sphinx: sphinx, 'Ruined house': ruin, Urns: urns, Rubble: r => rubble(r), Pilaster: () => pilaster(),
    Brazier: () => brazier(C.stone, '#6a4c30', C.flame, 1.4), Banner: () => banner(C.purple, C.gold, C.goldLight, 1.6, 4), Ziggurat: () => ziggurat(), Colossus: () => colossus(),
  },
  build(kit) {
    const r = kit.r, w = kit.w;
    // Stone gutter along both edges, then the sandstone wall: inner face at the physical wall (w + 0.6), a carved band, coping and a walkway.
    kit.extrude([[-.55, .025], [-.42, .13], [.6, .13]], { mirror: true, step: 2.5, paint: (_s, _k, i, out) => out.set(i % 2 ? '#e2cc9e' : '#c9ad7e') });
    const wall: [number, number][] = [[.6, -.2], [.6, 1], [.42, 1.06], [.42, 1.42], [.6, 1.48], [.6, 3], [.38, 3.06], [.38, 3.46], [2.1, 3.46], [2.1, -1.5]];
    const wc = [C.stone, C.carve, C.purple, C.carve, C.stone, C.stoneLight, C.stoneLight, C.stoneLight, C.stoneDark];
    kit.extrude(wall, { mirror: true, step: 2, paint: (s, k, i, out) => { out.set(wc[k]); if (k === 0 || k === 4 || k === 8) out.multiplyScalar(.9 + hash2(i, k, 5) * .16); } });
    const crest = new Parts().add(block(1.15, 1, 1.5, [0, 0, 0]), masonry(C.stone), { flat: true, ao: false }).add(block(1.3, .2, 1.65, [0, 1, 0]), C.stoneLight, { flat: true, ao: false }).bake();
    for (let s = 0; s < kit.len; s += 2.6) for (const side of [-1, 1]) kit.onTrack(crest, s, side * (w + 1.25), { y: 3.46 });
    // Pilasters with braziers and hanging banners along the inner faces.
    const pil = kit.prop('pilaster', pilaster), fire = kit.prop('brazier', () => brazier(C.stone, '#6a4c30', C.flame, .7));
    for (let s = 6, i = 0; s < kit.len - 6; s += 15, i++) for (const side of [-1, 1]) {
      if (Math.abs(s - kit.len) < 30 || s < 25) continue;
      kit.onTrack(pil, s, side * (w + .62), { faceRoad: true });
      if (i % 2) kit.onTrack(fire, s, side * (w + 1.2), { y: 3.46 });
      else kit.onTrack(kit.prop(`banner${side}`, () => banner(side > 0 ? C.purple : '#8e2f3a', C.gold, C.goldLight, 1.5, 3.6)), s + 7.5, side * (w + .5), { faceRoad: true, y: -.3 });
    }
    // The Ancient Gate on the straightest stretch in the middle of the lap.
    let best = kit.len * .5, score = Infinity;
    for (let s = kit.len * .25; s < kit.len * .8; s += 5) { let c = 0; for (let k = -30; k <= 30; k += 6) c += Math.abs(kit.at(s + k).curve); if (c < score) { score = c; best = s; } }
    kit.onTrack(kit.prop('ancient gate', () => ancientGate(w)), best, 0);
    for (const side of [-1, 1]) for (const ds of [-14, 14]) kit.onTrack(kit.prop('gate fire', () => brazier(C.stone, '#6a4c30', C.flame, 2.4)), best + ds, side * (w + 4.2), { onGround: true });
    // Plaza just outside the walls: colonnades, obelisks, sphinxes, palms and urns.
    const near = (x: number, z: number, m: number) => kit.road(x, z).d < w + m;
    for (let s = 20; s < kit.len - 10; s += r.range(16, 30)) {
      const side = r.sign(), off = side * (w + r.range(6, 14)), p = kit.at(s, off);
      if (near(p.x, p.z, 4.5) || Math.abs(s - best) < 25) continue;
      const k = r(), o = { onGround: true, faceRoad: true, yaw: r.range(-.15, .15) };
      if (k < .2) kit.onTrack(kit.prop('colonnade', rr => colonnade(rr, 4, rr() < .6), r.int(0, 3)), s, side * (w + r.range(9, 13)), { ...o, yaw: Math.PI / 2 * 0 + o.yaw });
      else if (k < .34) kit.onTrack(kit.prop('obelisk', rr => obelisk(rr, rr.range(11, 15)), r.int(0, 2)), s, off, o);
      else if (k < .46) kit.onTrack(kit.prop('sphinx', sphinx), s, side * (w + 9), o);
      else if (k < .72) kit.onTrack(kit.prop('palm', palm, r.int(0, 4)), s, off, { onGround: true, yaw: r() * 6 });
      else if (k < .82) kit.onTrack(kit.prop('urns', urns, r.int(0, 3)), s, side * (w + r.range(3.5, 6)), { onGround: true, yaw: r() * 6 });
      else kit.onTrack(kit.prop('column', rr => column(rr, 7, rr() < .5), r.int(0, 3)), s, off, { onGround: true, yaw: r() * 6 });
    }
    kit.scatter(140, w + 5, w + 28, (x, z) => { const y = kit.groundAt(x, z), k = r(); if (k < .45) kit.place(kit.prop('palm', palm, r.int(0, 4)), x, y, z, { yaw: r() * 6, scale: r.range(.9, 1.25) }); else if (k < .75) kit.place(kit.prop('rubble', rr => rubble(rr), r.int(0, 3)), x, y, z, { yaw: r() * 6 }); else kit.place(kit.prop('column', rr => column(rr, 7, rr() < .6), r.int(0, 3)), x, y, z, { yaw: r() * 6 }); });
    // The old town: ruined houses facing the road, thinning into the dunes.
    kit.scatter(70, w + 18, 90, (x, z, d) => {
      const y = kit.groundAt(x, z), q = kit.road(x, z), toward = Math.atan2(kit.bounds.cx - x, kit.bounds.cz - z);
      void q; if (d > 60 && r() < .5) return;
      kit.place(kit.prop('ruin', ruin, r.int(0, 5)), x, y - .2, z, { yaw: toward + r.range(-.5, .5), scale: r.range(.9, 1.3) });
    });
    kit.scatter(90, 40, 260, (x, z) => { const y = kit.groundAt(x, z); if (r() < .6) kit.place(kit.prop('palm', palm, r.int(0, 4)), x, y, z, { yaw: r() * 6, scale: r.range(1, 1.4) }); else kit.place(kit.prop('broken col', rr => column(rr, 7, true), r.int(0, 3)), x, y - .5, z, { yaw: r() * 6, scale: r.range(1, 1.6) }); });
    // Distant landmarks: the step pyramid and the seated colossus across the dunes.
    const { cx, cz, extent } = kit.bounds, landmark = (a: number, dist: number, parts: Parts, scale: number) => {
      const x = cx + Math.cos(a) * (extent + dist), z = cz + Math.sin(a) * (extent + dist);
      kit.place(parts, x, kit.groundAt(x, z) - 2, z, { yaw: Math.atan2(cx - x, cz - z), scale });
    };
    landmark(-2.3, 230, kit.prop('ziggurat', ziggurat), 1.4);
    landmark(.5, 260, kit.prop('colossus', colossus), 1.3);
    landmark(2.2, 300, kit.prop('obelisk far', rr => obelisk(rr, 15)), 4);
    // Festival flags and bunting on the start straight.
    const a = kit.at(-30, -w - 1.3), b = kit.at(-30, w + 1.3), c2 = kit.at(-52, -w - 1.3), d = kit.at(-52, w + 1.3);
    bunting(kit, new THREE.Vector3(a.x, a.y + 13.5, a.z), new THREE.Vector3(b.x, b.y + 13.5, b.z), [C.purple, C.gold, '#b8402e', C.purpleLight]);
    bunting(kit, new THREE.Vector3(c2.x, c2.y + 13.5, c2.z), new THREE.Vector3(d.x, d.y + 13.5, d.z), [C.gold, '#ffffff', C.purple]);
    for (const side of [-1, 1]) kit.onTrack(kit.prop(`start flag${side}`, () => flagPole(side > 0 ? C.purple : C.gold, '#ffffff', 9)), 14, side * (w + 1.3), { y: 3.46 });
    void cyl; void cone; void disc; void ellipsoid; void torus;
  },
};
