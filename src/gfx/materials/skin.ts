import * as THREE from 'three';

/** Uniforms shared by one character's materials, so a hit flash or ghost fade touches the whole model at once. */
/** `fade` dissolves the model with a screen-door dither (0 solid, 1 gone), used when it comes too close to the camera. */
export interface SkinUniforms { flash: { value: number }; flashColor: { value: THREE.Color }; rim: { value: number }; fade: { value: number } }
/** Discards a share of fragments in a stable screen pattern; needs `uniform float uFade;`. */
export const DITHER_FADE = 'if (uFade > 0.0 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < uFade) discard;';
export const skinUniforms = (): SkinUniforms => ({ flash: { value: 0 }, flashColor: { value: new THREE.Color('#ffffff') }, rim: { value: .42 }, fade: { value: 0 } });
