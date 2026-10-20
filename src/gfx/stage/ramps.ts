import * as THREE from 'three';
import { courseLayout, type Ramp } from '../../../shared/track/index.ts';
import { Parts } from './kit.ts';
import { STAGE, type Layer } from './materials.ts';
import type { Kit } from './kit.ts';
import type { RampStyle } from './types.ts';

const STEPS = 8;

/** One quad strip in world space, from points already lifted to their heights. */
function quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([a, c, b, b, c, d].flatMap(v => [v.x, v.y, v.z]), 3)); g.computeVertexNormals(); return g;
}

/**
 * A jump wedge matching the simulation exactly: its deck rises linearly to the lip at `ramp.s`, where it drops square to the road.
 * Chevrons on the deck point at the lip and the lip face carries warning stripes, so it reads from the chase camera well before it arrives.
 */
function wedge(kit: Kit, ramp: Ramp, style: RampStyle) {
  const parts = new Parts(), half = ramp.width / 2, c = kit.at(ramp.s - ramp.length / 2, ramp.x);
  // Built around its own centre, so it lands in the right scenery chunk for culling.
  const v = (s: number, x: number, y: number) => { const p = kit.at(s, x); return new THREE.Vector3(p.x - c.x, p.y + y - c.y, p.z - c.z); };
  const lift = (i: number) => ramp.height * i / STEPS + .03, at = (i: number) => ramp.s - ramp.length + ramp.length * i / STEPS;
  for (let i = 0; i < STEPS; i++) for (let k = 0; k < 4; k++) {
    const x0 = ramp.x - half + ramp.width * k / 4, x1 = ramp.x - half + ramp.width * (k + 1) / 4;
    // Chevrons: a stripe that runs diagonally from the deck's edges to its centre line, pointing towards the lip.
    const chevron = (i + (k < 2 ? 3 - k : k)) % 3 === 0;
    parts.add(quad(v(at(i), x1, lift(i)), v(at(i), x0, lift(i)), v(at(i + 1), x1, lift(i + 1)), v(at(i + 1), x0, lift(i + 1))), chevron ? style.stripe : style.deck, { ao: false });
  }
  for (const side of [-1, 1]) for (let i = 0; i < STEPS; i++) {
    const x = ramp.x + side * half, a = v(at(i), x, 0), b = v(at(i + 1), x, 0), top0 = v(at(i), x, lift(i)), top1 = v(at(i + 1), x, lift(i + 1));
    parts.add(side > 0 ? quad(a, top0, b, top1) : quad(top0, a, top1, b), style.side, { ao: false });
  }
  for (let k = 0; k < 8; k++) {
    const x0 = ramp.x - half + ramp.width * k / 8, x1 = ramp.x - half + ramp.width * (k + 1) / 8;
    parts.add(quad(v(ramp.s, x0, 0), v(ramp.s, x1, 0), v(ramp.s, x0, lift(STEPS)), v(ramp.s, x1, lift(STEPS))), k % 2 ? style.stripe : style.side, { ao: false });
  }
  // Its own mesh, not merged scenery: it is part of the driving surface.
  for (const [layer, [g]] of parts.bake().layers) { const m = new THREE.Mesh(g, STAGE[layer.replace('+', '') as Layer]); m.position.set(c.x, c.y, c.z); m.name = 'ramp'; m.castShadow = m.receiveShadow = true; kit.add(m); }
  parts.layers.clear();
}

/** Every jump ramp on the course, in the course's own colours. */
export function buildRamps(kit: Kit, style: RampStyle | undefined) {
  const ramps = courseLayout(kit.id).ramps; if (!ramps.length) return;
  if (!style) throw new Error(`${kit.id} has ramps but its scenery defines no ramp style`);
  for (const ramp of ramps) wedge(kit, ramp, style);
}
