import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RACERS } from '../../shared/game.ts';
import { toon, glow, outlineMaterial, skinUniforms, type SkinUniforms } from './materials.ts';
import { xf, ellipsoid, ball, rbox, cyl, torus, lathe, rock, sweep, feather, horn, tube, type V3 } from './shapes.ts';

export interface AnimState { t: number; dt: number; speed: number; steer: number; drifting: boolean; flying: number; stun: number; boost: number; menu: boolean }
/** A rigged, animated racer. The world positions `root`; the model animates everything below it. */
export interface Character {
  root: THREE.Group; model: THREE.Group; skin: SkinUniforms;
  /** Boost flames and exhaust smoke spawn from these points. */
  exhausts: THREE.Object3D[];
  /** Ground contact points at the back, used for drift sparks and dust. */
  contacts: THREE.Object3D[];
  head: THREE.Object3D; height: number;
  animate(s: AnimState): void; dispose(): void;
}

const shade = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));

function prep(g: THREE.BufferGeometry) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

class Rig {
  root = new THREE.Group(); model = new THREE.Group(); skin = skinUniforms();
  private batches = new Map<THREE.Object3D, Map<THREE.Material, THREE.BufferGeometry[]>>();
  private mats = new Map<string, THREE.Material>();
  constructor() { this.root.add(this.model); }
  joint(parent: THREE.Object3D, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...pos); g.rotation.set(...rot); parent.add(g); return g; }
  /** Cached per-rig toon material. `flat` gives faceted stone; `noOutline` skips the hull. */
  t(color: string, o: { flat?: boolean; noOutline?: boolean; emissive?: string; ei?: number } = {}) {
    const key = `t${color}${o.flat ? 'f' : ''}${o.noOutline ? 'n' : ''}${o.emissive || ''}`;
    if (!this.mats.has(key)) { const m = toon(color, this.skin, { emissive: o.emissive, emissiveIntensity: o.ei }); m.userData.noOutline = !!o.noOutline; this.mats.set(key, m); }
    return this.mats.get(key)!;
  }
  g(color: string, intensity = 2.4) { const key = `g${color}${intensity}`; if (!this.mats.has(key)) this.mats.set(key, glow(color, intensity)); return this.mats.get(key)!; }
  add(j: THREE.Object3D, m: THREE.Material, ...geos: THREE.BufferGeometry[]) {
    if (!this.batches.has(j)) this.batches.set(j, new Map());
    const b = this.batches.get(j)!; if (!b.has(m)) b.set(m, []); b.get(m)!.push(...geos.map(prep));
  }
  /**
   * Merges each joint into as few draw calls as possible: every plain toon part is baked into one
   * vertex-coloured mesh, glows stay separate, and one inverted hull outlines the joint.
   */
  finish(outline: string, width = .032) {
    const line = outlineMaterial(outline, width, this.skin), base = toon('#ffffff', this.skin); base.vertexColors = true;
    const c = new THREE.Color();
    for (const [j, byMat] of this.batches) {
      const hull: THREE.BufferGeometry[] = [], baked: THREE.BufferGeometry[] = [];
      for (const [m, geos] of byMat) {
        const toonPart = m instanceof THREE.MeshToonMaterial && !m.emissive.getHex();
        // Small details (claws, knobs, eyes) get no hull: their outline would be sub-pixel at race distance.
        if (m instanceof THREE.MeshToonMaterial && !m.userData.noOutline) for (const x of geos) { x.computeBoundingSphere(); if (x.boundingSphere!.radius > .16) hull.push(x.clone().deleteAttribute('normal')); }
        if (toonPart) {
          c.copy(m.color);
          for (const x of geos) { const n = x.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3); x.setAttribute('color', new THREE.BufferAttribute(col, 3)); baked.push(x); }
          continue;
        }
        const g = mergeGeometries(geos); geos.forEach(x => x.dispose()); if (!g) continue;
        const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; j.add(mesh);
      }
      if (baked.length) { const g = mergeGeometries(baked); baked.forEach(x => x.dispose()); if (g) { const mesh = new THREE.Mesh(g, base); mesh.castShadow = mesh.receiveShadow = true; j.add(mesh); } }
      if (hull.length) { const merged = mergeGeometries(hull); hull.forEach(h => h.dispose()); if (merged) { const welded = mergeVertices(merged, 1e-3); merged.dispose(); welded.computeVertexNormals(); const o = new THREE.Mesh(welded, line); o.userData.outline = true; j.add(o); } }
    }
    this.batches.clear();
  }
}

/** Glossy cartoon eyes on a blink joint. */
function eyes(r: Rig, head: THREE.Object3D, o: { y: number; z: number; sep: number; w: number; h: number; turn: number; iris: string; sclera?: string; pupil?: string; slit?: boolean }) {
  const blink = r.joint(head, [0, o.y, o.z]);
  for (const s of [-1, 1]) {
    const a = s * o.turn, dir: V3 = [Math.sin(a), 0, Math.cos(a)], c: V3 = [s * o.sep, 0, 0], at = (k: number, up = 0, side = 0): V3 => [c[0] + dir[0] * k + side * s, c[1] + up, c[2] + dir[2] * k];
    if (o.sclera !== 'none') r.add(blink, r.t(o.sclera || '#fffdf7'), ellipsoid([o.w, o.h, o.w * .5], c, [0, a, 0], .8));
    r.add(blink, r.t(o.iris, { noOutline: true }), ellipsoid(o.slit ? [o.w * .5, o.h * .8, o.w * .3] : [o.w * .74, o.h * .8, o.w * .3], at(o.w * .3, -o.h * .06), [0, a, 0], .8));
    r.add(blink, r.t(o.pupil || '#120d10', { noOutline: true }), ellipsoid(o.slit ? [o.w * .14, o.h * .68, o.w * .2] : [o.w * .4, o.h * .5, o.w * .2], at(o.w * .45, -o.h * .08), [0, a, 0], .7));
    r.add(blink, r.g('#ffffff', 1.3), ball(o.w * .2, at(o.w * .62, o.h * .32, -o.w * .14), .6), ball(o.w * .09, at(o.w * .6, -o.h * .3, o.w * .18), .5));
  }
  return blink;
}

