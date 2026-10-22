import * as THREE from 'three';
import { Parts, type V3 } from '../kit.ts';
import type { Rng } from '../noise.ts';
import { ball, bead, blob, card, cone, cyl, ellipsoid, grad, horn, lathe, prism, rbox, rock, sweep, torus, tube, xf } from './shapes.ts';

/*
 * The summoned Espers that watch over Fantasia, as large cel-shaded figures. Each faces +z with its feet at the origin.
 * They are stylised readings of the 1999 course's sprite statues, sized to read from the chase camera 20 to 40 m away.
 */

const E = {
  levBody: '#6c4fd6', levBand: '#ffe066', levPale: '#fff4c8', levHead: '#4a3aa8', levFin: '#e8404e', levNeck: '#f1e7cc',
  carb: '#5fd24e', carbLight: '#b8f59a', carbGem: '#ff3a52',
  titan: '#a8805a', titanDark: '#6e5038', titanHair: '#e9e2d0',
  shiva: '#6f9cff', shivaLight: '#cfe2ff', shivaHair: '#2b3d9e', ice: '#bff3ff',
  sylph: '#a8f27e', sylphHair: '#e9ff9a', wing: '#d9fff4',
  unicorn: '#2e3878', unicornLight: '#5867b8', mane: '#8fd0ff', hornGold: '#ffe9a6',
  ramuh: '#5b4fb0', ramuhRobe: '#8a7fd6', beard: '#f4f4ff', bolt: '#c8ecff',
  ifrit: '#d8442c', ifritDark: '#7c1e16', ifritHorn: '#f2dcb0', flame: '#ffb03a',
  odin: '#3a2f63', odinTrim: '#c9b86a', odinSteel: '#c9d2e6', cape: '#7a1f3a',
  skin: '#f6d9c4',
};

/** A tapered limb from `a` to `b`. */
const limb = (a: V3, b: V3, r0: number, r1: number) => sweep([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], b], t => r0 + (r1 - r0) * t, { radial: 7, segments: 4 });

/**
 * One of Leviathan's coils rising out of the void and arching over the road: a banded serpent body, purple with yellow and pale bands,
 * spanning `span` metres between its two ends. Origin at the road centre; the arch runs across x.
 */
export function leviathanCoil(span: number, height: number) {
  const p = new Parts(), pts: V3[] = [];
  // A squared-off arch, so the body stays high over the whole road before plunging into the void at both ends.
  const rise = (a: number) => Math.sin(a) ** .4 * height - 6;
  for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; pts.push([-Math.cos(a) * span, rise(a), Math.sin(a * 2) * .8]); }
  // Bands follow the body's length: paint by angle around the arch's centre.
  const band = (x: number, y: number, _z: number, out: THREE.Color) => {
    const k = Math.atan2(y + 6, x) * 9;
    out.set(Math.floor(k) % 3 === 0 ? E.levBand : Math.floor(k) % 3 === 1 ? E.levBody : E.levPale);
  };
  p.add(sweep(pts, 1.25, { radial: 12, segments: 60 }), band, { ao: false });
  // A low dorsal fin along the crest.
  for (let i = 3; i < 22; i += 2) { const a = Math.PI * i / 24; p.add(cone(.35, 1.1, 4, [-Math.cos(a) * span, rise(a) + 1.05, 0], [0, 0, Math.cos(a) * .8]), E.levFin, { ao: false, flat: true }); }
  return p;
}

