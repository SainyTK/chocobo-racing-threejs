import * as THREE from 'three';
import { Parts, type Kit } from '../kit.ts';
import { hills } from '../terrain.ts';
import { makeLiquid } from '../liquid.ts';
import { fbm2, smoothstep, type Rng } from '../noise.ts';
import { stageTime } from '../materials.ts';
import { Shape } from '../../particles/particles.ts';
import { boulder, bush, grass, flowers, lampPost, flagPole, bunting, savePoint, blob, block, prism, cone, cyl, ball, bead, disc, ellipsoid, rbox, torus, lathe, tube, sweep, grad, xf } from '../props/common.ts';
import type { CourseArt } from '../types.ts';

const C = {
  grass: '#62a83e', grassLight: '#8cc65a', grassDark: '#3f7a32', dirt: '#a8834e', moss: '#7fae4a',
  leaf: '#78bd45', leafLight: '#a9da62', leafDark: '#2f6e34', pine: '#2f7448', pineLight: '#57a160', bark: '#7a5236', barkDark: '#4f3524',
  cap: '#e0473f', capSpot: '#fff4e2', stem: '#f3e3c4', wood: '#b37a48', woodDark: '#7c5132', thatch: '#d9a752', thatchDark: '#a8762e', plaster: '#f4e9d2', pompom: '#ff4a5e',
};

/** Broadleaf tree: a curved trunk with root flares and a cloud of two-tone canopy lumps. */
function broadleaf(r: Rng) {
  const p = new Parts(), h = r.range(4.5, 6.5), lean = r.range(-.4, .4);
  p.add(sweep([[0, 0, 0], [lean * .3, h * .45, .1], [lean, h, 0]], t => .5 - t * .2, { radial: 7, segments: 6 }), grad(C.barkDark, C.bark, 0, h), { ao: [0, 1.2, .55] });
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + r(); p.add(sweep([[0, .9, 0], [Math.cos(a) * .55, .3, Math.sin(a) * .55], [Math.cos(a) * 1, 0, Math.sin(a) * 1]], t => .2 - t * .12, { radial: 4, segments: 4 }), C.barkDark, { ao: false }); }
  for (let i = 0; i < 2; i++) { const a = r() * 6.28; p.add(sweep([[lean * .6, h * .7, 0], [lean * .6 + Math.cos(a) * 1.4, h * .95, Math.sin(a) * 1.4]], t => .16 - t * .08, { radial: 5, segments: 3 }), C.bark, { ao: false }); }
  const n = r.int(5, 7), cx = lean, cy = h + 1.6;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + r() * .5, d = i ? r.range(1.6, 2.4) : 0, s = i ? r.range(1.5, 2.1) : 2.6, y = cy + (i ? r.range(-.9, .8) : .6);
    p.add(blob(s, [cx + Math.cos(a) * d, y, Math.sin(a) * d], r() * 9, .2), grad(C.leafDark, C.leafLight, cy - 2.2, cy + 2.5), { layer: 'foliage', sway: .12, ao: false });
  }
  return p;
}

/** Layered pine: stacked drooping cones on a straight trunk. */
function pine(r: Rng) {
  const p = new Parts(), h = r.range(9, 13), tiers = r.int(4, 5);
  p.add(prism(.2, .4, h * .5, 7), C.barkDark, { ao: [0, 1, .55] });
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers, y = h * (.22 + t * .62), rad = (1 - t * .72) * h * .3, ht = h * .32;
    p.add(lathe([[0, ht], [rad * .35, ht * .62], [rad, ht * .05], [rad * .92, 0], [rad * .6, ht * .12], [0, ht * .2]], [0, y, 0], [0, r() * 6, 0], 9), grad(C.leafDark, C.pineLight, y, y + ht), { layer: 'foliage', sway: .05 + t * .1, ao: false, flat: true });
  }
  return p;
}

