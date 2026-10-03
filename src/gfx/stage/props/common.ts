import * as THREE from 'three';
import { Parts, type Kit } from '../kit.ts';
import type { Rng } from '../noise.ts';
import { blob, block, prism, cone, card, blade, cyl, ball, bead, disc, ellipsoid, rbox, rock, torus, lathe, tube, sweep, grad, stripes, xf, type V3 } from './shapes.ts';

/** Props shared by several courses. Each returns Parts in local space with the origin on the ground. */

export function boulder(r: Rng, color: string, size = 1, moss?: string) {
  const p = new Parts(), c = new THREE.Color(color), top = new THREE.Color(moss ?? color);
  const paint = (_x: number, y: number, _z: number, out: THREE.Color) => { out.copy(c).lerp(top, moss ? Math.min(1, Math.max(0, (y / size - .55) * 3)) : 0); };
  p.add(rock([size * r.range(.9, 1.3), size * r.range(.6, .9), size * r.range(.8, 1.1)], [0, size * .35, 0], r() * 99, [0, r() * 6, 0]), paint, { flat: true, ao: [0, size * .5, .6] });
  if (r() < .7) p.add(rock([size * .45, size * .35, size * .4], [size * r.range(.8, 1.1), size * .12, size * r.range(-.5, .5)], r() * 99), paint, { flat: true, ao: [0, size * .4, .6] });
  return p;
}

export function bush(r: Rng, leaf: string, dark: string, size = 1, berries?: string) {
  const p = new Parts(), n = r.int(3, 5);
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + r(), d = i ? size * .55 : 0, s = size * (i ? r.range(.5, .7) : .8);
    p.add(blob(s, [Math.cos(a) * d, s * .75, Math.sin(a) * d], r() * 9, .25), grad(dark, leaf, 0, size * 1.4), { layer: 'foliage', sway: .25, ao: [0, size * .8, .55] });
  }
  if (berries) for (let i = 0; i < 7; i++) { const a = r() * 6.28; p.add(bead(size * .1, [Math.cos(a) * size * .85, size * r.range(.6, 1.3), Math.sin(a) * size * .85]), berries, { layer: 'foliage', sway: .25, ao: false }); }
  return p;
}

/** A clump of grass blades on the foliage layer. Hidden on Low quality. */
export function grass(r: Rng, base: string, tip: string, size = 1, n = 9) {
  const p = new Parts();
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = r() * .35 * size; p.add(blade(.12 * size, r.range(.45, .9) * size, r.range(.1, .3) * size, [Math.cos(a) * d, 0, Math.sin(a) * d], r() * 6.28), grad(base, tip, 0, .8 * size), { layer: 'foliage', sway: 'height', swayTop: size, detail: true, ao: false }); }
  return p;
}

/** A few flowers: a stem blade and a five-petal star facing up, about a dozen triangles each. */
export function flowers(r: Rng, colors: string[], stem = '#4f8a3a', n = 5, size = 1) {
  const p = new Parts();
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = r() * .6 * size, h = r.range(.35, .6) * size, x = Math.cos(a) * d, z = Math.sin(a) * d, col = r.pick(colors), R = .13 * size;
    p.add(blade(.05 * size, h, .05, [x, 0, z], r() * 6), stem, { layer: 'foliage', sway: 'height', swayTop: h, detail: true, ao: false });
    const star: number[] = [];
    for (let k = 0; k < 5; k++) { const a0 = k / 5 * 6.28, a1 = a0 + .63, a2 = a0 + 1.26; star.push(x, h + .02, z, x + Math.cos(a1) * R, h + .03, z + Math.sin(a1) * R, x + Math.cos(a0) * R * .35, h + .02, z + Math.sin(a0) * R * .35, x, h + .02, z, x + Math.cos(a2) * R * .35, h + .02, z + Math.sin(a2) * R * .35, x + Math.cos(a1) * R, h + .03, z + Math.sin(a1) * R); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(star, 3)); g.computeVertexNormals();
    p.add(g, (px, py, pz, out) => out.set(Math.hypot(px - x, pz - z) < R * .3 ? '#ffe66a' : col), { layer: 'foliage', sway: .5, detail: true, ao: false });
  }
  return p;
}

