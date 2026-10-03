import * as THREE from 'three';

/** Unlit HDR colour. Values above 1 feed the bloom pass. */
export function glow(color: string, intensity = 2.2, transparent = false) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity * 1.6), transparent, depthWrite: !transparent, fog: true });
}
