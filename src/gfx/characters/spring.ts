import type * as THREE from 'three';
import { clamp } from './math.ts';

/**
 * A part hanging or standing on a damped spring, such as Mog's pom-pom or Goblin's lantern: it lags behind steering and
 * speed, so it swings as the racer turns and tips back as it speeds up. Angles are in model axes: `x` tips it forward
 * and back, `z` to the sides.
 */
export function swingSpring() {
  let vx = 0, x = 0, vz = 0, z = 0;
  return (j: THREE.Object3D, dt: number, steer: number, push: number, t: number) => {
    vz += ((-steer * 3 - z) * 60 - vz * 5) * dt; z += vz * dt;
    vx += ((-push * 1.2 - x) * 60 - vx * 5) * dt; x += vx * dt;
    j.rotation.set(clamp(x * .3 + Math.sin(t * 18) * .04 * push, -.8, .8), 0, clamp(z * .3, -.8, .8));
  };
}
