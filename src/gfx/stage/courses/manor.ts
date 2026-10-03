import * as THREE from 'three';
import { Parts, type Kit } from '../kit.ts';
import { hills } from '../terrain.ts';
import { fbm2, hash2, smoothstep, type Rng } from '../noise.ts';
import { Shape } from '../../particles/particles.ts';
import { stageTime } from '../materials.ts';
import { bush, grass, block, prism, cone, card, cyl, bead, disc, ellipsoid, rbox, rock, sweep, grad, xf } from '../props/common.ts';
import { arch, type V3 } from '../props/shapes.ts';
import type { CourseArt } from '../types.ts';

const C = {
  stone: '#6e6684', stoneDark: '#4a4460', stoneLight: '#958cab', cap: '#8a82a2', slate: '#2c2942', slateLight: '#454066',
  iron: '#1d1a26', ironHi: '#3a3550', bark: '#2e2533', barkLight: '#4d4050', grass: '#34433f', grassDead: '#4f4740', moss: '#4d5e4a',
  window: '#ffc062', windowHot: '#ff9a3c', lantern: '#ffd47a', wisp: '#8fd8ff', pumpkin: '#e0702a', pumpkinDark: '#a8481c', face: '#ffbe45', hedge: '#2c3a36', hedgeLight: '#46574c',
};

/** Gable roof: a triangular prism spanning x, ridge along z, origin at the eaves' centre. */
function gable(w: number, h: number, d: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) {
  const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  return xf(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2), pos, rot);
}
/** Pointed gothic window: a lit card with a triangular head, facing +z after `rot`. */
function gothicWindow(p: Parts, w: number, h: number, pos: V3, yaw: number, color: string) {
  const g = new THREE.BufferGeometry(), x = w / 2;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-x, 0, 0, x, 0, 0, x, h, 0, -x, 0, 0, x, h, 0, -x, h, 0, -x, h, 0, x, h, 0, 0, h + w * .75, 0], 3)); g.computeVertexNormals();
  p.add(xf(g, pos, [0, yaw, 0]), color, { layer: 'glow', ao: false });
  // Dark mullion cross in front of the light.
  p.add(xf(new THREE.BoxGeometry(w * .12, h + w * .5, .06).translate(0, (h + w * .5) / 2, .04), pos, [0, yaw, 0]), C.iron, { ao: false });
  p.add(xf(new THREE.BoxGeometry(w, w * .1, .06).translate(0, h * .55, .04), pos, [0, yaw, 0]), C.iron, { ao: false });
}