interface Wheel { j: THREE.Object3D; r: number }
/** Rubber tyre, rim and hub on its own spin joint. */
function wheel(r: Rig, parent: THREE.Object3D, pos: V3, radius: number, width: number, rimColor = '#d9dee6', knobby = false) {
  const j = r.joint(parent, pos), side = Math.sign(pos[0]) || 1, w = width / 2, tire = r.t('#26272f');
  r.add(j, tire, lathe([[radius * .6, -w], [radius * .9, -w], [radius, -w * .55], [radius, w * .55], [radius * .9, w], [radius * .6, w]], [0, 0, 0], [0, 0, Math.PI / 2], radius > .2 ? 18 : 10));
  r.add(j, r.t(rimColor), cyl(radius * .62, radius * .62, width * .86, [0, 0, 0], [0, 0, Math.PI / 2], 18));
  r.add(j, r.t('#4b4f5c'), cyl(radius * .26, radius * .3, width * .2, [side * w * .95, 0, 0], [0, 0, Math.PI / 2], 12));
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; r.add(j, r.t(shade(rimColor, .7)), rbox(width * .1, radius * .1, radius * .42, .02, [side * w * .88, Math.sin(a) * radius * .36, Math.cos(a) * radius * .36], [a, 0, 0])); }
  if (knobby) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; r.add(j, tire, rbox(width * .96, radius * .12, radius * .2, .03, [0, Math.sin(a) * radius * 1.01, Math.cos(a) * radius * 1.01], [-a, 0, 0])); }
  return { j, r: radius } as Wheel;
}

interface Build { r: Rig; head: THREE.Object3D; height: number; wheels: Wheel[]; steer: THREE.Object3D[]; exhausts: THREE.Object3D[]; contacts: THREE.Object3D[]; outline: string; update?: (s: AnimState, k: number) => void }

/** Chocobo and Chubby Chocobo share a bird body with different proportions. */
function bird(r: Rig, parent: THREE.Object3D, color: string, light: string, fat: boolean) {
  const B = r.t(color), L = r.t(light), D = r.t(shade(color, .8)), beak = r.t('#f39a2b'), F = fat ? 1.32 : 1;
  const body = r.joint(parent, [0, 0, 0]);
  r.add(body, B, ellipsoid([.8 * F, .74 * F, .9 * F], [0, 0, 0], [.18, 0, 0]));
  r.add(body, L, ellipsoid([.6 * F, .56 * F, .44 * F], [0, -.08 * F, .5 * F], [.2, 0, 0]));
  for (let i = -2; i <= 2; i++) r.add(body, L, feather([i * .15 * F, .05, .82 * F], [i * .17 * F, -.2 * F, .86 * F], [i * .19 * F, -.38 * F, .8 * F], .13 * F, .35, [0, 0, 1]));
  for (let i = -3; i <= 3; i++) r.add(body, i % 2 ? D : B, feather([i * .12 * F, -.38 * F, -.55 * F], [i * .15 * F, -.6 * F, -.6 * F], [i * .18 * F, -.82 * F, -.48 * F], .12 * F, .4, [0, 0, -1]));
  const neckTop: V3 = fat ? [0, .78, .62] : [0, .98, .66];
  if (!fat) { r.add(body, B, sweep([[0, .1, .3], [0, .55, .56], neckTop], t => .5 - t * .2, { radial: 16 })); }
  const head = r.joint(body, [0, neckTop[1] + (fat ? .3 : .16), neckTop[2] + .04]), H = fat ? 1.12 : 1;
  r.add(head, B, ellipsoid([.5 * H, .47 * H, .52 * H]));
  for (const s of [-1, 1]) r.add(head, r.t('#ffb0a0', { noOutline: true }), ellipsoid([.1 * H, .06 * H, .04 * H], [s * .3 * H, -.12 * H, .4 * H], [0, s * .6, 0]));
  r.add(head, beak, sweep([[0, -.04, .36 * H], [0, -.08, .66 * H], [0, -.18, .92 * H]], t => .21 * (1 - t) + .02, { flat: .55, radial: 12 }));
  r.add(head, r.t('#d97a1c'), sweep([[0, -.15, .36 * H], [0, -.2, .58 * H], [0, -.24, .7 * H]], t => .15 * (1 - t) + .02, { flat: .45, radial: 10 }));
  const crest = r.joint(head, [0, .3 * H, 0]), n = fat ? 3 : 5;
  for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * .12, lift = 1 - Math.abs(k - (n - 1) / 2) * .14; r.add(crest, k % 2 ? D : B, feather([x * .7, 0, .08], [x * 1.1, .36 * lift, -.04], [x * 1.7, .7 * lift, -.44], .13, .42, [1, 0, 0])); }
  const blink = eyes(r, head, { y: .1 * H, z: .35 * H, sep: .24 * H, w: .16 * H, h: .2 * H, turn: .5, iris: '#2f6fb8', pupil: '#0f1a2e' });
  const wings: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const w = r.joint(body, [s * .76 * F, .14 * F, .04], [0, 0, -s * .15]); wings.push(w);
    r.add(w, B, ellipsoid([.17, .32, .42], [s * .05, -.04, -.08]));
    for (let k = 0; k < 3; k++) r.add(w, k === 1 ? L : k ? D : B, feather([s * .06, 0, .12], [s * .14, -.16 - k * .04, -.24], [s * .18, -.3 - k * .08, -.62 + k * .1], .16, .3, [1, 0, 0]));
  }
  const tail = r.joint(body, [0, .12 * F, -.82 * F]);
  for (let k = 0; k < 5; k++) { const a = (k - 2) * .42; r.add(tail, k % 2 ? D : B, feather([Math.sin(a) * .08, 0, .1], [Math.sin(a) * .3, .16, -.4], [Math.sin(a) * .62, .34 + Math.cos(a) * .12 - Math.abs(a) * .2, -1.0], .17, .3, [0, 1, 0])); }
  r.add(tail, L, feather([0, .05, .05], [0, .3, -.35], [0, .52, -.85], .13, .3, [0, 1, 0]));
  return { body, head, blink, crest, wings, tail };
}

