import * as THREE from 'three';
import { rand } from './util.ts';

const v = new THREE.Vector3(), v2 = new THREE.Vector3();

/** Additive lightning core: white-hot centre fading to `uColor` at the ribbon edges. */
export const boltMaterial = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uColor: { value: new THREE.Color('#9dffb0') } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform vec3 uColor; varying vec2 vUv; void main(){ float c = clamp(1. - abs(vUv.x * 2. - 1.), 0., 1.); vec3 col = mix(uColor * 1.5, vec3(3.), pow(c, 5.)) * pow(c, 1.6) * vUv.y * 2.5; gl_FragColor = vec4(col, 1.); }` });

/** Camera-facing jagged lightning ribbon. */
export class Bolt {
  mesh: THREE.Mesh; age = 99; life = .5; from = new THREE.Vector3(); to = new THREE.Vector3(); width = 1; private path: THREE.Vector3[] = []; private regen = 0; private geo: THREE.BufferGeometry;
  static N = 22;
  constructor(material: THREE.ShaderMaterial) {
    this.geo = new THREE.BufferGeometry(); this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Bolt.N * 6), 3)); this.geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Bolt.N * 4), 2));
    const idx: number[] = []; for (let i = 0; i < Bolt.N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, material); this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 4;
  }
  fire(from: THREE.Vector3, to: THREE.Vector3, width: number, life = .5) { this.from.copy(from); this.to.copy(to); this.width = width; this.life = life; this.age = 0; this.regen = 0; this.mesh.visible = true; }
  update(dt: number, cam: THREE.Camera) {
    this.age += dt; if (this.age > this.life) { this.mesh.visible = false; return; }
    this.regen -= dt;
    if (this.regen <= 0) { this.regen = .055; const len = this.from.distanceTo(this.to); this.path = Array.from({ length: Bolt.N }, (_, i) => { const t = i / (Bolt.N - 1), j = Math.sin(t * Math.PI) * len * .07; return new THREE.Vector3().lerpVectors(this.from, this.to, t).add(new THREE.Vector3(rand() * j, rand() * j * .3, rand() * j)); }); }
    const pos = this.geo.attributes.position as THREE.BufferAttribute, uv = this.geo.attributes.uv as THREE.BufferAttribute, flick = (1 - this.age / this.life) * (.6 + Math.random() * .4);
    for (let i = 0; i < Bolt.N; i++) {
      const p = this.path[i], next = this.path[Math.min(Bolt.N - 1, i + 1)], prev = this.path[Math.max(0, i - 1)];
      v.subVectors(next, prev).normalize(); v2.subVectors(cam.position, p).normalize(); v.cross(v2).normalize().multiplyScalar(this.width * flick * (i === Bolt.N - 1 ? .3 : 1));
      pos.setXYZ(i * 2, p.x + v.x, p.y + v.y, p.z + v.z); pos.setXYZ(i * 2 + 1, p.x - v.x, p.y - v.y, p.z - v.z); uv.setXY(i * 2, 0, flick); uv.setXY(i * 2 + 1, 1, flick);
    }
    pos.needsUpdate = uv.needsUpdate = true;
  }
  dispose() { this.geo.dispose(); }
}