/** The manor: a central hall and pavilion, two wings, round corner towers with spires and dozens of lit windows. Faces +z. */
function manorHouse(r: Rng) {
  const p = new Parts(), wall = grad(C.stoneDark, C.stone, 0, 18), roof = grad(C.slate, C.slateLight, 0, 40);
  const lit = () => r() < .78 ? (r() < .3 ? C.windowHot : C.window) : '#2a2238';
  // Raised terrace and steps.
  p.add(block(74, 1.6, 34, [0, -.6, -2]), C.stoneDark, { ao: [0, 1, .7] });
  for (let i = 0; i < 4; i++) p.add(block(14 - i, .4, 2, [0, .6 + i * .4 - .6, 16.5 - i * 1]), C.stoneLight, { ao: false });
  // Main hall.
  p.add(block(40, 16, 16, [0, 1, 0]), wall); p.add(gable(42, 10, 18, [0, 17, 0]), roof, { flat: true });
  for (let i = 0; i < 6; i++) { const x = -17 + i * 6.8; if (Math.abs(x) < 6) continue; for (const y of [3.5, 10]) gothicWindow(p, 1.8, 3, [x, y, 8.05], 0, lit()); }
  p.add(block(41, .7, 17, [0, 8.2, 0]), C.cap, { ao: false });
  // Central pavilion with a rose window and the great door.
  p.add(block(13, 26, 18, [0, 1, 2]), wall); p.add(gable(14.5, 12, 19.5, [0, 27, 2]), roof, { flat: true });
  p.add(xf(new THREE.CircleGeometry(3.4, 16), [0, 18.5, 11.06]), (x, y, _z, out) => { const a = Math.atan2(y - 18.5, x), rr = Math.hypot(x, y - 18.5); out.set(rr < .9 ? '#ffe7a0' : Math.abs(Math.sin(a * 4)) < .25 ? '#3a2a48' : rr > 3 ? '#3a2a48' : '#ff9a3c'); }, { layer: 'glow', ao: false });
  p.add(xf(new THREE.TorusGeometry(3.5, .35, 4, 20), [0, 18.5, 11.05]), C.cap, { ao: false });
  p.add(xf(arch(4, 7.5, .8, .8, true, 6), [0, 1, 11.2]), C.stoneLight, { ao: false });
  p.add(xf(new THREE.PlaneGeometry(4, 6.2).translate(0, 4.1, 0), [0, 0, 11.0]), '#ff9a3c', { layer: 'glow', ao: false });
  for (const y of [8, 12]) gothicWindow(p, 1.6, 2.6, [0, y + 3, 11.05], 0, lit());
  p.add(cone(1.1, 9, 4, [0, 38.5, 2], [0, Math.PI / 4, 0]), C.slate, { flat: true }); p.add(bead(.5, [0, 47.7, 2]), C.lantern, { layer: 'glow', ao: false });
  // Wings.
  for (const s of [-1, 1]) {
    p.add(block(14, 12, 22, [s * 27, 1, -2]), wall); p.add(gable(24, 8, 15.5, [s * 27, 13, -2], [0, Math.PI / 2, 0]), roof, { flat: true });
    for (let i = 0; i < 3; i++) for (const y of [3, 8]) gothicWindow(p, 1.6, 2.6, [s * 27 + (i - 1) * 4, y, 9.05], 0, lit());
    for (let i = 0; i < 4; i++) gothicWindow(p, 1.6, 2.6, [s * 34.05, 4, -10 + i * 5], s * Math.PI / 2, lit());
    // Chimneys.
    p.add(block(1.8, 8, 1.8, [s * 24, 14, -6]), C.stoneDark, { flat: true }); p.add(block(2.4, .6, 2.4, [s * 24, 22, -6]), C.cap, { ao: false });
    // Round corner tower with a needle spire.
    const tx = s * 35.5, tz = 9;
    p.add(prism(4, 4.4, 28, 10, [tx, 0, tz]), wall); p.add(prism(4.8, 4.8, 1.2, 10, [tx, 28, tz]), C.cap, { ao: false });
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; p.add(block(.9, 1.2, .9, [tx + Math.cos(a) * 4.5, 29.2, tz + Math.sin(a) * 4.5]), C.cap, { ao: false }); }
    p.add(cone(4.2, 17, 10, [tx, 29.2, tz]), roof, { flat: true }); p.add(cyl(.08, .08, 4, [tx, 48, tz], [0, 0, 0], 4), C.iron, { ao: false }); p.add(bead(.45, [tx, 50.2, tz]), C.lantern, { layer: 'glow', ao: false });
    for (const y of [6, 13, 20]) for (const a of [-.5, .5, s * 1.4]) gothicWindow(p, 1.4, 2.4, [tx + Math.sin(a) * 4.25, y, tz + Math.cos(a) * 4.25], a, lit());
  }
  // Tall keep behind the hall, the silhouette's highest point.
  p.add(prism(5.5, 6, 36, 8, [-9, 0, -9]), wall); p.add(prism(6.5, 6.5, 1.4, 8, [-9, 36, -9]), C.cap, { ao: false });
  p.add(cone(6, 22, 8, [-9, 37.4, -9]), roof, { flat: true }); p.add(bead(.6, [-9, 60, -9]), '#bfe6ff', { layer: 'glow', ao: false });
  for (const y of [10, 18, 26, 32]) for (const a of [0, .8, -.8]) gothicWindow(p, 1.5, 2.6, [-9 + Math.sin(a) * 5.75, y, -9 + Math.cos(a) * 5.75], a, y === 32 ? '#9fd8ff' : lit());
  p.add(prism(3, 3.3, 30, 8, [14, 0, -9]), wall); p.add(cone(3.6, 14, 8, [14, 30, -9]), roof, { flat: true });
  for (const y of [12, 22]) gothicWindow(p, 1.3, 2.2, [14, y, -5.75], 0, lit());
  return p;
}

/** Wrought-iron fence panel along z: rails, twisted bars and spear tips. Sits on the wall top. */
function fencePanel(L = 4) {
  const p = new Parts(), n = Math.round(L / .42);
  for (const y of [.18, 1.45]) p.add(xf(new THREE.BoxGeometry(.07, .08, L), [0, y, 0]), C.iron, { ao: false });
  for (let i = 0; i < n; i++) { const z = -L / 2 + (i + .5) * L / n; p.add(xf(new THREE.CylinderGeometry(.035, .035, 1.75, 3, 1, true).translate(0, .875, 0), [0, 0, z]), C.iron, { ao: false }); p.add(xf(new THREE.ConeGeometry(.085, .3, 3, 1, true).translate(0, .15, 0), [0, 1.75, z]), C.ironHi, { ao: false }); }
  // A diamond between every other bar near the top.
  for (let i = 0; i < n; i += 2) { const z = -L / 2 + (i + 1) * L / n; p.add(xf(new THREE.OctahedronGeometry(.11), [0, 1.2, z], [0, 0, 0], [.4, 1, 1]), C.ironHi, { ao: false }); }
  return p;
}

