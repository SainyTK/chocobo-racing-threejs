import * as THREE from 'three';
import type { SkinUniforms } from './skin.ts';

/** Inverted-hull outline. The hull uses welded smooth normals so hard edges do not crack. */
export function outlineMaterial(color: string, width: number, u: SkinUniforms) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = s => {
    s.uniforms.uWidth = { value: width }; s.uniforms.uFlash = u.flash;
    s.vertexShader = 'uniform float uWidth;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
      transformed += normalize(normal) * uWidth * clamp(-viewPos.z / 14.0, 0.75, 2.4);`);
  };
  m.customProgramCacheKey = () => `cbr-outline-${width}`;
  return m;
}