/** Corner warning board: two posts, a frame and painted chevrons pointing in the turn direction (+x). */
export function chevronSign(board: string, arrow: string, post = '#5b4a3e', w = 3.2) {
  const p = new Parts(), h = 1.5, a = new THREE.Color(arrow), b = new THREE.Color(board);
  for (const x of [-w * .38, w * .38]) p.add(cyl(.08, .1, 1.8, [x, .9, -.08], [0, 0, 0], 6), post);
  p.add(rbox(w + .2, h + .2, .12, .05, [0, 1.8 + h / 2, -.06]), post, { ao: false });
  // Chevrons painted per vertex on a finely divided board, so the stripes stay crisp.
  const g = new THREE.PlaneGeometry(w, h, 48, 8).translate(0, 1.8 + h / 2, 0);
  p.add(g, (x, y, _z, out) => { const u = x / w + .5, v = (y - 1.8) / h - .5, k = ((u * 3 - Math.abs(v) * 1.1) % 1 + 1) % 1; out.copy(k < .5 ? a : b); }, { ao: false });
  p.add(xf(new THREE.PlaneGeometry(w, h).translate(0, 1.8 + h / 2, 0), [0, 0, -.13], [0, Math.PI, 0]), board, { ao: false });
  return p;
}

/** Iron or wooden lamp post with a glowing lantern. */
export function lampPost(metal: string, light: string, h = 4.2, hook = true) {
  const p = new Parts();
  p.add(cyl(.18, .24, .4, [0, .2, 0], [0, 0, 0], 8), metal); p.add(cyl(.07, .09, h, [0, h / 2, 0], [0, 0, 0], 8), metal);
  if (hook) { p.add(tube([[0, h - .1, 0], [0, h + .25, .3], [0, h + .1, .75]], .045, 6), metal, { ao: false }); }
  const lx = hook ? .75 : 0, ly = hook ? h - .35 : h + .3;
  p.add(cone(.32, .22, 6, [0, ly + .46, lx]), metal, { ao: false }); p.add(cyl(.2, .2, .08, [0, ly - .02, lx], [0, 0, 0], 6), metal, { ao: false });
  p.add(prism(.2, .16, .44, 6, [0, ly, lx]), light, { layer: 'glow', ao: false });
  return p;
}

/** Wall torch or standing brazier: stand, bowl and a glowing flame. */
export function brazier(stone: string, metal: string, flame = '#ffb347', h = 1.6) {
  const p = new Parts();
  p.add(prism(.38, .5, .3, 6, [0, 0, 0]), stone, { flat: true }); p.add(prism(.18, .24, h, 6, [0, .3, 0]), stone, { flat: true });
  p.add(lathe([[.12, 0], [.5, .1], [.62, .32], [.56, .36], [.4, .18], [0, .14]], [0, h + .25, 0], [0, 0, 0], 10), metal, { ao: false });
  p.add(cone(.36, .9, 7, [0, h + .45, 0]), flame, { layer: 'glow', ao: false }); p.add(cone(.2, 1.3, 6, [.08, h + .45, .05]), '#fff1b0', { layer: 'glow', ao: false });
  return p;
}

/** Pennant pole with a cloth flag that ripples in the wind. */
export function flagPole(cloth: string, trim: string, h = 7, pole = '#d9d4cc') {
  const p = new Parts();
  p.add(cyl(.07, .1, h, [0, h / 2, 0], [0, 0, 0], 6), pole); p.add(ball(.16, [0, h + .1, 0], .6), trim, { ao: false });
  const flag = new THREE.PlaneGeometry(2.4, 1.4, 8, 3).translate(1.2, h - .8, 0), pos = flag.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, Math.sin(x * 2.2) * .12 * x); if (x > 1.6) pos.setY(i, pos.getY(i) + (pos.getY(i) - (h - .8)) * -.5 * (x - 1.6)); }
  p.add(flag, (x, y, _z, out) => out.set(Math.abs(y - (h - .8)) > .5 ? trim : cloth), { layer: 'foliage', sway: 0, ao: false });
  // Sway grows towards the flag's free end.
  const g = p.layers.get('foliage')!.at(-1)!, sw = g.attributes.sway as THREE.BufferAttribute, gp = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sw.count; i++) sw.setX(i, Math.max(0, gp.getX(i)) * .6);
  return p;
}