/** Wall pillar with a stone cap and either a caged lantern or a stone orb finial. */
function pillar(r: Rng, lamp: boolean) {
  const p = new Parts();
  p.add(block(1.5, 3.4, 1.5), grad(C.stoneDark, C.stone, 0, 3.4), { flat: true, ao: [0, 1, .6] });
  p.add(block(1.9, .35, 1.9, [0, 3.4, 0]), C.cap, { ao: false }); p.add(block(1.2, .3, 1.2, [0, 3.75, 0]), C.stoneLight, { ao: false });
  if (lamp) {
    p.add(prism(.38, .3, .9, 4, [0, 4.05, 0], [0, Math.PI / 4, 0]), C.lantern, { layer: 'glow', ao: false });
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + Math.PI / 4; p.add(prism(.035, .035, .95, 3, [Math.cos(a) * .36, 4.05, Math.sin(a) * .36]), C.iron, { ao: false }); }
    p.add(cone(.55, .5, 4, [0, 4.95, 0], [0, Math.PI / 4, 0]), C.iron, { ao: false }); p.add(bead(.1, [0, 5.5, 0]), C.iron, { ao: false });
  } else {
    p.add(ellipsoid([.55, .55, .55], [0, 4.6, 0], [0, 0, 0], .6), C.stoneLight, { ao: false });
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + r() * .2; p.add(cone(.13, .55, 4, [Math.cos(a) * .4, 4.75, Math.sin(a) * .4], [Math.sin(a) * .9, 0, -Math.cos(a) * .9]), C.stoneDark, { ao: false }); }
  }
  return p;
}

/** Wrought-iron archway over the road: tall stone gateposts, an ogee crown with a crescent moon and hanging lanterns. */
function ironGate(w: number) {
  const p = new Parts(), span = w + 2.3, top = 12.2;
  for (const s of [-1, 1]) {
    p.add(block(2.4, top, 2.4, [s * span, 0, 0]), grad(C.stoneDark, C.stone, 0, top), { flat: true, ao: [0, 2, .6] });
    p.add(block(3, .6, 3, [s * span, top, 0]), C.cap, { ao: false }); p.add(cone(1.3, 4, 4, [s * span, top + .6, 0], [0, Math.PI / 4, 0]), C.slate, { flat: true });
    p.add(bead(.35, [s * span, top + 4.9, 0]), C.lantern, { layer: 'glow', ao: false });
    for (const y of [3, 7.5]) p.add(block(2.6, .35, 2.6, [s * span, y, 0]), C.cap, { ao: false });
    gothicWindow(p, .8, 1.3, [s * span, 8.6, 1.22], 0, C.window);
  }
  // Crown: a pointed iron arch rising from the gateposts, every point above 12 m.
  const pts: V3[] = []; for (let i = 0; i <= 16; i++) { const t = i / 16, x = -span + t * span * 2; pts.push([x, top + .2 + Math.pow(Math.sin(t * Math.PI), .7) * 4.2, 0]); }
  p.add(sweep(pts, .16, { radial: 5, segments: 24 }), C.iron, { ao: false });
  p.add(xf(new THREE.BoxGeometry(span * 2, .22, .22), [0, top + .3, 0]), C.iron, { ao: false });
  for (let i = 1; i < 14; i++) { const x = -span + i * span * 2 / 14, h = Math.pow(Math.sin(i / 14 * Math.PI), .7) * 4.2; p.add(prism(.05, .05, h, 4, [x, top + .3, 0]), C.iron, { ao: false }); }
  // Crescent moon emblem at the apex.
  const moon = new THREE.Shape(); moon.absarc(0, 0, 1.3, 0, Math.PI * 2, false); const bite = new THREE.Path(); bite.absarc(.55, .25, 1.05, 0, Math.PI * 2, true); moon.holes.push(bite);
  p.add(xf(new THREE.ExtrudeGeometry(moon, { depth: .2, bevelEnabled: false, curveSegments: 10 }), [0, top + 5.9, -.1]), '#ffe9a8', { layer: 'glow', ao: false });
  for (const x of [-span * .55, span * .55]) {
    const h = top + .3 + Math.pow(Math.sin((x + span) / (span * 2) * Math.PI), .7) * 4.2;
    p.add(prism(.02, .02, h - 11.6, 3, [x, 11.6, 0]), C.iron, { ao: false });
    p.add(prism(.3, .24, .55, 6, [x, 11.05, 0]), C.lantern, { layer: 'glow', ao: false }); p.add(cone(.42, .35, 6, [x, 11.58, 0]), C.iron, { ao: false });
  }
  return p;
}

