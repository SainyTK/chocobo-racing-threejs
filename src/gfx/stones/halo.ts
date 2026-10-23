import * as THREE from 'three';
import { LEVEL_FLASH, LEVEL_FLASH_GLSL } from './level-flash.ts';

/** The halo quad reaches this far from the ball's centre, in stone radii: the end of the ring and its soft edge. */
const EXTENT = LEVEL_FLASH.ringRadius + LEVEL_FLASH.ringWidth;
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

const vertex = /* glsl */ `
attribute float aPhase; varying vec2 vUv; varying float vPhase;
void main() {
  // A camera-facing quad, pushed in front of the ball so the disc covers the ball it grows out of.
  mat4 mv = modelViewMatrix * instanceMatrix;
  vec3 centre = (mv * vec4(0., 0., 0., 1.)).xyz; float radius = length((mv * vec4(1., 0., 0., 0.)).xyz);
  vUv = position.xy * ${EXTENT.toFixed(3)}; vPhase = aPhase;
  gl_Position = projectionMatrix * vec4(centre + normalize(-centre) * radius * 1.3 + vec3(vUv * radius, 0.), 1.);
}`;

const fragment = /* glsl */ `
uniform float uTime; varying vec2 vUv; varying float vPhase;
${LEVEL_FLASH_GLSL}
void main() {
  float s = flashClock(vPhase, PERIOD_3), r = length(vUv);
  vec4 c = vec4(0.);
  if (s < FLASH) {
    // A white disc swells out of the ball, warmer toward its soft edge.
    float edge = mix(FLASH_FROM, FLASH_TO, s / FLASH);
    c = vec4(mix(vec3(1.), vec3(1., .96, .74), smoothstep(.5, edge, r)), (1. - smoothstep(edge - .25, edge, r)) * .96);
  } else if (s < FLASH + RING) {
    // It opens into a pale yellow ring that keeps growing and turns yellow-green as it fades.
    float u = (s - FLASH) / RING, at = mix(FLASH_TO, RING_TO, u);
    c = vec4(mix(vec3(1., .96, .6), vec3(.8, .84, .34), u), (1. - smoothstep(0., RING_WIDTH, abs(r - at))) * (1. - u * u));
  }
  if (c.a < .01) discard;
  gl_FragColor = c;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** The growing flash and ring of every level 3 stack, in one draw call. Positions and phases match their stones. */
export class LevelHalos {
  readonly mesh: THREE.InstancedMesh;
  private phases: THREE.InstancedBufferAttribute;
  private material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false });
  constructor(capacity: number) {
    const g = new THREE.PlaneGeometry(2, 2); this.phases = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1); this.phases.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aPhase', this.phases);
    this.mesh = new THREE.InstancedMesh(g, this.material, capacity); this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, hidden);
  }
  set time(t: number) { this.material.uniforms.uTime.value = t; }
  /** Halo `i` for a ball whose matrix places and sizes it, on the ball's flash `phase`. */
  set(i: number, matrix: THREE.Matrix4, phase: number) { this.mesh.setMatrixAt(i, matrix); this.phases.setX(i, phase); }
  commit(count: number) { this.mesh.count = count; this.mesh.visible = count > 0; this.mesh.instanceMatrix.needsUpdate = true; this.phases.needsUpdate = true; }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}
