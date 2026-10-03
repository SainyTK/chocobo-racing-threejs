import * as THREE from 'three';
import { ITEMS } from '../../../shared/game/index.ts';
import type { PickupKind } from '../effects/pickup.ts';
import { glassMaterial } from './glass.ts';
import { INTERIORS } from './interiors.ts';
import { vertex, fragment } from './glsl.ts';

export const RANDOM_COLOR = '#fff6d6';
/** The interior only needs to cover the sphere's silhouette, so it is coarse and slightly oversized; the glass needs smooth normals. */
const glassGeo = new THREE.SphereGeometry(1, 28, 18), interiorGeo = new THREE.SphereGeometry(1.04, 18, 12);
export const ORB_GEOMETRIES = [glassGeo, interiorGeo];

/** Detail for every orb, live and future. Below 1 (Low and Retro quality) ray-march steps halve and the outer glow is dropped. */
let detail = 1;
const live = new Set<{ interior: THREE.ShaderMaterial; glow: THREE.Sprite | null }>();
export function setOrbDetail(d: number) {
  if (d === detail) return; detail = d;
  for (const o of live) { o.interior.defines.DETAIL = d.toFixed(2); o.interior.needsUpdate = true; if (o.glow) o.glow.visible = d >= 1; }
}
export const orbColor = (kind: PickupKind) => kind === 'random' ? RANDOM_COLOR : ITEMS[kind].color;
export interface OrbOptions { /** Rim of the glass in the stone's colour. Clear glass otherwise. */ tint?: boolean; /** Soft outer glow that keeps the stone readable from far away. */ halo?: boolean }
/** A glass orb of radius 1 with the stone's element alive inside it. */
export interface Orb { root: THREE.Group; update(t: number): void; dispose(): void }

/** Soft radial falloff shared by every orb's outer glow. Built from data, so orbs can be created without a DOM. */
const glowMap = (() => {
  const n = 64, px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = Math.min(1, Math.hypot(x + .5 - n / 2, y + .5 - n / 2) / (n / 2)), i = (y * n + x) * 4; px.set([255, 255, 255, Math.round(255 * (1 - r) ** 2.2)], i); }
  const t = new THREE.DataTexture(px, n, n); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; t.userData.shared = true; return t;
})();

/** Ray-marched element held inside a glass sphere. The interior draws first, then the glass over it. */
export function makeOrb(kind: PickupKind, o: OrbOptions = {}): Orb {
  const { tint = true, halo = true } = o, color = orbColor(kind), root = new THREE.Group();
  const interiorMat = new THREE.ShaderMaterial({
    defines: { DETAIL: detail.toFixed(2) }, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uTime: { value: 0 } }, vertexShader: vertex, fragmentShader: fragment(INTERIORS[kind]),
  });
  const interior = new THREE.Mesh(interiorGeo, interiorMat); interior.scale.setScalar(.94); interior.renderOrder = 1;
  const glass = new THREE.Mesh(glassGeo, glassMaterial(tint ? color : '#cfe6ff', tint && kind === 'random')); glass.renderOrder = 2;
  root.add(interior, glass);
  const materials: THREE.ShaderMaterial[] = [interiorMat, glass.material];
  let glow: THREE.Sprite | null = null;
  if (halo) { glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: new THREE.Color(color).multiplyScalar(.9), blending: THREE.AdditiveBlending, depthWrite: false, opacity: .45 })); glow.scale.setScalar(2.6); glow.renderOrder = 0; glow.visible = detail >= 1; root.add(glow); }
  const entry = { interior: interiorMat, glow }; live.add(entry); interiorMat.addEventListener('dispose', () => live.delete(entry));
  return {
    root,
    update(t) { for (const m of materials) if (m.uniforms.uTime) m.uniforms.uTime.value = t; },
    dispose() { for (const m of materials) m.dispose(); glow?.material.dispose(); },
  };
}