/** A Leviathan head on a long pale neck rising from below the road, jaws open, a red fin crest down its skull. Faces +z. */
export function leviathanHead(r: Rng) {
  const p = new Parts(), h = r.range(9, 12), lean = r.range(.8, 1.6);
  p.add(sweep([[0, -16, -1.4], [0, -5, -.6], [0, h * .5, lean * .4], [0, h - 1, lean]], t => 1.5 - t * .55, { radial: 12, segments: 16 }), grad(E.levNeck, '#ffffff', -12, h), { ao: false });
  for (let i = 0; i < 3; i++) p.add(torus(1.42 - i * .14, .14, [0, -1 + i * 3, (i / 3) * lean * .5], [Math.PI / 2, 0, 0]), '#d9ccf2', { ao: false });
  const y = h + .3, z = lean + .9;
  // Skull, long upper jaw and a lower jaw dropped open, with a red tongue between them.
  p.add(ellipsoid([1.5, 1.25, 2.1], [0, y + .2, z]), E.levHead, { ao: false });
  p.add(ellipsoid([1.05, .55, 1.9], [0, y + .05, z + 1.9], [.12, 0, 0]), E.levHead, { ao: false });
  p.add(ellipsoid([.85, .32, 1.6], [0, y - .95, z + 1.4], [-.35, 0, 0]), E.levBody, { ao: false });
  p.add(ellipsoid([.55, .12, 1.1], [0, y - .55, z + 1.6], [-.15, 0, 0]), E.levFin, { ao: false });
  for (let i = 0; i < 4; i++) p.add(cone(.45 - i * .06, 1.5 - i * .2, 4, [0, y + 1.2 - i * .3, z - .4 - i * .7], [-.9 - i * .15, 0, 0]), E.levFin, { ao: false, flat: true });
  for (const s of [-1, 1]) {
    p.add(bead(.26, [s * .82, y + .55, z + 1]), '#fff36a', { layer: 'glow', ao: false });
    p.add(xf(new THREE.ConeGeometry(1, 2.8, 4), [s * 1.45, y + .3, z - .5], [-1.1, 0, s * .9], [.25, 1, 1]), E.levFin, { ao: false, flat: true });
    p.add(horn([[s * .7, y + 1, z - .7], [s * 1.1, y + 1.8, z - 2], [s * .9, y + 2.4, z - 3.4]], .34), E.levPale, { ao: false });
  }
  return p;
}

/** Carbuncle: a small green beast with long ears and a red jewel on its brow, sitting up. */
export function carbuncle(scale = 1) {
  const p = new Parts(), s = scale;
  p.add(ellipsoid([.9 * s, 1.05 * s, .85 * s], [0, 1 * s, 0]), E.carb, { ao: [0, s, .7] });
  p.add(ellipsoid([.55 * s, .7 * s, .4 * s], [0, 1 * s, .55 * s]), E.carbLight, { ao: false });
  p.add(ellipsoid([.8 * s, .72 * s, .75 * s], [0, 2.35 * s, .15 * s]), E.carb, { ao: false });
  p.add(bead(.24 * s, [0, 2.65 * s, .8 * s], 1.3), E.carbGem, { layer: 'glow', ao: false });
  for (const k of [-1, 1]) {
    p.add(xf(new THREE.ConeGeometry(.32 * s, 1.6 * s, 6), [k * .5 * s, 3.25 * s, -.1 * s], [-.25, 0, -k * .45]), E.carb, { ao: false });
    p.add(bead(.13 * s, [k * .3 * s, 2.45 * s, .78 * s]), '#20132a', { ao: false });
    p.add(ellipsoid([.28 * s, .22 * s, .45 * s], [k * .45 * s, .2 * s, .5 * s]), E.carb, { ao: false });
  }
  p.add(sweep([[0, .5 * s, -.7 * s], [0, .9 * s, -1.6 * s], [0, 1.9 * s, -1.9 * s], [0, 2.4 * s, -1.4 * s]], t => (.38 - t * .25) * s, { radial: 7, segments: 8 }), E.carb, { ao: false });
  return p;
}

