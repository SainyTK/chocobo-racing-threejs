import * as THREE from 'three';
import { Parts, type Kit } from '../kit.ts';
import { hills, type GroundSample } from '../terrain.ts';
import { makeLiquid } from '../liquid.ts';
import { fbm2, smoothstep, type Rng } from '../noise.ts';
import { Shape } from '../../particles/particles.ts';
import { arch } from '../props/shapes.ts';
import { lampPost, flagPole, bunting, savePoint, blob, block, prism, cone, cyl, bead, disc, lathe, torus, sweep, rbox, grad, stripes, xf } from '../props/common.ts';
import type { CourseArt } from '../types.ts';

const C = {
  frosting: '#f6b8d0', frostingLight: '#ffd9e8', mint: '#bdebd6', cream: '#fff3e2', sponge: '#f0c98e', crumb: '#d9a35e',
  choc: '#6e3f25', chocDark: '#4a2615', chocLight: '#9a6038', caramel: '#d48c3c', ginger: '#b56c34', gingerDark: '#8a4c22',
  icing: '#fffaf2', red: '#e8344f', pink: '#ff7fb6', mintDeep: '#5fd4a8', lemon: '#ffe36a', grape: '#a77cf0', sky: '#7fd0ff', orange: '#ff9b4a', cherry: '#d81e3a',
};
const CANDY = [C.red, C.pink, C.mintDeep, C.lemon, C.grape, C.sky, C.orange];
const col = (s: string) => new THREE.Color(s);

/** Red-and-white candy cane with its hook turned towards +z. */
function candyCane(r: Rng, h = r.range(3.2, 5), a = C.red, b = C.icing) {
  const p = new Parts(), R = h * .2, t = h * .055;
  const pts: [number, number, number][] = [[0, 0, 0], [0, h * .5, 0], [0, h, 0], [0, h + R * .72, R * .3], [0, h + R, R], [0, h + R * .72, R * 1.7], [0, h - R * .05, R * 2]];
  p.add(sweep(pts, t, { radial: 8, segments: 44 }), stripes(a, b, h * .09, 'y', .8), { ao: [0, .6, .7] });
  return p;
}

/** Lollipop: striped stick and a swirled disc facing ±z. */
function lollipop(r: Rng, size = r.range(1, 1.8)) {
  const p = new Parts(), R = 1.1 * size, h = 2.6 * size, ca = col(r.pick(CANDY)), cb = col(r.pick([C.icing, C.lemon, C.frostingLight])), turns = r.int(2, 3);
  p.add(cyl(.07 * size, .07 * size, h, [0, h / 2, 0], [0, 0, 0], 6), C.icing, { ao: [0, .4, .75] });
  const swirl = (x: number, y: number, _z: number, out: THREE.Color) => { const dx = x, dy = y - h - R * .9, a = Math.atan2(dy, dx) / 6.283 + .5, d = Math.hypot(dx, dy) / R; out.copy(Math.floor((a + d * turns) * 6) % 2 ? ca : cb); };
  for (const yaw of [0, Math.PI]) p.add(xf(new THREE.RingGeometry(.02, R, 26, 5), [0, h + R * .9, yaw ? -.16 * size : .16 * size], [0, yaw, 0]), swirl, { ao: false });
  p.add(xf(new THREE.CylinderGeometry(R, R, .32 * size, 20, 1, true), [0, h + R * .9, 0], [Math.PI / 2, 0, 0]), ca, { ao: false });
  return p;
}

/** Sugar-dusted gumdrop. */
function gumdrop(r: Rng, color = r.pick(CANDY), s = 1) {
  const p = new Parts(), c = col(color), hi = c.clone().lerp(col('#ffffff'), .4);
  p.add(lathe([[1, 0], [.97, .4], [.75, .95], [.35, 1.18], [0, 1.24]].map(([x, y]) => [x * s, y * s] as [number, number]), [0, 0, 0], [0, 0, 0], 14), (x, y, z, out) => out.copy(c).lerp(hi, Math.min(1, y / s)), { ao: [0, s * .4, .7] });
  return p;
}

