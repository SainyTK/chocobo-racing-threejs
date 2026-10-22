import * as THREE from 'three';
import { flareMaterial, Glyph } from './flare-material.ts';

const c0 = new THREE.Color(), c1 = new THREE.Color(), mid = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3(), dir = new THREE.Vector3(), across = new THREE.Vector3();

/**
 * Additive quads rebuilt every frame: spikes, rays, glows, beams and feathers. The PS1 drew these effects as flat
 * sprites that change every frame, so they are written on the CPU each frame and drawn in one call.
 */
export class FlareBatch {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  /** The camera's right, up and toward-camera directions, for quads that face the camera. */
  readonly right = new THREE.Vector3(); readonly up = new THREE.Vector3(); readonly toward = new THREE.Vector3();
  /** The camera's position. */
  readonly eye = new THREE.Vector3();
  private n = 0;
  private readonly pos: Float32Array; private readonly col0: Float32Array; private readonly col1: Float32Array; private readonly shape: Float32Array;
  constructor(readonly capacity: number) {
    const v = capacity * 4, geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(v * 3); this.col0 = new Float32Array(v * 3); this.col1 = new Float32Array(v * 3); this.shape = new Float32Array(v * 4);
    const corner = new Float32Array(v * 2), index = new Uint32Array(capacity * 6);
    for (let i = 0; i < capacity; i++) {
      corner.set([-1, -1, 1, -1, 1, 1, -1, 1], i * 8);
      const a = i * 4; index.set([a, a + 1, a + 2, a, a + 2, a + 3], i * 6);
    }
    for (const [name, array, size] of [['position', this.pos, 3], ['color0', this.col0, 3], ['color1', this.col1, 3], ['shape', this.shape, 4]] as const) geo.setAttribute(name, new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('corner', new THREE.BufferAttribute(corner, 2)); geo.setIndex(new THREE.BufferAttribute(index, 1));
    this.mesh = new THREE.Mesh(geo, flareMaterial()); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; geo.setDrawRange(0, 0);
  }
  begin(camera: THREE.Camera) {
    this.n = 0; camera.updateMatrixWorld();
    this.right.setFromMatrixColumn(camera.matrixWorld, 0); this.up.setFromMatrixColumn(camera.matrixWorld, 1); this.toward.setFromMatrixColumn(camera.matrixWorld, 2);
    this.eye.setFromMatrixPosition(camera.matrixWorld);
  }
  /**
   * Moves `at` up to `reach` toward the camera and returns how much to scale sizes drawn there so they keep their size
   * on screen. A sprite drawn this way stays in front of the road and the racer it surrounds, as the PS1's did.
   */
  lift(at: THREE.Vector3, reach: number) {
    const d = at.distanceTo(this.eye), step = Math.min(reach, d * .5); at.addScaledVector(this.toward, step);
    return (d - step) / Math.max(d, 1e-3);
  }
  /**
   * A quad centred on `at` spanning `±ax` and `±ay`; the glyph's bottom edge is at `-ay`. `cover` 0 adds its light,
   * as every glow does; up to 1 it paints over what is behind it instead.
   */
  quad(at: THREE.Vector3, ax: THREE.Vector3, ay: THREE.Vector3, glyph: Glyph, inner: THREE.ColorRepresentation, outer: THREE.ColorRepresentation, alpha: number, p = 0, q = 0, cover = 0) {
    if (this.n >= this.capacity || alpha <= .002) return;
    const i = this.n++; c0.set(inner); c1.set(outer);
    for (let k = 0; k < 4; k++) {
      const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1, j = (i * 4 + k);
      this.pos[j * 3] = at.x + ax.x * sx + ay.x * sy; this.pos[j * 3 + 1] = at.y + ax.y * sx + ay.y * sy; this.pos[j * 3 + 2] = at.z + ax.z * sx + ay.z * sy;
      this.col0[j * 3] = c0.r; this.col0[j * 3 + 1] = c0.g; this.col0[j * 3 + 2] = c0.b; this.col1[j * 3] = c1.r; this.col1[j * 3 + 1] = c1.g; this.col1[j * 3 + 2] = c1.b;
      this.shape[j * 4] = glyph + Math.min(1, Math.max(0, cover)) * .9; this.shape[j * 4 + 1] = alpha; this.shape[j * 4 + 2] = p; this.shape[j * 4 + 3] = q;
    }
  }
  /** A blade from `from` along the unit `dir`, `width` wide at its root, lying in the plane of `dir` and the unit `across`. */
  ray(from: THREE.Vector3, dir: THREE.Vector3, across: THREE.Vector3, length: number, width: number, inner: THREE.ColorRepresentation, outer: THREE.ColorRepresentation, alpha: number, tip = .08, core = .8) {
    mid.copy(from).addScaledVector(dir, length / 2); u.copy(across).multiplyScalar(width / 2); w.copy(dir).multiplyScalar(length / 2);
    this.quad(mid, u, w, Glyph.Ray, inner, outer, alpha, tip, core);
  }
  /** A camera-facing blade from `from` at `angle` radians on screen (0 is right, π/2 is up). */
  screenRay(from: THREE.Vector3, angle: number, length: number, width: number, inner: THREE.ColorRepresentation, outer: THREE.ColorRepresentation, alpha: number, tip = .08, core = .8) {
    dir.copy(this.right).multiplyScalar(Math.cos(angle)).addScaledVector(this.up, Math.sin(angle));
    across.copy(this.right).multiplyScalar(-Math.sin(angle)).addScaledVector(this.up, Math.cos(angle));
    this.ray(from, dir, across, length, width, inner, outer, alpha, tip, core);
  }
  /** A camera-facing soft disc of `radius`, squashed vertically by `squash`. */
  glow(at: THREE.Vector3, radius: number, inner: THREE.ColorRepresentation, outer: THREE.ColorRepresentation, alpha: number, edge = 1, rim = 0, squash = 1) {
    u.copy(this.right).multiplyScalar(radius); w.copy(this.up).multiplyScalar(radius * squash);
    this.quad(at, u, w, Glyph.Disc, inner, outer, alpha, rim, edge);
  }
  /** A camera-facing thin ring of `radius`, `width` across; `k` mixes its colour from `inner` to `outer`. */
  ring(at: THREE.Vector3, radius: number, width: number, inner: THREE.ColorRepresentation, outer: THREE.ColorRepresentation, alpha: number, k = 0) {
    u.copy(this.right).multiplyScalar(radius); w.copy(this.up).multiplyScalar(radius);
    this.quad(at, u, w, Glyph.Ring, inner, outer, alpha, width / radius, k);
  }
  /** Draws nothing until the next `begin`. */
  clear() { this.n = 0; this.end(); }
  end() {
    const geo = this.mesh.geometry, v = this.n * 4;
    for (const name of ['position', 'color0', 'color1', 'shape']) { const a = geo.getAttribute(name) as THREE.BufferAttribute; a.clearUpdateRanges(); a.addUpdateRange(0, v * a.itemSize); a.needsUpdate = true; }
    geo.setDrawRange(0, this.n * 6); this.mesh.visible = this.n > 0;
  }
  get count() { return this.n; }
}