/** Far-away tree: a handful of triangles that still reads as forest on the hills. */
function farTree(r: Rng) {
  const p = new Parts(), h = r.range(6, 10);
  p.add(prism(.2, .3, h * .4, 5), C.barkDark, { ao: false });
  if (r() < .5) p.add(blob([h * .32, h * .38, h * .32], [0, h * .62, 0], r() * 9, .25, 0), grad(C.leafDark, C.leaf, h * .3, h), { ao: false, flat: true });
  else p.add(cone(h * .28, h * .8, 6, [0, h * .25, 0]), grad(C.leafDark, C.pine, h * .25, h), { ao: false, flat: true });
  return p;
}

/** Red-capped mushroom with spots, from ankle height to giant. */
function mushroom(r: Rng, giant = false) {
  const p = new Parts(), h = giant ? r.range(2.6, 3.4) : r.range(.5, .8), cap = h * r.range(.55, .7);
  p.add(lathe([[h * .16, 0], [h * .12, h * .5], [h * .1, h], [0, h]], [0, 0, 0], [0, 0, 0], 10), C.stem, { ao: [0, h * .4, .7] });
  p.add(lathe([[cap * .15, h * .9], [cap * 1.05, h * .9], [cap, h * 1.05], [cap * .7, h * 1.32], [0, h * 1.42]], [0, 0, 0], [0, 0, 0], 14), C.cap, { ao: false });
  for (let i = 0; i < 7; i++) { const a = r() * 6.28, t = r.range(.25, .8), y = h * (1.05 + (1 - t) * .3), d = cap * t; p.add(disc(cap * .13, 6, [Math.cos(a) * d, y + cap * .05, Math.sin(a) * d], [Math.sin(a) * t * .9, 0, -Math.cos(a) * t * .9]), C.capSpot, { ao: false }); }
  if (giant) p.add(torus(h * .17, h * .05, [0, h * .6, 0], [Math.PI / 2, 0, 0]), C.capSpot, { ao: false });
  return p;
}

/** Moogle house: round plaster walls, thatched cone roof, a round door, glowing windows and the famous pompom on the antenna. */
function moogleHouse(r: Rng) {
  const p = new Parts(), R = r.range(2.6, 3.2), H = R * 1.15;
  p.add(lathe([[R * .98, 0], [R, H * .1], [R * .94, H], [0, H]], [0, 0, 0], [0, 0, 0], 16), C.plaster, { ao: [0, 1.4, .65] });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + .26; p.add(block(.28, H, .28, [Math.cos(a) * R * .97, 0, Math.sin(a) * R * .97], [0, -a, 0]), C.woodDark, { ao: false }); }
  const roof = lathe([[R * 1.35, 0], [R * 1.2, R * .25], [R * .55, R * 1.05], [R * .12, R * 1.55], [0, R * 1.6]], [0, H - .1, 0], [0, 0, 0], 16);
  p.add(roof, grad(C.thatchDark, C.thatch, H - .1, H + R), { ao: false });
  p.add(torus(R * 1.28, .14, [0, H, 0], [Math.PI / 2, 0, 0]), C.thatchDark, { ao: false });
  // Door faces +z, the road side.
  p.add(xf(new THREE.CylinderGeometry(.85, .85, .2, 14, 1, false, 0, Math.PI), [0, 1.2, R * .97], [Math.PI / 2, 0, -Math.PI / 2]), C.woodDark, { ao: false });
  p.add(block(1.7, 1.2, .2, [0, 0, R * .97]), C.woodDark, { ao: false }); p.add(ball(.08, [.5, 1, R + .1], .5), '#ffd76a', { ao: false });
  for (const a of [-.9, .9]) { p.add(xf(new THREE.CircleGeometry(.42, 12), [Math.sin(a) * R * .96, H * .6, Math.cos(a) * R * .96], [0, a, 0]), '#ffd98a', { layer: 'glow', ao: false }); p.add(torus(.44, .07, [Math.sin(a) * R * .97, H * .6, Math.cos(a) * R * .97], [0, a, 0]), C.woodDark, { ao: false }); }
  const top = H + R * 1.6 - .1;
  p.add(tube([[0, top, 0], [.25, top + 1, 0], [.1, top + 1.9, 0]], .05, 5), '#3b2a22', { ao: false }); p.add(ball(.42, [.1, top + 2.25, 0], .7), C.pompom, { layer: 'glow', ao: false });
  p.add(block(.6, 1.2, .6, [R * .55, H + R * .3, -.4]), '#8a6a5a', { flat: true, ao: false });
  return p;
}

