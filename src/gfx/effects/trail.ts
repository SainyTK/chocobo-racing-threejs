import * as THREE from 'three';

/** Fading ribbon that follows a point, for boost trails. */
export class Trail {
  mesh: THREE.Mesh; private pts: { p: THREE.Vector3; side: THREE.Vector3; age: number }[] = []; private geo = new THREE.BufferGeometry(); static N = 26;
  constructor(public color: THREE.Color, public width = .32, public maxAge = .38) {
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Trail.N * 6), 3)); this.geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(Trail.N * 2), 1));
    const idx: number[] = []; for (let i = 0; i < Trail.N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uColor: { value: this.color } },
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor * vA * 1.6, 1.); }` }));
    this.mesh.frustumCulled = false; this.mesh.visible = false;
  }
  update(dt: number, at: THREE.Vector3, side: THREE.Vector3, active: boolean) {
    for (const q of this.pts) q.age += dt; while (this.pts.length && this.pts[0].age > this.maxAge) this.pts.shift();
    if (active) { this.pts.push({ p: at.clone(), side: side.clone(), age: 0 }); if (this.pts.length > Trail.N) this.pts.shift(); }
    const n = this.pts.length; this.mesh.visible = n > 1; if (n < 2) return;
    const pos = this.geo.attributes.position as THREE.BufferAttribute, al = this.geo.attributes.alpha as THREE.BufferAttribute;
    this.pts.forEach((q, i) => { const k = 1 - q.age / this.maxAge, w = this.width * k; pos.setXYZ(i * 2, q.p.x + q.side.x * w, q.p.y + q.side.y * w + .02, q.p.z + q.side.z * w); pos.setXYZ(i * 2 + 1, q.p.x - q.side.x * w, q.p.y - q.side.y * w + .02, q.p.z - q.side.z * w); al.setX(i * 2, k * k); al.setX(i * 2 + 1, k * k); });
    this.geo.setDrawRange(0, (n - 1) * 6); pos.needsUpdate = al.needsUpdate = true;
  }
  dispose() { this.geo.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
