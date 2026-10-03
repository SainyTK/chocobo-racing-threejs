import * as THREE from 'three';

export const shade = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