/** Fallen log with a mossy top. */
function log(r: Rng) {
  const p = new Parts(), L = r.range(3, 5);
  p.add(tube([[-L / 2, .45, 0], [0, .5, r.range(-.3, .3)], [L / 2, .42, 0]], .45, 9), (x, y, z, out) => out.set(y > .72 ? C.moss : C.bark), { ao: [0, .4, .6] });
  for (const s of [-1, 1]) p.add(xf(new THREE.CircleGeometry(.43, 9), [s * L / 2 + s * .01, .43, 0], [0, s * Math.PI / 2, 0]), '#d9b07a', { ao: false });
  p.add(mushroom(r).layers.get('solid')![0].clone().scale(.6, .6, .6).translate(L * .2, .85, .2), (x, y, z, out) => out.set(y > 1.15 ? C.cap : C.stem), { ao: false });
  return p;
}

function stump(r: Rng) {
  const p = new Parts(), R = r.range(.5, .8);
  p.add(lathe([[R * 1.4, 0], [R * 1.05, .25], [R, .7], [0, .72]], [0, 0, 0], [0, 0, 0], 10), C.bark, { ao: [0, .5, .6], flat: true });
  p.add(xf(new THREE.CircleGeometry(R * .96, 12), [0, .725, 0], [-Math.PI / 2, 0, 0]), (x, _y, z, out) => out.set(Math.floor(Math.hypot(x, z) * 9) % 2 ? '#e3bf86' : '#c99c62'), { ao: false });
  return p;
}

/** Log archway over the road with hanging lanterns and a carved sign, the forest's welcome gate. */
function forestArch(w: number) {
  const p = new Parts(), span = w + 2.4, h = 12;
  for (const s of [-1, 1]) {
    p.add(tube([[s * span, 0, 0], [s * span * .99, h * .5, 0], [s * span * .96, h, 0]], .55, 8), grad(C.barkDark, C.bark, 0, h), { ao: [0, 1.5, .6] });
    p.add(blob(1.8, [s * span, h + .6, 0], s * 3, .25), grad(C.leafDark, C.leafLight, h - .5, h + 2), { layer: 'foliage', sway: .1, ao: false });
    for (let i = 0; i < 3; i++) p.add(tube([[s * span, .8, 0], [s * (span + .7), .2, (i - 1) * .6], [s * (span + 1.2), 0, (i - 1) * 1.1]], .2, 5), C.barkDark, { ao: false });
  }
  p.add(tube([[-span - .4, h - .2, 0], [0, h + .5, 0], [span + .4, h - .2, 0]], .45, 8), C.bark, { ao: false });
  p.add(rbox(6.5, 1.6, .25, .1, [0, h - 1.4, .25]), C.wood, { ao: false }); p.add(rbox(6.9, 1.9, .2, .1, [0, h - 1.4, .12]), C.woodDark, { ao: false });
  for (const x of [-2.2, 0, 2.2]) p.add(ball(.18, [x, h - 1.4, .4], .5), C.pompom, { layer: 'glow', ao: false });
  for (let i = 0; i < 4; i++) {
    const x = -span * .7 + i * span * 1.4 / 3, y = h - .2 + Math.sin((i / 3) * Math.PI) * .6;
    p.add(cyl(.015, .015, 1, [x, y - .7, 0], [0, 0, 0], 3), '#3b2a22', { ao: false });
    p.add(ellipsoid([.32, .42, .32], [x, y - 1.5, 0], [0, 0, 0], .6), i % 2 ? '#ffb15a' : '#ffd36a', { layer: 'glow', ao: false });
  }
  return p;
}

