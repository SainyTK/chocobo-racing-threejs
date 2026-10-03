import * as THREE from 'three';

/** Unit primitives that course scenery is scaled from. */
export const sphere = new THREE.SphereGeometry(1, 12, 8), box = new THREE.BoxGeometry(1, 1, 1), cone = new THREE.ConeGeometry(1, 1, 8), crystal = new THREE.OctahedronGeometry(1), wheel = new THREE.CylinderGeometry(1, 1, 1, 12);
export const STAGE_GEOMETRIES = [sphere, box, cone, crystal, wheel];
