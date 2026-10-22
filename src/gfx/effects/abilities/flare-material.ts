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
  /** Grip-Up's ring: a crescent bulging toward +x with a white outer rim and a jagged, streaky inner edge. `p` re-rolls the teeth, `q` thins it. */
  Crescent = 3,
  /** One Barrier pulse at progress `p`: a frosty bowl rising, a white oval, its cap lifting off and a clear sphere fading. `q` re-rolls the frost. */
  FrostPulse = 4,
  /** Magic Plus's green curtain: a U with streaks hanging above it, at progress `p`. */
  Curtain = 5,
  /** A thin ring; `p` is its width as a share of the radius and `q` mixes the inner colour toward the outer one. */
  Ring = 6,
}

const vertexShader = /* glsl */`
attribute vec2 corner; attribute vec3 color0, color1; attribute vec4 shape; attribute float cover;
varying vec2 vUv; varying vec3 vC0, vC1; varying vec4 vShape; varying float vCover;
void main() { vUv = corner; vC0 = color0; vC1 = color1; vShape = shape; vCover = cover; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }`;

const fragmentShader = /* glsl */`
uniform vec3 uFeatherGlow;
varying vec2 vUv; varying vec3 vC0, vC1; varying vec4 vShape; varying float vCover;
float noise1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
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
  } else if (glyph == 2) {
    // A plume: narrow at the root, widest near the rounded end, with ragged barbs, a white quill, bright dots and a violet halo.
    float y = vUv.y * .5 + .5, x = abs(vUv.x);
    float w = (.22 + .78 * smoothstep(0., .7, y)) * sqrt(max(0., 1. - pow(max(0., (y - .6) / .4), 2.)));
    w *= .82 + .18 * abs(sin(y * 30. + vShape.z * 7.));
    float u = x / max(w, .001), body = 1. - smoothstep(.7, 1., u), halo = exp(-max(0., x - w * .8) * 6.) * (1. - body) * smoothstep(0., .15, y) * (1. - smoothstep(.85, 1., y));
    float quill = exp(-u * u * 14.) * (1. - y * .5), barbs = .5 + .5 * cos(u * 10. - y * 8.);
    vec2 cell = fract(vec2(vUv.x * 2.2 + vShape.z, y * 10.)) - .5; float dots = smoothstep(.2, .06, length(cell)) * smoothstep(.3, .7, u) * body;
    c = mix(vC1, vC0, clamp(quill + dots * .8 + barbs * .25 * (1. - u), 0., 1.)) * body + uFeatherGlow * halo;
    a = clamp(body + halo * .8, 0., 1.);
  } else if (glyph == 3) {
    float ang = atan(vUv.y, vUv.x + .45 - vShape.w * .25), inner = .82 + .14 * noise1(floor(ang * 7. + vShape.z));
    float dOut = 1. - length(vUv), dIn = length(vUv - vec2(-.45 + vShape.w * .25, 0.)) - inner, streak = noise1(floor(ang * 23. + vShape.z * 1.7));
    a = smoothstep(0., .07, dOut) * smoothstep(-.3 * streak - .02, .06, dIn);
    c = mix(vC1, vC0, 1. - smoothstep(.02, .2, dOut)) * mix(.62, 1., smoothstep(-.15, .08, dIn));
  } else if (glyph == 4) {
    float k = vShape.z; vec2 e = vec2(vUv.x, (vUv.y + .15) / .8); float r = length(e), spike = .08 * noise1(floor(atan(e.y, e.x) * 9. + vShape.w * 5.)), body = 1. - smoothstep(.9 - spike, 1. - spike, r);
    float fx = vUv.x * 26. + vShape.w * 3.1, frost = .06 * mix(noise1(floor(fx)), noise1(floor(fx) + 1.), smoothstep(0., 1., fract(fx)));
    if (k < .33) {
      float top = mix(-.95, .35, k / .33) + frost;
      a = body * (1. - smoothstep(top - .04, top + .04, e.y)) * .9; c = mix(vC1, vC0, smoothstep(top - .5, top, e.y));
    } else if (k < .45) {
      a = body * .97; c = mix(vec3(1.), vC1, smoothstep(.75, 1., r));
    } else {
      float lift = smoothstep(.45, .7, k) * .45, fade = 1. - smoothstep(.55, 1., k);
      vec2 ce = vec2(e.x, e.y - lift); float cap = (1. - smoothstep(.93, 1., length(ce))) * smoothstep(.3 + frost, .4 + frost, ce.y) * (1. - smoothstep(.55, .75, k));
      float shell = body * mix(.22, .75, r * r * r) * fade;
      a = clamp(shell + cap, 0., 1.); c = mix(mix(vC1, vC0, r * r), vC0, cap / max(a, .001));
    }
  } else if (glyph == 5) {
    float x = vUv.x, y = vUv.y * .5 + .5, curve = x * x * .9, d = y - curve;
    float edge = exp(-d * d * 160.), hang = smoothstep(0., .04, d) * (1. - smoothstep(.0, .55, d)) * (.55 + .45 * noise1(floor(x * 18.)));
    a = clamp(edge + hang * .7, 0., 1.) * (1. - smoothstep(.85, 1., abs(x))); c = mix(vC1, vC0, smoothstep(.0, .3, d)) + vec3(edge * .5);
  } else {
    float r = length(vUv), w = max(vShape.z, .005), d = (r - (1. - w)) / w;
    a = exp(-d * d * 2.5); c = mix(vC0, vC1, vShape.w);
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