/** A cluster of gumdrops: the candy kingdom's bushes. */
function gumdropBush(r: Rng) {
  const p = new Parts(), n = r.int(3, 5);
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = i ? r.range(.8, 1.4) : 0, s = i ? r.range(.5, .8) : 1.1, g = gumdrop(r, r.pick(CANDY), s); for (const [, [geo]] of g.layers) p.add(geo.translate(Math.cos(a) * d, 0, Math.sin(a) * d), (x, y, z, out) => out.set('#ffffff'), { ao: false }); }
  // Re-paint: gumdrop() already baked colours, so copy them through.
  return recolour(p, r);
}
function recolour(p: Parts, r: Rng) {
  const out = new Parts();
  for (const [, list] of p.layers) for (const g of list) { const c = col(r.pick(CANDY)), hi = c.clone().lerp(col('#ffffff'), .45); out.add(g, (x, y, z, o) => o.copy(c).lerp(hi, Math.min(1, y / 1.4)), { ao: [0, .5, .7] }); }
  return out;
}

/** Swirl-frosting tree on a striped candy trunk, the forest of this land. */
function frostingTree(r: Rng) {
  const p = new Parts(), h = r.range(3.5, 5), c = col(r.pick([C.frosting, C.mint, C.frostingLight, '#ffe2a8', '#d8c4ff'])), hi = c.clone().lerp(col('#ffffff'), .5), lo = c.clone().multiplyScalar(.82);
  p.add(prism(.28, .38, h, 8), stripes(C.icing, r.pick([C.red, C.pink, C.mintDeep]), .45, 'y', .6), { ao: [0, 1, .6] });
  const paint = (y0: number, y1: number) => (_x: number, y: number, _z: number, out: THREE.Color) => out.copy(lo).lerp(hi, Math.min(1, Math.max(0, (y - y0) / (y1 - y0))));
  const tiers = 4;
  for (let i = 0; i < tiers; i++) { const t = i / tiers, rr = 2.6 * (1 - t * .7), y = h + .3 + i * 1.15; p.add(xf(new THREE.TorusGeometry(rr, .75 * (1 - t * .45), 6, 14), [0, y, 0], [Math.PI / 2, 0, r() * 6]), paint(h, h + 5.5), { layer: 'foliage', sway: .06 + t * .06, ao: false }); }
  p.add(blob(.85, [0, h + .3 + tiers * 1.15 - .2, 0], r() * 9, .1), paint(h, h + 5.5), { layer: 'foliage', sway: .14, ao: false });
  p.add(bead(.42, [0, h + tiers * 1.15 + .85, 0]), C.cherry, { layer: 'foliage', sway: .16, ao: false });
  for (let i = 0; i < 6; i++) { const a = r() * 6.28; p.add(bead(.13, [Math.cos(a) * 2.2, h + .5 + r() * 1.4, Math.sin(a) * 2.2], .6), r.pick(CANDY), { layer: 'foliage', sway: .08, ao: false }); }
  return p;
}

/** Giant cupcake: pleated wrapper, swirled frosting, sprinkles and a cherry. */
function cupcake(r: Rng) {
  const p = new Parts(), wrap = col(r.pick([C.pink, C.sky, C.lemon, C.mintDeep])), wrap2 = wrap.clone().lerp(col('#ffffff'), .45), fr = col(r.pick([C.frostingLight, C.cream, C.mint, '#ffd0a8']));
  p.add(lathe([[1.5, 0], [1.6, .1], [2.05, 2], [2.15, 2.15], [0, 2.15]], [0, 0, 0], [0, 0, 0], 24), (x, _y, z, out) => out.copy(Math.floor((Math.atan2(z, x) / 6.283 + .5) * 24) % 2 ? wrap : wrap2), { ao: [0, .6, .65] });
  for (let i = 0; i < 3; i++) p.add(xf(new THREE.TorusGeometry(1.9 - i * .55, .55 - i * .1, 6, 16), [0, 2.4 + i * .75, 0], [Math.PI / 2, 0, i]), fr, { ao: false });
  p.add(blob(.6, [0, 4.35, 0], 1, .1), fr, { ao: false }); p.add(bead(.45, [0, 5, 0]), C.cherry, { ao: false });
  p.add(sweep([[0, 5.3, 0], [.15, 5.8, .1], [.4, 6.1, 0]], .04, { radial: 4, segments: 5 }), '#4f8a3a', { ao: false });
  for (let i = 0; i < 18; i++) { const a = r() * 6.28, y = 2.5 + r() * 1.8, rr = 2 - (y - 2.4) * .65; p.add(xf(new THREE.BoxGeometry(.08, .08, .3), [Math.cos(a) * rr, y, Math.sin(a) * rr], [r() * 3, r() * 3, 0]), r.pick(CANDY), { ao: false }); }
  return p;
}

