import * as THREE from 'three';

const materials = new Map<string, THREE.MeshStandardMaterial>();
/** Flat-shaded scenery material, cached by colour so batched scenery merges into few draw calls. */
export function sceneryMaterial(color: string) { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true, side: THREE.DoubleSide })); return materials.get(color)!; }
export const sceneryMaterials = (): THREE.Material[] => [...materials.values()];
