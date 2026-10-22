import * as THREE from 'three';

/** Faceted crystal shading via screen-space derivatives. Shared by ice traps and the Blizzaga freeze shell. */
export function crystalMaterial(color: string, o: { opacity?: number; intensity?: number } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: o.opacity ?? .9 }, uIntensity: { value: o.intensity ?? 1 } },
    vertexShader: `varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uIntensity; varying vec3 vV;
      void main(){ vec3 cr = cross(dFdx(vV), dFdy(vV)); vec3 n = length(cr) > 1e-12 ? normalize(cr) : vec3(0., 1., 0.); vec3 e = normalize(vV); float f = pow(clamp(1. - abs(dot(n, e)), 0., 1.), 1.6);
        vec3 base = uColor;
        vec3 l = normalize(vec3(.4, .8, .3)); float spec = pow(max(0., dot(reflect(-e, n), l)), 24.);
        float facet = .55 + .45 * dot(n, vec3(.2, .7, .4));
        vec3 c = base * (.35 + facet * .7) + mix(base, vec3(1.), .6) * f * 1.3 + vec3(spec * 2.4);
        gl_FragColor = vec4(c * uIntensity, mix(uOpacity, 1., f * .6)); }`,
  });
}
