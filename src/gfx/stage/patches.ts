import * as THREE from 'three';
import { courseLayout, type PatchSurface } from '../../../shared/track/index.ts';
import { noiseTexture } from './textures.ts';
import type { Kit } from './kit.ts';
import type { PatchLook } from './types.ts';

/** Deep, mid and highlight colours, self-glow, and gloss (moving sheen streaks that mark a slippery surface). */
const LOOKS: Record<PatchLook, [string, string, string, number, number]> = {
  mud: ['#3a2618', '#6b4a2c', '#c9a77a', 0, 0],
  oil: ['#141018', '#2c2a3c', '#b8a8ff', .2, 1],
  ice: ['#6fb8e8', '#b8ecff', '#ffffff', .25, 1],
  icing: ['#f2c4dc', '#fff0f6', '#ffffff', .15, 1],
  syrup: ['#8a3a10', '#d8822a', '#ffe0a0', .25, 1],
  blood: ['#3a0410', '#8a1024', '#ff6a7a', .2, .3],
  goo: ['#c2306f', '#ff7fb6', '#ffe1f0', .3, 0],
  tar: ['#120e14', '#2e2830', '#7a6e80', 0, .2],
};

/** Rounded-rectangle decal shader: ragged noisy rim, swirling body, bubbles, and for slick surfaces bright sliding sheen. */
export function patchMaterial(kit: Kit, look: PatchLook) {
  const [deep, mid, hi, glow, gloss] = LOOKS[look];
  const mat = kit.own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNoise: { value: null }, uDeep: { value: new THREE.Color(deep) }, uMid: { value: new THREE.Color(mid) }, uHi: { value: new THREE.Color(hi) }, uGlow: { value: glow }, uGloss: { value: gloss } }]),
    vertexShader: `attribute vec2 size; varying vec2 vUv; varying vec2 vSize; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vSize = size; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime, uGlow, uGloss; uniform sampler2D uNoise; uniform vec3 uDeep, uMid, uHi; varying vec2 vUv; varying vec2 vSize; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 hs = vSize * .5, p = (vUv - .5) * vSize; float r = min(1.6, min(hs.x, hs.y) * .8);
        vec2 q = abs(p) - hs + r; float edge = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
        edge += (texture2D(uNoise, vW.xz * .07).r - .5) * 1.1;
        if (edge > 0.) discard;
        float body = smoothstep(0., -2.5, edge), swirl = texture2D(uNoise, vW.xz * .06 + vec2(uTime * .02, -uTime * .015)).g, bub = texture2D(uNoise, vW.xz * .18 - uTime * .03).b;
        vec3 c = mix(uMid, uDeep, body * .7 + swirl * .3);
        c = mix(c, uHi, smoothstep(.6, .75, swirl) * .45 + smoothstep(-.7, -.1, edge) * .45 + step(.74, bub) * .3 * (1. - uGloss));
        float streak = smoothstep(.82, .97, sin((vW.x + vW.z) * .45 - uTime * 2.2 + swirl * 4.) * .5 + .5);
        c = mix(c, uHi * 1.6, streak * uGloss * .55);
        c *= 1. + uGlow * (.6 + .4 * sin(uTime * 2. + swirl * 9.)) * body;
        gl_FragColor = vec4(c, smoothstep(0., -.6, edge) * .96);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }));
  // Set after the merge: merging clones texture uniforms, and the clone would never be disposed.
  mat.uniforms.uNoise.value = kit.own(noiseTexture(128));
  return mat;
}

/** Slow and slippery patches from the course layout, one decal mesh per surface, following the road's curve. Returns the materials to animate. */
export function buildPatches(kit: Kit, looks: Record<PatchSurface, PatchLook>) {
  const materials: THREE.ShaderMaterial[] = [];
  for (const surface of ['slow', 'slip'] as const) {
    const patches = courseLayout(kit.id).patches.filter(p => p.surface === surface); if (!patches.length) continue;
    const pos: number[] = [], uv: number[] = [], size: number[] = [], idx: number[] = [];
    for (const patch of patches) {
      const rows = Math.max(2, Math.ceil(patch.length / 2)), base = pos.length / 3;
      for (let i = 0; i <= rows; i++) for (let k = 0; k <= 1; k++) {
        const p = kit.at(patch.s + i / rows * patch.length, patch.x + (k - .5) * patch.width);
        pos.push(p.x, p.y + .05, p.z); uv.push(k, i / rows); size.push(patch.width, patch.length);
      }
      for (let i = 0; i < rows; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('size', new THREE.Float32BufferAttribute(size, 2)); g.setIndex(idx); g.computeBoundingSphere();
    const mat = patchMaterial(kit, looks[surface]), mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 1; mesh.name = 'patches'; kit.add(mesh); materials.push(mat);
  }
  return materials;
}