/** Titan asleep on his side, head on his arm, a great earthen giant. Lies along x. */
export function sleepingTitan() {
  const p = new Parts();
  p.add(ellipsoid([5.2, 2.6, 3.1], [0, 2.6, 0], [0, 0, .08]), grad(E.titanDark, E.titan, 0, 5), { ao: [0, 2.5, .6] });
  p.add(ellipsoid([2.4, 2.2, 2.2], [5.6, 3.1, .3]), E.titan, { ao: false });
  p.add(blob([2.3, 1.5, 2.1], [6.1, 4.6, -.2], 3, .25), E.titanHair, { ao: false });
  p.add(ellipsoid([.9, .5, .7], [6.6, 2.8, 2]), E.titanDark, { ao: false });
  // Folded arm as a pillow, legs drawn up.
  p.add(limb([3.2, 1.2, 2.4], [7.2, 1.6, 2.2], 1.15, .95), E.titan, { ao: false });
  p.add(limb([-3.6, 1.6, 1.4], [-6.8, 1.2, 2.6], 1.6, 1.2), E.titan, { ao: false });
  p.add(limb([-6.8, 1.2, 2.6], [-9, 1, -.4], 1.2, 1.05), E.titan, { ao: false });
  p.add(rbox(4.6, .9, 2.6, .3, [-.3, 1.1, .3]), E.titanDark, { ao: false });
  // Sleep: a trail of "z" puffs drifting up from his head.
  for (let i = 0; i < 3; i++) p.add(torus(.35 + i * .15, .09, [7.5 + i * .9, 6.2 + i * 1.4, .5], [0, 0, 0]), '#e8f0ff', { layer: 'glow', ao: false });
  return p;
}

/** Shiva: the ice queen, standing tall with one arm raised in a frost of crystals. */
export function shiva() {
  const p = new Parts();
  p.add(lathe([[0, 0], [1.1, 0], [.9, 1.5], [.55, 3.4], [.62, 4.6], [.45, 5.4], [0, 5.5]], [0, 0, 0], [0, 0, 0], 14), grad(E.shiva, E.shivaLight, 0, 5.5), { ao: [0, 1.4, .7] });
  p.add(ball(.62, [0, 6.05, .05]), E.shivaLight, { ao: false });
  p.add(blob([.75, .9, .7], [0, 6.4, -.3], 7, .2), E.shivaHair, { ao: false });
  p.add(sweep([[0, 6.6, -.5], [0, 5.8, -1.2], [0, 4, -1.4], [.2, 2.6, -1.1]], t => .45 - t * .3, { radial: 7, segments: 8 }), E.shivaHair, { ao: false });
  p.add(limb([-.6, 5, 0], [-1.1, 3.6, .4], .2, .16), E.shiva, { ao: false });
  p.add(limb([.6, 5, 0], [1.3, 6.4, .5], .2, .16), E.shiva, { ao: false });
  p.add(limb([1.3, 6.4, .5], [1.4, 7.6, .4], .16, .13), E.shiva, { ao: false });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; p.add(xf(new THREE.OctahedronGeometry(.32), [1.4 + Math.cos(a) * .7, 8.1 + Math.sin(a) * .7, .4], [0, a, 0], [.6, 1.4, .6]), E.ice, { layer: 'glow', ao: false, flat: true }); }
  return p;
}

/** A Sylph: a small green fairy with leaf wings, hovering. */
export function sylph(r: Rng) {
  const p = new Parts(), y = r.range(1.2, 2.4);
  p.add(lathe([[0, 0], [.42, .1], [.32, .75], [.2, 1.05], [0, 1.1]], [0, y, 0], [0, 0, 0], 10), E.sylph, { ao: false });
  p.add(ball(.36, [0, y + 1.38, 0]), E.skin, { ao: false });
  p.add(blob([.46, .38, .44], [0, y + 1.58, -.08], r() * 9, .25), E.sylphHair, { ao: false });
  for (const k of [-1, 1]) {
    p.add(card(1.2, 1.6, [k * .7, y + .5, -.2], [0, k * .6, k * -.4]), E.wing, { layer: 'glow', ao: false });
    p.add(limb([k * .3, y + .95, 0], [k * .65, y + .45, .25], .07, .06), E.skin, { ao: false });
  }
  return p;
}

