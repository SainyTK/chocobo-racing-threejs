import * as THREE from 'three';

/** Shared clock for every animated stage material. The course advances it once per frame. */
export const stageTime = { value: 0 };

function ramp(levels: number[]) {
  const data = new Uint8Array(levels.flatMap(v => [v, v, v, 255]));
  const t = new THREE.DataTexture(data, levels.length, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; t.userData.shared = true; return t;
}
/** Props use the same three-band ramp as the racers so both read as one cel-shaded world. */
const propRamp = ramp([138, 196, 240, 255]);
/** Terrain and roads get gentler bands, so large curved ground does not show hard contour lines. */
const groundRamp = ramp([150, 178, 204, 226, 244, 255]);

export interface StageMaterialOptions { wind?: boolean; ground?: boolean; map?: THREE.Texture | null; vertexColors?: boolean; color?: THREE.ColorRepresentation; side?: THREE.Side; rim?: number }
/**
 * Cel-shaded scenery material. Vertex colours carry each prop's paint and baked ambient occlusion.
 * `wind` sways vertices by their `sway` attribute (0 at the root, 1 at a branch tip), in world space so a forest moves as one breeze.
 */
export function stageMaterial(o: StageMaterialOptions = {}) {
  const m = new THREE.MeshToonMaterial({ color: o.color ?? '#ffffff', vertexColors: o.vertexColors ?? true, gradientMap: o.ground ? groundRamp : propRamp, map: o.map ?? null, side: o.side ?? THREE.FrontSide });
  const rim = o.rim ?? .22;
  m.onBeforeCompile = s => {
    s.uniforms.uTime = stageTime;
    if (o.wind) {
      s.vertexShader = 'uniform float uTime;\nattribute float sway;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        float gust = sin(uTime * 1.3 + wp.x * .045 + wp.z * .03) * .6 + .4;
        transformed.x += sway * (sin(uTime * 2.1 + wp.x * .17 + wp.z * .11) * .18 + gust * .12);
        transformed.z += sway * cos(uTime * 1.7 + wp.z * .19 - wp.x * .07) * .12;`);
    }
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', `
      float rimF = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
      outgoingLight += diffuseColor.rgb * smoothstep(0.6, 0.9, rimF) * ${rim.toFixed(3)};
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `cbr-stage-${o.wind ? 'w' : ''}${o.ground ? 'g' : ''}${rim}`;
  return m;
}

/** Unlit HDR vertex colour. Lanterns, crystals, lava cracks and windows feed the bloom pass through it. */
export function stageGlow(intensity = 2.4) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensity), vertexColors: true, fog: true, toneMapped: true });
}

/** Materials shared by every course. They are never disposed, so switching courses does not recompile shaders. */
export const STAGE = {
  solid: stageMaterial(),
  foliage: stageMaterial({ wind: true, side: THREE.DoubleSide }),
  glow: stageGlow(),
};
export type Layer = keyof typeof STAGE;
export const sharedStageMaterials = (): THREE.Material[] => Object.values(STAGE);
