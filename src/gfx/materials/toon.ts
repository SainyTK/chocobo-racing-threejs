import * as THREE from 'three';
import { DITHER_FADE, type SkinUniforms } from './skin.ts';

/** Three-band ramp shared by every toon material. */
const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255, 190, 190, 190, 255, 240, 240, 240, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();

/**
 * Faceted looks come from per-face normals in the geometry; MeshToonMaterial has no flatShading switch.
 * `shadowReach` makes the sun's shadow ignore occluders closer than that many metres along the sun's rays, so a model
 * is not shaded by itself but still darkens under a roof or in a tunnel; see `SELF_SHADOW_REACH`.
 */
export interface ToonOptions { emissive?: string; emissiveIntensity?: number; side?: THREE.Side; shadowReach?: number }
/** Cel-shaded material with a soft rim light and a per-model hit flash. */
export function toon(color: string, u: SkinUniforms, o: ToonOptions = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, side: o.side ?? THREE.FrontSide });
  if (o.emissive) { m.emissive.set(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
  const reach = o.shadowReach ?? 0;
  m.onBeforeCompile = s => {
    // The sun's shadow coordinate moves toward the sun by `reach` metres. The shadow camera is orthographic, so the
    // length of the shadow matrix's depth row is the change in shadow depth per metre.
    if (reach) s.vertexShader = s.vertexShader.replace('#include <shadowmap_vertex>', `#include <shadowmap_vertex>
      #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
        vDirectionalShadowCoord[0].z -= ${reach.toFixed(2)} * length(vec3(directionalShadowMatrix[0][0].z, directionalShadowMatrix[0][1].z, directionalShadowMatrix[0][2].z));
      #endif`);
    s.uniforms.uFlash = u.flash; s.uniforms.uFlashColor = u.flashColor; s.uniforms.uRim = u.rim; s.uniforms.uFade = u.fade;
    s.fragmentShader = 'uniform float uFlash;\nuniform vec3 uFlashColor;\nuniform float uRim;\nuniform float uFade;\n' + s.fragmentShader.replace('#include <opaque_fragment>', `
      ${DITHER_FADE}
      float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
      outgoingLight += diffuseColor.rgb * smoothstep(0.62, 0.86, rimF) * uRim;
      outgoingLight = mix(outgoingLight, uFlashColor, uFlash);
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `cbr-toon-${reach}`;
  return m;
}
