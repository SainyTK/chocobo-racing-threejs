import * as THREE from 'three';

/** Flat ground decal: an expanding ring for shockwaves, or a frost / rune disc. */
export function decalMaterial(kind: 'ring' | 'frost' | 'rune', color: string) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uProgress: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime, uProgress, uOpacity; varying vec2 vUv;
      float hash(float n){ return fract(sin(n) * 43758.5453); }
      void main(){ vec2 p = vUv * 2. - 1.; float r = length(p), a = atan(p.y, p.x), o = 0.;
        ${kind === 'ring' ? `o = smoothstep(.16, 0., abs(r - .82)) * (1. - uProgress) + smoothstep(.5, 0., abs(r - .7)) * .25 * (1. - uProgress);` : ''}
        ${kind === 'frost' ? `float rays = pow(abs(sin(a * 7. + hash(floor(a * 3.)) * 3.)), 6.) * smoothstep(1., .2, r); o = smoothstep(1., .55, r) * .35 + rays * .5 + smoothstep(.1, 0., abs(r - .9)) * .5;` : ''}
        ${kind === 'rune' ? `float ring1 = smoothstep(.04, 0., abs(r - .85)) + smoothstep(.03, 0., abs(r - .7)); float tick = smoothstep(.1, 0., abs(fract(a / 6.2832 * 12. + uTime * .2) - .5) - .38) * step(.7, r) * step(r, .85); float star = smoothstep(.04, 0., abs(sin(a * 2.5 - uTime) * .55 - r * .6)) * step(r, .7); o = ring1 + tick + star * .6;` : ''}
        o *= smoothstep(1., .96, r);
        gl_FragColor = vec4(uColor * o * uOpacity * 2., 1.); }`,
  });
}