function chocobo(c: typeof RACERS[number]): Build {
  const r = new Rig(), b = bird(r, r.joint(r.model, [0, 1.9, -.05]), c.color, c.light, false), legs: { hip: THREE.Object3D; knee: THREE.Object3D; ankle: THREE.Object3D }[] = [], wheels: Wheel[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const leg = r.t('#f0a540'), claw = r.t('#fff3d9'), boot = r.t('#3f6fd0'), trim = r.t('#ffcf4a'), metal = r.t('#c9d1dc');
  for (const s of [-1, 1]) {
    const hip = r.joint(b.body, [s * .36, -.48, -.08]); r.add(hip, r.t(c.color), ellipsoid([.28, .36, .31], [0, -.1, 0]));
    const knee = r.joint(hip, [0, -.42, .02]); r.add(knee, leg, tube([[0, 0, 0], [0, -.3, -.06], [0, -.62, 0]], .085));
    const ankle = r.joint(knee, [0, -.64, 0]);
    r.add(ankle, boot, rbox(.34, .26, .56, .11, [0, -.02, .08])); r.add(ankle, trim, rbox(.36, .07, .58, .03, [0, .1, .08]));
    for (const x of [-.09, 0, .09]) r.add(ankle, claw, horn([[x, 0, .33], [x, -.03, .4], [x, -.09, .43]], .035));
    r.add(ankle, metal, rbox(.1, .08, .74, .03, [0, -.17, .06]));
    for (const z of [-.22, .05, .32]) wheels.push(wheel(r, ankle, [0, -.24, z], .1, .07, '#ffcf4a'));
    r.add(ankle, metal, cyl(.075, .1, .24, [0, .02, -.26], [Math.PI / 2, 0, 0], 14)); r.add(ankle, r.g('#ffb24a', 2), torus(.07, .022, [0, .02, -.39]));
    const ex = r.joint(ankle, [0, .02, -.42]); exhausts.push(ex); const ct = r.joint(ankle, [0, -.33, -.25]); contacts.push(ct);
    legs.push({ hip, knee, ankle });
  }
  let phase = 0, flap = 0;
  return { r, head: b.head, height: 3.5, wheels, steer: [], exhausts, contacts, outline: '#3b2a12', update(s, k) {
    phase += s.dt * (s.menu ? 2.4 : 3 + Math.abs(s.speed) * .2); const kl = s.menu ? .2 : k;
    legs.forEach((l, i) => { const p = phase + i * Math.PI, push = Math.max(0, Math.sin(p)); l.hip.rotation.x = -Math.cos(p) * .42 * kl; l.hip.rotation.z = (i ? 1 : -1) * push * .2 * kl; l.knee.rotation.x = (.25 + push * .45) * kl; l.ankle.rotation.x = -l.hip.rotation.x - l.knee.rotation.x * .8; });
    b.body.position.y = Math.abs(Math.sin(phase)) * .07 * k + (s.menu ? Math.sin(s.t * 2.2) * .03 : 0);
    b.body.rotation.z = Math.sin(phase) * .05 * k; b.body.rotation.x = .1 * k;
    flap = damp(flap, s.flying > 0 ? 1 : 0, 6, s.dt);
    b.wings.forEach((w, i) => { const sd = i ? 1 : -1; w.rotation.z = -sd * (.15 + flap * (.9 + Math.sin(s.t * 26) * .8) + (1 - flap) * (.12 + Math.sin(s.t * 3 + phase) * .1 + k * .35)); w.rotation.x = (1 - flap) * k * .25; });
    b.tail.rotation.x = -k * .25 + Math.sin(s.t * 4) * .04; b.tail.rotation.y = -s.steer * .25;
    b.crest.rotation.x = -k * .25 + Math.sin(s.t * 9) * .03 * k;
    b.head.rotation.y = s.menu ? Math.sin(s.t * .7) * .35 : s.steer * .3; b.head.rotation.x = -Math.sin(phase * 2) * .04 * k;
    b.blink.scale.y = (s.t * .7) % 3.5 < .09 ? .12 : 1;
  } };
}

function chubby(c: typeof RACERS[number]): Build {
  const r = new Rig(), frame = r.t('#db6b41'), chrome = r.t('#cfd5dd'), dark = r.t('#353543'), wheels: Wheel[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const trike = r.joint(r.model);
  r.add(trike, frame, rbox(1.5, .22, 1.9, .1, [0, .7, -.35]), tube([[0, .78, .5], [0, 1.15, 1.05], [0, 1.65, 1.2]], .09));
  r.add(trike, dark, rbox(1.25, .2, 1.05, .09, [0, .9, -.35]));
  r.add(trike, r.t('#ffcf4a'), rbox(1.6, .08, .2, .04, [0, .82, -1.32]));
  const fork = r.joint(trike, [0, 0, 1.18]);
  r.add(fork, chrome, tube([[-.18, .52, 0], [-.18, 1.0, .02], [-.12, 1.5, 0]], .05), tube([[.18, .52, 0], [.18, 1.0, .02], [.12, 1.5, 0]], .05), tube([[-.62, 1.78, -.15], [-.3, 1.66, 0], [.3, 1.66, 0], [.62, 1.78, -.15]], .05));
  r.add(fork, r.t('#f04b4b'), ball(.08, [-.64, 1.79, -.16]), ball(.08, [.64, 1.79, -.16]));
  r.add(fork, r.g('#fff2c0', 2), ellipsoid([.16, .16, .06], [0, 1.25, .17]));
  wheels.push(wheel(r, fork, [0, .52, 0], .52, .3, '#ffcf4a'));
  for (const s of [-1, 1]) { wheels.push(wheel(r, trike, [s * 1.0, .44, -.95], .44, .34, '#ffcf4a')); contacts.push(r.joint(trike, [s * 1.0, .05, -1.05])); }
  // The Phat-Burner tank and twin rocket nozzles.
  r.add(trike, r.t('#e8e2d5'), cyl(.36, .36, 1.1, [0, 1.05, -1.25], [0, 0, Math.PI / 2], 20), ball(.36, [-.55, 1.05, -1.25]), ball(.36, [.55, 1.05, -1.25]));
  r.add(trike, frame, torus(.37, .04, [-.3, 1.05, -1.25], [0, Math.PI / 2, 0]), torus(.37, .04, [.3, 1.05, -1.25], [0, Math.PI / 2, 0]));
  for (const s of [-1, 1]) { r.add(trike, chrome, cyl(.13, .2, .45, [s * .4, 1.05, -1.6], [Math.PI / 2, 0, 0], 16)); r.add(trike, r.g('#ff9d3a', 2.2), torus(.16, .035, [s * .4, 1.05, -1.83])); exhausts.push(r.joint(trike, [s * .4, 1.05, -1.88])); }
  const b = bird(r, r.joint(r.model, [0, 1.8, -.2]), c.color, c.light, true), legs: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const hip = r.joint(b.body, [s * .5, -.6, .45]); r.add(hip, r.t(c.color), ellipsoid([.3, .32, .34], [0, 0, .05])); const shin = r.joint(hip, [0, -.15, .32]); r.add(shin, r.t('#f0a540'), tube([[0, 0, 0], [0, -.25, .2], [0, -.42, .3]], .08)); for (const x of [-.08, 0, .08]) r.add(shin, r.t('#fff3d9'), horn([[x, -.42, .3], [x, -.45, .44], [x, -.52, .5]], .05)); legs.push(hip); }
  let phase = 0;
  return { r, head: b.head, height: 3.6, wheels, steer: [fork], exhausts, contacts, outline: '#3b2a12', update(s, k) {
    phase += s.dt * (s.menu ? 1.2 : 2 + Math.abs(s.speed) * .25);
    legs.forEach((l, i) => { l.rotation.x = Math.sin(phase + i * Math.PI) * .45 * Math.max(k, s.menu ? .3 : 0); });
    b.body.position.y = Math.sin(phase * 2) * .03 + (s.menu ? Math.sin(s.t * 2) * .03 : 0); b.body.rotation.z = Math.sin(phase) * .04;
    b.wings.forEach((w, i) => { const sd = i ? 1 : -1; w.rotation.z = -sd * (s.flying > 0 ? .9 + Math.sin(s.t * 24) * .8 : .5 + Math.sin(s.t * 3) * .06); w.rotation.x = -.9; });
    b.tail.rotation.x = -.15 + Math.sin(s.t * 3) * .05; b.crest.rotation.x = Math.sin(s.t * 7) * .04 * k;
    b.head.rotation.y = s.menu ? Math.sin(s.t * .6) * .3 : s.steer * .25; b.blink.scale.y = (s.t * .8 + 1.3) % 3.9 < .09 ? .12 : 1;
  } };
}

function mog(): Build {
  const r = new Rig(), blue = r.t('#3f8bd8'), deep = r.t('#2a5f9c'), chrome = r.t('#d8dde4'), fur = r.t('#fbf3ef'), pink = r.t('#f2c6c2'), wheels: Wheel[] = [], steer: THREE.Object3D[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const car = r.joint(r.model);
  r.add(car, blue, rbox(1.75, .55, 2.6, .26, [0, .66, -.05]), ellipsoid([.82, .4, .7], [0, .66, 1.05]), rbox(1.8, .3, 1.0, .14, [0, .95, -.85]));
  r.add(car, deep, rbox(1.82, .12, 2.5, .05, [0, .48, -.05]));
  r.add(car, r.t('#26304a'), rbox(1.25, .16, 1.15, .07, [0, .98, -.2]), rbox(1.2, .62, .22, .1, [0, 1.25, -.72]));
  r.add(car, r.t('#ffe07a'), rbox(.5, .05, 2.3, .02, [0, .94, .1]));
  r.add(car, r.t('#9fd6ff'), rbox(1.1, .26, .03, .015, [0, 1.12, .62], [-.6, 0, 0])); r.add(car, r.t('#d8dde4'), torus(.03, .02, [-.55, 1.0, .66]), torus(.03, .02, [.55, 1.0, .66]));
  r.add(car, chrome, rbox(1.9, .14, .18, .07, [0, .5, 1.52]), rbox(1.9, .14, .18, .07, [0, .5, -1.38]), torus(.24, .035, [0, 1.3, .3], [-1.0, 0, 0]));
  for (const s of [-1, 1]) {
    r.add(car, r.g('#fff2c8', 2.4), ellipsoid([.14, .12, .06], [s * .5, .72, 1.6])); r.add(car, r.g('#ff3a3a', 2.2), rbox(.26, .12, .05, .03, [s * .62, .78, -1.4]));
    r.add(car, chrome, cyl(.08, .1, .36, [s * .38, .48, -1.48], [Math.PI / 2, 0, 0], 12)); exhausts.push(r.joint(car, [s * .38, .48, -1.68]));
    const st = r.joint(car, [s * .86, .38, .88]); steer.push(st); wheels.push(wheel(r, st, [0, 0, 0], .38, .32));
    wheels.push(wheel(r, car, [s * .86, .38, -.85], .38, .32)); contacts.push(r.joint(car, [s * .86, .03, -.95]));
  }
  const body = r.joint(r.model, [0, 1.42, -.18]); r.add(body, fur, ellipsoid([.56, .5, .5]));
  for (const s of [-1, 1]) r.add(body, fur, tube([[s * .45, .15, .1], [s * .45, .1, .45], [s * .25, -.08, .55]], .13), ball(.15, [s * .25, -.06, .58]));
  const head = r.joint(body, [0, .78, .1]); r.add(head, fur, ellipsoid([.68, .6, .6]));
  r.add(head, r.t('#e6455c'), ellipsoid([.13, .1, .1], [0, -.12, .57]));
  r.add(head, r.t('#f7a8b4', { noOutline: true }), ellipsoid([.12, .07, .04], [-.36, -.13, .48], [0, -.5, 0]), ellipsoid([.12, .07, .04], [.36, -.13, .48], [0, .5, 0]));
  const blink = eyes(r, head, { y: .06, z: .5, sep: .24, w: .1, h: .13, turn: .38, iris: '#3a2430' });
  for (const s of [-1, 1]) { r.add(head, fur, horn([[s * .34, .36, 0], [s * .5, .64, -.02], [s * .62, .9, -.06]], .2)); r.add(head, pink, horn([[s * .35, .4, .07], [s * .5, .64, .06], [s * .58, .82, .02]], .1)); }
  r.add(head, r.t('#965356'), tube([[0, .55, -.05], [0, .82, -.1], [0, 1.05, -.18]], .028, 8));
  const pom = r.joint(head, [0, 1.12, -.2]); r.add(pom, r.t('#f34364'), ball(.21));
  const wings: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const w = r.joint(body, [s * .3, .3, -.42]); wings.push(w); for (let k = 0; k < 3; k++) r.add(w, r.t(k === 1 ? '#8f5bb8' : '#a774c6'), feather([0, 0, 0], [s * (.25 + k * .05), .18 - k * .12, -.12], [s * (.55 + k * .08), .32 - k * .22, -.2], .14, .22, [0, 0, 1])); }
  let pv = 0, px = 0, pvz = 0, pz = 0;
  return { r, head, height: 3.6, wheels, steer, exhausts, contacts, outline: '#3a2a3a', update(s, k) {
    const ax = -s.steer * 3 * k, az = (s.menu ? 0 : -k) * 1.2;
    pv += ((ax - px) * 60 - pv * 5) * s.dt; px += pv * s.dt; pvz += ((az - pz) * 60 - pvz * 5) * s.dt; pz += pvz * s.dt;
    pom.rotation.z = clamp(px * .3, -.8, .8); pom.rotation.x = clamp(pz * .3 + Math.sin(s.t * 18) * .05 * k, -.8, .8);
    wings.forEach((w, i) => { w.rotation.y = (i ? 1 : -1) * (Math.sin(s.t * (s.flying > 0 ? 30 : 8)) * (s.flying > 0 ? .7 : .25)); });
    body.position.y = 1.42 + Math.sin(s.t * 5) * .015 + Math.sin(s.t * 23) * .01 * k;
    head.rotation.y = s.menu ? Math.sin(s.t * .8) * .3 : s.steer * .25; head.rotation.z = -s.steer * .1;
    blink.scale.y = (s.t * .6 + .7) % 3.2 < .1 ? .1 : 1;
  } };
}

function golem(c: typeof RACERS[number]): Build {
  const r = new Rig(), stone = r.t(c.color, { flat: true }), pale = r.t(c.light, { flat: true }), moss = r.t('#6c9a4a', { flat: true }), iron = r.t('#5d6169'), olive = r.t('#87926b'), chrome = r.t('#c4c9d2'), wheels: Wheel[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const car = r.joint(r.model);
  r.add(car, olive, rbox(2.2, .55, 2.5, .18, [0, .78, -.1]), rbox(2.0, .5, .6, .15, [0, .95, .95]));
  r.add(car, r.t('#f2c842'), rbox(2.25, .1, .1, .03, [0, 1.06, -.1]), rbox(2.25, .1, .1, .03, [0, .72, 1.27]));
  r.add(car, iron, rbox(2.3, .18, .32, .05, [0, .55, -1.35]));
  const drum = r.joint(car, [0, .55, 1.55]); r.add(drum, iron, cyl(.55, .55, 2.0, [0, 0, 0], [0, 0, Math.PI / 2], 24)); for (const x of [-.7, -.25, .25, .7]) r.add(drum, r.t('#7a7f88'), torus(.56, .05, [x, 0, 0], [0, Math.PI / 2, 0]));
  r.add(car, olive, rbox(.14, .5, .9, .05, [-1.05, .75, 1.35]), rbox(.14, .5, .9, .05, [1.05, .75, 1.35]));
  wheels.push({ j: drum, r: .55 });
  for (const s of [-1, 1]) { wheels.push(wheel(r, car, [s * 1.22, .62, -.8], .62, .46, '#b7a46e', true)); contacts.push(r.joint(car, [s * 1.22, .04, -.9])); }
  // V8 block with eight stacks.
  r.add(car, chrome, rbox(1.1, .45, .75, .12, [0, 1.3, -1.0]), rbox(.6, .2, .6, .08, [0, 1.6, -1.0]));
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const z = -1.3 + i * .2; r.add(car, chrome, cyl(.06, .07, .55, [s * .48, 1.62, z], [0, 0, s * .25], 10)); if (i % 2) exhausts.push(r.joint(car, [s * .55, 1.92, z])); }
  const body = r.joint(r.model, [0, 2.05, -.1]);
  r.add(body, stone, rock([.95, .85, .75], [0, 0, 0], 1), rock([.55, .45, .5], [0, -.55, .05], 2));
  r.add(body, pale, rock([.38, .3, .2], [0, .05, .62], 3));
  r.add(body, r.g('#ffd84a', 2.6), xf(new THREE.OctahedronGeometry(.13), [0, .08, .8]));
  const arms: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    r.add(body, stone, rock([.48, .44, .46], [s * 1.0, .42, 0], 4 + s)); r.add(body, moss, rock([.32, .12, .3], [s * 1.0, .82, 0], 7 + s));
    const arm = r.joint(body, [s * 1.0, .2, .1]); arms.push(arm);
    r.add(arm, stone, rock([.3, .4, .3], [s * .1, -.35, .15], 9 + s), rock([.26, .26, .45], [s * .02, -.6, .55], 11 + s), rock([.26, .22, .24], [-s * .1, -.62, .95], 13 + s));
  }
  const head = r.joint(body, [0, .95, .1]);
  r.add(head, stone, rock([.52, .46, .48], [0, 0, 0], 20)); r.add(head, pale, rock([.5, .14, .2], [0, .2, .38], 21)); r.add(head, moss, rock([.4, .14, .38], [0, .42, -.05], 22));
  const blink = r.joint(head, [0, .02, .42]); for (const s of [-1, 1]) r.add(blink, r.g('#ffe066', 3.2), ellipsoid([.1, .065, .05], [s * .2, 0, 0], [0, 0, s * -.2], .6));
  return { r, head, height: 3.9, wheels, steer: [], exhausts, contacts, outline: '#2a241c', update(s, k) {
    body.position.y = 2.05 + Math.sin(s.t * 18) * .02 * k + Math.sin(s.t * 1.5) * .02;
    arms.forEach((a, i) => { a.rotation.x = Math.sin(s.t * 1.5 + i) * .03; a.rotation.z = (i ? -1 : 1) * s.steer * .1; });
    head.rotation.y = s.menu ? Math.sin(s.t * .5) * .3 : s.steer * .2; blink.scale.y = (s.t * .5) % 4 < .12 ? .15 : 1;
  } };
}