/** Twisted dead tree: a bent trunk forking twice into crooked, tapering branches. */
function deadTree(r: Rng, h = 7) {
  const p = new Parts();
  const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
    const mid = from.clone().addScaledVector(dir, len * .5).add(new THREE.Vector3(r.range(-.5, .5), r.range(-.2, .3), r.range(-.5, .5)).multiplyScalar(len * .3));
    const end = from.clone().addScaledVector(dir, len).add(new THREE.Vector3(r.range(-.4, .4), r.range(-.3, .1), r.range(-.4, .4)).multiplyScalar(len * .4));
    p.add(sweep([[from.x, from.y, from.z], [mid.x, mid.y, mid.z], [end.x, end.y, end.z]], t => rad * (1 - t * .7) + .02, { radial: depth ? 4 : 6, segments: depth ? 3 : 6 }), grad(C.bark, C.barkLight, 0, h * 1.5), { ao: depth ? false : [0, 1.2, .6] });
    if (depth >= 2) return;
    const n = depth ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = new THREE.Vector3(Math.cos(a), depth ? r.range(.1, .7) : r.range(.35, .9), Math.sin(a)).normalize();
      branch(depth ? end : from.clone().lerp(end, r.range(.6, .95)), d, len * r.range(.45, .65), rad * .5, depth + 1);
    }
  };
  branch(new THREE.Vector3(0, -.2, 0), new THREE.Vector3(r.range(-.15, .15), 1, r.range(-.15, .15)).normalize(), h, h * .06, 0);
  for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28 + r(); p.add(sweep([[0, .6, 0], [Math.cos(a) * .5, .15, Math.sin(a) * .5], [Math.cos(a) * 1.1, -.05, Math.sin(a) * 1.1]], t => .22 - t * .15, { radial: 4, segments: 3 }), C.bark, { ao: false }); }
  return p;
}

/** Cheap silhouette tree for the far hills. */
function farDeadTree(r: Rng) {
  const p = new Parts(), h = r.range(6, 10);
  p.add(prism(.12, .32, h, 4), C.bark, { ao: false, flat: true });
  for (let i = 0; i < 4; i++) { const a = r() * 6.28, y = h * r.range(.45, .85); p.add(prism(.02, .12, h * .4, 3, [0, y, 0], [Math.sin(a) * 1, 0, Math.cos(a) * 1]), C.bark, { ao: false, flat: true }); }
  return p;
}

/** Headstones in three shapes: rounded tablet, cross and obelisk. */
function gravestone(r: Rng, kind: number) {
  const p = new Parts(), tilt: V3 = [r.range(-.12, .12), 0, r.range(-.12, .12)], stone = grad(C.stoneDark, C.stoneLight, 0, 1.8);
  if (kind === 0) { p.add(xf(block(.9, 1.1, .22), [0, 0, 0], tilt), stone, { flat: true }); p.add(xf(new THREE.CylinderGeometry(.45, .45, .22, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 1.1, 0), [0, 0, 0], tilt), stone, { flat: true }); }
  else if (kind === 1) { p.add(xf(block(.24, 1.7, .24), [0, 0, 0], tilt), stone, { flat: true }); p.add(xf(new THREE.BoxGeometry(.9, .22, .24).translate(0, 1.25, 0), [0, 0, 0], tilt), stone, { flat: true }); }
  else { p.add(block(.7, .3, .7), C.stoneDark, { flat: true }); p.add(prism(.18, .3, 1.9, 4, [0, .3, 0], [0, Math.PI / 4, 0]), stone, { flat: true }); p.add(cone(.2, .35, 4, [0, 2.2, 0], [0, Math.PI / 4, 0]), C.stoneLight, { flat: true }); }
  p.add(xf(new THREE.BoxGeometry(1.1, .1, 1.5).translate(0, .05, .55), [0, 0, 0]), C.moss, { ao: false });
  return p;
}

/** Mausoleum: columns, a pediment and a faint violet glow behind the iron door. Faces +z. */
function crypt(r: Rng) {
  const p = new Parts(), wall = grad(C.stoneDark, C.stone, 0, 5);
  p.add(block(6.4, .6, 7.4), C.stoneDark, { flat: true }); p.add(block(5.2, 4.6, 5.6, [0, .6, -.6]), wall, { flat: true });
  p.add(block(6, .45, 6.6, [0, 5.2, -.3]), C.cap, { ao: false }); p.add(gable(6.2, 1.8, 6.8, [0, 5.65, -.3], [0, Math.PI / 2, 0]).rotateY(0), C.slate, { flat: true });
  p.add(xf(gable(6.2, 1.6, .5, [0, 0, 0]), [0, 5.65, 3]), C.stoneLight, { flat: true });
  for (const x of [-2.4, -1, 1, 2.4]) p.add(prism(.28, .32, 4.6, 8, [x, .6, 2.6]), C.stoneLight, { ao: false });
  p.add(card(1.7, 2.8, [0, .6, 2.21]), '#b07aff', { layer: 'glow', ao: false });
  for (let i = 0; i < 5; i++) p.add(xf(new THREE.BoxGeometry(.06, 2.8, .06), [-.68 + i * .34, 2, 2.25]), C.iron, { ao: false });
  p.add(xf(new THREE.OctahedronGeometry(.35), [0, 6.6, 3.3]), '#c9a8ff', { layer: 'glow', ao: false });
  if (r() < 2) for (const s of [-1, 1]) p.add(block(.7, 1.2, .7, [s * 3.6, .6, 3.2]), C.stone, { flat: true });
  return p;
}

