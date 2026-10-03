import * as THREE from 'three';
import type { SkinUniforms } from './skin.ts';

/** Three-band ramp shared by every toon material. */
const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255, 190, 190, 190, 255, 240, 240, 240, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();

/** Faceted looks come from per-face normals in the geometry; MeshToonMaterial has no flatShading switch. */
export interface ToonOptions { emissive?: string; emissiveIntensity?: number; side?: THREE.Side }
/** Cel-shaded material with a soft rim light and a per-model hit flash. */
export function toon(color: string, u: SkinUniforms, o: ToonOptions = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, side: o.side ?? THREE.FrontSide });
  if (o.emissive) { m.emissive.set(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
  m.onBeforeCompile = s => {
    s.uniforms.uFlash = u.flash; s.uniforms.uFlashColor = u.flashColor; s.uniforms.uRim = u.rim;
    s.fragmentShader = 'uniform float uFlash;\nuniform vec3 uFlashColor;\nuniform float uRim;\n' + s.fragmentShader.replace('#include <opaque_fragment>', `
      float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
      outgoingLight += diffuseColor.rgb * smoothstep(0.62, 0.86, rimF) * uRim;
      outgoingLight = mix(outgoingLight, uFlashColor, uFlash);
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'cbr-toon';
  return m;
}
