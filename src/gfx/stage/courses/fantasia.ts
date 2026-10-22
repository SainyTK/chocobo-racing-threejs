import * as THREE from 'three';
import { Parts, type Kit } from '../kit.ts';
import { STAGE, stageTime, type Layer } from '../materials.ts';
import { fbm2, type Rng } from '../noise.ts';
import { Shape } from '../../particles/particles.ts';
import { crystalCluster, rock, tube, grad, xf, prism, disc } from '../props/common.ts';
import { carbuncle, ifrit, leviathanCoil, leviathanHead, odin, pedestal, ramuh, shiva, sleepingTitan, sylph, unicorn } from '../props/espers.ts';
import { shortcutSpots } from '../shortcuts.ts';
import { layoutHazard } from '../hazards.ts';
import { courseLayout, shortcutPaths, type Hazard } from '../../../../shared/track/index.ts';
import type { CourseArt } from '../types.ts';

const C = {
  rock: '#4b4f72', rockDark: '#262842', rockDeep: '#121326', rockLight: '#6d7299', rim: '#3550c8',
  shoulder: '#5c5d6c', shoulderDark: '#47485a',
  violet: '#c07bff', violetShell: '#5a2fb0', blue: '#7fb0ff', blueShell: '#2a3fa8', teal: '#7ff5e0', tealShell: '#1f8f8a',
  rail: '#3fb86a', railTop: '#ffe04a', post: '#2fb7b0', bolt: '#d6f1ff',
};

/** Sections of the lap, in metres from the start line, where each Esper keeps watch. They follow the original's order around the course. */
const ZONE = {
  coils: [60, 430], carbuncles: [450, 570], titan: 640, shiva: [890, 1000], sylphs: [1150, 1460], unicorn: 1500,
  tunnel: [1716, 1796], ramuh: 1836, ifrit: 1905, odin: 2066,
} as const;

// ---- Light ---------------------------------------------------------------------------------------

/** Additive glow over the road and its shoulders, fading in and out along `s0`..`s1`: the coloured light pools of each Esper's grotto. */
function lightPool(kit: Kit, s0: number, s1: number, color: string, strength = .5) {
  const mat = kit.own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: strength }, uTime: stageTime },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uK, uTime; varying vec2 vUv; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){ float ends = smoothstep(0., .2, vUv.y) * smoothstep(1., .8, vUv.y), across = smoothstep(1., .55, abs(vUv.x * 2. - 1.));
        float ripple = .65 + .35 * n(vW.xz * .12 + vec2(uTime * .15, -uTime * .1));
        gl_FragColor = vec4(uColor * ends * across * ripple * uK, 1.); }`,
  }));
  const steps = Math.max(2, Math.round((s1 - s0) / 2)), across = 6, pos: number[] = [], uv: number[] = [], idx: number[] = [], reach = kit.w + 4.6;
  for (let i = 0; i <= steps; i++) for (let k = 0; k <= across; k++) { const p = kit.at(s0 + (s1 - s0) * i / steps, -reach + 2 * reach * k / across); pos.push(p.x, p.y + .07, p.z); uv.push(k / across, i / steps); }
  for (let i = 0; i < steps; i++) for (let k = 0; k < across; k++) { const a = i * (across + 1) + k, b = a + 1, c = a + across + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat); m.name = 'light pool'; m.renderOrder = 3; kit.add(m);
}

/** A soft shaft of coloured light falling from the cavern roof onto a point. */
function lightShaft(kit: Kit, x: number, y: number, z: number, color: string, radius = 5) {
  const mat = kit.own(new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: stageTime },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float core = pow(abs(dot(normalize(vN), normalize(vV))), 2.); float k = core * smoothstep(0., .25, vY) * smoothstep(1., .45, vY) * (.85 + .15 * sin(uTime * .9 + vY * 4.));
        gl_FragColor = vec4(uColor * k * .14, 1.); }`,
  }));
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius * .45, radius, 32, 16, 1, true).translate(0, 16, 0), mat);
  m.position.set(x, y - 1, z); m.renderOrder = 4; m.name = 'light shaft'; kit.add(m);
}

// ---- Road ----------------------------------------------------------------------------------------