/** Iced donut standing on its edge, icing and sprinkles on the +z face. */
function donut(r: Rng) {
  const p = new Parts(), R = 1.5, ice = col(r.pick([C.pink, C.frostingLight, '#7a4428', C.mint, C.lemon])), dough = col('#e0a25c');
  p.add(xf(new THREE.TorusGeometry(R, .7, 9, 22), [0, R + .55, 0]), (x, y, z, out) => out.copy(z > .1 + Math.sin(Math.atan2(y - R - .55, x) * 9) * .1 ? ice : dough), { ao: [0, .5, .7] });
  for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = R + r.range(-.4, .4); p.add(xf(new THREE.BoxGeometry(.07, .26, .07), [Math.cos(a) * d, R + .55 + Math.sin(a) * d, .62 + (.4 - Math.abs(d - R)) * .3], [0, 0, r() * 3]), r.pick(CANDY), { ao: false }); }
  return p;
}

/** Stack of macarons in pastel colours. */
function macarons(r: Rng) {
  const p = new Parts(); let y = 0;
  const n = r.int(3, 4);
  for (let i = 0; i < n; i++) {
    const s = 1.3 - i * .12, c = col(r.pick([C.pink, C.mint, C.lemon, '#d8c4ff', '#ffd0a8', C.sky])), shell = (y0: number, up: boolean) => lathe((up ? [[s * .95, 0], [s, .12], [s * .85, .42], [0, .5]] : [[0, 0], [s * .85, .08], [s, .38], [s * .95, .5]]) as [number, number][], [0, y0, 0], [0, 0, 0], 18);
    p.add(shell(y, false), c, { ao: false }); p.add(cyl(s * .88, s * .9, .22, [0, y + .6, 0], [0, 0, 0], 18), C.cream, { ao: false }); p.add(shell(y + .71, true), c, { ao: false });
    y += 1.2;
  }
  return p;
}

/** Waffle cone with scoops, upside-down on the ground like a candy tower. */
function iceCream(r: Rng) {
  const p = new Parts(), h = 3.4, waffle = col('#e2a85e'), dark = col('#b97a36');
  p.add(xf(new THREE.ConeGeometry(1.05, h, 18, 8), [0, h / 2, 0], [Math.PI, 0, 0]), (x, y, z, out) => { const a = Math.atan2(z, x) * 4, k = (Math.floor(a + y * 2.4) + Math.floor(a - y * 2.4)) % 2; out.copy(k ? waffle : dark); }, { ao: [0, .6, .7] });
  const flavours = [C.frostingLight, '#fff1d6', '#8a5a3a', C.mint, '#ffd0a8'];
  p.add(blob([1.25, 1, 1.25], [0, h + .45, 0], r() * 9, .14), r.pick(flavours), { ao: false });
  p.add(blob(.95, [0, h + 1.65, 0], r() * 9, .14), r.pick(flavours), { ao: false });
  p.add(bead(.32, [0, h + 2.6, 0]), C.cherry, { ao: false });
  return p;
}

/** Peppermint candy lying on the ground: red swirl on white. */
function peppermint(r: Rng) {
  const p = new Parts(), R = r.range(.5, .9), red = col(r.pick([C.red, C.mintDeep, C.pink])), white = col(C.icing);
  p.add(xf(new THREE.CylinderGeometry(R, R, .3, 24, 1), [0, .15, 0]), (x, y, z, out) => out.copy(Math.floor((Math.atan2(z, x) / 6.283 + .5 + Math.hypot(x, z) / R * .25) * 8) % 2 ? red : white), { ao: false, detail: true });
  return p;
}

/** Chocolate bar fence segment: a squared bar on two chocolate posts, along +x. */
function chocFence() {
  const p = new Parts(), L = 6;
  for (const x of [-L / 2, L / 2]) { p.add(block(.5, 1.6, .5, [x, 0, 0]), C.chocDark, { flat: true }); p.add(bead(.3, [x, 1.75, 0]), C.cream, { ao: false }); }
  for (let i = 0; i < 4; i++) p.add(rbox(L / 4 - .08, .7, .3, .06, [-L / 2 + (i + .5) * L / 4, .95, 0]), i % 2 ? C.choc : C.chocLight, { ao: false });
  return p;
}

