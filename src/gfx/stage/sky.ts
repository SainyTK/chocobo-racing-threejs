import * as THREE from 'three';
import { noiseTexture } from './textures.ts';
import { ridge2, fbm2, smoothstep, type Rng } from './noise.ts';
import { stageTime } from './materials.ts';

export interface SkySpec {
  top: string; horizon: string;
  /** Below the horizon. Defaults to the horizon colour. */
  below?: string;
  /** A warm band just above the horizon (sunset glow, lava light, sugar haze). */
  band?: { color: string; height?: number; strength?: number };
  sun?: { color: string; size?: number; glow?: number };
  moon?: { color: string; size?: number; dir: [number, number, number] };
  /** Flat cel-shaded cloud deck. `cover` 0 is clear, 1 overcast. */
  clouds?: { lit: string; shade: string; cover?: number; scale?: number; speed?: number };
  /** Flat-bottomed cumulus banks sitting on the horizon, the classic RPG overworld sky. */
  cumulus?: { lit: string; shade: string; height?: number; amount?: number };
  stars?: number;
  /** Shimmering aurora curtains, for magical night skies. */
  aurora?: string;
}

const RADIUS = 1200;
/**
 * Sky dome drawn around the camera. Gradient, sun, moon and stars are analytic; clouds threshold a smooth noise
 * texture on the GPU, so their edges stay crisp at any resolution while costing a few texture reads per pixel.
 */
