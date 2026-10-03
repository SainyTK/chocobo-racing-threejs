import * as THREE from 'three';

/** Uniforms shared by one character's materials, so a hit flash or ghost fade touches the whole model at once. */
export interface SkinUniforms { flash: { value: number }; flashColor: { value: THREE.Color }; rim: { value: number } }
export const skinUniforms = (): SkinUniforms => ({ flash: { value: 0 }, flashColor: { value: new THREE.Color('#ffffff') }, rim: { value: .42 } });