/** The Unicorn Esper: a dark blue horse with a pale mane and a golden horn, standing. */
export function unicorn() {
  const p = new Parts();
  p.add(ellipsoid([.95, 1, 2.1], [0, 2.4, 0]), grad(E.unicorn, E.unicornLight, 1.4, 3.4), { ao: false });
  for (const [x, z] of [[-.5, 1.4], [.5, 1.4], [-.5, -1.4], [.5, -1.4]]) p.add(limb([x, 2, z], [x, 0, z + .1], .28, .18), E.unicorn, { ao: false });
  p.add(limb([0, 2.8, 1.6], [0, 4.2, 2.3], .55, .42), E.unicorn, { ao: false });
  p.add(ellipsoid([.45, .5, .95], [0, 4.35, 2.8], [.5, 0, 0]), E.unicornLight, { ao: false });
  p.add(cone(.13, 1.4, 6, [0, 4.9, 3], [.55, 0, 0]), E.hornGold, { layer: 'glow', ao: false });
  p.add(sweep([[0, 4.8, 2.2], [0, 4, 1.6], [0, 3.2, .9]], .3, { radial: 6, segments: 6, flat: .4 }), E.mane, { ao: false });
  p.add(sweep([[0, 2.8, -2], [0, 2.4, -2.8], [0, 1.2, -3]], t => .35 - t * .2, { radial: 6, segments: 6 }), E.mane, { ao: false });
  return p;
}

/** Ramuh: the old sage of thunder in a long robe, staff raised, a crackling orb at its head. */
export function ramuh() {
  const p = new Parts();
  p.add(lathe([[0, 0], [1.3, 0], [1.1, 2.2], [.85, 4.2], [.95, 4.9], [0, 5.1]], [0, 0, 0], [0, 0, 0], 14), grad(E.ramuh, E.ramuhRobe, 0, 5), { ao: [0, 1.4, .7] });
  p.add(ball(.6, [0, 5.6, .1]), E.skin, { ao: false });
  p.add(cone(.75, 2.3, 10, [0, 3.2, .45], [Math.PI, 0, 0]), E.beard, { ao: false });
  p.add(blob([.7, .4, .65], [0, 6, -.05], 4, .2), E.beard, { ao: false });
  p.add(limb([.8, 4.6, .1], [1.6, 5.6, .6], .22, .18), E.ramuhRobe, { ao: false });
  p.add(cyl(.09, .09, 7.4, [1.7, 3.7, .7]), '#8a6a3a', { ao: false });
  p.add(ball(.55, [1.7, 7.6, .7]), E.bolt, { layer: 'glow', ao: false });
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; p.add(tube([[1.7, 7.6, .7], [1.7 + Math.cos(a) * .7, 7.9 + Math.sin(a * 2) * .3, .7 + Math.sin(a) * .7], [1.7 + Math.cos(a + .4) * 1.3, 7.4, .7 + Math.sin(a + .4) * 1.3]], .05, 4), E.bolt, { layer: 'glow', ao: false }); }
  return p;
}

/** Ifrit: the fire demon, crouched to spring, horns swept back and flames along its arms. */
export function ifrit() {
  const p = new Parts();
  p.add(ellipsoid([1.6, 2, 1.2], [0, 4.2, 0], [.2, 0, 0]), grad(E.ifritDark, E.ifrit, 2.5, 6), { ao: false });
  p.add(ellipsoid([.8, .85, .8], [0, 6.6, .5]), E.ifrit, { ao: false });
  p.add(blob([.9, .7, .9], [0, 7, .2], 5, .3), E.flame, { layer: 'glow', ao: false });
  for (const k of [-1, 1]) {
    p.add(horn([[k * .55, 7, .3], [k * 1.2, 7.6, -.5], [k * 1.1, 8.6, -1.4]], .3), E.ifritHorn, { ao: false });
    p.add(limb([k * 1.4, 5.4, .2], [k * 2.4, 3.6, 1.2], .6, .45), E.ifrit, { ao: false });
    p.add(ball(.6, [k * 2.5, 3.3, 1.4]), E.ifritDark, { ao: false });
    p.add(limb([k * .8, 2.6, 0], [k * 1.3, 1.4, 1.1], .7, .5), E.ifritDark, { ao: false });
    p.add(limb([k * 1.3, 1.4, 1.1], [k * 1.2, 0, .5], .5, .35), E.ifritDark, { ao: false });
    for (let i = 0; i < 3; i++) p.add(cone(.3, 1.1, 5, [k * (1.7 + i * .3), 4.9 - i * .55, .4 + i * .3], [0, 0, k * .6]), E.flame, { layer: 'glow', ao: false });
  }
  return p;
}

