import * as THREE from 'three';

export const padGeo = new THREE.PlaneGeometry(4.8, 7).rotateX(-Math.PI / 2);
/** Boost pads: scrolling chevrons that read clearly from the chase camera. */
export const padMaterial = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, uniforms: { uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ vec2 p = vUv; float edge = step(.06, p.x) * step(p.x, .94) * step(.03, p.y) * step(p.y, .97);
    float chev = fract((1. - p.y) * 3.5 + abs(p.x - .5) * 1.6 - uTime * 1.8); float c = smoothstep(.0, .06, chev) * smoothstep(.5, .42, chev);
    vec3 base = mix(vec3(.85, .38, .06), vec3(1., .62, .12), p.y); vec3 col = mix(base * .7, vec3(2.2, 1.7, .7), c) ;
    gl_FragColor = vec4(mix(vec3(1., .85, .4), col, edge), .95); }`,
});
export const makeBoostPad = () => new THREE.Mesh(padGeo, padMaterial);
