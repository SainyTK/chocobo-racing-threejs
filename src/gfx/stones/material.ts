import * as THREE from 'three';
import { GLYPHS } from './glyphs.ts';
import { LEVEL_FLASH_GLSL } from './level-flash.ts';
import { CENTRED_KINDS, STONE_KINDS, STONE_LOOKS } from './looks.ts';

const table = (pick: (kind: typeof STONE_KINDS[number]) => string) => STONE_KINDS.map(kind => new THREE.Color(pick(kind)));
const N = STONE_KINDS.length;

const vertex = /* glsl */ `
attribute float aKind; attribute vec4 aState;
uniform float uTime; uniform float uSway[${N}];
varying vec3 vN; varying vec3 vView; varying vec3 vF; varying vec3 vR; varying vec3 vU; varying vec4 vState; flat varying int vKind;
void main() {
  mat4 mv = modelViewMatrix * instanceMatrix;
  vec4 p = mv * vec4(position, 1.), centre = mv * vec4(0., 0., 0., 1.);
  vN = normalize(mat3(mv) * normal); vView = -p.xyz; vState = aState; vKind = int(aKind + .5);
  // The symbol faces the camera and rocks gently: it sways a little to each side and rolls back and forth. A centred
  // symbol only rolls, so it never slides off the middle of the ball.
  vec3 f = normalize(-centre.xyz), r = normalize(cross(vec3(0., 1., 0.), f)), u = cross(f, r);
  float sway = sin(uTime * 1.7 + aState.x) * .32 * uSway[vKind], roll = sin(uTime * 1.13 + aState.x * 1.3) * .22;
  vec3 f2 = f * cos(sway) + r * sin(sway), r2 = r * cos(sway) - f * sin(sway);
  vF = f2; vR = r2 * cos(roll) + u * sin(roll); vU = u * cos(roll) - r2 * sin(roll);
  gl_Position = projectionMatrix * p;
}`;

const fragment = /* glsl */ `
uniform float uTime; uniform vec3 uBody[${N}]; uniform vec3 uGlyph[${N}]; uniform vec3 uAccent[${N}];
varying vec3 vN; varying vec3 vView; varying vec3 vF; varying vec3 vR; varying vec3 vU; varying vec4 vState; flat varying int vKind;
${GLYPHS}
/** The symbol spans this much of the ball's face. */
const float GLYPH_SCALE = 1.22;
${LEVEL_FLASH_GLSL}
void main() {
  vec3 n = normalize(vN), v = normalize(vView);
  vec2 q = vec2(dot(n, vR), dot(n, vU)) / GLYPH_SCALE;
  float aa = max(length(fwidth(q)), 1e-4);
  vec4 sym = dot(n, vF) > 0. ? glyph(vKind, q, aa, uGlyph[vKind], uAccent[vKind]) : vec4(0.);
  // Toon body: a light from the upper left of the screen, three soft bands, a crisp highlight and a darker rim.
  vec3 L = normalize(vec3(-.45, .62, .64));
  float lit = dot(n, L) * .5 + .5, band = .58 + .22 * smoothstep(.36, .44, lit) + .2 * smoothstep(.7, .78, lit);
  vec3 col = mix(uBody[vKind] * band, sym.rgb * mix(.86, 1.04, lit), sym.a);
  float hl = dot(n, normalize(L + v)), rim = 1. - max(dot(n, v), 0.);
  col *= 1. - .3 * smoothstep(.5, 1., rim);
  col += vec3(1.) * (smoothstep(.95, .985, hl) * .62 + smoothstep(.86, .97, hl) * .14);
#ifndef PUFF
  // A held stack shows its level with a bright band sweeping down the ball (see LEVEL_FLASH); w is the stack's level.
  if (vState.w > 1.5) col = mix(col, vec3(1.), sweepBand(vState.w, dot(n, vU), flashClock(vState.x, vState.w > 2.5 ? PERIOD_3 : PERIOD_2)) * smoothstep(0., .3, dot(n, v)) * .9);
#endif
  // Magic Plus flips the raised stone to black while it works.
  if (vState.y > 0. && fract(uTime * vState.y + vState.x * .16) > .5) col *= .07;
#ifdef PUFF
  // A picked stone bursts into a bright, soft smear of its own colours that fades out.
  float edge = smoothstep(0., .6, max(dot(n, v), 0.));
  gl_FragColor = vec4(col * (1. - vState.w) * edge * 1.5, 1.);
#else
  gl_FragColor = vec4(col, vState.z);
#endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** The stone shader. The puff variant draws additively for the pickup burst. */
export function stoneMaterial(puff = false) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, defines: puff ? { PUFF: '' } : {},
    transparent: true, depthWrite: !puff, blending: puff ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 }, uSway: { value: STONE_KINDS.map(k => CENTRED_KINDS.includes(k) ? 0 : 1) }, uBody: { value: table(k => STONE_LOOKS[k].body) }, uGlyph: { value: table(k => STONE_LOOKS[k].glyph) },
      uAccent: { value: table(k => STONE_LOOKS[k].accent) },
    },
  });
}

/** Soft dark blob under a floating stone. `aState.z` fades it with its stone. */
export function shadowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: /* glsl */ `attribute vec4 aState; varying vec2 vUv; varying float vFade; void main() { vUv = uv * 2. - 1.; vFade = aState.z; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */ `varying vec2 vUv; varying float vFade; void main() { float r = length(vUv); gl_FragColor = vec4(0., 0., 0., smoothstep(1., .25, r) * .42 * vFade); }`,
  });
}
