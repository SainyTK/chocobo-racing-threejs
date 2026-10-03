export const vertex = `
attribute vec3 iPos; attribute vec3 iVel; attribute vec4 iColor; attribute vec3 iMisc;
varying vec2 vUv; varying vec4 vColor; varying float vShape;
void main() {
  vUv = position.xy + .5; vColor = iColor; vShape = iMisc.z;
  vec4 mv = viewMatrix * vec4(iPos, 1.);
  vec2 d = (viewMatrix * vec4(iVel, 0.)).xy; float l = length(d);
  vec2 axis = l > 1e-4 ? d / l : vec2(cos(iMisc.y), sin(iMisc.y)); vec2 perp = vec2(axis.y, -axis.x);
  mv.xy += perp * position.x * iMisc.x + axis * position.y * (iMisc.x + l);
  gl_Position = projectionMatrix * mv;
}`;
export const fragment = `
varying vec2 vUv; varying vec4 vColor; varying float vShape;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
void main() {
  vec2 p = vUv * 2. - 1.; float r = length(p), a = 0.;
  if (vShape < .5) { a = pow(max(0., 1. - r), 2.2); a += smoothstep(.35, 0., r) * .6; }
  else if (vShape < 1.5) { float cross = max(0., 1. - abs(p.x) * 7.) * max(0., 1. - abs(p.y)) + max(0., 1. - abs(p.y) * 7.) * max(0., 1. - abs(p.x)); a = cross + pow(max(0., 1. - r), 3.) * .9; }
  else if (vShape < 2.5) { float n = hash(floor((p + 3.) * 3.)) * .25; a = smoothstep(1., .25, r + n) * .8; }
  else if (vShape < 3.5) { a = smoothstep(.12, 0., abs(r - .8)) + smoothstep(.3, 0., abs(r - .8)) * .3; }
  else { a = max(0., 1. - abs(p.x) * 2.2 - abs(p.y) * .9); a = pow(a, .7); }
  if (a < .003) discard;
  gl_FragColor = vec4(vColor.rgb * (ADDITIVE ? a : 1.), ADDITIVE ? 1. : a * vColor.a);
  if (ADDITIVE) gl_FragColor.rgb *= vColor.a;
  #include <colorspace_fragment>
}`;