/** Ruined chapel: broken walls with pointed window gaps, a leaning bell tower and a single candle-lit window. */
function chapel(r: Rng) {
  const p = new Parts(), wall = grad(C.stoneDark, C.stone, 0, 10);
  const broken = (x: number, z: number, len: number, h: number, yaw: number) => {
    for (let i = 0; i < len; i++) { const hh = h * (1 - Math.pow(Math.abs(i - len * .3) / len, 1.3) * r.range(.6, 1.2)); p.add(xf(block(1.02, Math.max(1.2, hh), 1.1), [x + Math.cos(yaw) * (i - len / 2), 0, z - Math.sin(yaw) * (i - len / 2)], [0, yaw, 0]), wall, { flat: true }); }
  };
  broken(0, -7, 12, 9, 0); broken(-6, 0, 14, 7, Math.PI / 2); broken(6, 0, 14, 5, Math.PI / 2);
  // Gable end wall facing +z with a tall pointed window.
  p.add(block(12, 9, 1.1, [0, 0, 7]), wall, { flat: true }); p.add(gable(12, 6, 1.1, [0, 9, 7]), wall, { flat: true });
  p.add(xf(arch(2.4, 8, .5, 1.3, true, 6), [0, 1, 7]), C.stoneLight, { ao: false });
  gothicWindow(p, 2.2, 5.5, [0, 1.3, 7.56], 0, C.windowHot);
  // Bell tower.
  p.add(xf(block(3.6, 16, 3.6), [5, 0, 7.5], [0, 0, .03]), wall, { flat: true });
  p.add(xf(cone(3, 6, 4, [0, 0, 0], [0, Math.PI / 4, 0]), [5.5, 16, 7.5], [0, 0, .03]), C.slate, { flat: true });
  p.add(xf(new THREE.BoxGeometry(2, 2.6, 3.8).translate(0, 13, 0), [5.4, 0, 7.5], [0, 0, .03]), '#1a1624', { ao: false });
  p.add(lathePart(), '#c9a050', { ao: false });
  for (let i = 0; i < 6; i++) p.add(rock([1, .6, .9], [r.range(-5, 5), .3, r.range(-6, 6)], r() * 9), C.stoneDark, { flat: true });
  return p;
  function lathePart() { return new THREE.LatheGeometry([new THREE.Vector2(.01, 1.1), new THREE.Vector2(.45, .9), new THREE.Vector2(.7, 0), new THREE.Vector2(.01, 0)], 8).translate(5.4, 12, 7.5); }
}

/** Jack-o'-lantern with ribs, a curled stem and a glowing carved face on +z. */
function pumpkin(r: Rng, size = 1) {
  const p = new Parts(), g = new THREE.SphereGeometry(1, 14, 9), a = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) { const x = a.getX(i), y = a.getY(i), z = a.getZ(i), ang = Math.atan2(z, x), k = 1 - .09 * Math.pow(Math.abs(Math.sin(ang * 4)), .5); a.setXYZ(i, x * k * size, (y * .72 + .7) * size, z * k * size); }
  g.computeVertexNormals();
  p.add(g, (_x, y, _z, out) => out.set(C.pumpkinDark).lerp(new THREE.Color(C.pumpkin), Math.min(1, y / (1.2 * size))), { ao: [0, .5 * size, .6] });
  p.add(sweep([[0, 1.3 * size, 0], [.05 * size, 1.6 * size, 0], [.25 * size, 1.7 * size, .05 * size]], .09 * size, { radial: 5, segments: 4 }), '#4a5a2a', { ao: false });
  const face = new THREE.BufferGeometry(), f = (x: number, y: number): number[] => [x * size, (y + .7) * size, .93 * size];
  const tri = (a: [number, number], b: [number, number], c: [number, number]) => [...f(...a), ...f(...b), ...f(...c)];
  const evil = r() < .5;
  face.setAttribute('position', new THREE.Float32BufferAttribute([
    ...tri([-.45, .15], [-.15, .15], [-.3, evil ? .42 : .4]), ...tri([.15, .15], [.45, .15], [.3, evil ? .42 : .4]), ...tri([-.08, -.02], [.08, -.02], [0, .12]),
    ...tri([-.5, -.22], [.5, -.22], [0, -.48]), ...tri([-.5, -.22], [-.32, -.22], [-.42, -.08]), ...tri([.32, -.22], [.5, -.22], [.42, -.08]),
  ], 3));
  face.computeVertexNormals(); p.add(face, C.face, { layer: 'glow', ao: false });
  return p;
}