function goblin(c: typeof RACERS[number]): Build {
  const r = new Rig(), wood = r.t('#a26c3b'), woodD = r.t('#7a4c27'), skin = r.t(c.color), skinL = r.t(c.light), hood = r.t('#c23b45'), wheels: Wheel[] = [], steer: THREE.Object3D[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const cart = r.joint(r.model);
  r.add(cart, wood, rbox(1.8, .3, 2.5, .05, [0, .62, 0]));
  for (const x of [-.6, 0, .6]) r.add(cart, woodD, rbox(.04, .31, 2.5, .01, [x, .62, 0]));
  for (const s of [-1, 1]) r.add(cart, wood, rbox(.12, .42, 2.2, .04, [s * .88, .92, -.1]));
  r.add(cart, woodD, rbox(1.8, .42, .12, .04, [0, .92, -1.2]), cyl(.14, .14, 2.0, [0, .6, 1.32], [0, 0, Math.PI / 2], 12));
  r.add(cart, r.t('#5a5f6b'), tube([[0, .8, .9], [0, 1.15, .6]], .05), torus(.22, .035, [0, 1.2, .55], [-.9, 0, 0]));
  r.add(cart, r.t('#878c97'), cyl(.12, .15, .6, [.55, .95, -1.35], [-1.2, 0, 0], 12)); exhausts.push(r.joint(cart, [.55, 1.12, -1.62]));
  r.add(cart, r.t('#e9c553'), rbox(.5, .3, .02, .02, [-.45, 1.0, -1.27]));
  for (const s of [-1, 1]) { const st = r.joint(cart, [s * 1.0, .36, .9]); steer.push(st); wheels.push(wheel(r, st, [0, 0, 0], .36, .26, '#c39a52')); wheels.push(wheel(r, cart, [s * 1.0, .42, -.85], .42, .3, '#c39a52')); contacts.push(r.joint(cart, [s * 1.0, .03, -.95])); }
  const body = r.joint(r.model, [0, 1.3, -.25]);
  r.add(body, r.t('#b5713f'), ellipsoid([.55, .55, .48])); r.add(body, r.t('#6b4a2b'), torus(.5, .06, [0, -.12, 0], [Math.PI / 2, 0, 0]));
  for (const s of [-1, 1]) r.add(body, skin, tube([[s * .48, .25, .05], [s * .42, .05, .45], [s * .22, -.05, .72]], .11), ball(.14, [s * .2, -.05, .78]));
  const head = r.joint(body, [0, .85, .1]);
  r.add(head, skin, ellipsoid([.55, .5, .5])); r.add(head, skinL, ellipsoid([.2, .17, .26], [0, -.06, .5]));
  r.add(head, r.t('#fff6dc'), horn([[-.13, -.25, .4], [-.13, -.38, .42]], .05), horn([[.13, -.25, .4], [.13, -.38, .42]], .05));
  const blink = eyes(r, head, { y: .06, z: .38, sep: .2, w: .12, h: .13, turn: .45, iris: '#ffd23f', pupil: '#1a1208', slit: true });
  r.add(head, r.t('#3b5e2a'), rbox(.22, .05, .06, .02, [-.2, .2, .45], [0, 0, -.35]), rbox(.22, .05, .06, .02, [.2, .2, .45], [0, 0, .35]));
  r.add(head, hood, lathe([[.6, 0], [.58, .14], [.48, .3], [.28, .42], [.0001, .46]], [0, .12, -.04]), torus(.6, .06, [0, .12, -.04], [Math.PI / 2, 0, 0]));
  r.add(head, hood, horn([[0, .5, -.1], [0, .62, -.45], [0, .4, -.8]], .16));
  const ears: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const e = r.joint(head, [s * .48, .04, -.05]); ears.push(e); r.add(e, skin, sweep([[0, 0, 0], [s * .35, .12, -.06], [s * .7, .3, -.18]], t => .17 * (1 - t) + .01, { flat: .35, up: [0, 0, 1] })); r.add(e, r.t('#5f8f45', { noOutline: true }), sweep([[s * .05, .01, .04], [s * .35, .13, .0], [s * .6, .27, -.1]], t => .09 * (1 - t) + .01, { flat: .3, up: [0, 0, 1] })); }
  let ev = 0, ea = 0;
  return { r, head, height: 3.1, wheels, steer, exhausts, contacts, outline: '#1f2a16', update(s, k) {
    ev += ((Math.sin(s.t * 20) * .3 * k - s.steer * .4 - ea) * 80 - ev * 6) * s.dt; ea += ev * s.dt;
    ears.forEach((e, i) => { e.rotation.z = (i ? 1 : -1) * (ea * .5 - k * .15); e.rotation.y = (i ? -1 : 1) * k * .3; });
    body.position.y = 1.3 + Math.abs(Math.sin(s.t * 14)) * .04 * k; head.rotation.y = s.menu ? Math.sin(s.t * .9) * .4 : s.steer * .3;
    blink.scale.y = (s.t * .9 + .4) % 3 < .1 ? .1 : 1;
  } };
}