/** Gingerbread house with icing trim, a frosted roof, gumdrop studs and warm windows. Faces +z. */
function gingerHouse(r: Rng) {
  const p = new Parts(), W = r.range(5.5, 7), D = r.range(5, 6), H = r.range(3.6, 4.4), roof = col(r.pick([C.frosting, C.cream, C.mint, '#d8c4ff'])), icing = col(C.icing), ginger = col(C.ginger);
  p.add(block(W, H, D), (x, y, z, out) => { const band = Math.abs(y - H + .35 + Math.sin(x * 4 + z * 4) * .12) < .14; out.copy(band ? icing : ginger); }, { ao: [0, 1.3, .65], flat: true });
  // Gable ends.
  const tri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, W * .42)]);
  for (const z of [D / 2, -D / 2]) p.add(xf(new THREE.ExtrudeGeometry(tri, { depth: .3, bevelEnabled: false }), [0, H, z - .15]), C.ginger, { ao: false, flat: true });
  const slope = Math.atan2(W * .42, W / 2), len = Math.hypot(W / 2, W * .42) + .5;
  for (const s of [-1, 1]) {
    p.add(xf(new THREE.BoxGeometry(len, .35, D + .9), [s * W / 4, H + W * .21 + .15, 0], [0, 0, -s * slope]), roof, { ao: false });
    // Icing drips along the eave.
    for (let i = 0; i < 9; i++) p.add(bead(.18, [s * (W / 2 + .12), H + .02, -D / 2 - .3 + i * (D + .6) / 8], 1.6), icing, { ao: false });
    for (let i = 0; i < 4; i++) p.add(bead(.24, [s * W / 4 + s * .15, H + W * .21 + .5, -D / 2 + .5 + i * (D - 1) / 3]), r.pick(CANDY), { ao: false });
  }
  p.add(sweep([[0, H + W * .42 + .25, -D / 2 - .45], [0, H + W * .42 + .32, 0], [0, H + W * .42 + .25, D / 2 + .45]], .14, { radial: 6, segments: 8 }), icing, { ao: false });
  // Door, windows, chimney.
  p.add(rbox(1.3, 2.2, .2, .15, [0, 1.1, D / 2 + .05]), C.chocDark, { ao: false }); p.add(torus(.66, .09, [0, 2.2, D / 2 + .12], [0, 0, 0], Math.PI), icing, { ao: false });
  for (const x of [-W * .3, W * .3]) { p.add(xf(new THREE.PlaneGeometry(1, 1), [x, H * .55, D / 2 + .02]), '#ffd98a', { layer: 'glow', ao: false }); p.add(xf(new THREE.BoxGeometry(1.25, .14, .12), [x, H * .55 - .55, D / 2 + .06]), icing, { ao: false }); p.add(xf(new THREE.BoxGeometry(.1, 1.1, .1), [x, H * .55, D / 2 + .06]), icing, { ao: false }); p.add(xf(new THREE.BoxGeometry(1.1, .1, .1), [x, H * .55, D / 2 + .06]), icing, { ao: false }); }
  for (const x of [-W * .3, W * .3]) p.add(xf(new THREE.PlaneGeometry(.9, .9), [x, H * .55, -D / 2 - .02], [0, Math.PI, 0]), '#ffd98a', { layer: 'glow', ao: false });
  p.add(block(.9, 2.2, .9, [W * .25, H + 1, -D * .2]), stripes(C.red, C.icing, .4, 'y'), { ao: false, flat: true });
  p.add(rbox(1.1, .3, 1.1, .1, [W * .25, H + 3.25, -D * .2]), icing, { ao: false });
  for (const x of [-.95, .95]) p.add(candyCane(r, 2.2).layers.get('solid')![0].clone().translate(x, 0, D / 2 + .5), stripes(C.red, C.icing, .2, 'y', .8), { ao: false });
  return p;
}

