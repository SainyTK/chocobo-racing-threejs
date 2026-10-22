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
// Ice: a cut ice crystal seen point on, a tall diamond in four lit facets: pale upper left, cyan upper right, teal lower
// left and navy lower right.
vec4 glyphIce(vec2 p, float aa, vec3 g, vec3 a) {
  p /= 1.12; aa /= 1.12;
  vec2 T = vec2(.04, .5), B = vec2(.1, -.52), L = vec2(-.38, -.02), R = vec2(.52, -.04), C = vec2(.14, -.06);
  vec4 c = over(vec4(0.), mix(g, vec3(1.), .55), cover(sdTriangle(p, T, L, C), aa));
  c = over(c, g, cover(sdTriangle(p, T, C, R), aa));
  c = over(c, g * vec3(.45, .7, .72), cover(sdTriangle(p, L, B, C), aa));
  return over(c, a, cover(sdTriangle(p, C, B, R), aa));
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
// Mini: a little navy man with his arms and legs spread, pale inside his outline, and two shrink strokes over his
// left shoulder.
vec4 glyphMini(vec2 p, float aa, vec3 g, vec3 a) {
  vec2 hip = vec2(.02, -.22), neck = vec2(.02, .2);
  float limbs = min(min(sdSegment(p, neck, hip), sdSegment(p, vec2(-.44, .0), vec2(.46, .0))),
    min(sdSegment(p, hip, vec2(-.3, -.58)), sdSegment(p, hip, vec2(.34, -.58))));
  float head = length((p - vec2(.04, .36)) * vec2(.8, 1.15)) - .15;
  vec2 q = p - vec2(-.32, .4);
  float strokes = min(sdSegment(q, vec2(-.18, -.08), vec2(.1, .12)), sdSegment(q, vec2(-.06, -.2), vec2(.22, 0.))) - .055;
  vec4 c = over(vec4(0.), g, cover(min(min(limbs - .13, head), strokes), aa));
  return over(c, a, cover(limbs - .065, aa));
}
// Haste: a fat upward arrow, magenta at the head and darkening to purple down the stem.
vec4 glyphHaste(vec2 p, float aa, vec3 g, vec3 a) {
  float d = min(sdTriangle(p, vec2(-.54, .08), vec2(.54, .08), vec2(0., .64)), sdBox(p - vec2(0., -.2), vec2(.24, .3), .02));
  return over(vec4(0.), mix(g, a, smoothstep(.05, -.5, p.y)), cover(d, aa));
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
// Ultima: a pale burst of light filling a slate-blue face inside the gold rim: long straight and diagonal rays, short rays
// between them and a white-hot heart.
vec4 glyphUltima(vec2 p, float aa, vec3 g, vec3 a) {
  float r = length(p), an = atan(p.y, p.x);
  vec4 c = over(vec4(0.), a, cover(r - .66, aa));
  // Distance to the nearest of 16 rays: the 8 main ones reach the rim, the 8 between them stop short.
  float sector = .3927, k = floor(an / sector + .5), off = an - k * sector;
  float reach = mod(k, 2.) < .5 ? (mod(k, 4.) < .5 ? .74 : .66) : .46;
  float ray = abs(sin(off)) * r + max(r - reach, 0.) - mix(.075, .015, clamp(r / reach, 0., 1.));
  c = over(c, g, cover(ray, aa));
  return over(c, vec3(1.), smoothstep(.3, .05, r));
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