function blackMage(): Build {
  const r = new Rig(), cloudM = r.t('#f3f5ff'), cloudD = r.t('#c7cdef'), robe = r.t('#3550c4'), robeD = r.t('#26398e'), tan = r.t('#d8a957'), tanD = r.t('#a77a3c'), exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const cloud = r.joint(r.model, [0, .7, 0]), puffs: THREE.Object3D[] = [];
  r.add(cloud, cloudD, ellipsoid([1.15, .32, 1.35], [0, -.15, 0]));
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, p = r.joint(cloud, [Math.sin(a) * .85, Math.cos(i * 3.1) * .05, Math.cos(a) * 1.05]); puffs.push(p); r.add(p, i % 3 ? cloudM : cloudD, ball(.42 + (i * 37 % 10) / 40, [0, 0, 0], .8)); }
  r.add(cloud, cloudM, ellipsoid([.8, .35, .95], [0, .15, 0]));
  for (const s of [-1, 1]) { exhausts.push(r.joint(cloud, [s * .5, 0, -1.25])); contacts.push(r.joint(cloud, [s * .6, -.6, -1.0])); }
  const body = r.joint(r.model, [0, 1.0, 0]);
  r.add(body, robe, lathe([[.82, 0], [.8, .12], [.64, .5], [.48, .9], [.36, 1.2], [.0001, 1.28]]));
  r.add(body, robeD, torus(.8, .07, [0, .06, 0], [Math.PI / 2, 0, 0]));
  r.add(body, tan, lathe([[.38, 0], [.5, .1], [.46, .24], [.32, .3]], [0, 1.08, 0]));
  r.add(body, r.t('#a03d3d'), rbox(.5, .12, .5, .05, [0, .55, .32], [.3, 0, 0]));
  const arms: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const a = r.joint(body, [s * .42, .95, .05]); arms.push(a); r.add(a, robe, sweep([[0, 0, 0], [s * .25, -.3, .2], [s * .2, -.45, .55]], t => .17 + t * .06)); r.add(a, tan, torus(.2, .05, [s * .2, -.45, .58], [0, 0, 0])); r.add(a, r.t('#f2ead8'), ball(.13, [s * .2, -.45, .68])); }
  const staff = r.joint(arms[1], [.2, -.45, .68], [.5, 0, -.2]);
  r.add(staff, r.t('#7a4f2c'), tube([[0, -.6, 0], [0, .4, 0], [0, 1.0, .05]], .045)); r.add(staff, r.t('#c7a24a'), torus(.13, .03, [0, 1.12, .05], [0, Math.PI / 2, 0]));
  r.add(staff, r.g('#b67cff', 2.6), ball(.1, [0, 1.12, .05], .7));
  const head = r.joint(body, [0, 1.48, .05]);
  r.add(head, r.t('#151327'), ellipsoid([.48, .46, .46]));
  const blink = r.joint(head, [0, .02, .4]); for (const s of [-1, 1]) r.add(blink, r.g('#ffe14a', 3.4), ellipsoid([.075, .12, .04], [s * .17, 0, 0], [0, s * .3, 0], .6));
  const hat = r.joint(head, [0, .28, -.02], [-.08, 0, 0]);
  r.add(hat, tan, lathe([[1.05, -.02], [1.08, .02], [.95, .06], [.6, .1], [.5, .12]], [0, 0, 0], [0, 0, 0], 36), torus(1.05, .045, [0, 0, 0], [Math.PI / 2, 0, 0]));
  r.add(hat, tanD, cyl(.53, .55, .14, [0, .14, 0], [0, 0, 0], 24));
  const tip = r.joint(hat, [0, .2, 0]); r.add(tip, tan, horn([[0, 0, 0], [0, .45, -.04], [.05, .9, -.2], [.22, 1.25, -.5]], .52));
  let sway = 0;
  return { r, head, height: 4.2, wheels: [], steer: [], exhausts, contacts, outline: '#121230', update(s, k) {
    cloud.position.y = .7 + Math.sin(s.t * 2.4) * .08; cloud.rotation.y = s.steer * .12;
    puffs.forEach((p, i) => { const b = 1 + Math.sin(s.t * 3 + i * 1.7) * .08; p.scale.setScalar(b); p.position.y = Math.cos(i * 3.1) * .05 + Math.sin(s.t * 2 + i) * .05; });
    body.position.y = 1.0 + Math.sin(s.t * 2.4 - .5) * .07; sway = damp(sway, -k * .5 - s.steer * .2, 4, s.dt);
    tip.rotation.x = sway * .6 + Math.sin(s.t * 3) * .05; tip.rotation.z = s.steer * .25 + Math.sin(s.t * 2.2) * .04; hat.rotation.z = s.steer * .08;
    arms.forEach((a, i) => { a.rotation.x = Math.sin(s.t * 2 + i) * .06; });
    head.rotation.y = s.menu ? Math.sin(s.t * .7) * .3 : s.steer * .25; blink.scale.y = (s.t * .7 + .2) % 3.6 < .1 ? .1 : 1;
  } };
}