/** Striped candy hoop over the road: rises from both shoulders and clears 15 m at the top. */
function candyArch(w: number, a = C.red, b = C.icing) {
  const p = new Parts(), R = w + 3.2, pts: [number, number, number][] = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16 * Math.PI; pts.push([-Math.cos(t) * R, Math.sin(t) * R * 1.15 + .2, 0]); }
  p.add(sweep(pts, .75, { radial: 10, segments: 80 }), (x, y, z, out) => out.set(Math.floor((Math.atan2(y, x) * 7 + z * .6) + 100) % 2 ? a : b), { ao: false });
  for (const s of [-1, 1]) for (const [col2, d] of [[C.mintDeep, 0], [C.lemon, 1.3]] as const) { const g = gumdrop(rngLess(), col2, 1.2 - d * .4); for (const [, [geo]] of g.layers) p.add(geo.translate(s * (R + d * .3), 0, d ? 1.5 : 0), col2, { ao: [0, .6, .7] }); }
  p.add(xf(new THREE.OctahedronGeometry(1.2), [0, R * 1.15 + 1.6, 0], [0, 0, Math.PI / 4]), C.lemon, { layer: 'glow', ao: false });
  for (let i = 1; i < 16; i += 2) { const t = i / 16 * Math.PI; p.add(bead(.28, [-Math.cos(t) * (R - .9), Math.sin(t) * (R - .9) * 1.15 + .2, 0]), CANDY[i % CANDY.length], { layer: 'glow', ao: false }); }
  return p;
}
const rngLess = (): Rng => Object.assign(() => .5, { range: (a: number, b: number) => (a + b) / 2, int: (a: number) => a, pick: <T>(l: readonly T[]) => l[0], sign: () => 1 });

/** Layer-cake tunnel: sponge, cream and jam bands under pink frosting with dripping icing and cherries. Inner top at 17 m. */
function cakeTunnel(w: number) {
  const p = new Parts(), span = (w + 3) * 2, H = 17, thick = 3.2, depth = 9, r = span / 2, legH = H - r;
  const bands = [col(C.sponge), col(C.cream), col('#e04a6a'), col(C.cream)], frost = col(C.frosting), drip = col(C.icing);
  p.add(arch(span, H, thick, depth, false, 18), (x, y, _z, out) => {
    const d = y > legH ? Math.hypot(x, y - legH) : Math.abs(x), k = (d - r) / thick;
    out.copy(k > .78 ? frost : bands[((Math.floor(Math.max(0, k) * 9) % 4) + 4) % 4]);
  }, { ao: [0, 2, .6] });
  // Drips and cherries along the frosted crown, front and back.
  for (let i = 0; i <= 14; i++) {
    const t = i / 14 * Math.PI, x = -Math.cos(t) * (r + thick), y = legH + Math.sin(t) * (r + thick);
    for (const z of [-depth / 2 - .05, depth / 2 + .05]) p.add(bead(.32, [x * .985, y - .55, z], 1.8), drip, { ao: false });
    if (i % 2 === 0 && i > 0 && i < 14) p.add(bead(.55, [x, y + .45, 0]), C.cherry, { ao: false });
  }
  for (const s of [-1, 1]) p.add(candyCane(rngLess(), 7).layers.get('solid')![0].clone().rotateY(s > 0 ? Math.PI : 0).translate(s * (r + thick + 1), 0, depth / 2 + 1.2), stripes(C.red, C.icing, .5, 'y', .8), { ao: false });
  return p;
}

/** The candy castle on the horizon: a tiered cake crowned with turrets and candles. */
function cakeCastle(r: Rng) {
  const p = new Parts(), tiers: [number, number, string][] = [[62, 22, C.frosting], [48, 20, C.cream], [34, 18, C.frostingLight], [20, 16, C.mint]];
  let y = 0;
  for (const [R, h, c] of tiers) {
    const base = col(c), shade = base.clone().multiplyScalar(.86), top = col(C.icing);
    p.add(lathe([[R, 0], [R, h * .8], [R * .99, h], [0, h]], [0, y, 0], [0, 0, 0], 40), (x, yy, z, out) => { const lt = yy - y, drip = lt > h * .82 - Math.max(0, Math.sin(Math.atan2(z, x) * 18)) * h * .18; out.copy(drip ? top : Math.floor(Math.atan2(z, x) * 10 + 50) % 2 ? base : shade); }, { ao: false });
    for (let i = 0; i < Math.round(R / 3); i++) { const a = i / Math.round(R / 3) * 6.283; p.add(bead(1.6, [Math.cos(a) * R, y + h + .6, Math.sin(a) * R]), i % 2 ? C.cherry : C.icing, { ao: false }); }
    y += h;
  }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * 6.283 + .3, x = Math.cos(a) * 58, z = Math.sin(a) * 58, th = 34 + (i % 2) * 10;
    p.add(prism(6, 6.5, th, 14, [x, 0, z]), (xx, yy, zz, out) => out.set(Math.floor(yy / 4) % 2 ? C.cream : C.frosting), { ao: false });
    p.add(cone(8, 16, 14, [x, th, z]), i % 2 ? C.pink : C.grape, { ao: false });
    p.add(bead(1.6, [x, th + 17, z]), C.lemon, { layer: 'glow', ao: false });
  }
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; p.add(prism(1.4, 1.4, 14, 10, [Math.cos(a) * 11, y, Math.sin(a) * 11]), stripes(C.icing, CANDY[i], 2.5, 'y', .5), { ao: false }); p.add(cone(1.6, 4, 8, [Math.cos(a) * 11, y + 14.4, Math.sin(a) * 11]), '#ffc94a', { layer: 'glow', ao: false }); }
  p.add(blob(7, [0, y + 6, 0], 2, .08), C.cherry, { ao: false });
  return p;
}

