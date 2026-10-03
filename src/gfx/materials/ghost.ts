import * as THREE from 'three';

/** Translucent holographic look for the saved Time Attack ghost. */
export function ghostMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = -mv.xyz; vY = (modelMatrix*vec4(position,1.)).y; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(clamp(1. - abs(dot(normalize(vN), normalize(vV))), 0., 1.), 2.); float scan = .55 + .45*sin(vY*14. - uTime*6.); gl_FragColor = vec4(vec3(.35,.9,1.)*(f*1.4 + .08)*scan, 1.); }`,
  });
}