/** Red carpet texture with a gold border and star motif, drawn once. */
let carpetTexture: THREE.CanvasTexture | null = null;
function carpet() {
  if (carpetTexture) return carpetTexture;
  const c = document.createElement('canvas'); c.width = 128; c.height = 192; const g = c.getContext('2d')!;
  g.fillStyle = '#9e2245'; g.fillRect(0, 0, 128, 192); g.strokeStyle = '#ffcf6a'; g.lineWidth = 8; g.strokeRect(8, 8, 112, 176); g.lineWidth = 3; g.strokeRect(20, 20, 88, 152);
  g.fillStyle = '#4a2a8c'; g.fillRect(24, 24, 80, 144); g.fillStyle = '#ffcf6a';
  for (const [x, y, rr] of [[64, 96, 22], [44, 50, 9], [84, 142, 9], [84, 50, 6], [44, 142, 6]]) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, d = i % 2 ? rr * .45 : rr; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } g.fill(); }
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#ffcf6a' : '#e85a7a'; g.fillRect(12 + i * 9, 2, 5, 4); g.fillRect(12 + i * 9, 186, 5, 4); }
  carpetTexture = new THREE.CanvasTexture(c); carpetTexture.colorSpace = THREE.SRGBColorSpace; carpetTexture.anisotropy = 4; return carpetTexture;
}

