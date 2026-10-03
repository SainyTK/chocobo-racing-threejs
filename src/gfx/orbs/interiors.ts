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

  // A cluster of clear ice crystals: pointed hexagonal spires grow from a frosted root, splitting light into rainbow edges.
  ice: /* glsl */ `
  mat3 R;
  float hexR(vec2 p) { p = abs(p); return max(p.x * .866 + p.y * .5, p.y); }
  /** One spire along local +y from the root: hexagonal column of radius r, length L, with a six-sided point. h is its height in 0..1. */
  float spire(vec3 q, float r, float L, out float h) {
    float hx = hexR(q.xz); h = clamp(q.y / L, 0., 1.);
    return max(max(hx - r, -q.y), (hx + (q.y - L + r * 1.8) * .55 - r) * .88);
  }
  /** Root, tilt, yaw, radius and length of each spire. */
  const vec4 SP[7] = vec4[7](vec4(.08, 0., .2, 1.2), vec4(.62, .4, .16, .92), vec4(.7, 2.5, .15, .86), vec4(.58, 4.3, .15, .8), vec4(1.1, 1.4, .11, .62), vec4(1.15, 3.4, .11, .6), vec4(1.05, 5.5, .1, .56));
  float crystals(vec3 p, out float h) {
    vec3 q = R * p - vec3(0., -.62, 0.); float d = 1e9; h = 0.;
    for (int i = 0; i < 7; i++) { float hi, di = spire(rotX(-SP[i].x) * rotY(SP[i].y) * q, SP[i].z, SP[i].w, hi); if (di < d) { d = di; h = hi; } }
    return d;
  }
  float crystals(vec3 p) { float h; return crystals(p, h); }
  vec3 crystalNormal(vec3 p) { vec2 e = vec2(.0015, -.0015); return normalize(e.xyy * crystals(p + e.xyy) + e.yyx * crystals(p + e.yyx) + e.yxy * crystals(p + e.yxy) + e.xxx * crystals(p + e.xxx)); }
  vec3 env(vec3 d) { return mix(vec3(.04, .12, .26), vec3(1., 1.08, 1.18), smoothstep(-.4, .9, d.y)) + vec3(6.) * pow(max(dot(d, normalize(vec3(-.4, .8, .5))), 0.), 60.) + vec3(2.5, 3., 3.5) * pow(max(dot(d, normalize(vec3(.6, .3, -.7))), 0.), 30.); }
  float snow(vec3 ro, vec3 rd, float tmax) {
    float s = 0., tq;
    for (int k = 0; k < int(16. * DETAIL); k++) { float fk = float(k); vec3 h = hash31(fk * 5.3); vec3 pos = vec3((h.x - .5) * 1.3 + sin(uTime + fk) * .05, .8 - 1.6 * fract(h.y + uTime * .08), (h.z - .5) * 1.3); if (length(pos) > .92) continue; float d = rayPoint(ro, rd, pos, tq); s += step(0., tq) * step(tq, tmax) * exp(-d * d / .0004); }
    return s;
  }
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    R = rotX(sin(uTime * .45) * .1) * rotY(uTime * .5);
    vec3 haze = vec3(.2, .45, .75) * (t1 - t0) * .05;
    float t = t0, h; bool hit = false;
    for (int i = 0; i < 64; i++) { float d = crystals(ro + rd * t); if (d < .0012) { hit = true; break; } t += d * .85; if (t > t1) break; }
    if (!hit) { vec3 c = vec3(1.6, 1.9, 2.2) * snow(ro, rd, t1) + haze; return vec4(c, clamp(c.b * .4, 0., .5)); }
    vec3 p = ro + rd * t, n = crystalNormal(p); crystals(p, h);
    vec3 rIn = refract(rd, n, 1. / 1.31);
    float fres = .05 + .95 * pow(1. - max(dot(-rd, n), 0.), 5.), ti = 0.;
    for (int k = 0; k < int(18. * DETAIL); k++) { ti += .04 / DETAIL; if (crystals(p + rIn * ti) > 0.) break; }
    vec3 pe = p + rIn * ti, ne = -crystalNormal(pe);
    // Dispersion: each colour leaves the crystal at its own angle, so facet edges fringe into rainbows.
    vec3 behind = vec3(0.);
    for (int c = 0; c < 3; c++) { vec3 o = refract(rIn, ne, 1.29 + float(c) * .025); if (dot(o, o) < .01) o = reflect(rIn, ne); vec3 e = env(o) * .55 + vec3(1.6, 1.9, 2.2) * snow(pe, o, 2.); behind[c] = e[c]; }
    float frost = smoothstep(.3, 0., h) * (.6 + .4 * noise(R * p * 16.)), glint = pow(max(dot(reflect(rd, n), normalize(vec3(-.3, .7, .65))), 0.), 400.);
    vec3 col = (behind + vec3(.35, .7, 1.) * .25) * exp(-ti * vec3(1.8, .7, .3)) + env(reflect(rd, n)) * fres + vec3(7.) * glint;
    col = mix(col, vec3(1.1, 1.2, 1.3), frost * .7);
    return vec4(col + haze, .93);
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

  // A speed dash: a forward-pointing wedge trailing flame-like spikes, with streaks rushing past. It always points right on screen.
  haste: /* glsl */ `
  // Outline traced from the design sketch: the right tip, the flat base, four swept spikes with deep notches, a hook, and the curved back.
  const int NV = 14;
  const vec2 OUTLINE[14] = vec2[14](vec2(.75, -.195), vec2(-.75, -.195), vec2(-.37, -.1), vec2(-.68, -.05), vec2(-.14, -.03), vec2(-.54, .045), vec2(-.12, .1),
    vec2(-.36, .19), vec2(.13, .095), vec2(-.08, .25), vec2(.02, .245), vec2(.22, .19), vec2(.42, .1), vec2(.6, -.03));
  float dash(vec2 p) {
    vec2 v[14]; for (int i = 0; i < NV; i++) v[i] = OUTLINE[i];
    // The spike tips flicker like flames.
    for (int i = 1; i < 10; i += 2) v[i].x -= (.5 + .5 * sin(uTime * 14. + float(i) * 1.3)) * .06;
    float d = dot(p - v[0], p - v[0]), s = 1.;
    for (int i = 0, j = NV - 1; i < NV; j = i, i++) {
      vec2 e = v[j] - v[i], w = p - v[i], b = w - e * clamp(dot(w, e) / dot(e, e), 0., 1.); d = min(d, dot(b, b));
      bvec3 c = bvec3(p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x); if (all(c) || all(not(c))) s = -s;
    }
    return s * sqrt(d);
  }
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    float tp; vec2 q = billboard(ro, rd, tp) / 1.12; q.y += sin(uTime * 9.) * .012 - .02;
    float d = dash(q), ink = smoothstep(.012, -.004, d);
    float heat = smoothstep(-.7, .6, q.x);
    float edge = smoothstep(.05, .012, d) * (1. - ink);
    vec3 col = mix(vec3(.1, .75, .68), vec3(1.15, 1.45, 1.4), heat) * ink + vec3(.15, .7, .62) * exp(-max(d, 0.) * 22.) * .25 * (1. - ink);
    for (int k = 0; k < 9; k++) {
      float fk = float(k), y = (hash11(fk * 3.1) - .5) * 1.4, x = 1. - 2.4 * fract(hash11(fk * 7.7) + uTime * (1.4 + hash11(fk) * .8)), len = .2 + hash11(fk * 1.3) * .25;
      col += vec3(.4, 1.2, 1.1) * smoothstep(.012, .0, segment2(q, vec2(x, y), vec2(x + len, y))) * smoothstep(.95, .6, length(q)) * .6 * step(.02, d);
    }
    col += vec3(.04, .2, .18) * (t1 - t0) * .3;
    return vec4(col, clamp(max(max(ink, edge * .6), max(col.g, col.b) * .3), 0., 1.));
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

  // A grinning skull glowing in churning curse smoke. Its eyes burn and its jaw chatters.
  doom: /* glsl */ `
  float box2(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }
  float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
  /** Premultiplied colour and coverage of the skull at billboard point q. */
  vec4 skull(vec2 q) {
    q.y -= sin(uTime * 1.6) * .02; vec2 e = vec2(abs(q.x), q.y);
    float chew = abs(sin(uTime * 5.)) * .035, cranium = length((q - vec2(0., .1)) * vec2(1., 1.06)) - .34;
    float cheeks = box2(q - vec2(0., -.12), vec2(.24, .1), .08), jaw = box2(q - vec2(0., -.27 - chew), vec2(.155, .065), .05);
    float head = min(smin(cranium, cheeks, .06), jaw);
    float eye = length((e - vec2(.13, .02)) * vec2(1., 1.18)) - .085;
    float nose = max(abs(q.x) * 1.8 - (q.y + .15) * .9, q.y + .07);
    float teeth = step(abs(fract(q.x / .052 + .5) - .5) * .052, .008) * step(abs(q.y + .21 + (q.y < -.215 ? -chew : 0.)), .035) * step(abs(q.x), .13);
    float mouth = smoothstep(.006, 0., abs(q.y + .215 - chew * .5) - chew * .5) * step(abs(q.x), .15);
    float cover = smoothstep(.01, -.01, head), hole = max(smoothstep(.01, -.01, min(eye, nose)), max(teeth, mouth) * cover);
    vec3 bone = mix(vec3(1.1, .95, .8), vec3(1.9, 1.75, 1.45), smoothstep(-.3, .35, q.y + .25 * (1. - length(q))));
    float pulse = .7 + .3 * sin(uTime * 6.), burn = exp(-dot(e - vec2(.13, .02), e - vec2(.13, .02)) / .0016) * pulse;
    vec3 c = bone * cover * (1. - hole) + vec3(3.2, .5, 2.6) * burn + vec3(.9, .2, 1.5) * exp(-max(head, 0.) * 22.) * .55 * (1. - cover);
    return vec4(c, cover * (1. - hole * .1));
  }
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    const int N = int(26. * DETAIL); float dt = (t1 - t0) / float(N), j = hash13(vec3(gl_FragCoord.xy, 3.)), T = 1., tp; vec3 col = vec3(0.);
    vec2 q = billboard(ro, rd, tp); bool drawn = false; vec4 sk = skull(q * .82);
    for (int i = 0; i < N; i++) {
      float t = t0 + (float(i) + j) * dt; vec3 p = ro + rd * t;
      if (!drawn && t >= tp) { col += T * sk.rgb; T *= 1. - sk.a * .92; drawn = true; }
      float n = fbm(rotY(uTime * .4) * p * 2.4 + vec3(0., -uTime * .35, 0.));
      float d = smoothstep(.42, .72, n) * smoothstep(1., .55, length(p)) * 5.;
      col += T * vec3(.32, .06, .5) * d * (.15 + .85 * smoothstep(.5, -.8, p.y)) * dt * .8; T *= exp(-d * dt);
    }
    if (!drawn) { col += T * sk.rgb; T *= 1. - sk.a * .92; }
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

  // Only a white question mark floating in clear glass: the stone could become anything.
  random: /* glsl */ `
  float glyph(vec2 q) {
    q = q / 1.35 - vec2(0., .04); vec2 c = vec2(0., .14); float r = .17, d = abs(length(q - c) - r);
    float an = atan(q.y - c.y, q.x - c.x); if (an < -.75 && an > -2.7) d = 1.;
    vec2 tail = c + r * vec2(cos(-.75), sin(-.75)); d = min(d, segment2(q, tail, vec2(0., -.09)));
    d = min(d, segment2(q, vec2(0., -.09), vec2(0., -.14))); d = min(d, length(q - vec2(0., -.27)) - .015);
    return d;
  }
  vec4 interior(vec3 ro, vec3 rd, float t0, float t1) {
    float tp; vec2 q = billboard(ro, rd, tp);
    q.y -= sin(uTime * 1.8) * .025;
    // A soft shadow behind the mark keeps it legible against the white glass.
    float g = glyph(q), ink = smoothstep(.034, .026, g), shadow = smoothstep(.1, .03, g) * (1. - ink);
    vec3 c = vec3(2.6) * ink + vec3(.04, .06, .1) * (t1 - t0);
    return vec4(c, max(ink, shadow * .55));
  }`,
};