/** Overgrown dead hedge: dark lumps with bare twigs poking out. */
function hedge(r: Rng) {
  const p = bush(r, C.hedgeLight, C.hedge, 1.3);
  for (let i = 0; i < 5; i++) { const a = r() * 6.28; p.add(sweep([[Math.cos(a) * .6, 1, Math.sin(a) * .6], [Math.cos(a) * 1.4, r.range(1.5, 2.2), Math.sin(a) * 1.4]], .04, { radial: 3, segments: 2 }), C.bark, { ao: false }); }
  return p;
}

/** Flock of bats circling the manor's towers, one instanced draw call. */
function bats(kit: Kit, at: THREE.Vector3) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .3, 0, 0, -.3, -1.1, .15, -.2, 0, 0, .3, 1.1, .15, -.2, 0, 0, -.3, -1.1, .15, -.2, -.6, -.05, -.45, 0, 0, -.3, 1.1, .15, -.2, 0, 0, -.3, .6, -.05, -.45], 3)); g.computeVertexNormals();
  const mat = kit.own(new THREE.MeshBasicMaterial({ color: '#0e0b16', side: THREE.DoubleSide, fog: true })), n = 18, mesh = new THREE.InstancedMesh(kit.own(g), mat, n);
  mesh.name = 'bats'; mesh.frustumCulled = false; kit.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), seeds = Array.from({ length: n }, (_, i) => [hash2(i, 1), hash2(i, 2), hash2(i, 3)]);
  kit.onUpdate(t => {
    seeds.forEach(([a, b, c], i) => {
      const R = 18 + a * 30, sp = (.25 + b * .25) * (i % 2 ? 1 : -1), ang = t * sp + c * 6.28, y = 32 + b * 22 + Math.sin(t * 1.3 + i) * 3;
      v.set(at.x + Math.cos(ang) * R, at.y + y, at.z + Math.sin(ang) * R);
      e.set(0, -ang + (sp > 0 ? 0 : Math.PI), Math.sin(t * 2 + i) * .3); q.setFromEuler(e);
      const flap = .35 + .65 * Math.abs(Math.sin(t * 14 + i * 1.7)); s.set(1.4 * flap, 1.4, 1.4);
      m.compose(v, q, s); mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
}

/** Moonlit mist banks: big soft sprites hugging the graveyards, drifting slowly. */
function groundMist(kit: Kit, spots: THREE.Vector3[]) {
  const mat = kit.own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color('#9d90d0') } }]),
    vertexShader: `uniform float uTime; varying vec2 vUv; varying float vSeed;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vSeed = position.z; vec3 c = position; vec4 mvPosition = viewMatrix * vec4(c.x + sin(uTime * .1 + c.z) * 3., c.y, c.z + cos(uTime * .08 + c.x) * 3., 1.); mvPosition.xy += (uv - .5) * vec2(26., 7.); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uColor; varying vec2 vUv;
      #include <fog_pars_fragment>
      void main(){ vec2 p = vUv * 2. - 1.; float a = smoothstep(1., .1, length(p * vec2(1., 1.6))) * .22; gl_FragColor = vec4(uColor, a);
        #include <fog_fragment>
      }`,
  }));
  mat.uniforms.uTime = stageTime;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  spots.forEach((c, i) => { for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { pos.push(c.x, c.y + 1.4, c.z); uv.push(u, v); } const o = i * 4; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); });
  const g = kit.own(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.name = 'mist'; kit.add(mesh);
}