function whiteMage(): Build {
  const r = new Rig(), robe = r.t('#f7f2ea'), red = r.t('#cf3557'), skinM = r.t('#ffdcc0'), hair = r.t('#9a5d3a'), exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const geo = new THREE.PlaneGeometry(2.3, 3.1, 10, 16); geo.rotateX(-Math.PI / 2); const base = Float32Array.from(geo.attributes.position.array as Float32Array);
  const rugMat = new THREE.MeshToonMaterial({ map: carpet(), side: THREE.DoubleSide, gradientMap: (r.t('#fff') as THREE.MeshToonMaterial).gradientMap });
  const rug = new THREE.Mesh(geo, rugMat); rug.position.y = .5; rug.castShadow = true; r.model.add(rug);
  const tassels = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), r.t('#ffcf6a')); r.model.add(m); return m; });
  for (const s of [-1, 1]) { exhausts.push(r.joint(r.model, [s * .9, .5, -1.6])); contacts.push(r.joint(r.model, [s * .9, .1, -1.4])); }
  const body = r.joint(r.model, [0, .58, 0]);
  r.add(body, robe, lathe([[.86, 0], [.8, .2], [.6, .7], [.44, 1.12], [.0001, 1.25]]));
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; r.add(body, red, xf(new THREE.ConeGeometry(.15, .34, 3), [Math.sin(a) * .82, .2, Math.cos(a) * .82], [0, a, 0], [1, 1, .25])); }
  for (const s of [-1, 1]) { r.add(body, robe, sweep([[s * .38, .95, .05], [s * .52, .6, .3], [s * .3, .45, .58]], t => .14 + t * .1)); r.add(body, red, xf(new THREE.ConeGeometry(.16, .3, 3), [s * .3, .4, .66], [Math.PI, 0, 0], [1, 1, .3])); r.add(body, skinM, ball(.1, [s * .2, .42, .7])); }
  const head = r.joint(body, [0, 1.42, .05]);
  r.add(head, robe, ellipsoid([.62, .6, .6], [0, .04, -.04])); r.add(head, red, torus(.4, .05, [0, -.04, .4]));
  r.add(head, skinM, ellipsoid([.42, .42, .26], [0, -.06, .32]));
  r.add(head, hair, ellipsoid([.4, .16, .2], [0, .22, .4], [.3, 0, 0]));
  for (const s of [-1, 1]) { r.add(head, robe, horn([[s * .3, .5, -.05], [s * .4, .78, -.08], [s * .46, 1.02, -.14]], .19)); r.add(head, r.t('#f4c0cb', { noOutline: true }), ellipsoid([.09, .05, .03], [s * .22, -.2, .55], [0, s * .4, 0])); }
  for (let k = 0; k < 5; k++) { const a = (k - 2) * .5; r.add(head, red, xf(new THREE.ConeGeometry(.12, .3, 3), [Math.sin(a) * .5, -.45, -.25 - Math.cos(a) * .2], [Math.PI, a, 0], [1, 1, .3])); }
  const blink = eyes(r, head, { y: -.04, z: .5, sep: .15, w: .1, h: .14, turn: .3, iris: '#6d3f8a' });
  let phase = 0;
  return { r, head, height: 3.2, wheels: [], steer: [], exhausts, contacts, outline: '#3a2230', update(s, k) {
    phase += s.dt * (2 + Math.abs(s.speed) * .25); const a = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) { const x = base[i * 3], z = base[i * 3 + 2], back = clamp((1 - z) / 3, 0, 1); a.setY(i, Math.sin(z * 2.2 + phase * 2.4) * (.04 + back * .14 * (.4 + k)) + Math.sin(x * 2 + phase) * .03 - s.steer * x * .08 + (Math.abs(x) > .95 && z > 1.3 ? .08 : 0)); }
    a.needsUpdate = true; geo.computeVertexNormals();
    [[0, 0], [10, 0], [0, 16], [10, 16]].forEach(([ix, iz], i) => { const v = iz * 11 + ix; tassels[i].position.set(a.getX(v), a.getY(v) + .5 - .05, a.getZ(v)); });
    rug.position.y = .5 + Math.sin(s.t * 2.2) * .07; body.position.y = .58 + Math.sin(s.t * 2.2) * .07;
    head.rotation.y = s.menu ? Math.sin(s.t * .8) * .3 : s.steer * .25; head.rotation.z = Math.sin(s.t * 1.5) * .04;
    blink.scale.y = (s.t * .75 + .9) % 3.4 < .1 ? .1 : 1;
  } };
}