/** Rubble shoulders, a dark blue lip and the rock keel under the road, which hangs over the void. */
function roadbed(kit: Kit) {
  const w = kit.w, rock0 = new THREE.Color(C.rock), deep = new THREE.Color(C.rockDeep), sh = new THREE.Color(C.shoulder), shd = new THREE.Color(C.shoulderDark);
  kit.extrude([[0, -.04], [1.6, -.06], [3.2, -.08], [4.6, -.1]], { mirror: true, step: 2, paint: (s, seg, _i, out) => { const n = fbm2(s * .05, seg * 1.9, 2, 5); out.copy(sh).lerp(shd, n); } });
  kit.extrude([[4.6, -.1], [4.9, .05], [5.25, .05], [5.25, -.6]], { mirror: true, step: 2, paint: (_s, seg, _i, out) => out.set(seg === 1 ? '#5b6bd8' : C.rim) });
  kit.extrude([[5.25, -.6], [5.5, -2.2], [4.2, -5.5], [1.5, -9], [-w * .5, -13], [-w, -15.5]], { mirror: true, step: 2.5, paint: (s, seg, _i, out) => { const n = fbm2(s * .03, seg, 2, 9); out.copy(rock0).lerp(deep, Math.min(1, seg / 4 + n * .3)); } });
}

/** Stone tunnel over the road, its walls stepping out past the shoulders so Carbuncles and Sylphs can sit in the niches. */
function tunnel(kit: Kit, s0: number, s1: number) {
  const w = kit.w, a = new THREE.Color(C.rockDark), b = new THREE.Color(C.rock);
  // Profiles run from the floor up to the crown, so the faces look inward at the road.
  const vault: [number, number][] = [[4.4, -.12], [4.8, 3], [4.2, 6.6], [1, 9.4], [-w * .5, 10.4], [-w, 10.6]];
  kit.extrude(vault, { s0, s1, mirror: true, step: 2, paint: (s, seg, _i, out) => out.copy(a).lerp(b, fbm2(s * .08, seg * 2.3, 2, 4) * .8) });
  // Portal rims at both ends, a little proud of the tunnel, seen from outside and from within.
  const rim: [number, number][] = [[-w, 11.8], [-w * .5, 11.6], [1.2, 10.6], [5, 7.4], [5.6, 3.2], [4, -.12]];
  for (const s of [s0, s1]) for (const profile of [rim, [...rim].reverse()]) kit.extrude(profile, { s0: s - .8, s1: s + .8, mirror: true, step: .8, paint: C.rockLight });
}

// ---- Placement -----------------------------------------------------------------------------------

/** First offset on `side`, from `min` to `max` metres off the centre line, where a figure of `radius` stands clear of every stretch of road. */
function clearSpot(kit: Kit, s: number, side: number, min: number, max: number, radius: number) {
  for (let off = min; off <= max; off += 2) { const p = kit.at(s, side * off); if (kit.road(p.x, p.z).d > kit.w + 5.6 + radius) return side * off; }
  return null;
}

/** An Esper on its floating pedestal, turned to face the road, with a shaft of its colour falling on it. */
function enshrine(kit: Kit, key: string, figure: (r: Rng) => Parts, s: number, side: number, o: { radius: number; min?: number; lift?: number; scale?: number; light?: string; crystal: string }) {
  const off = clearSpot(kit, s, side, kit.w + o.radius + 6, kit.w + o.radius + 40, o.radius); if (off === null) return false;
  const p = kit.at(s, off), y = p.y + (o.lift ?? 0), yaw = p.yaw + (off > 0 ? -Math.PI / 2 : Math.PI / 2);
  kit.place(kit.prop(`${key} pedestal`, rr => pedestal(rr, o.radius, o.crystal)), p.x, y, p.z, { yaw: kit.r() * 6 });
  kit.place(kit.prop(key, figure), p.x, y, p.z, { yaw, scale: o.scale ?? 1 });
  if (o.light) lightShaft(kit, p.x, y, p.z, o.light, o.radius * .9);
  return true;
}

// ---- Hazard art ----------------------------------------------------------------------------------

/** Ramuh's thunderbolt: a jagged glowing column from the cavern roof to the road, with a burst ring where it lands. */
function thunderbolt(h: Hazard) {
  const p = new Parts(), pts: [number, number, number][] = [];
  for (let i = 0; i <= 10; i++) { const y = 30 - i * 3, j = i === 0 || i === 10 ? 0 : (i % 2 ? 1 : -1) * (.5 + (i * 7 % 5) * .25); pts.push([j, y, (i * 3 % 4 - 1.5) * .35]); }
  p.add(tube(pts, .32, 6), C.bolt, { layer: 'glow', ao: false });
  p.add(tube(pts.map(([x, y, z]) => [x * 1.6 + .4, y, z - .3] as [number, number, number]).slice(4), .14, 5), '#8fd4ff', { layer: 'glow', ao: false });
  p.add(disc(h.width * .55, 18, [0, .12, 0]), '#bfe8ff', { layer: 'glow', ao: false });
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; p.add(xf(new THREE.OctahedronGeometry(.35), [Math.cos(a) * h.width * .6, .5, Math.sin(a) * h.width * .6], [0, a, 0], [.5, 1.6, .5]), C.bolt, { layer: 'glow', ao: false, flat: true }); }
  return p;
}

