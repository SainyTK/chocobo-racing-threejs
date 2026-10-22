import { STONE_KINDS, type StoneKind } from './looks.ts';

/** Index of each kind in the shader's look tables. */
export const kindIndex = (kind: StoneKind) => STONE_KINDS.indexOf(kind);
const K = Object.fromEntries(STONE_KINDS.map((kind, i) => [kind, i])) as Record<StoneKind, number>;

/**
 * The symbol painted on each stone, as 2D distance fields in glyph space: the face of the ball seen head on, with the
 * silhouette at radius 1 and y up. `glyph()` returns the symbol's straight colour and coverage, anti-aliased over
 * `aa` (one screen pixel in glyph units) so it stays crisp at any distance. `g` is the main colour, `a` the accent.
 */
export const GLYPHS = /* glsl */ `
float cover(float d, float aa) { return clamp(.5 - d / aa, 0., 1.); }
float sdSegment(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
float sdBox(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }
float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2, v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0., 1.), pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0., 1.), pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0., 1.);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
/** Lays colour c with coverage k over the layer below. */
vec4 over(vec4 below, vec3 c, float k) { return vec4(mix(below.rgb, c, k), max(below.a, k)); }

// "?": a thick question mark.
vec4 glyphRandom(vec2 p, float aa, vec3 g, vec3 a) {
  vec2 c = vec2(0., .2); float r = .25, an = atan(p.y - c.y, p.x - c.x);
  float arc = abs(length(p - c) - r); if (an < -1.05 && an > -2.75) arc = 1.;
  vec2 tail = c + r * vec2(cos(-1.05), sin(-1.05));
  float d = min(min(arc, sdSegment(p, tail, vec2(0., -.1))), sdSegment(p, vec2(0., -.1), vec2(0., -.17))) - .12;
  d = min(d, length(p - vec2(0., -.45)) - .12);
  return over(vec4(0.), mix(g, a, smoothstep(.0, -.08, d) * .35), cover(d, aa));
}
// Fire: a flame with a white-hot core.
float flame(vec2 p) { return smin(length(p - vec2(0., -.16)) - .3, sdTriangle(p, vec2(-.28, -.1), vec2(.25, -.1), vec2(.04, .62)), .14); }
vec4 glyphFire(vec2 p, float aa, vec3 g, vec3 a) {
  float outer = min(flame(p), flame((p - vec2(.25, -.02)) * 2.1) / 2.1), core = flame((p - vec2(.0, -.17)) * 1.85) / 1.85;
  vec4 c = over(vec4(0.), g * 1.15, cover(outer, aa));
  return over(c, a * 1.3, cover(core, aa));
}
// Ice: an eight-pointed snowflake with a blue outline.
vec4 glyphIce(vec2 p, float aa, vec3 g, vec3 a) {
  float d = 1e9;
  for (int i = 0; i < 4; i++) { float an = float(i) * .7854; vec2 dir = vec2(cos(an), sin(an)) * .58; d = min(d, sdSegment(p, -dir, dir)); }
  float rays = d - .05, hub = length(p) - .13;
  float flake = min(rays, hub);
  vec4 c = over(vec4(0.), a, cover(flake - .045, aa));
  return over(c, g * 1.2, cover(flake, aa));
}
// Thunder: a lightning bolt.
vec4 glyphThunder(vec2 p, float aa, vec3 g, vec3 a) {
  float d = min(sdTriangle(p, vec2(.3, .62), vec2(-.3, -.04), vec2(.14, -.04)), sdTriangle(p, vec2(-.14, .07), vec2(.3, .07), vec2(-.26, -.62)));
  return over(vec4(0.), mix(g, a, smoothstep(0., -.1, d) * .5), cover(d, aa));
}
// Reflect: a glowing violet shield with a white arrow bouncing off it.
vec4 glyphReflect(vec2 p, float aa, vec3 g, vec3 a) {
  vec2 o = vec2(-.12, -.08); float disc = length(p - o) - .48;
  vec4 c = over(vec4(0.), mix(a, g, smoothstep(.04, .4, length(p - o))), cover(disc, aa));
  vec2 tip = vec2(.44, .4), dir = normalize(tip - o), side = vec2(-dir.y, dir.x);
  float arrow = min(sdSegment(p, o, tip - dir * .1) - .04, sdTriangle(p, tip, tip - dir * .24 + side * .15, tip - dir * .24 - side * .15));
  float tail = min(sdSegment(p, o, o + vec2(-.2, .22)), sdSegment(p, o, o + vec2(-.28, -.05))) - .038;
  return over(c, a * 1.1, cover(min(arrow, tail), aa));
}
// Haste: a right-pointing triangle, lit on its upper face and shaded on its lower one.
vec4 glyphHaste(vec2 p, float aa, vec3 g, vec3 a) {
  vec2 A = vec2(-.36, .48), B = vec2(-.36, -.48), T = vec2(.52, 0.), M = vec2(-.12, -.06);
  vec4 c = over(vec4(0.), g, cover(sdTriangle(p, A, M, T), aa));
  c = over(c, g * .92, cover(sdTriangle(p, A, B, M), aa));
  return over(c, a, cover(sdTriangle(p, B, T, M), aa));
}
// Mini: a fat upward arrow, lighter along its middle.
vec4 glyphMini(vec2 p, float aa, vec3 g, vec3 a) {
  float d = min(sdTriangle(p, vec2(-.54, .08), vec2(.54, .08), vec2(0., .64)), sdBox(p - vec2(0., -.2), vec2(.24, .3), .02));
  return over(vec4(0.), mix(g, a, smoothstep(.0, -.2, d) * .35), cover(d, aa));
}
// Doom: a pale skull.
vec4 glyphDoom(vec2 p, float aa, vec3 g, vec3 a) {
  float head = smin(length((p - vec2(0., .1)) * vec2(1., 1.05)) - .4, sdBox(p - vec2(0., -.26), vec2(.22, .16), .07), .1);
  vec2 e = vec2(abs(p.x), p.y);
  float eyes = length((e - vec2(.16, .06)) * vec2(1., 1.15)) - .12, nose = sdTriangle(p, vec2(-.06, -.16), vec2(.06, -.16), vec2(0., -.04));
  float teeth = step(abs(fract(p.x / .09 + .5) - .5) * .09, .012) * step(abs(p.y + .33), .06) * step(abs(p.x), .17);
  vec3 bone = g * mix(.72, 1.06, smoothstep(-.45, .4, p.y));
  vec4 c = over(vec4(0.), bone, cover(head, aa));
  return over(c, a, max(cover(min(eyes, nose), aa), teeth) * c.a);
}
// Ultima: a four-pointed star with a golden heart.
vec4 glyphUltima(vec2 p, float aa, vec3 g, vec3 a) {
  vec2 q = abs(p); float star = (pow(q.x, .55) + pow(q.y, .55)) - pow(.62, .55), core = length(p) - .14;
  vec4 c = over(vec4(0.), g, cover(star / 2.2, aa));
  return over(c, a * 1.2, cover(core, aa));
}
vec4 glyph(int kind, vec2 p, float aa, vec3 g, vec3 a) {
  if (kind == ${K.fire}) return glyphFire(p, aa, g, a);
  if (kind == ${K.ice}) return glyphIce(p, aa, g, a);
  if (kind == ${K.thunder}) return glyphThunder(p, aa, g, a);
  if (kind == ${K.haste}) return glyphHaste(p, aa, g, a);
  if (kind == ${K.shield}) return glyphReflect(p, aa, g, a);
  if (kind == ${K.mini}) return glyphMini(p, aa, g, a);
  if (kind == ${K.doom}) return glyphDoom(p, aa, g, a);
  if (kind == ${K.ultima}) return glyphUltima(p, aa, g, a);
  return glyphRandom(p, aa, g, a);
}
`;