/** Cheap distant candy for the hills: lollipops and gumdrops in a few triangles. */
function farCandy(r: Rng) {
  const p = new Parts(), c = r.pick(CANDY);
  if (r() < .5) { const h = r.range(5, 9); p.add(prism(.15, .15, h, 4), C.icing, { ao: false }); p.add(xf(new THREE.CylinderGeometry(h * .28, h * .28, .4, 10), [0, h + h * .2, 0], [Math.PI / 2, 0, 0]), c, { ao: false, flat: true }); }
  else { const s = r.range(2, 4); p.add(prism(s * .3, s, s * 1.2, 8), (x, y, z, out) => out.copy(col(c)).lerp(col('#ffffff'), y / s * .3), { ao: false, flat: true }); }
  return p;
}

const terrainHeight = (() => {
  const h = hills({ amp: 34, ridge: 10, scale: 1, rise: 60, seed: 11 });
  return (p: GroundSample) => { const lake = smoothstep(.37, .28, fbm2(p.x / 240 - 3, p.z / 240 + 5, 3, 21)) * smoothstep(p.drive + 10, p.drive + 45, p.d); return h(p) - lake * 14; };
})();

export const gingerbread: CourseArt = {
  env: {
    sky: { top: '#8f7fe6', horizon: '#ffd3e6', band: { color: '#fff1cc', height: .1, strength: .5 }, sun: { color: '#fff1d2', size: .055, glow: .75 },
      clouds: { lit: '#fffafd', shade: '#f2b4d6', cover: .4, scale: .8 }, cumulus: { lit: '#fff6fb', shade: '#eea4cc', height: .22, amount: .7 } },
    fog: { color: '#ffd3e6', near: 150, far: 760 },
    hemi: { sky: '#ffeaf5', ground: '#c98a7a', intensity: 1.6 },
    sun: { color: '#fff0de', intensity: 2.6, dir: [.4, .72, .55] },
    mountains: [
      { color: '#d996c4', radius: 980, height: 220, rough: .35, snow: '#fff6fa', snowLine: .58, haze: .5, seed: 6 },
      { color: '#8a5a44', radius: 800, height: 110, rough: .2, snow: '#ffe2ef', snowLine: .72, haze: .35, seed: 13 },
    ],
  },
  terrain: {
    height: terrainHeight,
    color(p, h, slope, out) {
      const n = fbm2(p.x * .025, p.z * .025, 3, 4), m = fbm2(p.x * .007, p.z * .007, 2, 9);
      out.set(C.frosting).lerp(col(C.frostingLight), smoothstep(.45, .7, n) * .7).lerp(col(C.mint), smoothstep(.47, .4, m) * .85).lerp(col(C.cream), smoothstep(.56, .64, m) * .75).lerp(col('#e6c8f5'), smoothstep(.6, .72, fbm2(p.x * .012 + 9, p.z * .012, 2, 31)) * .6);
      out.lerp(col(C.crumb), smoothstep(p.w + 3.4, p.w + .6, p.d) * .9);
      out.lerp(col(C.choc), smoothstep(.5, .85, slope) * .9);
      out.lerp(col(C.caramel), smoothstep(5.4, 4.3, h) * .85);
    },
    detail: 'candy',
  },
  road: { kind: 'biscuit', palette: { base: '#dca660', dark: '#a8703a', light: '#f2cc8c', edge: '#fff4ea' } },
  start: { pillar: '#f78fb3', trim: '#fff6ea', banner: '#c2306f', text: '#fff6ea', light: '#ffe28a', flags: [C.pink, C.mintDeep, C.lemon, C.grape] },
  hazard: 'goo',
  signs: { board: '#fff6ea', arrow: '#e83e6c', post: '#c98a4a' },
  ambient: [
    { color: '#ffffff', endColor: '#ffc8ec', rate: 14, size: .18, life: 3.5, glow: true, shape: Shape.Star, height: [.5, 6], wander: .4, drift: [0, .15, 0], radius: 34, alpha: .9 },
    { color: '#ff7fb6', rate: 4, size: .16, life: 4.5, shape: Shape.Shard, height: [5, 11], drift: [.8, -1, .3], wander: .7, radius: 28 },
    { color: '#7fe8c8', rate: 4, size: .16, life: 4.5, shape: Shape.Shard, height: [5, 11], drift: [.8, -1, .3], wander: .7, radius: 28 },
    { color: '#ffe36a', rate: 4, size: .16, life: 4.5, shape: Shape.Shard, height: [5, 11], drift: [.8, -1, .3], wander: .7, radius: 28 },
  ],
  catalog: {
    'Candy cane': r => candyCane(r), Lollipop: r => lollipop(r), 'Gumdrop bush': gumdropBush, 'Frosting tree': frostingTree, Cupcake: cupcake, Donut: donut, Macarons: macarons,
    'Ice cream': iceCream, Peppermint: peppermint, 'Chocolate fence': () => chocFence(), 'Gingerbread house': gingerHouse, 'Far candy': farCandy, 'Candy arch': () => candyArch(12), 'Cake tunnel': () => cakeTunnel(12),
  },
  build(kit: Kit) {
    const r = kit.r, w = kit.w, clear = (x: number, z: number, m: number) => kit.road(x, z).d > w + m;
    makeLiquid(kit, { y: 4.4, deep: '#4a2414', shallow: '#7e4422', foam: '#e0a86a', sky: '#c98a6a', scale: 1.2, swell: .06, speed: .6 });
    // Verge: peppermints and small gumdrops along both edges.
    for (let s = 0; s < kit.len; s += 4.5) for (const side of [-1, 1]) {
      const s1 = s + r() * 3, o1 = side * (w + r.range(1, 5)), q1 = kit.at(s1, o1), s2 = s + r() * 3, o2 = side * (w + r.range(1.5, 6)), q2 = kit.at(s2, o2);
      if (r() < .45 && clear(q1.x, q1.z, .8)) kit.onTrack(kit.prop('peppermint', peppermint, r.int(0, 3)), s1, o1, { yaw: r() * 6, onGround: true });
      if (r() < .25 && clear(q2.x, q2.z, 1.2)) kit.onTrack(kit.prop('gumdrop', rr => gumdrop(rr, rr.pick(CANDY), .45), r.int(0, 6)), s2, o2, { yaw: r() * 6, onGround: true, scale: r.range(.7, 1.3) });
    }
    // Landmarks along the lap.
    for (let s = 30; s < kit.len - 20; s += r.range(13, 22)) {
      const side = r.sign(), off = side * (w + r.range(7, 15)), q = kit.at(s, off), pick = r();
      if (!clear(q.x, q.z, 5)) continue;
      const o = { onGround: true, yaw: r() * 6 };
      if (pick < .18) kit.onTrack(kit.prop('cane', rr => candyCane(rr), r.int(0, 3)), s, off, { ...o, faceRoad: true, yaw: r.range(-.6, .6), scale: r.range(1, 1.5) });
      else if (pick < .36) kit.onTrack(kit.prop('lollipop', rr => lollipop(rr), r.int(0, 6)), s, off, { ...o, faceRoad: true, yaw: r.range(-.5, .5) });
      else if (pick < .48) kit.onTrack(kit.prop('cupcake', cupcake, r.int(0, 3)), s, off, o);
      else if (pick < .58) kit.onTrack(kit.prop('donut', donut, r.int(0, 3)), s, off, { onGround: true, faceRoad: true, yaw: r.range(-.4, .4) });
      else if (pick < .68) kit.onTrack(kit.prop('macarons', macarons, r.int(0, 3)), s, off, o);
      else if (pick < .78) kit.onTrack(kit.prop('ice cream', iceCream, r.int(0, 3)), s, off, o);
      else kit.onTrack(kit.prop('gumdrop bush', gumdropBush, r.int(0, 4)), s, off, { ...o, scale: r.range(.9, 1.4) });
    }
    // Candy woods: frosting trees, lollipop groves and canes, thinning into cheap candy on the hills.
    kit.scatter(320, w + 10, 95, (x, z) => {
      const y = kit.groundAt(x, z); if (y < 4.7) return;
      const k = r();
      if (k < .5) kit.place(kit.prop('frosting tree', frostingTree, r.int(0, 6)), x, y, z, { yaw: r() * 6, scale: r.range(.9, 1.5) });
      else if (k < .7) kit.place(kit.prop('lollipop', rr => lollipop(rr), r.int(0, 6)), x, y, z, { yaw: r() * 6, scale: r.range(1, 1.6) });
      else if (k < .85) kit.place(kit.prop('cane', rr => candyCane(rr), r.int(0, 3)), x, y, z, { yaw: r() * 6, scale: r.range(1.2, 2) });
      else kit.place(kit.prop('gumdrop bush', gumdropBush, r.int(0, 4)), x, y, z, { yaw: r() * 6, scale: r.range(1, 1.8) });
    });
    kit.scatter(1300, 95, 420, (x, z) => { const y = kit.groundAt(x, z); if (y < 4.7) return; kit.place(kit.prop('far candy', farCandy, r.int(0, 7)), x, y, z, { yaw: r() * 6, scale: r.range(1, 2) }); });
    // Gingerbread village along the start straight, with chocolate fences and candy lamps.
    for (let i = 0; i < 6; i++) {
      const s = -170 + i * 48 + r.range(-6, 6), side = i % 2 ? 1 : -1, off = side * (w + r.range(17, 24)), q = kit.at(s, off);
      if (!clear(q.x, q.z, 12)) continue;
      kit.onTrack(kit.prop('house', gingerHouse, i % 4), s, off, { faceRoad: true, onGround: true, yaw: r.range(-.25, .25) });
      kit.onTrack(kit.prop('fence', chocFence), s, side * (w + 10), { onGround: true, yaw: r.range(-.1, .1) });
      kit.onTrack(kit.prop('lamp', () => lampPost('#e86a9a', '#fff0b0', 4)), s + 7, side * (w + 3), { faceRoad: true, onGround: true });
    }
    // Overhead pieces go where the road runs straightest, so their legs never cut into a bend.
    const straight = (target: number) => { let best = target, score = Infinity; for (let s = target - 70; s <= target + 70; s += 5) { let k = 0; for (let d = -14; d <= 14; d += 2) k = Math.max(k, Math.abs(kit.at(s + d).curve)); for (const o of [-20, -15, 15, 20]) for (const d of [-6, 0, 6]) { const q = kit.at(s + d, o); if (kit.road(q.x, q.z).d < w + 1) k += 1; } if (k < score) { score = k; best = s; } } return best; };
    for (const f of [.11, .62]) kit.onTrack(kit.prop('candy arch', () => candyArch(w)), straight(kit.len * f), 0);
    kit.onTrack(kit.prop('candy arch 2', () => candyArch(w, C.mintDeep, C.icing)), straight(kit.len * .36), 0);
    for (const f of [.46, .8]) kit.onTrack(kit.prop('cake tunnel', () => cakeTunnel(w)), straight(kit.len * f), 0);
    // Cake castle on the horizon, out past the far side of the course.
    for (const a of [.6, 3.9]) {
      const { cx, cz, extent } = kit.bounds, x = cx + Math.cos(a) * (extent + 230), z = cz + Math.sin(a) * (extent + 230);
      kit.place(kit.prop('castle', cakeCastle, a > 1 ? 1 : 0), x, kit.groundAt(x, z) - 2, z, { yaw: a, scale: a > 1 ? .8 : 1 });
    }
    // Start festival: bunting, flags, a save point.
    for (const s of [-24, -42]) { const a = kit.at(s, -w - 3.4), b = kit.at(s, w + 3.4); bunting(kit, new THREE.Vector3(a.x, a.y + 13.2, a.z), new THREE.Vector3(b.x, b.y + 13.2, b.z), [C.pink, C.icing, C.mintDeep, C.lemon, C.grape]); }
    kit.onTrack(kit.prop('save', () => savePoint('#ffb8e8')), -30, -(w + 9), { onGround: true });
    kit.onTrack(kit.prop('flag', () => flagPole(C.pink, C.icing, 9, C.icing)), 12, w + 5, { onGround: true });
  },
};
