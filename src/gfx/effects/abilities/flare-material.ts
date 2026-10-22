import * as THREE from 'three';
import { FLAP } from './looks.ts';

/** What a flare quad draws. Each glyph reads two shape parameters, `p` and `q`. */
export const enum Glyph {
  /** A tapered blade from the quad's bottom edge to its top. `p` is the tip width, `q` how white its core runs. */
  Ray = 0,
  /** A soft disc. `p` is where the inner colour starts turning to the rim colour, `q` how soft the edge is. */
  Disc = 1,
  /** A glowing feather plume from the bottom edge. `p` is a seed for its barbs, `q` unused. */
  Feather = 2,
}

const vertexShader = /* glsl */`
attribute vec2 corner; attribute vec3 color0, color1; attribute vec4 shape; attribute float cover;
varying vec2 vUv; varying vec3 vC0, vC1; varying vec4 vShape; varying float vCover;
void main() { vUv = corner; vC0 = color0; vC1 = color1; vShape = shape; vCover = cover; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }`;

const fragmentShader = /* glsl */`
uniform vec3 uFeatherGlow;
varying vec2 vUv; varying vec3 vC0, vC1; varying vec4 vShape; varying float vCover;
void main() {
  int glyph = int(vShape.x + .5); float a; vec3 c;
  if (glyph == 0) {
    float y = vUv.y * .5 + .5, w = mix(1., vShape.z, y), x = abs(vUv.x) / max(w, .001);
    a = (1. - smoothstep(.72, 1., x)) * smoothstep(0., .05, y) * (1. - smoothstep(.82, 1., y));
    c = mix(vC0, vC1, smoothstep(.2, .85, y));
    c = mix(c, vec3(1.), (1. - smoothstep(0., .6, x)) * vShape.w * (1. - smoothstep(.1, .55, y)));
  } else if (glyph == 1) {
    float r = length(vUv);
    a = 1. - smoothstep(1. - max(vShape.w, .01), 1., r);
    c = mix(vC0, vC1, smoothstep(vShape.z, 1., r));
  } else {
    // A plume: narrow at the root, widest near the rounded end, with ragged barbs, a white quill, bright dots and a violet halo.
    float y = vUv.y * .5 + .5, x = abs(vUv.x);
    float w = (.22 + .78 * smoothstep(0., .7, y)) * sqrt(max(0., 1. - pow(max(0., (y - .6) / .4), 2.)));
    w *= .82 + .18 * abs(sin(y * 30. + vShape.z * 7.));
    float u = x / max(w, .001), body = 1. - smoothstep(.7, 1., u), halo = exp(-max(0., x - w * .8) * 6.) * (1. - body) * smoothstep(0., .15, y) * (1. - smoothstep(.85, 1., y));
    float quill = exp(-u * u * 14.) * (1. - y * .5), barbs = .5 + .5 * cos(u * 10. - y * 8.);
    vec2 cell = fract(vec2(vUv.x * 2.2 + vShape.z, y * 10.)) - .5; float dots = smoothstep(.2, .06, length(cell)) * smoothstep(.3, .7, u) * body;
    c = mix(vC1, vC0, clamp(quill + dots * .8 + barbs * .25 * (1. - u), 0., 1.)) * body + uFeatherGlow * halo;
    a = clamp(body + halo * .8, 0., 1.);
  }
  a *= vShape.y; if (a < .002) discard;
  // Premultiplied: cover 0 adds light as before, cover 1 paints over the scene like normal alpha blending.
  gl_FragColor = vec4(c * a, a * vCover);
}`;

/** One premultiplied-alpha material draws every flare quad, additive or painted, so all ability effects together cost a single draw call. */
export function flareMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms: { uFeatherGlow: { value: new THREE.Color(FLAP.glowColor) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, premultipliedAlpha: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}
