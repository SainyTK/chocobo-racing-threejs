import * as THREE from 'three';

/** Three-band ramp shared by every toon material. */
const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255, 190, 190, 190, 255, 240, 240, 240, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();

/** Uniforms shared by one character's materials, so a hit flash or ghost fade touches the whole model at once. */
export interface SkinUniforms { flash: { value: number }; flashColor: { value: THREE.Color }; rim: { value: number } }
export const skinUniforms = (): SkinUniforms => ({ flash: { value: 0 }, flashColor: { value: new THREE.Color('#ffffff') }, rim: { value: .42 } });

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

/** Unlit HDR colour. Values above 1 feed the bloom pass. */
export function glow(color: string, intensity = 2.2, transparent = false) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity * 1.6), transparent, depthWrite: !transparent, fog: true });
}

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

/** Translucent holographic look for the saved Time Attack ghost. */
export function ghostMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = -mv.xyz; vY = (modelMatrix*vec4(position,1.)).y; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(clamp(1. - abs(dot(normalize(vN), normalize(vV))), 0., 1.), 2.); float scan = .55 + .45*sin(vY*14. - uTime*6.); gl_FragColor = vec4(vec3(.35,.9,1.)*(f*1.4 + .08)*scan, 1.); }`,
  });
}
