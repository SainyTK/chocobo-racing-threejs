/** GLSL helpers shared by every orb interior. Interiors work in the orb's unit sphere: |p| <= 1, y up. */
export const common = /* glsl */ `
uniform float uTime;
const float TAU = 6.28318;
float hash11(float n) { return fract(sin(n) * 43758.5453); }
vec3 hash31(float n) { return fract(sin(vec3(n, n + 1.7, n + 3.1)) * vec3(43758.5453, 22578.1459, 19642.349)); }
float hash13(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
vec3 hue(float h) { return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
/** Distance from a ray to a point; tq is the ray parameter of closest approach. */
float rayPoint(vec3 ro, vec3 rd, vec3 p, out float tq) { tq = dot(p - ro, rd); return length(ro + rd * tq - p); }
/** Closest distance between a ray and the segment ab. */
float raySegment(vec3 ro, vec3 rd, vec3 a, vec3 b) {
  vec3 ba = b - a, w = ro - a; float d = dot(rd, ba), bb = dot(ba, ba), den = bb - d * d;
  float s = den > 1e-6 ? clamp((dot(w, ba) - d * dot(w, rd)) / den, 0., 1.) : 0.;
  vec3 r = ro + rd * max(dot(a + ba * s - ro, rd), 0.); s = clamp(dot(r - a, ba) / bb, 0., 1.);
  return length(r - a - ba * s);
}
/** Coordinates on a plane through the centre that always faces the camera, for glyphs such as Doom's clock. */
vec2 billboard(vec3 ro, vec3 rd, out float tp) {
  vec3 n = normalize(ro), u = normalize(cross(vec3(0., 1., 0.), n)), v = cross(n, u);
  tp = -dot(ro, n) / dot(rd, n); vec3 q = ro + rd * tp; return vec2(dot(q, u), dot(q, v));
}
float segment2(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
`;

/** Ray setup shared by every interior: the camera ray in the orb's unit sphere, entry t0 and exit t1. */
export const vertex = /* glsl */ `
varying vec3 vPos; varying vec3 vOrigin;
void main() { vPos = position; vOrigin = (inverse(modelMatrix) * vec4(cameraPosition, 1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

export const fragment = (interior: string) => /* glsl */ `
${common}
varying vec3 vPos; varying vec3 vOrigin;
${interior}
void main() {
  vec3 ro = vOrigin, rd = normalize(vPos - vOrigin);
  float b = dot(ro, rd), h = b * b - dot(ro, ro) + 1.; if (h <= 0.) discard; h = sqrt(h);
  vec4 c = interior(ro, rd, max(-b - h, 0.), -b + h);
  gl_FragColor = vec4(c.rgb, clamp(c.a, 0., 1.));
}`;
