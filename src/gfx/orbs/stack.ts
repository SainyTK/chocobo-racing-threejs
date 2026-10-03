import * as THREE from 'three';
import { ITEMS, type Item } from '../../../shared/game/index.ts';
import { glowMap, makeOrb, type Orb } from './index.ts';

/** Thin energy ring of radius 1 in the XZ plane. */
const ringGeo = new THREE.TorusGeometry(1, .03, 6, 64).rotateX(Math.PI / 2);
export const AURA_GEOMETRIES = [ringGeo];

/** Eight soft rays around a hot centre, for the level three starburst. Built from data like the glow map. */
const raysMap = (() => {
  const n = 128, px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x + .5 - n / 2, dy = y + .5 - n / 2, r = Math.min(1, Math.hypot(dx, dy) / (n / 2)), a = Math.atan2(dy, dx);
    const rays = (Math.abs(Math.cos(a * 4)) ** 40 + Math.abs(Math.cos(a * 4 + Math.PI / 4)) ** 60 * .45) * (1 - r) ** 1.5, core = (1 - r) ** 6;
    px.set([255, 255, 255, Math.round(255 * Math.min(1, rays + core))], (y * n + x) * 4);
  }
  const t = new THREE.DataTexture(px, n, n); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; t.userData.shared = true; return t;
})();

/** The glow around a held stack. Level two pulses with two rings and soft rays; level three blazes with three rings, a hot core and strong rays. Sized for an orb of radius 1. */
interface StackAura { root: THREE.Group; update(t: number): void; dispose(): void }

function makeStackAura(color: string, level: 2 | 3): StackAura {
  const root = new THREE.Group(), materials: THREE.Material[] = [], hot = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), .35);
  const sprite = (map: THREE.Texture, c: THREE.Color, opacity: number, size: number) => {
    const m = new THREE.SpriteMaterial({ map, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }); materials.push(m);
    const s = new THREE.Sprite(m); s.scale.setScalar(size); root.add(s); return s;
  };
  const ring = (radius: number, c: THREE.Color, intensity: number) => {
    const m = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(intensity), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }); materials.push(m);
    const pivot = new THREE.Group(), mesh = new THREE.Mesh(ringGeo, m); mesh.scale.setScalar(radius); pivot.add(mesh); root.add(pivot); return pivot;
  };
  const halo = sprite(glowMap, new THREE.Color(color), level === 3 ? .7 : .6, level === 3 ? 3.6 : 3.2);
  const core = sprite(glowMap, hot, level === 3 ? .45 : .3, level === 3 ? 2.2 : 1.9);
  const burst = sprite(raysMap, level === 3 ? hot : new THREE.Color(color), level === 3 ? .6 : .38, level === 3 ? 4.4 : 3.5);
  const rings = level === 3
    ? [ring(1.45, hot, 3.2), ring(1.6, new THREE.Color(color), 2.6), ring(1.95, new THREE.Color(color), 1.4)]
    : [ring(1.45, hot, 2.6), ring(1.6, new THREE.Color(color), 1.8)];
  return {
    root,
    update(t) {
      if (level === 3) {
        const beat = .5 + .5 * Math.sin(t * 7);
        halo.scale.setScalar(3.3 + beat * .6); halo.material.opacity = .5 + beat * .25; core.scale.setScalar(2 + beat * .4);
        burst.material.rotation = t * .9; burst.scale.setScalar(4.2 + Math.sin(t * 3.1) * .4);
        rings[0].rotation.set(1.1, t * 3.2, 0); rings[1].rotation.set(-1.1, -t * 2.6, .4); rings[2].rotation.set(.25, t * 1.4, Math.sin(t * 1.7) * .2);
      } else {
        const beat = .5 + .5 * Math.sin(t * 4);
        halo.scale.setScalar(3 + beat * .4); halo.material.opacity = .45 + beat * .2; core.scale.setScalar(1.8 + beat * .25);
        burst.material.rotation = -t * .6; burst.scale.setScalar(3.4 + Math.sin(t * 2.3) * .25);
        rings[0].rotation.set(.9 + Math.sin(t * 1.3) * .2, t * 2.4, 0); rings[1].rotation.set(-1, -t * 1.8, .3);
      }
    },
    dispose() { for (const m of materials) m.dispose(); },
  };
}

/** A held stack: the stone's orb of radius 1, wrapped in its level's aura from level two up. */
export function makeHeldStack(kind: Item, level: number): Orb {
  const orb = makeOrb(kind, { halo: false }), aura = level > 1 ? makeStackAura(ITEMS[kind].color, level >= 3 ? 3 : 2) : null, root = new THREE.Group();
  root.add(orb.root); if (aura) root.add(aura.root);
  return { root, update(t) { orb.update(t); aura?.update(t); }, dispose() { orb.dispose(); aura?.dispose(); } };
}