export function makeSky(spec: SkySpec, sunDir: THREE.Vector3) {
  const tex = noiseTexture(256), c = (s: string) => new THREE.Color(s);
  const u = {
    uTime: stageTime, uNoise: { value: tex }, uTop: { value: c(spec.top) }, uHorizon: { value: c(spec.horizon) }, uBelow: { value: c(spec.below ?? spec.horizon) },
    uBand: { value: c(spec.band?.color ?? spec.horizon) }, uBandH: { value: spec.band?.height ?? .12 }, uBandK: { value: spec.band ? spec.band.strength ?? .8 : 0 },
    uSunDir: { value: sunDir.clone().normalize() }, uSun: { value: c(spec.sun?.color ?? '#000000') }, uSunSize: { value: spec.sun?.size ?? .035 }, uSunGlow: { value: spec.sun?.glow ?? .5 },
    uMoonDir: { value: new THREE.Vector3(...(spec.moon?.dir ?? [0, 1, 0])).normalize() }, uMoon: { value: c(spec.moon?.color ?? '#000000') }, uMoonSize: { value: spec.moon?.size ?? .07 },
    uCloudLit: { value: c(spec.clouds?.lit ?? '#ffffff') }, uCloudShade: { value: c(spec.clouds?.shade ?? '#ffffff') }, uCover: { value: spec.clouds ? spec.clouds.cover ?? .45 : -1 }, uCloudScale: { value: spec.clouds?.scale ?? 1 }, uCloudSpeed: { value: spec.clouds?.speed ?? 1 },
    uCumLit: { value: c(spec.cumulus?.lit ?? '#ffffff') }, uCumShade: { value: c(spec.cumulus?.shade ?? '#ffffff') }, uCumH: { value: spec.cumulus?.height ?? .2 }, uCumK: { value: spec.cumulus ? spec.cumulus.amount ?? .5 : -1 },
    uStars: { value: spec.stars ?? 0 }, uAurora: { value: c(spec.aurora ?? '#000000') }, uAuroraK: { value: spec.aurora ? 1 : 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`,
    fragmentShader: `uniform float uTime, uBandH, uBandK, uSunSize, uSunGlow, uMoonSize, uCover, uCloudScale, uCloudSpeed, uCumH, uCumK, uStars, uAuroraK;
      uniform vec3 uTop, uHorizon, uBelow, uBand, uSunDir, uSun, uMoonDir, uMoon, uCloudLit, uCloudShade, uCumLit, uCumShade, uAurora; uniform sampler2D uNoise; varying vec3 vDir;
      float n(vec2 p){ return texture2D(uNoise, p).r; }
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir); float y = d.y, az = atan(d.x, d.z) / 6.28318 + .5;
        vec3 col = mix(uHorizon, uTop, pow(smoothstep(0., 1., y), .55));
        col = mix(col, uBand, uBandK * exp(-max(y, 0.) / max(uBandH, .001)) * step(-.02, y));
        col = mix(col, uBelow, smoothstep(0., -.08, y));
        // Stars twinkle slowly and fade near the horizon haze.
        if (uStars > 0.) { vec3 g = floor(d * 160.); float h = hash(g); vec3 f = fract(d * 160.) - .5; float s = step(1. - uStars * .02, h) * smoothstep(.22, .0, length(f)) * smoothstep(.05, .3, y);
          col += vec3(1., .95, .9) * s * (.6 + .4 * sin(uTime * 2. + h * 60.)) * 1.6; }
        if (uAuroraK > 0.) { float cur = n(vec2(az * 3. + uTime * .006, .3)) ; float a = smoothstep(.5, .9, n(vec2(az * 6. + cur, uTime * .01))) * smoothstep(.12, .35, y) * smoothstep(.8, .4, y);
          col += uAurora * a * (.6 + .4 * sin(az * 90. + uTime)) * 1.3; }
        // Sun: hot disc with a soft halo that tints the sky around it.
        float sd = dot(d, uSunDir); col += uSun * (pow(max(sd, 0.), 6.) * uSunGlow * .55 + pow(max(sd, 0.), 64.) * uSunGlow);
        col = mix(col, uSun * 3.2, smoothstep(1. - uSunSize * uSunSize * .5, 1. - uSunSize * uSunSize * .42, sd));
        // Moon with darker maria.
        float md = dot(d, uMoonDir); float moon = smoothstep(1. - uMoonSize * uMoonSize * .5, 1. - uMoonSize * uMoonSize * .46, md);
        col += uMoon * pow(max(md, 0.), 40.) * .5;
        if (moon > 0.) { vec3 mx = normalize(cross(uMoonDir, vec3(0., 1., 0.))); vec3 my = cross(mx, uMoonDir); vec2 mp = vec2(dot(d, mx), dot(d, my)) / uMoonSize; float maria = smoothstep(.45, .6, n(mp * .35 + .2)); col = mix(col, uMoon * (1.9 - maria * .55), moon); }
        // Cumulus banks: flat bottoms on the horizon, billowing tops, lit rims facing the sun.
        if (uCumK > 0. && y > -.01) {
          float h = y / uCumH, puff = n(vec2(az * 4., h * .35 + .1)) * .62 + n(vec2(az * 11., h * .9)) * .38;
          float thresh = mix(.3, 1.05, smoothstep(0., 1., h)) + (1. - uCumK) * .4;
          float body = smoothstep(thresh, thresh + .015, puff) * smoothstep(-.01, .015, y);
          float lit = smoothstep(.0, .06, puff - thresh - .02 + h * .05) ;
          float rim = smoothstep(.92, 1., dot(normalize(vec3(d.x, 0., d.z)), normalize(vec3(uSunDir.x, 0., uSunDir.z))) * .5 + .5);
          vec3 cc = mix(uCumShade, uCumLit, lit) + uSun * rim * .25 * lit;
          col = mix(col, mix(cc, uHorizon, .25 * (1. - h)), body);
        }
        // Cloud deck projected on a plane high above the course, drifting with the wind.
        if (uCover >= 0. && y > .02) {
          vec2 p = d.xz / (y + .08) * .07 * uCloudScale + vec2(uTime * .0025, uTime * .001) * uCloudSpeed;
          float c = n(p) * .65 + n(p * 2.7 + 3.1) * .35, t = 1. - uCover * .55;
          float body = smoothstep(t, t + .02, c) * smoothstep(.02, .2, y);
          float lit = smoothstep(t + .015, t + .07, n(p - uSunDir.xz * .015) * .65 + n((p - uSunDir.xz * .015) * 2.7 + 3.1) * .35);
          col = mix(col, mix(uCloudShade, uCloudLit, lit), body * .96);
        }
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 24), mat); mesh.frustumCulled = false; mesh.renderOrder = -10; mesh.name = 'sky';
  return { mesh, dispose() { mesh.geometry.dispose(); mat.dispose(); tex.dispose(); } };
}

