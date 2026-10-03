import * as THREE from 'three';
import { crystalMaterial } from '../materials/crystal.ts';
import { shell } from '../materials/shell.ts';
import { decalMaterial } from '../materials/decal.ts';
import { sphereGeo, ringGeo, gemGeo } from './geometries.ts';

/** Track Magic Stone: a spinning faceted gem over a soft ground glow. */
export function makePickup(color: string, rainbow: boolean) {
  const group = new THREE.Group(), gem = new THREE.Mesh(gemGeo, crystalMaterial(color, { rainbow, opacity: .92, intensity: 1.25 }));
  gem.scale.setScalar(.85); group.add(gem);
  const halo = new THREE.Mesh(sphereGeo, shell(color, rainbow ? '#ffffff' : color, { power: 2.5, intensity: 1.1 })); halo.scale.setScalar(1.25); group.add(halo);
  const disc = new THREE.Mesh(ringGeo, decalMaterial('ring', color)); disc.position.y = -1.42; disc.scale.setScalar(1.3); (disc.material as THREE.ShaderMaterial).uniforms.uOpacity.value = .4; group.add(disc);
  return group;
}
