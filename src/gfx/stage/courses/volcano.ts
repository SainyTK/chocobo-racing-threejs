import * as THREE from 'three';
import { Parts, type Kit } from '../kit.ts';
import { makeLiquid } from '../liquid.ts';
import { fbm2, ridge2, hash2, noise2, smoothstep, type Rng } from '../noise.ts';
import { stageMaterial, stageGlow, stageTime } from '../materials.ts';
import { noiseTexture } from '../textures.ts';
import { Particles, Shape } from '../../particles/particles.ts';
import { boulder, brazier, blob, block, prism, cone, cyl, bead, disc, rock, lathe, sweep, grad, xf } from '../props/common.ts';
import { horn } from '../props/shapes.ts';
import type { CourseArt } from '../types.ts';

/** Lava sea level. The road ridge never dips below about -5, so the cliffs always show. */
const LAVA = -14;
const K = { boneDark: new THREE.Color('#9c8a6e'), basaltDark: new THREE.Color('#1d1a22'), ash: new THREE.Color('#7c6e6e'), crust: new THREE.Color('#8a2a14'), crater: new THREE.Color('#7a2a18') };
const C = {
  basalt: '#33303c', basaltLight: '#57525f', basaltDark: '#1d1a22', ash: '#7c6e6e', hot: '#5e2620', ember: '#ff6a1a', magma: '#ff5414', flame: '#ffb347',
  obsidian: '#1c1524', obsidianLight: '#4a3a62', bone: '#e4d6ba', boneDark: '#9c8a6e', iron: '#4a4246', ironLight: '#7a6e6a', bronze: '#b08a5a', char: '#1d1719',
};

/** Hexagonal basalt columns packed in a cluster, one unit tall; placements stretch them to reach the lava. */
function basaltColumns(r: Rng, n = 7) {
  const p = new Parts(), dark = new THREE.Color('#15131c'), light = new THREE.Color('#3c3a4e'), top = new THREE.Color('#8e8696');
  const cells: [number, number][] = [[0, 0]]; for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28 + .52; cells.push([Math.cos(a) * 1.75, Math.sin(a) * 1.75]); }
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; cells.push([Math.cos(a) * 3.2, Math.sin(a) * 3.2]); }
  for (const [x, z] of cells.slice(0, n)) {
    const h = r.range(.72, 1), rr = r.range(.82, .98);
    p.add(prism(rr, rr, h, 6, [x, 0, z]), (_x, y, _z, out) => { out.copy(dark).lerp(light, y / h); if (y > h - .001) out.copy(top); }, { flat: true, ao: false });
  }
  return p;
}

/** Tall black glass shard with violet facets and a faint glowing vein. */
function obsidianSpire(r: Rng) {
  const p = new Parts(), h = r.range(9, 15);
  p.add(cone(h * .16, h, 5, [0, 0, 0], [r.range(-.08, .08), r() * 6, r.range(-.08, .08)]), grad(C.obsidian, C.obsidianLight, 0, h), { flat: true, ao: [0, 2, .5] });
  for (let i = 0; i < 3; i++) { const a = r() * 6.28, hh = h * r.range(.3, .55); p.add(cone(hh * .2, hh, 4, [Math.cos(a) * h * .14, 0, Math.sin(a) * h * .14], [Math.sin(a) * .35, 0, -Math.cos(a) * .35]), grad(C.obsidian, C.obsidianLight, 0, hh), { flat: true, ao: [0, 1.5, .5] }); }
  p.add(rock([h * .2, h * .06, h * .2], [0, 0, 0], r() * 9), C.basaltDark, { flat: true, ao: false });
  return p;
}

/** Magma boulder: dark crust shards split around a glowing core that shows through the cracks. */
function magmaRock(r: Rng, size = 1) {
  const p = new Parts();
  p.add(rock([size * .82, size * .62, size * .8], [0, size * .5, 0], r() * 9), C.magma, { layer: 'glow', flat: true, ao: false });
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * 6.28 + r() * .4, dx = Math.cos(a) * size * .32, dz = Math.sin(a) * size * .32;
    p.add(rock([size * .62, size * .52, size * .62], [dx, size * (.42 + (i % 2) * .12), dz], r() * 99, [0, a, 0]), grad(C.basaltDark, C.basalt, 0, size), { flat: true, ao: [0, size * .5, .6] });
  }
  p.add(rock([size * .5, size * .4, size * .5], [0, size * .92, 0], r() * 99), C.basalt, { flat: true, ao: false });
  return p;
}