export const manor: CourseArt = {
  env: {
    sky: { top: '#090a22', horizon: '#3d3462', band: { color: '#6a4c8e', height: .09, strength: .55 }, moon: { color: '#efeaff', size: .2, dir: [.55, .32, -.6] },
      stars: 1.3, aurora: '#2e8c8a', clouds: { lit: '#5d5888', shade: '#221f3c', cover: .28, scale: .8, speed: .6 }, cumulus: { lit: '#4d4677', shade: '#262143', height: .12, amount: .45 } },
    fog: { color: '#3d3462', near: 70, far: 520 },
    hemi: { sky: '#8a80c8', ground: '#2c2438', intensity: 1.35 },
    sun: { color: '#a9b6ff', intensity: 2, dir: [.55, .55, -.6] },
    mountains: [
      { color: '#1b1830', radius: 950, height: 170, rough: .85, haze: .45, seed: 5 },
      { color: '#262040', radius: 760, height: 80, rough: .5, haze: .35, seed: 11 },
    ],
  },
  terrain: {
    height: hills({ amp: 34, ridge: 14, scale: 1, flat: 27, rise: 70, seed: 9 }),
    color(p, h, slope, out) {
      const n = fbm2(p.x * .035, p.z * .035, 3, 4), m = fbm2(p.x * .008, p.z * .008, 2, 7);
      out.set(C.grass).lerp(new THREE.Color(C.grassDead), smoothstep(.4, .7, n) * .7).lerp(new THREE.Color(C.moss), smoothstep(.55, .3, m) * .5);
      out.lerp(new THREE.Color('#4a4456'), smoothstep(p.w + 4, p.w + 1.5, p.d) * .9);
      out.lerp(new THREE.Color('#585068'), smoothstep(.5, .9, slope) * .8);
    },
    detail: 'grass',
  },
  road: { kind: 'flagstone', palette: { base: '#6a6380', dark: '#36304a', light: '#8f87a6' } },
  start: { pillar: '#4a4460', trim: '#b8acd0', banner: '#3a1d52', text: '#ffcf6a', light: '#9fd8ff', flags: ['#5a2a7a', '#e0702a', '#2a2a4a', '#8a5ac8'] },
  hazard: 'ink',
  signs: { board: '#2a2238', arrow: '#ffb84a', post: '#1d1a26' },
  ambient: [
    { color: '#9fe0ff', endColor: '#b77aff', rate: 12, size: .32, life: 5, glow: true, height: [.6, 3.5], wander: .6, drift: [0, .15, 0], radius: 36, alpha: .9 },
    { color: '#b5a8e8', rate: 6, size: 3.5, life: 7, height: [.1, 1], drift: [.5, 0, .2], wander: .2, shape: Shape.Smoke, radius: 40, alpha: .14 },
  ],
  catalog: {
    Manor: manorHouse, 'Iron gate': () => ironGate(11), 'Wall lantern': r => pillar(r, true), 'Wall finial': r => pillar(r, false), 'Iron fence': () => fencePanel(),
    'Dead tree': r => deadTree(r), 'Far tree': farDeadTree, Tablet: r => gravestone(r, 0), Cross: r => gravestone(r, 1), Obelisk: r => gravestone(r, 2),
    Crypt: crypt, 'Ruined chapel': chapel, Pumpkin: r => pumpkin(r), 'Dead hedge': hedge,
  },
  build(kit) {
    const r = kit.r, w = kit.w;
    // Kerb, low stone wall and the iron fence along both sides. The wall's inner face sits on the physical wall at w + 0.7.
    kit.extrude([[-.4, .02], [-.15, .14], [.62, .14]], { mirror: true, step: 2, paint: (_s, _k, i, out) => out.set(i % 2 ? '#a99fc0' : '#7a7192') });
    const stoneTone = new THREE.Color(), base = new THREE.Color(C.stone), dark = new THREE.Color(C.stoneDark);
    kit.extrude([[.62, -.3], [.62, 1.15], [.72, 1.3], [1.48, 1.3], [1.58, 1.15], [1.58, -.6]], { mirror: true, step: 2, paint: (s, k, i, out) => {
      if (k >= 1 && k <= 3) { out.set(C.cap); return; }
      stoneTone.copy(dark).lerp(base, .35 + hash2(i, k, 3) * .55); out.copy(stoneTone);
    } });
    for (let s = 0; s < kit.len; s += 4) for (const side of [-1, 1]) {
      const sc = Math.round(s / 4), q = kit.at(s, side * (w + 1.1));
      // Inside the bend at the start the fence line would cross the incoming road.
      if (kit.road(q.x, q.z).d < w + .9) continue;
      if (sc % 5 === 0) kit.onTrack(kit.prop('pillar', rr => pillar(rr, (sc / 5) % 2 === 0), (sc / 5) % 2), s, side * (w + 1.1), { yaw: 0 });
      else kit.onTrack(kit.prop('fence', () => fencePanel(4)), s, side * (w + 1.1), { y: 1.3 });
    }
    // Iron gates over the road.
    for (const f of [.13, .37, .61, .85]) kit.onTrack(kit.prop('gate', () => ironGate(w)), kit.len * f, 0);
    // The manor, on the infield spot furthest from any road.
    const { cx, cz, extent } = kit.bounds; let best = { x: cx, z: cz, d: 0 };
    for (let i = 0; i < 900; i++) { const x = cx + (r() * 2 - 1) * extent * .7, z = cz + (r() * 2 - 1) * extent * .7, d = kit.road(x, z).d; if (d > best.d) best = { x, z, d }; }
    const near = kit.at(0); let nearest = { s: 0, d: Infinity };
    for (let s = 0; s < kit.len; s += 8) { const p = kit.at(s), d = Math.hypot(p.x - best.x, p.z - best.z); if (d < nearest.d) nearest = { s, d }; }
    const face = kit.at(nearest.s), yaw = Math.atan2(face.x - best.x, face.z - best.z), scale = Math.min(1.25, Math.max(.6, (best.d - 12) / 45));
    void near;
    const gy = kit.groundAt(best.x, best.z);
    kit.place(kit.prop('manor', manorHouse), best.x, gy, best.z, { yaw, scale });
    bats(kit, new THREE.Vector3(best.x, gy, best.z));
    // Graveyards, crypts and the chapel in the spaces between road sections.
    const mist: THREE.Vector3[] = [];
    kit.scatter(11, w + 16, 60, (x, z) => {
      const y = kit.groundAt(x, z), roadDir = Math.atan2(cx - x, cz - z);
      if (Math.hypot(x - best.x, z - best.z) < 55 * scale) return;
      kit.place(kit.prop('crypt', crypt, r.int(0, 1)), x, y, z, { yaw: roadDir + r.range(-.4, .4) }); mist.push(new THREE.Vector3(x, y, z));
      for (let i = 0; i < 16; i++) {
        const gx = x + r.range(-14, 14), gz = z + r.range(-14, 14); if (kit.road(gx, gz).d < w + 5 || Math.hypot(gx - x, gz - z) < 5) continue;
        kit.place(kit.prop('grave', rr => gravestone(rr, 0), r.int(0, 2)), gx, kit.groundAt(gx, gz), gz, { yaw: roadDir + r.range(-.25, .25), scale: r.range(.85, 1.2) });
      }
    });
    kit.scatter(160, w + 4, 34, (x, z) => { const kind = r.int(0, 2); kit.place(kit.prop(`grave${kind}`, rr => gravestone(rr, kind), r.int(0, 2)), x, kit.groundAt(x, z), z, { yaw: r() * 6.28, scale: r.range(.8, 1.15), tint: r() < .3 ? '#c8c0e0' : undefined, tintAmount: .3 }); });
    let chapels = 0;
    kit.scatter(40, w + 24, 70, (x, z) => { if (chapels >= 2 || Math.hypot(x - best.x, z - best.z) < 70) return; chapels++; kit.place(kit.prop('chapel', chapel), x, kit.groundAt(x, z), z, { yaw: Math.atan2(cx - x, cz - z) }); mist.push(new THREE.Vector3(x, kit.groundAt(x, z), z)); });
    // Pumpkins grinning beside the walls, outside the fence.
    for (let s = 20; s < kit.len; s += r.range(9, 22)) {
      const side = r.sign(), off = side * (w + r.range(2.4, 5)), p = kit.at(s, off); if (kit.road(p.x, p.z).d < w + 2) continue;
      const n = r.int(1, 3);
      for (let i = 0; i < n; i++) kit.onTrack(kit.prop('pumpkin', rr => pumpkin(rr), r.int(0, 3)), s + i * 1.3, off + side * i * .6, { faceRoad: true, onGround: true, scale: r.range(.5, .95), yaw: r.range(-.4, .4) });
    }
    // Dead trees and hedges, thinning out into silhouettes on the hills.
    kit.scatter(170, w + 11, 90, (x, z, d) => {
      const y = kit.groundAt(x, z); if (Math.hypot(x - best.x, z - best.z) < 48 * scale) return;
      if (r() < .7) kit.place(kit.prop('dead tree', rr => deadTree(rr, rr.range(6, 9)), r.int(0, 5)), x, y, z, { yaw: r() * 6.28, scale: r.range(.8, 1.4) * (d > 50 ? 1.3 : 1) });
      else kit.place(kit.prop('hedge', hedge, r.int(0, 2)), x, y, z, { yaw: r() * 6.28, scale: r.range(.8, 1.3) });
      if (r() < .3) mist.push(new THREE.Vector3(x, y, z));
    });
    kit.scatter(900, 90, 420, (x, z) => kit.place(kit.prop('far tree', farDeadTree, r.int(0, 4)), x, kit.groundAt(x, z), z, { yaw: r() * 6.28, scale: r.range(1, 2) }));
    kit.scatter(260, w + 3, 40, (x, z) => kit.place(kit.prop('grass', rr => grass(rr, '#2f3c3a', '#6a7458', 1, 9), r.int(0, 2)), x, kit.groundAt(x, z), z, { yaw: r() * 6.28, scale: r.range(.9, 1.4) }));
    groundMist(kit, mist);
    void cone; void cyl; void rbox; void disc; void card;
  },
};