function behemoth(c: typeof RACERS[number]): Build {
  const r = new Rig(), fur = r.t(c.color), furL = r.t(c.light), mane = r.t('#574276'), bone = r.t('#f2dcae'), frame = r.t('#e8783e'), body = r.t('#5f586f'), wheels: Wheel[] = [], steer: THREE.Object3D[] = [], exhausts: THREE.Object3D[] = [], contacts: THREE.Object3D[] = [];
  const car = r.joint(r.model);
  r.add(car, body, rbox(2.1, .45, 2.9, .16, [0, .78, 0]), rbox(1.7, .35, .8, .14, [0, .9, 1.25], [.3, 0, 0]));
  r.add(car, r.t('#ffd84a'), rbox(2.15, .08, .3, .03, [0, 1.02, .6]), rbox(2.15, .08, .3, .03, [0, 1.02, -.6]));
  r.add(car, frame, tube([[-.95, .95, -1.1], [-.88, 2.2, -1.0], [-.6, 2.85, -.95], [.6, 2.85, -.95], [.88, 2.2, -1.0], [.95, .95, -1.1]], .07), tube([[-.82, 2.6, -.98], [-.85, 1.7, .6], [-.9, 1.0, 1.2]], .06), tube([[.82, 2.6, -.98], [.85, 1.7, .6], [.9, 1.0, 1.2]], .06));
  r.add(car, r.t('#3a3644'), rbox(1.3, .5, .6, .1, [0, 1.18, -1.25]));
  for (const s of [-1, 1]) {
    r.add(car, r.t('#bfc4cc'), cyl(.09, .11, .7, [s * .45, 1.55, -1.42], [-.3, 0, 0], 12)); exhausts.push(r.joint(car, [s * .45, 1.9, -1.55]));
    r.add(car, r.g('#ff3a3a', 2), rbox(.2, .1, .04, .02, [s * .8, .85, -1.47]));
    const st = r.joint(car, [s * 1.18, .55, 1.0]); steer.push(st); wheels.push(wheel(r, st, [0, 0, 0], .55, .5, '#e8783e', true));
    wheels.push(wheel(r, car, [s * 1.22, .64, -1.0], .64, .58, '#e8783e', true)); contacts.push(r.joint(car, [s * 1.22, .04, -1.1]));
  }
  const torso = r.joint(r.model, [0, 1.95, -.25]);
  r.add(torso, fur, ellipsoid([.95, .82, .9])); r.add(torso, furL, ellipsoid([.62, .6, .4], [0, -.12, .55]));
  for (let k = 0; k < 6; k++) r.add(torso, mane, horn([[(k % 2 - .5) * .4, .62 - k * .12, -.45 - k * .1], [(k % 2 - .5) * .5, .9 - k * .14, -.75 - k * .1], [(k % 2 - .5) * .6, 1.05 - k * .16, -1.05 - k * .08]], .17));
  const arms: THREE.Object3D[] = [];
  for (const s of [-1, 1]) { const a = r.joint(torso, [s * .82, .25, .2]); arms.push(a); r.add(a, fur, sweep([[0, 0, 0], [s * .2, -.35, .35], [s * .1, -.5, .8]], t => .26 - t * .06)); r.add(a, furL, ball(.22, [s * .08, -.5, .9])); for (const x of [-.08, 0, .08]) r.add(a, bone, horn([[s * .08 + x, -.45, 1.05], [s * .08 + x, -.52, 1.15]], .04)); }
  const tail = r.joint(torso, [0, -.2, -.85]); r.add(tail, fur, tube([[0, 0, 0], [0, .3, -.5], [0, .9, -.75], [0, 1.3, -.6]], .09)); r.add(tail, mane, ellipsoid([.2, .32, .2], [0, 1.4, -.55]));
  const head = r.joint(torso, [0, .75, .75]);
  r.add(head, fur, ellipsoid([.72, .62, .6])); r.add(head, furL, ellipsoid([.56, .34, .42], [0, -.24, .45]));
  r.add(head, r.t('#3c2b4e'), ellipsoid([.2, .11, .1], [0, -.08, .84]));
  for (const s of [-1, 1]) {
    r.add(head, bone, horn([[s * .2, -.32, .7], [s * .22, -.5, .74], [s * .2, -.66, .7]], .07));
    r.add(head, bone, horn([[s * .42, .38, .05], [s * .82, .78, -.05], [s * 1.15, .7, -.42], [s * 1.12, .35, -.6], [s * .95, .2, -.45]], .2));
    r.add(head, mane, rbox(.3, .07, .08, .03, [s * .24, .27, .53], [0, s * -.2, s * .38]));
  }
  for (let k = 0; k < 5; k++) { const a = (k - 2) * .45; r.add(head, mane, horn([[Math.sin(a) * .45, .35, -.25], [Math.sin(a) * .65, .55, -.55], [Math.sin(a) * .8, .45, -.9]], .2)); }
  const blink = eyes(r, head, { y: .1, z: .45, sep: .26, w: .13, h: .12, turn: .5, iris: '#ffc94a', slit: true });
  return { r, head, height: 4.0, wheels, steer, exhausts, contacts, outline: '#22182e', update(s, k) {
    torso.position.y = 1.95 + Math.abs(Math.sin(s.t * 12)) * .04 * k + Math.sin(s.t * 1.8) * .03;
    tail.rotation.y = Math.sin(s.t * 3) * .3 - s.steer * .3; tail.rotation.x = -k * .5;
    arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * s.steer * .12; });
    head.rotation.y = s.menu ? Math.sin(s.t * .6) * .3 : s.steer * .25; head.rotation.x = Math.sin(s.t * 1.8) * .03;
    blink.scale.y = (s.t * .6 + 2) % 3.8 < .1 ? .1 : 1;
  } };
}

const BUILDERS: ((c: typeof RACERS[number]) => Build)[] = [chocobo, mog, golem, goblin, blackMage, whiteMage, chubby, behemoth];

export function createCharacter(index: number): Character {
  const c = RACERS[index], b = BUILDERS[index](c); b.r.finish(b.outline);
  b.r.root.traverse(o => { o.matrixAutoUpdate = true; });
  let lean = 0, spin = 0;
  return {
    root: b.r.root, model: b.r.model, skin: b.r.skin, exhausts: b.exhausts, contacts: b.contacts, head: b.head, height: b.height,
    animate(s) {
      const k = clamp(Math.abs(s.speed) / 38, 0, 1);
      lean = damp(lean, -s.steer * (s.drifting ? .16 : .07) * (s.menu ? 0 : 1), 8, s.dt); b.r.model.rotation.z = lean;
      spin = s.stun > 0 ? spin + s.dt * 13 : damp(spin, Math.round(spin / (Math.PI * 2)) * Math.PI * 2, 10, s.dt); b.r.model.rotation.y = spin;
      // Menu showcase: an idle engine shake, plus a cheerful hop with a flap every few seconds.
      const cycle = (s.t % 4.2) / 4.2, hop = s.menu && cycle < .16 ? Math.sin(cycle / .16 * Math.PI) : 0;
      b.r.model.position.y = s.menu ? hop * .45 + (b.wheels.length ? Math.sin(s.t * 38) * .012 : 0) : Math.sin(s.t * 31) * Math.min(.03, k * .03);
      b.r.model.scale.set(1 + hop * .04, 1 - (s.menu && cycle > .16 && cycle < .2 ? Math.sin((cycle - .16) / .04 * Math.PI) * .08 : 0), 1 + hop * .04);
      if (hop > 0) s = { ...s, flying: 1 };
      for (const w of b.wheels) w.j.rotation.x += s.speed * s.dt / w.r;
      for (const st of b.steer) st.rotation.y = damp(st.rotation.y, s.steer * .45, 12, s.dt);
      b.update?.(s, k);
    },
    dispose() {
      b.r.root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
    },
  };
}