/** Burnt dead tree: a twisted charcoal trunk with forked branches, ember-tipped. */
function charredTree(r: Rng) {
  const p = new Parts(), h = r.range(4.5, 7), lean = r.range(-.6, .6);
  p.add(sweep([[0, 0, 0], [lean * .4, h * .4, .2], [lean, h * .75, -.1], [lean * 1.2, h, 0]], t => .38 - t * .3, { radial: 6, segments: 6 }), grad(C.char, '#3a2e30', 0, h), { flat: true, ao: [0, 1, .6] });
  for (let i = 0; i < 4; i++) {
    const a = r() * 6.28, y = h * r.range(.45, .85), L = r.range(1.2, 2.4), sx = lean * (y / h), tip: [number, number, number] = [sx + Math.cos(a) * L, y + L * .7, Math.sin(a) * L];
    p.add(sweep([[sx, y, 0], [sx + Math.cos(a) * L * .5, y + L * .2, Math.sin(a) * L * .5], tip], t => .14 - t * .11, { radial: 4, segments: 4 }), C.char, { flat: true, ao: false });
    if (r() < .5) p.add(bead(.09, tip), C.ember, { layer: 'glow', ao: false });
  }
  for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28 + r(); p.add(sweep([[0, .5, 0], [Math.cos(a) * .6, .1, Math.sin(a) * .6], [Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1]], t => .16 - t * .1, { radial: 4, segments: 3 }), C.char, { ao: false }); }
  return p;
}

/** One giant rib over the road, local x across the road. Feet sit below the cliff lip; the span clears 13 m. */
function rib(w: number, r: Rng) {
  const p = new Parts(), lean = r.range(-.6, .6), pts: [number, number, number][] = [[-(w + 7.6), -5, 0], [-(w + 6.6), 6, lean * .3], [-(w + 2.5), 14, lean], [0, 16.4, lean * 1.2], [w + 2.5, 14, lean], [w + 6.6, 6, lean * .3], [w + 7.6, -5, 0]];
  p.add(sweep(pts, t => .9 + Math.abs(t - .5) * 1.4 + Math.sin(t * Math.PI * 8) * .08, { radial: 8, segments: 28 }), (x, y, _z, out) => { out.set(C.bone).lerp(K.boneDark, smoothstep(6, -5, y) * .7 + Math.abs(Math.sin(x * .7)) * .12); }, { ao: false });
  // A vertebra where the rib meets the spine.
  p.add(rock([1.6, 1.1, 1.8], [0, 17.2, lean * 1.2], 3), C.bone, { flat: true, ao: false });
  p.add(horn([[0, 17.6, lean * 1.2], [0, 19.5, lean * 1.2 - .6], [0, 20.6, lean * 1.2 - 1.6]], .55), C.boneDark, { ao: false });
  return p;
}

/** Horned beast skull watching the road, with glowing eyes. Faces +z. */
function skull(r: Rng) {
  const p = new Parts(), bone = grad(C.boneDark, C.bone, 0, 7);
  p.add(blob([4, 3.4, 4.2], [0, 4.6, 0], 2, .12), bone, { ao: [0, 3, .6] });
  p.add(blob([2.9, 1.8, 3.2], [0, 2.4, 2.6], 5, .1), bone, { ao: [0, 2, .6] });
  for (let i = -3; i <= 3; i++) p.add(cone(.32, 1.2, 4, [i * .7, .8, 4.9], [Math.PI, 0, 0]), C.bone, { ao: false, flat: true });
  for (const s of [-1, 1]) {
    p.add(blob([1.05, .9, .5], [s * 1.6, 5, 3.75], s, .05), '#140c10', { ao: false });
    p.add(bead(.55, [s * 1.6, 5, 3.95]), C.ember, { layer: 'glow', ao: false });
    p.add(horn([[s * 3, 6.4, 0], [s * 6.5, 8.5, -1.5], [s * 8.4, 12.4, -.5], [s * 7.6, 14.6, 2]], 1.25), grad(C.boneDark, '#f2e8d2', 5, 14), { ao: false });
  }
  p.add(rock([5, 2, 5], [0, .6, 0], 7), C.basalt, { flat: true, ao: false });
  r();
  return p;
}

