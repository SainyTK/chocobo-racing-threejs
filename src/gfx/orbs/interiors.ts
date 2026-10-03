import type { PickupKind } from '../effects/pickup.ts';

/**
 * One GLSL `interior(ro, rd, t0, t1)` per Magic Stone. Each returns premultiplied HDR colour and coverage for the
 * camera ray between entry t0 and exit t1 of the orb's unit sphere. Values above 1 feed the bloom pass.
 * DETAIL (1 on High quality, .5 below) scales the ray-march step counts.
 */
export const INTERIORS: Record<PickupKind, string> = {
  // A candle-like flame licking upward from the bottom of the orb, with embers rising off the tip.
  fire: /* glsl */ `
  vec3 fireRamp(float x) { return mix(mix(vec3(.9, .1, .01), vec3(3.2, .95, .1), smoothstep(0., .45, x)), vec3(4.6, 3.7, 1.9), smoothstep(.55, 1., x)); }
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    const int N = int(36. * DETAIL); float dt = (t1 - t0) / float(N), j = hash13(vec3(gl_FragCoord.xy, 1.)), T = 1.; vec3 col = vec3(0.);
    for (int i = 0; i < N; i++) {
      vec3 p = ro + rd * (t0 + (float(i) + j) * dt);
      float h = clamp((p.y + .62) / 1.38, 0., 1.);
      vec3 q = p * vec3(3.2, 1.6, 3.2) - vec3(0., uTime * 3.2, 0.);
      vec2 xz = p.xz + (vec2(noise(q), noise(q + 7.3)) - .5) * .5 * h + vec2(sin(uTime * 2.7 + p.y * 3.) * .05 * h, 0.);
      float tongues = .75 + .5 * noise(vec3(atan(xz.y, xz.x) * 1.6, p.y * 2. - uTime * 2.4, 3.));
      float width = .44 * pow(1. - h, .62) * smoothstep(0., .07, h) * tongues, d = width - length(xz);
      float flame = smoothstep(-.015, .05, d), heat = clamp(d / max(width, .01), 0., 1.) * (1. - h * .55) + (1. - h) * .12;
      vec3 e = fireRamp(heat) * flame * 2.6 + vec3(.25, .45, 2.2) * flame * smoothstep(.16, .02, h) * smoothstep(.0, .25, heat) * .9;
      e += vec3(1.6, .35, .04) * exp(-max(-d, 0.) * 14.) * .12 * (1. - h);
      col += T * e * dt; T *= exp(-flame * 2.5 * dt);
    }
    for (int k = 0; k < 9; k++) {
      float fk = float(k), life = fract(uTime * .55 + hash11(fk * 3.7)), tq; vec3 s = hash31(fk * 9.1) - .5;
      vec3 pos = vec3(s.x * .4 + sin(uTime * 2. + fk) * .07 * life, -.2 + life * .95, s.z * .4);
      float d = rayPoint(ro, rd, pos, tq); col += vec3(4., 1.6, .3) * exp(-d * d / .0004) * (1. - life) * 1.4;
    }
    col += vec3(.35, .07, .01) * (t1 - t0) * .08;
    return vec4(col, 1. - T * .9);
  }`,

  // A tumbling ice cube with frosted edges, inner cracks and bubbles, refracting snow that drifts down behind it.
  ice: /* glsl */ `
  mat3 R;
  float cube(vec3 p) { vec3 q = abs(R * p) - vec3(.42) + .08; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - .08; }
  vec3 cubeNormal(vec3 p) { vec2 e = vec2(.002, -.002); return normalize(e.xyy * cube(p + e.xyy) + e.yyx * cube(p + e.yyx) + e.yxy * cube(p + e.yxy) + e.xxx * cube(p + e.xxx)); }
  vec3 env(vec3 d) { return mix(vec3(.04, .12, .24), vec3(1., 1.08, 1.15), smoothstep(-.4, .9, d.y)) + vec3(5.) * pow(max(dot(d, normalize(vec3(-.4, .8, .5))), 0.), 70.); }
  float snow(vec3 ro, vec3 rd, float tmax) {
    float s = 0., tq;
    for (int k = 0; k < int(20. * DETAIL); k++) { float fk = float(k); vec3 h = hash31(fk * 5.3); vec3 pos = vec3((h.x - .5) * 1.3 + sin(uTime + fk) * .05, .8 - 1.6 * fract(h.y + uTime * .11), (h.z - .5) * 1.3); if (length(pos) > .92) continue; float d = rayPoint(ro, rd, pos, tq); s += step(0., tq) * step(tq, tmax) * exp(-d * d / .00045); }
    return s;
  }
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    R = rotX(.55 + sin(uTime * .5) * .25) * rotY(uTime * .7);
    vec3 haze = vec3(.25, .5, .75) * (t1 - t0) * .06;
    float t = t0; bool hit = false;
    for (int i = 0; i < 48; i++) { float d = cube(ro + rd * t); if (d < .0015) { hit = true; break; } t += d; if (t > t1) break; }
    if (!hit) { vec3 c = vec3(1.7, 2., 2.3) * snow(ro, rd, t1) + haze; return vec4(c, clamp(c.b * .4, 0., .5)); }
    vec3 p = ro + rd * t, n = cubeNormal(p), rIn = refract(rd, n, 1. / 1.31);
    float fres = .04 + .96 * pow(1. - max(dot(-rd, n), 0.), 5.), ti = 0.; vec3 veins = vec3(0.);
    for (int k = 0; k < int(16. * DETAIL); k++) {
      ti += .05 / DETAIL; vec3 q = R * (p + rIn * ti); if (cube(p + rIn * ti) > 0.) break;
      float crack = smoothstep(.04, 0., abs(noise(q * 6.5) - .5)) * smoothstep(.2, .45, noise(q * 2.3 + 4.));
      float bubble = smoothstep(.82, .9, noise(q * 17. + 3.));
      veins += (vec3(.85, .95, 1.) * crack * 1.6 + bubble * .9) * .05 / DETAIL;
    }
    vec3 pe = p + rIn * ti, ne = -cubeNormal(pe), rOut = refract(rIn, ne, 1.31); if (dot(rOut, rOut) < .01) rOut = reflect(rIn, ne);
    vec3 behind = vec3(1.7, 2., 2.3) * snow(pe, rOut, 2.) + env(rOut) * .25;
    vec3 q = abs(R * p); float edge = smoothstep(.3, .4, min(max(q.x, q.y), min(max(q.y, q.z), max(q.x, q.z))));
    vec3 col = (behind + vec3(.4, .75, 1.) * .45 + veins) * exp(-ti * vec3(2.4, .95, .45)) + env(reflect(rd, n)) * fres + vec3(.85, .95, 1.) * edge * .55;
    return vec4(col + haze, .94);
  }`,

  // A plasma globe: jagged filaments crawl from a hot electrode to the glass and flicker many times a second.
  thunder: /* glsl */ `
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    vec3 col = vec3(0.); float tq, flick = floor(uTime * 18.);
    float dc = rayPoint(ro, rd, vec3(0.), tq);
    col += vec3(3., 3.2, 2.6) * smoothstep(.12, .09, dc) + vec3(.6, 1.6, .8) * exp(-dc * dc / .03);
    for (int i = 0; i < 6; i++) {
      float fi = float(i), bright = .65 + .35 * hash11(fi + flick * 7.);
      vec3 dir = normalize(vec3(sin(uTime * .9 + fi * 2.1 + sin(uTime * .37 + fi)), cos(uTime * .7 + fi * 1.3) * .9, cos(uTime * .8 + fi * 2.1)));
      vec3 s1 = normalize(cross(dir, vec3(.1, 1., .2))), s2 = cross(dir, s1), prev = dir * .1;
      for (int k = 1; k <= 7; k++) {
        float f = float(k) / 7.; vec3 jit = hash31(fi * 31. + float(k) * 7. + flick * 13.) - .5;
        vec3 cur = dir * mix(.1, .93, f) + (s1 * jit.x + s2 * jit.y) * .22 * sin(f * 3.1416);
        float d = raySegment(ro, rd, prev, cur);
        col += (vec3(2.6, 3., 2.6) * exp(-d * d / .00012) + vec3(.35, 1., .5) * exp(-d * d / .004) * .45) * bright; prev = cur;
      }
      float ds = rayPoint(ro, rd, prev, tq); col += vec3(.8, 2., 1.) * exp(-ds * ds / .004) * bright;
    }
    col += vec3(.06, .2, .1) * (t1 - t0) * .5;
    return vec4(col, clamp(max(col.g, col.r) * .4, 0., .85));
  }`,

  // A whirlwind: three wind bands spiral up a funnel, spinning fast.
  haste: /* glsl */ `
  float funnel(float y) { return .12 + .5 * pow(smoothstep(-.8, .8, y), 1.4); }
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    const int N = int(34. * DETAIL); float dt = (t1 - t0) / float(N), j = hash13(vec3(gl_FragCoord.xy, 2.)), T = 1., tq; vec3 col = vec3(0.);
    for (int i = 0; i < N; i++) {
      vec3 p = ro + rd * (t0 + (float(i) + j) * dt);
      float r = length(p.xz), a = atan(p.z, p.x), f = funnel(p.y), wall = exp(-pow((r - f) / (.05 + .06 * f), 2.));
      float bands = pow(.5 + .5 * sin(a * 2. + p.y * 15. - uTime * 14.), 4.);
      float gusts = smoothstep(.35, .75, noise(vec3(a * 1.5 - uTime * 4., p.y * 3., 1.)));
      float d = wall * (bands * (.5 + gusts) + .08) * smoothstep(.97, .82, length(p)) * smoothstep(-.88, -.7, p.y);
      col += T * mix(vec3(.08, .65, .55), vec3(1.7, 2.7, 2.5), bands * gusts) * d * 4.5 * dt; T *= exp(-d * 1.1 * dt);
    }
    for (int k = 0; k < 12; k++) {
      float fk = float(k), life = fract(uTime * .45 + hash11(fk * 1.9)), y = -.72 + life * 1.45, a = fk * 2.4 + uTime * 9. * (1.2 - life * .5);
      vec3 pos = vec3(cos(a), 0., sin(a)) * funnel(y) * 1.1 + vec3(0., y, 0.);
      float d = rayPoint(ro, rd, pos, tq); col += vec3(1.5, 2.6, 2.3) * exp(-d * d / .0003) * sin(life * 3.1416);
    }
    return vec4(col, 1. - T);
  }`,

  // A mirror ball inside a hexagonal barrier: the ball reflects a pink-lit room, the barrier turns slowly.
  shield: /* glsl */ `
  vec3 room(vec3 d) {
    vec3 c = mix(vec3(.3, .1, .28), vec3(1.1, .5, 1.), smoothstep(-.6, .7, d.y)) + vec3(2.2, 1.6, 2.1) * smoothstep(.035, 0., abs(d.y - .02));
    c += vec3(2.6, 1.3, 2.3) * smoothstep(.92, .97, sin(atan(d.z, d.x) * 6. + uTime * .6)) * smoothstep(.12, .3, d.y) * smoothstep(.85, .6, d.y);
    return c + vec3(5.) * smoothstep(.95, .98, dot(d, normalize(vec3(-.5, .6, .6))));
  }
  float hex(vec3 p) {
    vec2 uv = vec2(atan(p.z, p.x) / TAU * 18. + uTime * .3, acos(clamp(p.y / length(p), -1., 1.)) / 3.1416 * 9.);
    vec2 g = abs(fract(uv + vec2(.5 * floor(mod(uv.y, 2.)), 0.)) - .5);
    return smoothstep(.07, 0., abs(max(g.x * 1.5 + g.y, g.y * 2.) - .5)) * smoothstep(.98, .8, abs(p.y / length(p)));
  }
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    vec3 col = vec3(0.); float a = 0.;
    float b = dot(ro, rd), h = b * b - dot(ro, ro) + .74 * .74;
    if (h > 0.) { h = sqrt(h); float fr = -b - h, bk = -b + h; col += vec3(1., .4, .9) * hex(ro + rd * bk) * .5; vec3 p = ro + rd * fr; float rim = pow(1. - abs(dot(rd, normalize(p))), 2.); col += vec3(1.2, .45, 1.) * (hex(p) * 1.4 + rim * .6); a = .25; }
    h = b * b - dot(ro, ro) + .4 * .4;
    if (h > 0.) { vec3 p = ro + rd * (-b - sqrt(h)), n = normalize(p); float fres = .5 + .5 * pow(1. - max(dot(-rd, n), 0.), 3.); col = col * .25 + room(reflect(rd, n)) * vec3(1., .82, .95) * fres; a = .97; }
    return vec4(col, a);
  }`,

  // Shrinking bubbles: rings collapse toward a bright point while sparkles spiral inward.
  mini: /* glsl */ `
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    vec3 col = vec3(0.); float tq, dc = rayPoint(ro, rd, vec3(0.), tq);
    for (int k = 0; k < 3; k++) {
      float phase = fract(uTime * .42 + float(k) / 3.), R = mix(.9, .03, phase), w = .02 + .03 * R;
      col += vec3(.8, .55, 1.4) * (exp(-pow((dc - R) / w, 2.)) * 1.6 + smoothstep(R, R * .7, dc) * .12) * smoothstep(0., .2, phase) * (.6 + phase * 1.6);
    }
    col += vec3(2.4, 1.9, 3.) * exp(-dc * dc / .004) + vec3(.5, .3, .9) * exp(-dc * dc / .08) * .5;
    for (int k = 0; k < 14; k++) {
      float fk = float(k), life = fract(uTime * .35 + hash11(fk * 2.3)), rr = .85 * (1. - life), an = hash11(fk) * TAU + life * 5.;
      vec3 pos = vec3(cos(an) * rr, (hash11(fk * 7.7) - .5) * 1.1 * rr, sin(an) * rr); float d = rayPoint(ro, rd, pos, tq);
      col += vec3(1.6, 1.2, 2.4) * exp(-d * d / .0006) * smoothstep(0., .2, life);
    }
    return vec4(col, clamp(col.b * .35, 0., .7));
  }`,

  // A ten-second clock face glowing in churning curse smoke. The hand completes one turn per countdown.
  doom: /* glsl */ `
  vec3 clock(vec2 q) {
    float r = length(q), a = atan(q.x, q.y), hand = -uTime * TAU / 10.;
    float ring = smoothstep(.022, 0., abs(r - .5)) + smoothstep(.012, 0., abs(r - .44)) * .6;
    float arc = abs(fract(a / TAU * 10. + .5) - .5) * TAU / 10. * r, tick = smoothstep(.022, .01, arc) * step(.36, r) * step(r, .44);
    float needle = smoothstep(.024, .008, segment2(q, vec2(0.), vec2(sin(-hand), cos(-hand)) * .38)) + smoothstep(.06, .03, r);
    return vec3(2.6, 1.6, .55) * (ring + tick) + vec3(3.4, 2.2, .9) * needle;
  }
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    const int N = int(26. * DETAIL); float dt = (t1 - t0) / float(N), j = hash13(vec3(gl_FragCoord.xy, 3.)), T = 1., tp; vec3 col = vec3(0.);
    vec2 q = billboard(ro, rd, tp); bool drawn = false;
    for (int i = 0; i < N; i++) {
      float t = t0 + (float(i) + j) * dt; vec3 p = ro + rd * t;
      if (!drawn && t >= tp) { col += T * clock(q); drawn = true; }
      float n = fbm(rotY(uTime * .4) * p * 2.4 + vec3(0., -uTime * .35, 0.));
      float d = smoothstep(.42, .72, n) * smoothstep(1., .55, length(p)) * 5.;
      col += T * vec3(.32, .06, .5) * d * (.15 + .85 * smoothstep(.5, -.8, p.y)) * dt * .8; T *= exp(-d * dt);
    }
    if (!drawn) col += T * clock(q);
    return vec4(col, 1. - T * .82);
  }`,

  // A miniature star: prismatic plasma swirling around a blinding core, with twinkling stars.
  ultima: /* glsl */ `
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    const int N = int(28. * DETAIL); float dt = (t1 - t0) / float(N), j = hash13(vec3(gl_FragCoord.xy, 4.)), T = 1., tq; vec3 col = vec3(0.);
    for (int i = 0; i < N; i++) {
      vec3 p = ro + rd * (t0 + (float(i) + j) * dt), q = rotY(uTime * .6) * p; float r = length(q);
      float swirl = .5 + .5 * sin(atan(q.z, q.x) * 2. + r * 9. - uTime * 1.8);
      float n = fbm(q * 3.4 + vec3(0., uTime * .3, 0.)), d = smoothstep(.55, .85, n * .8 + swirl * .4 + (1. - r) * .2) * smoothstep(.95, .45, r) * 2.4;
      col += T * (hue(n * 1.1 + r * .5 + uTime * .05) * .9 + vec3(.25, .2, .5)) * d * 1.5 * dt; T *= exp(-d * .9 * dt);
    }
    float dc = rayPoint(ro, rd, vec3(0.), tq); col += vec3(3.2, 3., 4.) * exp(-dc * dc / .005) + vec3(.7, .6, 1.3) * exp(-dc * dc / .05) * .35;
    for (int k = 0; k < 16; k++) { vec3 pos = (hash31(float(k) * 4.1) - .5) * 1.3; if (length(pos) > .9) continue; float d = rayPoint(ro, rd, pos, tq); col += vec3(2.5) * exp(-d * d / .0003) * (.5 + .5 * sin(uTime * 5. + float(k) * 2.)); }
    return vec4(col, 1. - T * .8);
  }`,

  // Rainbow mist around a glowing question mark: the stone could become anything.
  random: /* glsl */ `
  float glyph(vec2 q) {
    q = q / 1.35 - vec2(0., .04); vec2 c = vec2(0., .14); float r = .17, d = abs(length(q - c) - r);
    float an = atan(q.y - c.y, q.x - c.x); if (an < -.75 && an > -2.7) d = 1.;
    vec2 tail = c + r * vec2(cos(-.75), sin(-.75)); d = min(d, segment2(q, tail, vec2(0., -.09)));
    d = min(d, segment2(q, vec2(0., -.09), vec2(0., -.14))); d = min(d, length(q - vec2(0., -.27)) - .015);
    return d;
  }
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    const int N = int(24. * DETAIL); float dt = (t1 - t0) / float(N), j = hash13(vec3(gl_FragCoord.xy, 5.)), T = 1., tp; vec3 col = vec3(0.);
    vec2 q = billboard(ro, rd, tp);
    float g = glyph(q), ink = smoothstep(.04, .028, g), outline = smoothstep(.075, .05, g) - ink;
    vec3 mark = vec3(2.4, 2.3, 2.1) * ink;
    for (int i = 0; i < N; i++) {
      vec3 p = ro + rd * (t0 + (float(i) + j) * dt);
      float n = fbm(rotY(uTime * .8) * p * 2.6 + uTime * .25), d = smoothstep(.5, .78, n) * smoothstep(1., .6, length(p)) * 2.;
      col += T * hue(n * 1.6 + p.y * .4 + uTime * .1) * d * 2.4 * dt; T *= exp(-d * .8 * dt);
    }
    // The mark floats in front of the mist so it reads at a glance.
    float cover = max(ink, outline * .8);
    return vec4(col * (1. - cover) + mark, max(1. - T * .85, cover));
  }`,
};