/** Odin: the dark knight in horned armour and a crimson cape, the Zantetsuken sword raised. */
export function odin() {
  const p = new Parts();
  p.add(sweep([[0, 6.4, -.6], [0, 4, -1.4], [0, .6, -1.9]], t => .9 + t * .9, { radial: 8, segments: 6, flat: .35 }), E.cape, { ao: false });
  p.add(rbox(2.2, 2.6, 1.3, .3, [0, 4.5, 0]), grad(E.odin, '#544892', 3.2, 5.8), { ao: false });
  p.add(rbox(1.5, 1, 1, .2, [0, 3.1, 0]), E.odinTrim, { ao: false });
  for (const k of [-1, 1]) {
    p.add(limb([k * .55, 2.8, 0], [k * .7, 0, .2], .45, .36), E.odin, { ao: false });
    p.add(ball(.7, [k * 1.35, 5.6, 0]), E.odinTrim, { ao: false });
    p.add(horn([[k * .4, 6.9, 0], [k * 1.2, 7.4, -.1], [k * 1.4, 8.3, -.4]], .2), E.odinTrim, { ao: false });
  }
  p.add(ellipsoid([.6, .7, .6], [0, 6.5, .05]), E.odin, { ao: false });
  p.add(rbox(.7, .14, .1, .03, [0, 6.6, .62]), '#ff4a6a', { layer: 'glow', ao: false });
  p.add(limb([1.3, 5.3, .2], [1.9, 6.6, 1], .3, .25), E.odin, { ao: false });
  p.add(rbox(.22, 5.2, .06, .02, [2, 9.3, 1.1], [.15, 0, 0]), E.odinSteel, { layer: 'glow', ao: false });
  p.add(rbox(1, .2, .25, .05, [2, 6.8, 1]), E.odinTrim, { ao: false });
  p.add(limb([-1.3, 5.3, .2], [-1.7, 4.2, .9], .3, .25), E.odin, { ao: false });
  p.add(cyl(1.1, 1.1, .2, [-1.9, 4.2, 1.1], [Math.PI / 2, 0, 0], 12), E.odinTrim, { ao: false });
  return p;
}

/** A floating rock pedestal for an Esper: a dark slab over a hanging spike, with crystals at its rim. Origin at its top centre. */
export function pedestal(r: Rng, radius: number, crystal: string) {
  const p = new Parts();
  p.add(rock([radius, radius * .32, radius], [0, -radius * .2, 0], r() * 9), '#3d3f60', { flat: true, ao: false });
  p.add(xf(new THREE.ConeGeometry(radius * .85, radius * 2.2, 7), [0, -radius * 1.3, 0], [Math.PI, 0, 0]), grad('#151629', '#33355a', -radius * 2.4, -radius * .2), { flat: true, ao: false });
  for (let i = 0; i < 5; i++) {
    // Rooted inside the slab's rim, so each crystal grows out of the rock.
    const a = i / 5 * 6.28 + r() * .6, d = radius * r.range(.5, .65), h = radius * r.range(.25, .5);
    p.add(prism(0, h * .22, h, 6, [Math.cos(a) * d, -radius * .22, Math.sin(a) * d], [r.range(-.3, .3), 0, r.range(-.3, .3)]), grad('#3b2c86', crystal, 0, h), { layer: 'glow', flat: true, ao: false });
  }
  return p;
}