/** Tall hanging banner on a crossbar, sized for festival arches and castle walls. */
export function banner(cloth: string, trim: string, emblem: string, w = 1.6, h = 4) {
  const p = new Parts();
  p.add(cyl(.06, .06, w + .5, [0, h, 0], [0, 0, Math.PI / 2], 6), trim, { ao: false });
  for (const s of [-1, 1]) p.add(ball(.12, [s * (w / 2 + .25), h, 0], .5), trim, { ao: false });
  const cut = .45, g = new THREE.BufferGeometry(), v = [-w / 2, h, 0, w / 2, h, 0, w / 2, cut, 0, 0, 0, 0, -w / 2, cut, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex([0, 4, 1, 1, 4, 2, 4, 3, 2]); g.computeVertexNormals();
  const ce = new THREE.Color(emblem), cc = new THREE.Color(cloth), ct = new THREE.Color(trim);
  const fine = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, h), new THREE.Vector2(w / 2, h), new THREE.Vector2(w / 2, cut), new THREE.Vector2(0, 0), new THREE.Vector2(-w / 2, cut)]), 1);
  g.dispose();
  const sub = subdivide(fine, 3);
  p.add(sub, (x, y, _z, out) => { const edge = Math.min(w / 2 - Math.abs(x), h - y, y - (cut - Math.abs(x) * cut * 2 / w)); const em = Math.hypot(x, (y - h * .58) * .8) < w * .28; out.copy(edge < .12 ? ct : em ? ce : cc); }, { layer: 'foliage', sway: 0, ao: false });
  const back = p.layers.get('foliage')!.at(-1)!, sw = back.attributes.sway as THREE.BufferAttribute, gp = back.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sw.count; i++) sw.setX(i, Math.max(0, (h - gp.getY(i)) / h) * .5);
  return p;
}

/** Splits every triangle into 4^n smaller ones, so vertex paint and wind can follow fine detail. */
export function subdivide(g: THREE.BufferGeometry, n: number) {
  let geo = g.index ? g.toNonIndexed() : g;
  for (let k = 0; k < n; k++) {
    const a = geo.attributes.position as THREE.BufferAttribute, out: number[] = [], P = (i: number) => [a.getX(i), a.getY(i), a.getZ(i)];
    const mid = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    for (let i = 0; i < a.count; i += 3) { const A = P(i), B = P(i + 1), C = P(i + 2), ab = mid(A, B), bc = mid(B, C), ca = mid(C, A); out.push(...A, ...ab, ...ca, ...ab, ...B, ...bc, ...ca, ...bc, ...C, ...ab, ...bc, ...ca); }
    const next = new THREE.BufferGeometry(); next.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); geo = next;
  }
  geo.computeVertexNormals(); return geo;
}

/** Magic crystal cluster: glowing cores inside darker facets. The classic Final Fantasy landmark. */
export function crystalCluster(r: Rng, core: string, shell: string, size = 1, base = '#4a4058') {
  const p = new Parts(), n = r.int(4, 7);
  p.add(rock([size * 1.1, size * .4, size * 1.1], [0, size * .1, 0], r() * 9), base, { flat: true, ao: [0, size * .4, .6] });
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = i ? size * r.range(.3, .8) : 0, h = size * (i ? r.range(1, 2.2) : 3), rr = size * (i ? r.range(.18, .3) : .42), tilt: V3 = [Math.sin(a) * (i ? .45 : .05), 0, -Math.cos(a) * (i ? .45 : .05)];
    const g = prism(0, rr, h * .25, 6, [0, h * .75, 0]), body = prism(rr, rr * .85, h * .75, 6);
    const pos: V3 = [Math.cos(a) * d, 0, Math.sin(a) * d];
    p.add(xf(body.clone(), pos, tilt), grad(shell, core, 0, h), { layer: 'glow', ao: false, flat: true });
    p.add(xf(g, pos, tilt), core, { layer: 'glow', ao: false, flat: true }); body.dispose();
  }
  return p;
}

/** Stack of old tyres for the test circuit's barriers. */
export function tyreStack(colors: string[], n = 3) {
  const p = new Parts();
  for (let i = 0; i < n; i++) p.add(torus(.42, .2, [0, .2 + i * .38, 0], [Math.PI / 2, 0, 0]), colors[i % colors.length], { ao: [0, .3, .7] });
  return p;
}

/** Seated spectators: rounded bodies and heads in mixed colours, filling a stand's rows. */
function crowd(p: Parts, r: Rng, rows: number, seats: number, rowH: number, rowD: number, w: number, palette: string[]) {
  for (let j = 0; j < rows; j++) for (let i = 0; i < seats; i++) {
    if (r() < .12) continue;
    const x = -w / 2 + (i + .5) * w / seats + r.range(-.1, .1), y = (j + 1) * rowH, z = -j * rowD - rowD * .5, c = r.pick(palette), arm = r() < .3;
    p.add(ellipsoid([.26, .34, .22], [x, y + .34, z], [0, 0, 0], .5), c, { ao: false, detail: false });
    p.add(ball(.19, [x, y + .82, z], .5), r.pick(['#f6d2b0', '#e8b48a', '#c98b64', '#fff0dc', '#ffe066']), { ao: false });
    if (arm) p.add(cyl(.06, .06, .5, [x + .25, y + .85, z], [0, 0, -.4], 5), c, { ao: false });
  }
}

