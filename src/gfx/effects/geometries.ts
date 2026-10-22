import * as THREE from 'three';

export const sphereGeo = new THREE.SphereGeometry(1, 40, 28), ringGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).translate(0, .5, 0);
export const shardGeo = new THREE.LatheGeometry([new THREE.Vector2(0, -.25), new THREE.Vector2(.32, 0), new THREE.Vector2(.3, .95), new THREE.Vector2(0, 1.45)], 6);
/** Upper half of a sphere, for shockwave domes that rise from the ground. */
export const domeGeo = new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
export const FX_GEOMETRIES = [sphereGeo, ringGeo, pillarGeo, shardGeo, domeGeo];
