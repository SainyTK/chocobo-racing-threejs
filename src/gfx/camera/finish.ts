import * as THREE from 'three';

const ease = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const from = new THREE.Vector3(), to = new THREE.Vector3(), look = new THREE.Vector3();


/**
 * Cameras for the finish: an orbit that swings from behind the player's racer round to its front,
 * then a wide shot of the podium. Each shot eases in from wherever the camera was when it began.
 */
export class FinishCamera {
  private start = new THREE.Vector3(); private startLook = new THREE.Vector3(); private shot = '';
  /** Swings round a racer at `focus` heading `yaw`, `t` seconds after it crossed the line. */
  orbit(camera: THREE.PerspectiveCamera, focus: THREE.Vector3, yaw: number, t: number) {
    const k = ease(t / 3.4), angle = yaw + Math.PI + k * (Math.PI - .55), distance = 8.5 - k * 2.5;
    to.set(focus.x + Math.sin(angle) * distance, focus.y + 3.4 - k * 1.5, focus.z + Math.cos(angle) * distance);
    this.place(camera, 'orbit', to, look.set(focus.x, focus.y + 3, focus.z), t);
  }
  /** Faces the podium from down the road, slowly drifting closer. */
  podium(camera: THREE.PerspectiveCamera, center: THREE.Vector3, facing: number, t: number) {
    const distance = 17 - ease(t / 5) * 2.5;
    to.set(center.x + Math.sin(facing) * distance, center.y + 4.6, center.z + Math.cos(facing) * distance);
    this.place(camera, 'podium', to, look.set(center.x, center.y + 3.2, center.z), t);
  }
  private place(camera: THREE.PerspectiveCamera, shot: string, position: THREE.Vector3, target: THREE.Vector3, t: number) {
    if (shot !== this.shot) { this.shot = shot; this.start.copy(camera.position); camera.getWorldDirection(this.startLook).multiplyScalar(10).add(camera.position); }
    const blend = shot === 'podium' ? 1 : ease(t / .6);
    camera.position.copy(from.copy(this.start).lerp(position, blend)); camera.lookAt(from.copy(this.startLook).lerp(target, blend));
  }
  reset() { this.shot = ''; }
}