export interface MountainLayer {
  color: string; radius: number; height: number;
  /** 0 smooth hills, 1 jagged peaks. */
  rough?: number;
  /** Colour of the peaks above `snowLine` (0 to 1 of the layer's height). */
  snow?: string; snowLine?: number;
  /** How strongly the base melts into the horizon colour. */
  haze?: number;
  seed?: number;
}
/**
 * Distant ranges as faceted rings around the course, shaded by the sun and hazed towards the horizon colour.
 * They ignore fog so they stay visible beyond the fog distance, and their base matches the horizon.
 */
export function makeMountains(layers: MountainLayer[], center: THREE.Vector2, horizon: string, sunDir: THREE.Vector3, baseY: number, r?: Rng) {
  const group = new THREE.Group(), hz = new THREE.Color(horizon), sun = sunDir.clone().normalize(), seg = 220;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  layers.forEach((L, li) => {
    const pos: number[] = [], col: number[] = [], base = new THREE.Color(L.color), snow = new THREE.Color(L.snow ?? L.color), seed = (L.seed ?? li) * 13 + (r ? Math.floor(r() * 50) : 0);
    const peak = (a: number) => { const t = a * 6, rough = L.rough ?? .5; return Math.max(.08, (ridge2(t, seed, 5, seed) * rough + fbm2(t * .5, seed + 3, 3, seed) * (1 - rough)) ** 1.6 * 1.25); };
    const verts: THREE.Vector3[][] = [];
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, rr = L.radius * (1 + (fbm2(a * 3, seed, 2, seed) - .5) * .12), h = peak(i / seg * 6.28) * L.height;
      // Two rows: the ridge line and a mid row offset back, so every peak has two lit facets.
      const ca = Math.cos(a), sa = Math.sin(a), back = rr + L.height * .5;
      verts.push([new THREE.Vector3(center.x + ca * rr * 1.03, baseY - 40, center.y + sa * rr * 1.03), new THREE.Vector3(center.x + ca * (rr + (i % 2 ? 10 : -10)), baseY + h * .55, center.y + sa * (rr + (i % 2 ? 10 : -10))), new THREE.Vector3(center.x + ca * back, baseY + h, center.y + sa * back)]);
    }
    const nrm = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), cc = new THREE.Color();
    for (let i = 0; i < seg; i++) for (let k = 0; k < 2; k++) {
      const a = verts[i][k], b = verts[i + 1][k], c2 = verts[i][k + 1], d = verts[i + 1][k + 1];
      for (const tri of [[a, b, c2], [b, d, c2]]) {
        e1.subVectors(tri[1], tri[0]); e2.subVectors(tri[2], tri[0]); nrm.crossVectors(e2, e1).normalize();
        const light = .62 + .5 * Math.max(0, nrm.dot(sun));
        for (const v of tri) {
          const hgt = (v.y - baseY) / L.height;
          cc.copy(base).lerp(snow, L.snow ? smoothstep((L.snowLine ?? .6) - .04, (L.snowLine ?? .6) + .02, hgt) : 0).multiplyScalar(light);
          cc.lerp(hz, Math.min(1, (L.haze ?? .45) * (1 - smoothstep(-.2, .7, hgt)) + (L.haze ?? .45) * .35));
          pos.push(v.x, v.y, v.z); col.push(cc.r, cc.g, cc.b);
        }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, mat); m.renderOrder = -5 + li; m.name = `mountains ${li}`; group.add(m);
  });
  return { group, dispose() { group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); mat.dispose(); } };
}
