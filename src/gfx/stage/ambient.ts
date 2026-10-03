import * as THREE from 'three';
import { Particles, Shape, type Emit } from '../particles/particles.ts';

/** Drifting atmosphere around the camera: fireflies, leaves, embers, dust, petals, sugar, wisps. */
export interface AmbientSpec {
  color: string; endColor?: string;
  /** Particles per second at full density. */
  rate: number; size: number; life: number;
  /** Glowing additive sprites (fireflies, embers) or soft alpha sprites (leaves, dust). */
  glow?: boolean; shape?: Shape;
  /** Spawn band above the ground, metres. */
  height?: [number, number];
  /** Constant drift (wind, rising heat) plus random wander. */
  drift?: [number, number, number]; wander?: number; gravity?: number; spin?: number; alpha?: number;
  /** Spawn radius around the point ahead of the camera. */
  radius?: number;
}

const ahead = new THREE.Vector3(), fwd = new THREE.Vector3();
export class Ambient {
  readonly group = new THREE.Group(); density = 1;
  private glow = new Particles(900, true); private soft = new Particles(700, false); private debt: number[];
  constructor(private specs: AmbientSpec[], private groundAt: (x: number, z: number) => number) { this.group.add(this.glow.mesh, this.soft.mesh); this.debt = specs.map(() => 0); }
  update(dt: number, camera: THREE.Camera) {
    if (dt > 0) {
      camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      this.specs.forEach((s, i) => {
        this.debt[i] += s.rate * this.density * dt;
        const R = s.radius ?? 30, pool = s.glow ? this.glow : this.soft;
        while (this.debt[i] >= 1) {
          this.debt[i]--;
          ahead.copy(camera.position).addScaledVector(fwd, R * .7);
          const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * R, x = ahead.x + Math.cos(a) * d, z = ahead.z + Math.sin(a) * d, [h0, h1] = s.height ?? [.3, 4];
          const wv = s.wander ?? .4, [dx, dy, dz] = s.drift ?? [0, 0, 0];
          const e: Emit = { x, y: this.groundAt(x, z) + h0 + Math.random() * (h1 - h0), z, vx: dx + (Math.random() - .5) * wv * 2, vy: dy + (Math.random() - .5) * wv, vz: dz + (Math.random() - .5) * wv * 2,
            life: s.life * (.7 + Math.random() * .6), size: s.size * (.6 + Math.random() * .8), color: s.color, endColor: s.endColor, alpha: s.alpha ?? 1, gravity: s.gravity ?? 0, shape: s.shape ?? Shape.Glow, spin: s.spin };
          pool.emit(e);
        }
      });
    }
    this.glow.update(dt); this.soft.update(dt);
  }
  dispose() { this.glow.dispose(); this.soft.dispose(); }
}