/** Cliff-edge marker: a squat basalt bollard crowned with a glowing ember. Chains between them are built per span. */
function bollard(iron = false) {
  const p = new Parts();
  if (iron) { p.add(prism(.12, .14, 1.3, 6), C.iron); p.add(prism(.2, .2, .12, 6, [0, 1.3, 0]), C.ironLight, { ao: false }); p.add(bead(.13, [0, 1.5, 0]), C.flame, { layer: 'glow', ao: false }); return p; }
  p.add(prism(.28, .38, 1.05, 6), grad(C.basaltDark, C.basaltLight, 0, 1.1), { flat: true }); p.add(prism(.36, .3, .2, 6, [0, 1.05, 0]), C.bronze, { flat: true, ao: false });
  p.add(bead(.2, [0, 1.38, 0]), C.ember, { layer: 'glow', ao: false });
  return p;
}

/**
 * The ridge cliffs, swept along both edges like `kit.extrude`, except that on the inside of hairpins each profile point
 * is pulled back until it is no nearer to another stretch of road, so the cliffs never fold across the track.
 */
function cliffs(kit: Kit, profile: [number, number][], s0: number, s1: number, step: number, paint: (s: number, k: number, i: number, out: THREE.Color) => void) {
  const w = kit.w, steps = Math.max(1, Math.round((s1 - s0) / step)), ds = (s1 - s0) / steps, piece = 12;
  const reach = (s: number, side: number, x: number) => { let o = w + x; for (let k = 0; k < 12; k++) { const p = kit.at(s, side * o); if (kit.road(p.x, p.z).d >= o - .7 || o <= w + 5.05) break; o = Math.max(w + 5.05, o - .9); } return o; };
  for (const side of [-1, 1]) for (let p0 = 0; p0 < steps; p0 += piece) {
    const rows: THREE.Vector3[][] = [];
    for (let i = p0; i <= Math.min(steps, p0 + piece); i++) { const s = s0 + i * ds; rows.push(profile.map(([x, y]) => { const o = x <= 5 ? w + x : reach(s, side, x), q = kit.at(s, side * o), r = kit.road(q.x, q.z); return new THREE.Vector3(q.x, r.d < w - .5 ? Math.min(kit.at(s).y + y, r.y - 2.5) : kit.at(s).y + y, q.z); })); }
    const mid = rows[rows.length >> 1][0], pos: number[] = [], cols: THREE.Color[] = [], c = new THREE.Color();
    for (let i = 0; i < rows.length - 1; i++) for (let k = 0; k < profile.length - 1; k++) {
      const A = rows[i][k], B = rows[i][k + 1], Cc = rows[i + 1][k], D = rows[i + 1][k + 1], quad = side > 0 ? [A, Cc, B, B, Cc, D] : [A, B, Cc, B, D, Cc];
      for (const v of quad) pos.push(v.x - mid.x, v.y - mid.y, v.z - mid.z);
      paint(s0 + (p0 + i) * ds, k, p0 + i, c); for (let j = 0; j < 6; j++) cols.push(c.clone());
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    let n = 0; const parts = new Parts().add(g, (_x, _y, _z, out) => { out.copy(cols[n++]); }, { ao: false });
    kit.place(parts, mid.x, mid.y, mid.z); parts.dispose();
  }
}

/** Track-aligned frame helper: world point at distance s, offset off, lifted by y. */
const at = (kit: Kit, s: number, off: number, y = 0) => { const p = kit.at(s, off); return new THREE.Vector3(p.x, p.y + y, p.z); };

/** Lowest-curvature stretch of `length` metres, avoiding the given ranges. */
function straightest(kit: Kit, length: number, avoid: [number, number][]) {
  let best = 0, cost = Infinity;
  for (let s = 90; s < kit.len - length - 90; s += 8) {
    if (avoid.some(([a, b]) => s + length > a - 40 && s < b + 40)) continue;
    let c = 0; for (let k = 0; k <= length; k += 6) c += Math.abs(kit.at(s + k).curve); if (c < cost) { cost = c; best = s; }
  }
  return best;
}

/** Glowing lava cascades pouring off the ridge into the sea, sharing one scrolling shader. */
function lavaFalls(kit: Kit, spots: { s: number; side: number }[]) {
  const noise = kit.own(noiseTexture(256));
  const mat = kit.own(new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNoise: { value: null } }]),
    vertexShader: `varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform sampler2D uNoise; varying vec2 vUv;
      #include <fog_pars_fragment>
      void main(){ float n = texture2D(uNoise, vec2(vUv.x * .8, vUv.y * .25 - uTime * .12)).r * .6 + texture2D(uNoise, vec2(vUv.x * 2.3 + .3, vUv.y * .6 - uTime * .3)).g * .4;
        float edge = min(vUv.x, 1. - vUv.x); if (edge * 2.6 + n * .6 < .38) discard;
        vec3 c = mix(vec3(.55, .05, .01), vec3(1., .42, .05), smoothstep(.35, .6, n)); c = mix(c, vec3(1., .85, .45), smoothstep(.66, .74, n));
        c *= mix(.6, 1., smoothstep(.0, .25, edge)) * 2.2;
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }));
  mat.uniforms.uNoise.value = noise; mat.uniforms.uTime = stageTime;
  const rows = 18, cols = 5;
  for (const { s, side } of spots) {
    const p = kit.at(s, side * (kit.w + 6)), top = new THREE.Vector3(p.x, p.y - 1.4, p.z), out = new THREE.Vector3(p.nx * side, 0, p.nz * side), along = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const W = 4.5, drop = top.y - LAVA, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const t = j / rows, u = i / cols, spread = 1 + t * .5, v = top.clone().addScaledVector(out, 1.2 + t ** 1.6 * 4.5 + Math.sin(u * 3.14) * .5).addScaledVector(along, (u - .5) * W * spread);
      v.y = top.y - drop * t - .3; pos.push(v.x, v.y, v.z); uv.push(u, t * drop / 6);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.name = 'lava fall'; kit.add(m);
    // Crust lips around the source and a glowing splash pool where it lands.
    kit.onTrack(kit.prop('magma rock', r => magmaRock(r, 2.2), 1), s, side * (kit.w + 6.4), { y: -2.6, yaw: kit.r() * 6 });
    const foot = top.clone().addScaledVector(out, 6.2);
    kit.place(kit.prop('splash', () => new Parts().add(disc(3.4, 10), C.flame, { layer: 'glow', ao: false }).add(disc(5.2, 12, [0, -.05, 0]), C.magma, { layer: 'glow', ao: false })), foot.x, LAVA + .25, foot.z);
  }
}

/** Iron trestle bridge replacing the ridge over one straight: deck, side girders, piers into the lava and abutments. */
function bridge(kit: Kit, b0: number, b1: number) {
  const w = kit.w, ga = new THREE.Color('#3e383a'), gb = new THREE.Color('#57504e');
  kit.extrude([[-.05, .015], [5, .015]], { s0: b0, s1: b1, step: 1, mirror: true, paint: (s, _k, _i, out) => out.copy(Math.floor(s) % 2 ? ga : gb) });
  kit.extrude([[5, .015], [5.25, .5], [5.25, -1.9], [4.4, -1.9]], { s0: b0, s1: b1, step: 3, mirror: true, paint: (s, k, _i, out) => out.set(k === 1 ? (Math.floor(s / 3) % 2 ? C.iron : '#5c4a40') : C.iron) });
  kit.extrude([[w + 4.5, -1.9], [-(w + 4.5), -1.9]], { s0: b0, s1: b1, step: 3, offset: 0, mirror: false, paint: '#2a2426' });
  for (let s = b0 + 9; s < b1 - 4; s += 18) {
    const y = kit.at(s).y, H = y - 1.9 - (LAVA - 3), pier = new Parts();
    for (const x of [-(w - 1), w - 1]) pier.add(prism(1.1, 1.5, H, 6, [x, 0, 0]), grad(C.basaltDark, C.iron, 0, H), { flat: true, ao: false });
    for (let k = 1; k < 4; k++) pier.add(block(2 * (w - 1), .7, .7, [0, H * k / 4, 0]), C.iron, { ao: false });
    pier.add(xf(new THREE.BoxGeometry(.35, Math.hypot(2 * (w - 1), H * .5), .35), [0, H * .62, 0], [0, 0, Math.atan2(2 * (w - 1), H * .5)]), C.ironLight, { ao: false });
    kit.onTrack(pier.bake(), s, 0, { y: -(y - (LAVA - 3)) }); pier.dispose();
  }
  for (const s of [b0, b1]) {
    const y = kit.at(s).y, H = y - (LAVA - 4) - .9, ab = new Parts();
    ab.add(block(2 * (w + 7), H, 5), grad(C.basaltDark, C.basalt, 0, H), { flat: true, ao: false });
    for (const x of [-(w + 6.2), w + 6.2]) { ab.add(block(2.2, H + 4.5, 2.2, [x, 0, 0]), grad(C.basaltDark, C.basaltLight, 0, H + 4), { flat: true, ao: false }); }
    kit.onTrack(ab.bake(), s, 0, { y: -H - .85 }); ab.dispose();
    for (const side of [-1, 1]) kit.onTrack(kit.prop('brazier', () => brazier(C.basalt, C.bronze, C.flame, 1.2)), s, side * (w + 6.2), { y: 3.65 });
  }
}

/** The erupting volcano on the horizon: craggy cone, glowing crater and lava streaks, a rolling smoke plume and ember bursts. */
function volcanoLandmark(kit: Kit, horizon: string) {
  const dir = new THREE.Vector2(.6, .8).normalize(), cx = kit.bounds.cx + dir.x * 1150, cz = kit.bounds.cz + dir.y * 1150, R = 320, H = 380;
  const solid = kit.own(stageMaterial({ rim: .1 })), glowMat = kit.own(stageGlow(1.6)); solid.fog = false; glowMat.fog = false;
  const haze = new THREE.Color(horizon), base = new THREE.Color('#1c141c'), ash = new THREE.Color('#4a3e46');
  const prof: [number, number][] = [[R * 1.1, -60], [R, 0], [R * .78, 50], [R * .55, 120], [R * .38, 190], [R * .26, 245], [R * .2, 285], [R * .17, H], [R * .145, H - 6], [R * .12, H - 26], [0, H - 34]];
  const cone3 = lathe(prof, [0, 0, 0], [0, 0, 0], 56), pa = cone3.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), a = Math.atan2(z, x), k = 1 + (ridge2(a * 3, y / 70, 3, 5) - .5) * .22 * smoothstep(H, 0, y); pa.setXYZ(i, x * k, y, z * k); }
  const toCourse = Math.atan2(kit.bounds.cz - cz, kit.bounds.cx - cx), p = new Parts();
  p.add(cone3, (x, y, z, out) => { const a = Math.atan2(z, x); out.copy(base).lerp(ash, smoothstep(140, 280, y) * .8 + (noise2(a * 12, y / 30) - .5) * .25); out.lerp(haze, .12 + .25 * smoothstep(100, -40, y)); if (y > H - 30 && Math.hypot(x, z) < R * .16) out.copy(K.crater); }, { flat: true, ao: false });
  // Lava streaks down the flank facing the course.
  for (let k = 0; k < 6; k++) {
    const a = toCourse + (k - 2.5) * .22 + Math.sin(k * 7) * .05, pts: [number, number, number][] = [];
    const stop = 170 - k * 25 - (k % 2) * 50;
    for (let y = H - 2; y > stop; y -= 22) { const t = (H - y) / (H + 60), rad = R * (.17 + t * .9) + 3, wob = Math.sin(y * .05 + k) * .04; pts.push([Math.cos(a + wob) * rad, y, Math.sin(a + wob) * rad]); }
    if (pts.length > 2) p.add(sweep(pts, t => 9 - t * 6, { radial: 5, segments: pts.length * 2, flat: .35 }), k % 2 ? '#e8300a' : '#ff4a0e', { layer: 'glow', ao: false });
  }
  p.add(disc(R * .14, 20, [0, H - 30, 0]), C.flame, { layer: 'glow', ao: false });
  p.bake();
  const g = new THREE.Group(); g.name = 'volcano'; g.position.set(cx, 0, cz);
  for (const [layer, [geo]] of p.layers) { const m = new THREE.Mesh(geo, layer === 'glow' ? glowMat : solid); g.add(m); }
  // Smoke plume: puffs rise, swell and drift with the wind, lit orange from the crater below.
  const puffGeo = new Parts().add(blob(1, [0, 0, 0], 3, .3), grad('#b0502a', '#4a3a3e', -1, .6), { ao: false }).bake().layers.get('solid')![0];
  const puffs: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; o: number }[] = [];
  for (let i = 0; i < 16; i++) { const mat = kit.own(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false })), m = new THREE.Mesh(puffGeo, mat); g.add(m); puffs.push({ m, mat, o: i / 16 }); }
  const embers = new Particles(400, true); embers.mesh.position.set(0, 0, 0); g.add(embers.mesh); kit.own({ dispose: () => { embers.dispose(); puffGeo.dispose(); } });
  let debt = 0, nextBurst = 4;
  kit.onUpdate((t, dt) => {
    for (const q of puffs) { const k = (t * .025 + q.o) % 1, s = 40 + k * 150; q.m.position.set(k * 260 + Math.sin(q.o * 40) * 30, H + 10 + k * 380, -k * 90 + Math.cos(q.o * 30) * 30); q.m.scale.set(s, s * .8, s); q.m.rotation.y = q.o * 9 + t * .02; q.mat.opacity = Math.min(1, k * 8) * (1 - k) * .92; }
    glowMat.color.setScalar(1.6 * (.85 + .15 * Math.sin(t * 2.3)));
    if (dt <= 0) { embers.update(0); return; }
    debt += dt * (t > nextBurst && t < nextBurst + 1.5 ? 90 : 10);
    if (t > nextBurst + 1.5) nextBurst = t + 7 + Math.random() * 6;
    while (debt >= 1) { debt--; const a = Math.random() * 6.28, sp = 20 + Math.random() * 40; embers.emit({ x: Math.cos(a) * 30, y: H - 10, z: Math.sin(a) * 30, vx: Math.cos(a) * sp * .5, vy: 60 + Math.random() * 70, vz: Math.sin(a) * sp * .5, life: 3.5, size: 5 + Math.random() * 6, endSize: 2, color: '#ffe08a', endColor: '#ff3a0a', gravity: 30, shape: Shape.Glow }); }
    embers.update(dt);
  });
  kit.add(g);
}

/** Chains sagging between two edge bollards, built in the first bollard's local space so they cull with their chunk. */
function chain(kit: Kit, a: THREE.Vector3, b: THREE.Vector3, color: string) {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 4; i++) { const t = i / 4, v = a.clone().lerp(b, t); v.y -= Math.sin(t * Math.PI) * .35; pts.push([v.x - a.x, v.y - a.y, v.z - a.z]); }
  const p = new Parts().add(sweep(pts, .05, { radial: 4, segments: 8, caps: false }), color, { ao: false, detail: true });
  kit.place(p, a.x, a.y, a.z); p.dispose();
}

export const volcano: CourseArt = {
  env: {
    sky: { top: '#140816', horizon: '#a8442e', below: '#4a1c1a', band: { color: '#ff7a2a', height: .07, strength: .9 }, sun: { color: '#ffb070', size: .075, glow: .9 },
      clouds: { lit: '#c47660', shade: '#3a1e28', cover: .62, scale: .8, speed: 1.6 }, cumulus: { lit: '#a0584e', shade: '#2c1820', height: .24, amount: .72 } },
    fog: { color: '#a8442e', near: 190, far: 900 },
    hemi: { sky: '#d8a0a0', ground: '#ff6a32', intensity: 1.3 },
    sun: { color: '#ffb27a', intensity: 2.4, dir: [.55, .42, -.55] },
    mountains: [
      { color: '#2a161e', radius: 1040, height: 270, rough: .9, haze: .5, seed: 11 },
      { color: '#3e1c22', radius: 860, height: 140, rough: .75, haze: .32, seed: 4 },
    ],
  },
  terrain: {
    height(p) {
      const near = smoothstep(p.w + 70, p.w + 240, p.d), far = smoothstep(300, 700, p.d);
      const isle = smoothstep(.6, .74, fbm2(p.x / 45, p.z / 45, 3, 21)) * smoothstep(p.w + 18, p.w + 40, p.d) * 13;
      const mount = ridge2(p.x / 170, p.z / 170, 4, 9) * 80 + fbm2(p.x / 60, p.z / 60, 3, 2) * 25;
      return -30 + isle + near * (mount * .8 + 4) + far * 60;
    },
    color(p, h, slope, out) {
      const n = fbm2(p.x * .05, p.z * .05, 3, 4);
      out.set(C.basalt).lerp(K.basaltDark, smoothstep(.4, .9, slope) * .7).lerp(K.ash, smoothstep(40, 90, h) * .6 + (n - .5) * .3);
      out.lerp(K.crust, smoothstep(LAVA + 4, LAVA + .5, h));
    },
    detail: 'ash',
  },
  road: { kind: 'basalt', glow: .2, palette: { base: '#463f4a', dark: '#26222a', light: '#655d6a', accent: '#8a3018' } },
  start: { pillar: '#3a2a2e', trim: '#c8a070', banner: '#8a1f1a', text: '#ffd27a', light: '#ff9a3a', flags: ['#c22a1a', '#ffb347', '#2a1a1e'] },
  hazard: 'lava',
  signs: { board: '#2a2226', arrow: '#ff9a3a', post: '#5a4a48' },
  ambient: [
    { color: '#ffd27a', endColor: '#ff3a0a', rate: 26, size: .14, life: 3.5, glow: true, height: [0, 5], drift: [.3, 1.4, .2], wander: .8, radius: 36 },
    { color: '#a89a98', endColor: '#5a4e50', rate: 12, size: .16, life: 5, height: [5, 13], drift: [.8, -.6, .3], wander: .5, shape: Shape.Shard, radius: 32, alpha: .85 },
  ],
  catalog: {
    'Basalt columns': r => basaltColumns(r, 13).bake(), 'Obsidian spire': obsidianSpire, 'Magma rock': r => magmaRock(r, 2), 'Charred tree': charredTree,
    'Rib arch': r => rib(10.5, r), 'Horned skull': skull, 'Edge bollard': () => bollard(), 'Bridge post': () => bollard(true), Brazier: () => brazier(C.basalt, C.bronze, C.flame, 1.2), Boulder: r => boulder(r, C.basalt, 1.6),
  },
  build(kit) {
    const r = kit.r, w = kit.w, len = kit.len, terrainAt = kit.groundAt;
    // Embers and props spawn on the ridge or above the lava, never inside the cliffs.
    kit.groundAt = (x, z) => { const q = kit.road(x, z); return q.d < w + 5.5 ? q.y : Math.max(terrainAt(x, z), LAVA); };
    makeLiquid(kit, { y: LAVA, deep: '#5a0a06', shallow: '#c8360a', foam: '#ff9a2a', glow: .7, scale: 1.3, speed: .5, swell: .25, size: 2800 });

    const ribs = straightest(kit, 60, [[len - 80, len], [0, 80]]), b0 = straightest(kit, 72, [[len - 80, len], [0, 80], [ribs, ribs + 60]]), b1 = b0 + 72;
    // The ridge: drivable shoulder out to w + 5 at road height, a cracked lip, then jagged cliffs into the lava.
    const shoulder = [new THREE.Color('#38333e'), new THREE.Color('#3a3540'), new THREE.Color('#36313c')], face = [new THREE.Color(C.basalt), new THREE.Color('#2e252b'), new THREE.Color('#41363b')], hot = new THREE.Color(C.hot);
    const cliff: [number, number][] = [[-.05, .015], [5, .015], [5.3, -.3], [5.7, -1.7], [6, -4.2], [6.8, -7], [6.5, -11], [7.8, -17], [8.8, -27], [10, -52]];
    const paint = (s: number, k: number, i: number, out: THREE.Color) => { const h = hash2(i, k, 7); if (k === 0) out.copy(shoulder[Math.floor(hash2(i, 3) * 3)]); else if (k === 1) out.copy(K.ash); else out.copy(face[Math.floor(h * 3)]).lerp(hot, k >= 5 && k <= 6 ? .5 + h * .3 : 0); };
    cliffs(kit, cliff, 0, b0, 2.5, paint);
    cliffs(kit, cliff, b1, len, 2.5, paint);
    // Warning curbs: basalt and ember stripes along both road edges.
    const ca = new THREE.Color('#2a2226'), cb = new THREE.Color('#e0602a');
    kit.extrude([[-.35, .03], [-.2, .11], [.3, .11], [.45, .03]], { step: 3, mirror: true, paint: (s, k, _i, out) => out.copy(k === 2 ? ca : Math.floor(s / 3) % 2 ? ca : cb) });
    bridge(kit, b0, b1);

    // Edge bollards with chains mark where the ridge ends.
    for (const side of [-1, 1]) for (let s = 0; s < len - 1; s += 10) {
      const onBridge = s >= b0 - 1 && s <= b1 + 1, off = side * (w + 5.25);
      if (Math.abs(((s + len / 2) % len) - len / 2) < 30) continue;
      // Inside tight hairpins the ridge edge meets the other leg of the road; leave those stretches open.
      const clear = (q: number) => { const p = kit.at(q, off); return kit.road(p.x, p.z).d > w + 4; };
      if (!clear(s)) continue;
      kit.onTrack(kit.prop(onBridge ? 'post' : 'bollard', () => bollard(onBridge)), s, off);
      if (s + 10 < len - 1 && clear(s + 5) && clear(s + 10)) chain(kit, at(kit, s, off, onBridge ? 1.35 : 1.15), at(kit, s + 10, off, onBridge ? 1.35 : 1.15), onBridge ? C.ironLight : C.iron);
    }
    // Rock outcrops break up the cliff faces.
    for (let s = 0; s < len; s += r.range(5, 9)) for (const side of [-1, 1]) {
      if (s > b0 - 4 && s < b1 + 4) continue;
      const off = w + r.range(6.4, 8.4), q = kit.at(s, side * off); if (kit.road(q.x, q.z).d < off - 1) continue;
      kit.onTrack(kit.prop('outcrop', rr => boulder(rr, C.basaltDark, 1.6), r.int(0, 4)), s, side * off, { y: -r.range(3, 14), yaw: r() * 6, scale: r.range(1.4, 2.8) });
    }
    // Basalt columns and obsidian spires rising out of the lava beside the ridge.
    kit.scatter(170, w + 11, w + 60, (x, z, d) => {
      const top = kit.road(x, z).y + r.range(-7, 1.5) - (d - w) * .08, base = LAVA - 3;
      if (terrainAt(x, z) > LAVA - 1) return;
      if (r() < .62) kit.place(kit.prop('columns', rr => basaltColumns(rr, r.int(4, 13)), r.int(0, 5)), x, base, z, { yaw: r() * 6, scale: [r.range(1.8, 2.8), Math.max(4, top - base), r.range(1.8, 2.8)] });
      else kit.place(kit.prop('spire', obsidianSpire, r.int(0, 4)), x, base + 2, z, { yaw: r() * 6, scale: r.range(.8, 1.6) });
    });
    // Islands and far slopes: magma rocks, charred trees, spires.
    kit.scatter(420, w + 25, 260, (x, z) => {
      const y = terrainAt(x, z); if (y < LAVA + 1.5) return;
      const k = r();
      if (k < .4) kit.place(kit.prop('tree', charredTree, r.int(0, 5)), x, y - .2, z, { yaw: r() * 6, scale: r.range(.9, 1.6) });
      else if (k < .65) kit.place(kit.prop('magma', rr => magmaRock(rr, 2), r.int(0, 3)), x, y - .4, z, { yaw: r() * 6, scale: r.range(.8, 2.2) });
      else if (k < .85) kit.place(kit.prop('spire', obsidianSpire, r.int(0, 4)), x, y - 1, z, { yaw: r() * 6, scale: r.range(.8, 1.8) });
      else kit.place(kit.prop('columns', rr => basaltColumns(rr, 7), r.int(0, 5)), x, y - 1, z, { yaw: r() * 6, scale: [1.2, r.range(5, 12), 1.2] });
    });
    // The ribcage of some ancient fire beast, and its skull watching the road.
    for (let i = 0; i < 6; i++) kit.onTrack(kit.prop('rib', rr => rib(w, rr), i % 3), ribs + 6 + i * 9.5, 0, { yaw: (i - 2.5) * .03 });
    const skullSide = kit.at(ribs - 6).curve > 0 ? -1 : 1, sp = kit.at(ribs - 8, skullSide * (w + 17));
    kit.onTrack(kit.prop('skull pillar', rr => basaltColumns(rr, 7), 2), ribs - 8, skullSide * (w + 17), { y: -(sp.y - (LAVA - 3)), scale: [2.2, sp.y - (LAVA - 3) - 1.2, 2.2] });
    kit.onTrack(kit.prop('skull', skull), ribs - 8, skullSide * (w + 17), { y: -1.4, faceRoad: true, yaw: .5 * skullSide });
    // Lava falls pour from cracks in the ridge.
    const falls: { s: number; side: number }[] = [];
    for (let s = 120; s < len - 60; s += r.range(140, 210)) if ((s < b0 - 20 || s > b1 + 20) && (s < ribs - 20 || s > ribs + 70)) falls.push({ s, side: r.sign() });
    lavaFalls(kit, falls);
    // Brazier pillars lining the start straight.
    for (let s = -70; s <= 40; s += 22) for (const side of [-1, 1]) {
      const p = kit.at(s, side * (w + 7.6)), H = p.y + .3 - (LAVA - 3);
      kit.onTrack(kit.prop('pillar', rr => basaltColumns(rr, 4), 3), s, side * (w + 7.6), { y: -H + .3, scale: [1.1, H, 1.1] });
      kit.onTrack(kit.prop('brazier', () => brazier(C.basalt, C.bronze, C.flame, 1.2)), s, side * (w + 7.6), { y: .3 });
    }
    // Magma rocks on cliff ledges, catching the eye at the edge of the ridge.
    for (let s = 40; s < len - 20; s += r.range(45, 80)) { const side = r.sign(), q = kit.at(s, side * (w + 7.2)); if (s > b0 - 6 && s < b1 + 6 || kit.road(q.x, q.z).d < w + 6) continue; kit.onTrack(kit.prop('magma', rr => magmaRock(rr, 2), r.int(0, 3)), s, side * (w + 7.2), { y: -r.range(2, 5), yaw: r() * 6, scale: r.range(1, 1.6) }); }
    volcanoLandmark(kit, '#a8442e');
  },
};