/** Sunbeams slanting through the canopy: soft additive shafts, brightest at the core and fading out at both ends. */
function sunbeams(kit: Kit) {
  const mat = kit.own(new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color('#fff0c0') }, uTime: stageTime },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float core = pow(abs(dot(normalize(vN), normalize(vV))), 2.5); float k = core * smoothstep(0., .35, vY) * smoothstep(1., .6, vY) * (.8 + .2 * sin(uTime * .7 + vY * 3.));
        gl_FragColor = vec4(uColor * k * .16, 1.); }`,
  }));
  const geo = kit.own(new THREE.CylinderGeometry(1.6, 3.8, 26, 14, 1, true).translate(0, 13, 0)), group = new THREE.Group(); group.name = 'sunbeams';
  for (let i = 0, s = 80; s < kit.len; s += kit.r.range(90, 150), i++) {
    const side = i % 2 ? 1 : -1, p = kit.at(s, side * (kit.w + kit.r.range(4, 14))), m = new THREE.Mesh(geo, mat);
    m.position.set(p.x, kit.groundAt(p.x, p.z) - 1, p.z); m.rotation.set(.32, kit.r() * 6, -.22); m.renderOrder = 4; group.add(m);
  }
  kit.add(group);
}

export const forest: CourseArt = {
  env: {
    sky: { top: '#2f86e0', horizon: '#bfe4f2', band: { color: '#f4f0d4', height: .08, strength: .35 }, sun: { color: '#fff1c8', size: .05, glow: .7 },
      clouds: { lit: '#ffffff', shade: '#c9dcf2', cover: .38, scale: .9 }, cumulus: { lit: '#ffffff', shade: '#b9cfe6', height: .2, amount: .6 } },
    fog: { color: '#bfe4f2', near: 140, far: 760 },
    hemi: { sky: '#dff2ff', ground: '#5a7a34', intensity: 1.55 },
    sun: { color: '#fff1d0', intensity: 2.7, dir: [-.45, .75, .5] },
    mountains: [
      { color: '#6f97b5', radius: 980, height: 230, rough: .75, snow: '#f2f6ff', snowLine: .62, haze: .55, seed: 3 },
      { color: '#3f7d55', radius: 800, height: 110, rough: .25, haze: .38, seed: 8 },
    ],
  },
  terrain: {
    height: (() => { const h = hills({ amp: 42, ridge: 18, scale: 1.1, rise: 60, seed: 4 }); return (p: Parameters<typeof h>[0]) => { const base = h(p), lake = smoothstep(.36, .28, fbm2(p.x / 260 + 4, p.z / 260 - 2, 3, 12)) * smoothstep(p.drive + 10, p.drive + 45, p.d); return base - lake * 14; }; })(),
    color(p, h, slope, out) {
      const n = fbm2(p.x * .03, p.z * .03, 3, 2), m = fbm2(p.x * .006, p.z * .006, 2, 5);
      out.set(C.grass).lerp(new THREE.Color(C.grassLight), smoothstep(.45, .7, n) * .7).lerp(new THREE.Color(C.grassDark), smoothstep(.55, .3, m) * .6);
      out.lerp(new THREE.Color(C.dirt), smoothstep(p.w + 3.2, p.w + .8, p.d) * .85);
      out.lerp(new THREE.Color('#8d8670'), smoothstep(.55, .9, slope) * .8);
      out.lerp(new THREE.Color('#c9b98a'), smoothstep(5.2, 4.2, h) * .8);
    },
    detail: 'grass',
  },
  road: { kind: 'dirt', palette: { base: '#c19a5e', dark: '#8f6c3f', light: '#e2c896', accent: '#5c9a3a', edge: '#86c04f' } },
  start: { pillar: '#b37a48', trim: '#f6ead2', banner: '#3d8a4a', text: '#fff2b8', light: '#ffd36a', flags: ['#e0473f', '#3d8a4a', '#ffd84a', '#4a8fe0'] },
  hazard: 'mud',
  signs: { board: '#f4e2b8', arrow: '#c1452f', post: '#7c5132' },
  ambient: [
    { color: '#fff7a0', endColor: '#c8ff7a', rate: 16, size: .16, life: 4, glow: true, height: [.4, 3], wander: .5, drift: [0, .1, 0], radius: 34, alpha: .9 },
    { color: '#86c04f', endColor: '#c99a3a', rate: 7, size: .22, life: 5, height: [6, 12], drift: [1.1, -.9, .4], wander: .6, shape: Shape.Shard, radius: 30, alpha: .95 },
  ],
  catalog: {
    'Broadleaf tree': broadleaf, Pine: pine, 'Far tree': farTree, Mushroom: r => mushroom(r), 'Giant mushroom': r => mushroom(r, true), 'Moogle house': moogleHouse, Log: log, Stump: stump,
    Bush: r => bush(r, C.leaf, C.leafDark, 1.1, '#e04a6a'), Grass: r => grass(r, C.grassDark, C.grassLight), Flowers: r => flowers(r, ['#ff7aa8', '#ffffff', '#ffd84a', '#9a8cff']), Boulder: r => boulder(r, '#9a9486', 1.4, C.moss), 'Forest arch': () => forestArch(12),
  },
  build(kit) {
    const r = kit.r, w = kit.w;
    makeLiquid(kit, { y: 4.4, deep: '#2f7fa8', shallow: '#5fc0d6', foam: '#e8fbff', sky: '#cfeefa', scale: 1.4, swell: .08 });
    // Verge dressing: grass and flowers hugging both edges of the path.
    for (let s = 0; s < kit.len; s += 2.2) for (const side of [-1, 1]) {
      const off = side * (w + r.range(.4, 3.5));
      kit.onTrack(kit.prop('grass', rr => grass(rr, C.grassDark, C.grassLight, 1.1, 11), r.int(0, 3)), s + r() * 2, off, { yaw: r() * 6, onGround: true });
      if (r() < .3) kit.onTrack(kit.prop('flowers', rr => flowers(rr, ['#ff7aa8', '#ffffff', '#ffd84a', '#9a8cff', '#ff9b4a']), r.int(0, 3)), s, side * (w + r.range(1, 5)), { yaw: r() * 6, onGround: true });
    }
    // Trackside landmarks along the lap.
    for (let s = 30; s < kit.len - 20; s += r.range(14, 26)) {
      const side = r.sign(), off = side * (w + r.range(6, 16)), pick = r();
      if (kit.road(kit.at(s, off).x, kit.at(s, off).z).d < w + 5) continue;
      if (pick < .2) kit.onTrack(kit.prop('mushroom', rr => mushroom(rr), r.int(0, 4)), s, off, { yaw: r() * 6, onGround: true, scale: r.range(1, 1.8) });
      else if (pick < .3) kit.onTrack(kit.prop('giant mushroom', rr => mushroom(rr, true), r.int(0, 2)), s, off, { yaw: r() * 6, onGround: true });
      else if (pick < .45) kit.onTrack(kit.prop('log', log, r.int(0, 2)), s, off, { yaw: r.range(-.4, .4), onGround: true });
      else if (pick < .55) kit.onTrack(kit.prop('stump', stump, r.int(0, 2)), s, off, { onGround: true });
      else if (pick < .8) kit.onTrack(kit.prop('bush', rr => bush(rr, C.leaf, C.leafDark, 1.2, rr() < .5 ? '#e04a6a' : undefined), r.int(0, 3)), s, off, { yaw: r() * 6, onGround: true, scale: r.range(.8, 1.4) });
      else kit.onTrack(kit.prop('boulder', rr => boulder(rr, '#9a9486', 1.4, C.moss), r.int(0, 3)), s, off, { yaw: r() * 6, onGround: true, scale: r.range(.7, 1.6) });
    }
    // The woods: dense near the road, thinning into cheap trees on the hills.
    kit.scatter(420, w + 9, 95, (x, z, d) => {
      const y = kit.groundAt(x, z); if (y < 4.6) return;
      const k = r(), tint = r() < .3 ? '#d8f0a0' : r() < .5 ? '#a8d890' : undefined;
      if (k < .62) kit.place(kit.prop('broadleaf', broadleaf, r.int(0, 5)), x, y, z, { yaw: r() * 6, scale: r.range(.85, 1.5) * (d > 50 ? 1.2 : 1), tint, tintAmount: .35 });
      else kit.place(kit.prop('pine', pine, r.int(0, 3)), x, y, z, { yaw: r() * 6, scale: r.range(.8, 1.3), tint, tintAmount: .3 });
      if (r() < .25) kit.place(kit.prop('bush', rr => bush(rr, C.leaf, C.leafDark, 1.2), r.int(0, 3)), x + r.range(-3, 3), y, z + r.range(-3, 3), { yaw: r() * 6 });
    });
    kit.scatter(1500, 95, 420, (x, z) => { const y = kit.groundAt(x, z); if (y < 4.6) return; kit.place(kit.prop('far tree', farTree, r.int(0, 5)), x, y, z, { yaw: r() * 6, scale: r.range(1, 2) }); });
    kit.scatter(400, w + 6, 70, (x, z) => { const y = kit.groundAt(x, z); if (y < 4.8) return; kit.place(kit.prop('grass', rr => grass(rr, C.grassDark, C.grassLight, 1.1, 11), r.int(0, 3)), x, y, z, { yaw: r() * 6, scale: r.range(1, 1.6) }); });
    // Moogle village beside the start straight.
    for (let i = 0; i < 5; i++) {
      const s = -150 + i * 55 + r.range(-8, 8), side = i % 2 ? 1 : -1, off = side * (w + r.range(17, 26)), p = kit.at(s, off);
      if (kit.road(p.x, p.z).d < w + 12) continue;
      kit.onTrack(kit.prop('moogle house', moogleHouse, i % 3), s, off, { faceRoad: true, onGround: true, yaw: r.range(-.3, .3) });
      kit.onTrack(kit.prop('lamp', () => lampPost('#4a3a30', '#ffcf73', 3.6)), s + 5, side * (w + 3), { faceRoad: true, onGround: true });
    }
    for (const s of [190, kit.len * .55, kit.len * .82]) kit.onTrack(kit.prop('arch', () => forestArch(w)), s, 0);
    // Festival dressing around the start: flags, bunting and a save point.
    const a = kit.at(-24, -w - 3.4), b = kit.at(-24, w + 3.4), c = kit.at(-42, -w - 3.4), d = kit.at(-42, w + 3.4);
    bunting(kit, new THREE.Vector3(a.x, a.y + 7, a.z), new THREE.Vector3(b.x, b.y + 7, b.z), ['#e0473f', '#ffd84a', '#3d8a4a', '#4a8fe0', '#ffffff']);
    bunting(kit, new THREE.Vector3(c.x, c.y + 7, c.z), new THREE.Vector3(d.x, d.y + 7, d.z), ['#ff8ab8', '#ffffff', '#8ad8ff']);
    kit.onTrack(kit.prop('save', () => savePoint()), -30, -(w + 9), { onGround: true });
    kit.onTrack(kit.prop('flag', () => flagPole('#3d8a4a', '#ffd84a', 9)), 12, w + 5, { onGround: true });
    sunbeams(kit);
  },
};