// ---- Course --------------------------------------------------------------------------------------

export const fantasia: CourseArt = {
  env: {
    sky: { top: '#020209', horizon: '#0b0d26', below: '#020208', band: { color: '#16123c', height: .3, strength: .7 }, stars: 1.6, aurora: '#2fe0a8' },
    fog: { color: '#0b0d26', near: 90, far: 520 },
    hemi: { sky: '#cdd2ea', ground: '#3b3552', intensity: 1.5 },
    sun: { color: '#e8ecff', intensity: 1.6, dir: [-.3, .9, .25] },
    mountains: [
      { color: '#141530', radius: 720, height: 420, rough: .95, haze: .25, seed: 6 },
      { color: '#1f2045', radius: 560, height: 260, rough: .85, haze: .3, seed: 2 },
    ],
  },
  terrain: null,
  road: { kind: 'dirt', palette: { base: '#7f8088', dark: '#4c4d56', light: '#a6a7ae' } },
  start: { pillar: '#5b3fb0', trim: '#ffd84a', banner: '#24185c', text: '#ffe9a8', light: '#9ff6ff', checker: ['#fbf3e6', '#f08a2a'] },
  patches: { slow: 'tar', slip: 'ice' },
  rail: { top: C.railTop, rail: C.rail, post: C.post },
  shortcut: { wall: '#9fb4ff', cap: '#dfe8ff' },
  hazards: { bolt: { mover: thunderbolt, warn: '#9fdcff' } },
  signs: { board: '#f6f3f8', arrow: '#e3342c', post: '#ecebf2' },
  ambient: [
    { color: '#a8fbe9', endColor: '#c48bff', rate: 12, size: .26, life: 3, glow: true, shape: Shape.Star, height: [1, 9], wander: .3, drift: [0, .2, 0], radius: 34, alpha: .9 },
    { color: '#c9c4ff', rate: 10, size: .1, life: 6, height: [.5, 10], wander: .2, drift: [.1, .08, 0], radius: 30, alpha: .5 },
  ],
  catalog: {
    'Leviathan coil': () => leviathanCoil(14, 19), 'Leviathan head': leviathanHead, Carbuncle: () => carbuncle(1.4), 'Sleeping Titan': sleepingTitan, Shiva: shiva,
    Sylph: sylph, Unicorn: unicorn, Ramuh: ramuh, Ifrit: ifrit, Odin: odin, Pedestal: r => pedestal(r, 6, C.violet),
    'Crystal (violet)': r => crystalCluster(r, C.violet, C.violetShell, 1.4, C.rock), 'Crystal (blue)': r => crystalCluster(r, C.blue, C.blueShell, 1.4, C.rock),
    Thunderbolt: () => thunderbolt(layoutHazard('fantasia', 'bolt')),
  },
  build(kit) {
    const r = kit.r, w = kit.w, len = kit.len;
    roadbed(kit);
    tunnel(kit, ZONE.tunnel[0], ZONE.tunnel[1]);

    // Leviathan's coils arch over the start straight; his heads rise from the void beside the lobes.
    for (const s of [-36, 14, 30]) kit.onTrack(kit.prop('coil', () => leviathanCoil(w + 4.6, 19)), s, 0);
    for (let s = ZONE.coils[0], i = 0; s < ZONE.coils[1]; s += 62, i++) {
      const side = i % 2 ? 1 : -1, off = clearSpot(kit, s, side, w + 9, w + 20, 3); if (off === null) continue;
      kit.onTrack(kit.prop('leviathan head', leviathanHead, i % 3), s, off, { faceRoad: true, y: -2 });
    }

    // The Espers, in the original's order around the lap.
    for (let s = ZONE.carbuncles[0], i = 0; s < ZONE.carbuncles[1]; s += 38, i++) enshrine(kit, 'carbuncle', () => carbuncle(1.5), s, i % 2 ? 1 : -1, { radius: 4, crystal: C.teal });
    enshrine(kit, 'titan', sleepingTitan, ZONE.titan, 1, { radius: 11, crystal: C.violet, light: '#b49aff' }) || enshrine(kit, 'titan', sleepingTitan, ZONE.titan, -1, { radius: 11, crystal: C.violet, light: '#b49aff' });
    for (const [s, side] of [[ZONE.shiva[0] + 25, 1], [ZONE.shiva[0] + 75, -1]] as const) enshrine(kit, 'shiva', shiva, s, side, { radius: 5, crystal: C.blue, light: '#6fa0ff', lift: 1 });
    lightPool(kit, ZONE.shiva[0], ZONE.shiva[1], '#3d6bff', .55);
    for (let s = ZONE.sylphs[0], i = 0; s < ZONE.sylphs[1]; s += 52, i++) enshrine(kit, 'sylph', rr => { const p = new Parts(); for (let k = 0; k < 3; k++) p.include(sylph(rr), [(k - 1) * 1.8, 0, rr.range(-1, 1)], rr.range(-.4, .4)); return p; }, s, i % 2 ? -1 : 1, { radius: 4, crystal: C.teal, light: '#5fffc8' });
    lightPool(kit, ZONE.sylphs[0] + 60, ZONE.sylphs[0] + 150, '#21d6a0', .35);
    enshrine(kit, 'unicorn', unicorn, ZONE.unicorn, 1, { radius: 5, crystal: C.blue, light: '#7fb8ff' }) || enshrine(kit, 'unicorn', unicorn, ZONE.unicorn, -1, { radius: 5, crystal: C.blue, light: '#7fb8ff' });
    // In the tunnel, Carbuncles and Sylphs sit in the wall niches under teal light.
    for (let s = ZONE.tunnel[0] + 10, i = 0; s < ZONE.tunnel[1] - 6; s += 14, i++) {
      const side = i % 2 ? 1 : -1;
      if (i % 3 === 1) kit.onTrack(kit.prop('niche carbuncle', () => carbuncle(.7)), s, side * (w + 2.8), { faceRoad: true });
      else kit.onTrack(kit.prop('niche sylph', sylph, i % 2), s, side * (w + 2.6), { faceRoad: true, y: 1 });
      kit.onTrack(kit.prop('niche crystal', rr => crystalCluster(rr, C.teal, C.tealShell, .8, C.rock), i % 3), s + 7, side * (w + 3.6), { yaw: r() * 6 });
    }
    lightPool(kit, ZONE.tunnel[0], ZONE.tunnel[1], '#1fb8a8', .32);
    // Ramuh stands inside the semicircle, calling down the bolts that strike its edges.
    enshrine(kit, 'ramuh', ramuh, ZONE.ramuh, 1, { radius: 5, crystal: C.blue, light: '#cfeaff', scale: 1.3 }) || enshrine(kit, 'ramuh', ramuh, ZONE.ramuh, -1, { radius: 5, crystal: C.blue, light: '#cfeaff', scale: 1.3 });
    lightPool(kit, ZONE.ramuh - 40, ZONE.ramuh + 40, '#6fa8ff', .22);
    enshrine(kit, 'ifrit', ifrit, ZONE.ifrit, -1, { radius: 5, crystal: '#ff8a5a', light: '#ff5a3a', lift: 1 }) || enshrine(kit, 'ifrit', ifrit, ZONE.ifrit, 1, { radius: 5, crystal: '#ff8a5a', light: '#ff5a3a', lift: 1 });
    lightPool(kit, ZONE.ifrit - 30, ZONE.ifrit + 30, '#ff3a22', .4);
    enshrine(kit, 'odin', odin, ZONE.odin, 1, { radius: 5, crystal: C.violet, light: '#b07aff', lift: 4, scale: 1.2 }) || enshrine(kit, 'odin', odin, ZONE.odin, -1, { radius: 5, crystal: C.violet, light: '#b07aff', lift: 4, scale: 1.2 });

    // The railless walkway past the far-left hairpin, lit blue like Shiva's grotto, with crystals hanging under it.
    for (const path of shortcutPaths(kit.id)) for (const q of shortcutSpots(kit, path, 9)) {
      lightShaft(kit, q.x, q.y, q.z, '#4f7dff', 4);
      kit.place(kit.prop('under crystal', rr => new Parts().add(prism(0, .9, rr.range(3, 5), 6, [0, -6, 0], [Math.PI, 0, 0]), grad(C.blue, C.blueShell, -6, -1), { layer: 'glow', flat: true, ao: false })), q.x, q.y, q.z, { yaw: r() * 6, shortcut: true });
    }

    // Crystal clusters on ledges beside the road, and rock spires rising from the void to the cavern roof.
    for (let s = 20; s < len - 10; s += r.range(14, 26)) {
      const side = r.sign(), off = clearSpot(kit, s, side, w + 8, w + 16, 2.5); if (off === null) continue;
      const blue = r() < .35, p = kit.at(s, off);
      kit.place(kit.prop('ledge', rr => pedestal(rr, 3, blue ? C.blue : C.violet), r.int(0, 3)), p.x, p.y - 1, p.z, { yaw: r() * 6 });
      kit.place(kit.prop(blue ? 'crystal blue' : 'crystal violet', rr => crystalCluster(rr, blue ? C.blue : C.violet, blue ? C.blueShell : C.violetShell, 1.3, C.rock), r.int(0, 4)), p.x, p.y - 1, p.z, { yaw: r() * 6, scale: r.range(.9, 1.7) });
    }
    // Cavern walls: great rock masses rising from the void around the course, close enough to close in the view.
    kit.scatter(90, w + 30, 90, (x, z, d) => {
      const y = kit.road(x, z).y, size = Math.min(d - w - 10, 30) * r.range(.6, 1);
      kit.place(kit.prop('cave wall', rr => new Parts().add(rock([1, 1, 1], [0, 0, 0], rr() * 9), (_x, yy, _z, out) => out.set(C.rockDark).lerp(new THREE.Color('#2c4a66'), Math.max(0, yy) * .6), { flat: true, ao: false }), r.int(0, 5)), x, y - 8, z, { yaw: r() * 6, scale: [size, r.range(30, 60), size] });
    });
    kit.scatter(70, w + 50, 190, (x, z) => {
      const y = kit.road(x, z).y, h = r.range(50, 110);
      kit.place(kit.prop('spire', rr => new Parts().add(rock([1, 1, 1], [0, 0, 0], rr() * 9), grad(C.rockDeep, C.rockDark, -.8, .8), { flat: true, ao: false }), r.int(0, 4)), x, y - 30 + h * .3, z, { yaw: r() * 6, scale: [r.range(5, 11), h, r.range(5, 11)] });
    });
    // Stalactites hanging from the cavern roof over the whole course, and crystal glints high in the dark.
    kit.scatter(140, 0, 220, (x, z) => {
      const y = kit.road(x, z).y + r.range(48, 80);
      kit.place(kit.prop('stalactite', rr => new Parts().add(xf(new THREE.ConeGeometry(1, 1, 7), [0, -.5, 0], [Math.PI, 0, 0]), grad(C.rockLight, C.rockDark, -1, 0), { flat: true, ao: false }), r.int(0, 3)), x, y, z, { scale: [r.range(2.5, 6), r.range(14, 34), r.range(2.5, 6)], yaw: r() * 6 });
    });
    kit.scatter(360, 0, 300, (x, z) => kit.place(kit.prop('glint', () => new Parts().add(xf(new THREE.OctahedronGeometry(.6)), C.teal, { layer: 'glow', ao: false })), x, kit.road(x, z).y + r.range(40, 90), z, { yaw: r() * 6 }));
    // Ramuh's fireworks: sparks circling above the semicircle, where the bolts strike.
    const bolts = courseLayout(kit.id).hazards.filter(h => h.kind === 'bolt');
    if (bolts.length) {
      const c = kit.at(ZONE.ramuh), sparks = new THREE.Group(); sparks.name = 'ramuh sparks';
      const spark = kit.prop('spark', () => new Parts().add(xf(new THREE.OctahedronGeometry(.5), [0, 0, 0], [0, 0, 0], [.5, 1.6, .5]), C.bolt, { layer: 'glow', ao: false, flat: true }));
      for (const [layer, [g]] of spark.layers) for (let i = 0; i < 14; i++) sparks.add(new THREE.Mesh(g, STAGE[layer.replace('+', '') as Layer]));
      sparks.position.set(c.x, c.y + 24, c.z); kit.add(sparks);
      kit.onUpdate(t => sparks.children.forEach((m, i) => { const a = t * .8 + i / 14 * 6.28; m.position.set(Math.cos(a) * 16, Math.sin(t * 2 + i) * 3, Math.sin(a) * 16); }));
    }
  },
};
