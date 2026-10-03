import * as THREE from 'three';

const fresnelVertex = `varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec2 vUv; uniform float uTime; uniform float uWobble;
void main(){ vUv = uv; vP = position; vec3 p = position * (1. + uWobble * sin(position.y * 9. + uTime * 21.) * sin(position.x * 7. - uTime * 17.));
  vec4 mv = modelViewMatrix * vec4(p, 1.); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;

/** Additive fresnel shell. Used for fireball cores, Ultima, shields and auras. */
export function shell(inner: string, edge: string, o: { power?: number; intensity?: number; wobble?: number; hex?: boolean; opacity?: number } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uTime: { value: 0 }, uInner: { value: new THREE.Color(inner) }, uEdge: { value: new THREE.Color(edge) }, uPower: { value: o.power ?? 2 }, uIntensity: { value: o.intensity ?? 2 }, uWobble: { value: o.wobble ?? 0 }, uOpacity: { value: o.opacity ?? 1 } },
    vertexShader: fresnelVertex,
    fragmentShader: `uniform float uTime, uPower, uIntensity, uOpacity; uniform vec3 uInner, uEdge; varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec2 vUv;
      void main(){ float f = pow(clamp(1. - abs(dot(normalize(vN), normalize(vV))), 0., 1.), uPower); vec3 c = mix(uInner, uEdge, f) * (.35 + f * 1.2);
        ${o.hex ? `vec2 h = vec2(vUv.x * 28., vUv.y * 14. - uTime * .6); vec2 g = abs(fract(h + vec2(.5 * floor(mod(h.y, 2.)), 0.)) - .5); float line = smoothstep(.06, 0., abs(max(g.x * 1.5 + g.y, g.y * 2.) - .5)); c += uEdge * line * (.4 + .6 * f);` : ''}
        c *= .88 + .12 * sin(uTime * 37. + vP.y * 11.);
        gl_FragColor = vec4(c * uIntensity * uOpacity, 1.); }`,
  });
}