/** Covered grandstand full of fans, facing +z (the road). */
export function grandstand(r: Rng, o: { w?: number; rows?: number; frame: string; seat: string; roof: string; trim: string; crowd: string[] }) {
  const p = new Parts(), w = o.w ?? 24, rows = o.rows ?? 6, rh = .55, rd = .9, depth = rows * rd + 1.5;
  for (let j = 0; j < rows; j++) p.add(block(w, rh * (j + 1), rd, [0, 0, -j * rd - rd / 2]), j % 2 ? o.seat : o.frame, { ao: [0, .3, .8] });
  for (const x of [-w / 2, -w / 6, w / 6, w / 2]) p.add(block(.35, rh * rows + 4.5, .35, [x, 0, -depth + .6]), o.frame);
  for (const x of [-w / 2, w / 2]) p.add(block(.3, 2, depth, [x, 0, -depth / 2]), o.frame);
  // Sloped roof with a scalloped trim.
  const roofY = rh * rows + 4.5;
  p.add(xf(new THREE.BoxGeometry(w + 1.4, .3, depth + 1.5), [0, roofY, -depth / 2 + .4], [-.12, 0, 0]), o.roof, { ao: false });
  for (let i = 0; i < Math.round(w / 1.4); i++) p.add(xf(new THREE.ConeGeometry(.45, .7, 3).rotateX(Math.PI), [-w / 2 + .7 + i * 1.4, roofY - .5 - .04, .9], [0, 0, 0]), i % 2 ? o.trim : o.roof, { ao: false });
  crowd(p, r, rows, Math.round(w / .75), rh, rd, w - 1, o.crowd);
  return p;
}

/** Floating festival balloon on a string. */
export function balloon(color: string, size = 1) {
  const p = new Parts();
  p.add(lathe([[0, 0], [.3, .15], [.95, .9], [1.05, 1.5], [.8, 2.1], [0, 2.35]].map(([x, y]) => [x * size, y * size] as [number, number]), [0, 0, 0], [0, 0, 0], 12), stripes(color, '#ffffff', .8 * size, 'y'), { ao: false });
  p.add(cyl(.01, .01, 3 * size, [0, -1.5 * size, 0], [0, 0, 0], 3), '#f4f0e8', { ao: false });
  return p;
}

/** Garland of triangular pennants strung between two points, sagging in the middle. */
export function bunting(kit: Kit, a: THREE.Vector3, b: THREE.Vector3, colors: string[], sag = 1.2) {
  const p = new Parts(), n = Math.max(3, Math.round(a.distanceTo(b) / .9)), pts: V3[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, v = a.clone().lerp(b, t); v.y -= Math.sin(t * Math.PI) * sag; pts.push([v.x, v.y, v.z]); }
  p.add(tube(pts, .025, 4), '#f4efe6', { ao: false });
  const dir = b.clone().sub(a).normalize(), yaw = Math.atan2(dir.x, dir.z) + Math.PI / 2;
  for (let i = 1; i < n; i++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-.3, 0, 0, .3, 0, 0, 0, -.6, 0], 3)); g.computeVertexNormals(); p.add(xf(g, pts[i], [0, yaw, 0]), colors[i % colors.length], { layer: 'foliage', sway: .3, ao: false }); }
  kit.place(p, 0, 0, 0); p.dispose();
}

/** Glowing save point: a rotating ring of light the racers pass by. Static here; the course animates nothing. */
export function savePoint(color = '#9fe8ff') {
  const p = new Parts();
  p.add(cyl(1.3, 1.5, .25, [0, .12, 0], [0, 0, 0], 16), '#d9dce8', { ao: false });
  p.add(torus(1.05, .07, [0, .3, 0], [Math.PI / 2, 0, 0]), color, { layer: 'glow', ao: false });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; p.add(xf(new THREE.OctahedronGeometry(.18), [Math.cos(a) * 1.05, 1.2 + (i % 2) * .4, Math.sin(a) * 1.05]), '#ffffff', { layer: 'glow', ao: false }); }
  return p;
}

/** Plain re-exports for course files, so they import shapes and props from one place. */
export { blob, block, prism, cone, card, blade, cyl, ball, bead, disc, ellipsoid, rbox, rock, torus, lathe, tube, sweep, grad, stripes, xf };
