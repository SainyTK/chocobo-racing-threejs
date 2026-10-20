import * as THREE from 'three';

const vertexShader = /* glsl */`
varying vec2 vUv;
void main() { vUv = position.xy; gl_Position = vec4(position.xy, 0., 1.); }`;
// Thin radial streaks near the screen edges that rush outward. Strength 0 hides them.
const fragmentShader = /* glsl */`
uniform float uTime, uStrength, uAspect;
varying vec2 vUv;
float hash(float n) { return fract(sin(n * 91.345) * 47453.21); }
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y + .12);
  float r = length(p), a = atan(p.y, p.x) / 6.2831853 + .5, lane = floor(a * 140.), cell = fract(a * 140.);
  float seed = hash(lane), speed = 1.4 + seed * 1.6, head = fract(seed * 7. - uTime * speed);
  float along = fract(r * 1.1 - uTime * speed * 1.5 + seed);
  float streak = smoothstep(.0, .12, along) * smoothstep(.45, .2, along) * step(.6, seed);
  float thin = 1. - smoothstep(.0, .18, abs(cell - .5));
  float edge = smoothstep(.7, 1.3, r);
  float alpha = streak * thin * edge * uStrength * .5 * (.6 + .4 * head);
  if (alpha < .003) discard;
  gl_FragColor = vec4(vec3(1.), alpha);
}`;

/** Full-screen speed streaks drawn over the scene. Call update with the 0 to 1 speed feel every frame. */
export class SpeedLines {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private strength = 0;
  constructor() {
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uAspect: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1000; this.mesh.visible = false;
  }
  update(dt: number, feel: number, aspect: number) {
    this.strength += (feel - this.strength) * (1 - Math.exp(-dt * 6));
    const u = this.mesh.material.uniforms; u.uTime.value += dt; u.uStrength.value = this.strength; u.uAspect.value = aspect;
    this.mesh.visible = this.strength > .01;
  }
}
