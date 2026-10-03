import * as THREE from 'three';

/** Thin glass shell: a coloured fresnel rim, a soft window highlight, a pin-point glint and a faint sky reflection. `rainbow` makes the rim iridescent. */
export function glassMaterial(rim: string, rainbow = false) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uRim: { value: new THREE.Color(rim) }, uRainbow: { value: rainbow ? 1 : 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uRim; uniform float uRainbow, uTime; varying vec3 vN; varying vec3 vV;
      vec3 hue(float h) { return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
      void main(){ vec3 n = normalize(vN), v = normalize(vV), r = reflect(-v, n); float f = pow(1. - clamp(dot(n, v), 0., 1.), 2.6);
        float window = smoothstep(.17, .1, length((n.xy - vec2(-.4, .46)) * vec2(1.15, 1.7))) * .8, glint = pow(max(dot(r, normalize(vec3(-.3, .45, .84))), 0.), 900.);
        float fill = pow(max(dot(r, normalize(vec3(.65, -.35, .68))), 0.), 14.) * .3, sky = smoothstep(-.05, .25, r.y) * f;
        vec3 rim = mix(uRim, hue(atan(n.y, n.x) / 6.2832 + uTime * .15) * .9 + .15, uRainbow);
        vec3 c = rim * f * 1.7 + vec3(1.) * (window * 1.4 + glint * 5. + fill) + vec3(.75, .85, 1.) * sky * .25;
        gl_FragColor = vec4(c, clamp(f * .8 + window * .5 + glint + fill * .6 + .03, 0., 1.)); }`,
  });
}
