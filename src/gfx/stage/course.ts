import * as THREE from 'three';
import { courseObjects, type TrackId } from '../../../shared/track/index.ts';
import { Kit, Parts } from './kit.ts';
import { STAGE, stageTime } from './materials.ts';
import { makeSky, makeMountains } from './sky.ts';
import { TrackField, buildTerrain, buildRoad } from './terrain.ts';
import { Ambient } from './ambient.ts';
import { chevronSign, block, rbox, cyl, ball, cone, flagPole, xf } from './props/common.ts';
import { noiseTexture } from './textures.ts';
import type { CourseArt, Environment, HazardKind, StartGateStyle } from './types.ts';
import { COURSE_ART } from './courses/index.ts';

export type { Environment, CourseArt } from './types.ts';
export type StageQuality = 'high' | 'low' | 'retro';

/** A built course: everything static or ambient around the road. Pickups, pads and racers stay with the caller. */
export interface Course {
  id: TrackId; root: THREE.Group; env: Environment; art: CourseArt;
  groundAt(x: number, z: number): number;
  update(t: number, dt: number, camera: THREE.Camera): void;
  setQuality(q: StageQuality): void;
  dispose(): void;
}

/** Applies a course's light and fog. The caller keeps the sun's target on its focus point, offset by `sunOffset`. */
export function applyEnvironment(env: Environment, scene: THREE.Scene, hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight) {
  scene.background = new THREE.Color(env.fog.color); scene.fog = new THREE.Fog(env.fog.color, env.fog.near, env.fog.far);
  hemi.color.set(env.hemi.sky); hemi.groundColor.set(env.hemi.ground); hemi.intensity = env.hemi.intensity;
  sun.color.set(env.sun.color); sun.intensity = env.sun.intensity;
}
export const sunOffset = (env: Environment, out = new THREE.Vector3()) => out.set(...env.sun.dir).normalize().multiplyScalar(75);

export function buildCourse(id: TrackId): Course {
  const art = COURSE_ART[id], kit = new Kit(id), field = new TrackField(id), env = art.env;
  const sunDir = new THREE.Vector3(...env.sun.dir).normalize();
  kit.road = (x, z) => field.sample(x, z); kit.bounds = { cx: field.cx, cz: field.cz, extent: field.extent };
  if (art.terrain) buildTerrain(kit, field, art.terrain); else kit.groundAt = (x, z) => field.sample(x, z).y - 1;
  buildRoad(kit, art.road);
  startLine(kit, art.start);
  signs(kit, art);
  const hazard = hazards(kit, art.hazard);
  art.build(kit);
  kit.finish();

  const sky = makeSky(env.sky, sunDir); kit.root.add(sky.mesh);
  const mountains = env.mountains ? makeMountains(env.mountains, new THREE.Vector2(field.cx, field.cz), env.sky.horizon, sunDir, 0, kit.r) : null;
  if (mountains) kit.root.add(mountains.group);
  const ambient = new Ambient(art.ambient ?? [], (x, z) => kit.groundAt(x, z)); kit.root.add(ambient.group);

  // Chunks beyond the fog are invisible anyway; skipping them saves draw calls on the far side of the course.
  const chunks = kit.root.children.filter(c => c.name.startsWith('chunk')).map(c => { const b = new THREE.Box3().setFromObject(c), s = b.getBoundingSphere(new THREE.Sphere()); return { o: c, c: s.center, r: s.radius }; });
  const reach = env.fog.far + 40;
  let detail = true;
  return {
    id, root: kit.root, env, art, groundAt: (x, z) => kit.groundAt(x, z),
    update(t, dt, camera) {
      stageTime.value = t; sky.mesh.position.copy(camera.position); hazard.uniforms.uTime.value = t;
      for (const ch of chunks) ch.o.visible = ch.c.distanceTo(camera.position) - ch.r < reach;
      kit.update(t, dt, camera); ambient.update(dt, camera);
    },
    setQuality(q) {
      detail = q === 'high'; ambient.density = q === 'high' ? 1 : q === 'low' ? .5 : .3;
      kit.root.traverse(o => { if (o instanceof THREE.Mesh && o.userData.detail) o.visible = detail; });
    },
    dispose() {
      const keep = new Set<THREE.Material>(Object.values(STAGE));
      kit.root.traverse(o => { if (o instanceof THREE.Mesh && o.name !== 'sky' && !o.name.startsWith('mountains')) { o.geometry.dispose(); for (const m of [o.material].flat()) if (!keep.has(m) && !kit.owned.includes(m)) m.dispose(); } });
      kit.owned.forEach(x => x.dispose()); sky.dispose(); mountains?.dispose(); ambient.dispose();
    },
  };
}

/** Checkered start line, grid boxes and the start gate with its banner. */
function startLine(kit: Kit, st: StartGateStyle) {
  const w = kit.w, a = new THREE.Color('#f7f4ee'), b = new THREE.Color('#25243a'), pos: number[] = [], col: number[] = [];
  const quad = (s0: number, s1: number, o0: number, o1: number, c: THREE.Color, lift = .045) => {
    const p = [kit.at(s0, o0), kit.at(s0, o1), kit.at(s1, o0), kit.at(s1, o1)];
    pos.push(p[0].x, p[0].y + lift, p[0].z, p[2].x, p[2].y + lift, p[2].z, p[1].x, p[1].y + lift, p[1].z, p[1].x, p[1].y + lift, p[1].z, p[2].x, p[2].y + lift, p[2].z, p[3].x, p[3].y + lift, p[3].z);
    for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
  };
  const n = Math.round(w * 2 / 1.2), cw = 2 * w / n;
  for (let j = 0; j < 2; j++) for (let i = 0; i < n; i++) quad(j * 1.2, (j + 1) * 1.2, -w + i * cw, -w + (i + 1) * cw, (i + j) % 2 ? a : b);
  // Grid boxes for the six starting slots, matching the race setup.
  for (let g = 0; g < 6; g++) {
    const s = -8 - Math.floor(g / 2) * 6, x = (g % 2 - .5) * 6;
    quad(s + 1.6, s + 1.85, x - 1.6, x + 1.6, a, .04); quad(s - 1.4, s + 1.85, x - 1.6, x - 1.4, a, .04); quad(s - 1.4, s + 1.85, x + 1.4, x + 1.6, a, .04);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  kit.addWorld(g, '#ffffff', { ao: false });
  // Gate: twin towers and a truss carrying the banner. Rebuilt per course from its palette.
  const gate = new Parts(), span = w + 1.8, h = 9;
  for (const x of [-span, span]) {
    gate.add(rbox(2.2, 1, 2.2, .15, [x, .5, 0]), st.trim); gate.add(block(1.6, h, 1.6, [x, .8, 0]), st.pillar, { flat: true });
    gate.add(rbox(2, .5, 2, .12, [x, h + .9, 0]), st.trim); gate.add(cone(1.25, 1.6, 4, [x, h + 1.15, 0], [0, Math.PI / 4, 0]), st.banner, { flat: true });
    gate.add(ball(.3, [x, h + 2.9, 0], .6), st.light ?? '#ffe28a', { layer: 'glow', ao: false });
    for (const y of [3, 5.5]) gate.add(xf(new THREE.BoxGeometry(1.7, .28, 1.7), [x, y, 0]), st.trim, { ao: false });
  }
  gate.add(rbox(span * 2 + 1.6, .55, .7, .1, [0, h - .2, 0]), st.trim); gate.add(rbox(span * 2 + 1.6, .55, .7, .1, [0, h - 3.2, 0]), st.trim);
  for (let i = 0; i < 12; i++) { const x = -span + (i + .5) * span * 2 / 12; gate.add(cyl(.06, .06, 3.1, [x, h - 1.7, 0], [0, 0, (i % 2 ? 1 : -1) * .55], 5), st.trim, { ao: false }); }
  for (let i = 0; i < 9; i++) { const x = -span + .8 + i * (span * 2 - 1.6) / 8; gate.add(ball(.16, [x, h - 3.55, .38], .5), i % 2 ? (st.light ?? '#ffe28a') : '#ffffff', { layer: 'glow', ao: false }); }
  kit.onTrack(gate.bake(), 0, 0); gate.dispose();
  if (st.flags) for (let i = 0; i < 4; i++) for (const side of [-1, 1]) kit.onTrack(kit.prop(`flag${i}`, () => flagPole(st.flags![i % st.flags!.length], '#ffffff', 7.5)), -14 - i * 9, side * (w + 3.4), { yaw: side > 0 ? Math.PI : 0 });
  if (typeof document === 'undefined') return;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const x = c.getContext('2d')!;
  x.fillStyle = st.banner; x.fillRect(0, 0, 1024, 160); x.strokeStyle = st.trim; x.lineWidth = 10; x.strokeRect(8, 8, 1008, 144);
  x.fillStyle = st.text; x.font = 'italic 900 88px "Barlow Condensed", "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = '#00000066'; x.shadowOffsetY = 5; x.fillText('CHOCOBO RACING', 512, 84);
  const tex = kit.own(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = kit.own(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: true }));
  const p = kit.at(0), board = new THREE.Mesh(new THREE.PlaneGeometry(span * 2 - .6, 2.4), mat);
  board.position.set(p.x, p.y + h - 1.7, p.z); board.rotation.y = p.yaw + Math.PI; board.name = 'start banner'; kit.add(board);
}

/** Warning boards on the outside of every major bend, pointing into the turn. */
function signs(kit: Kit, art: CourseArt) {
  const { board, arrow, post } = art.signs;
  for (let s = 60; s < kit.len - 30; s += 6) {
    const p = kit.at(s + 18), q = kit.at(s + 34), turn = (p.curve + q.curve) / 2;
    if (Math.abs(turn) < .012) continue;
    const dir = turn > 0 ? 1 : -1, sign = kit.prop(`chevron${dir}`, () => { const g = chevronSign(board, arrow, post); if (dir < 0) g.layers.forEach(list => list.forEach(x => x.rotateY(Math.PI))); return g; });
    const off = -dir * (kit.w + (kit.def.wall ? 1.6 : 2.6));
    kit.onTrack(sign, s, off, { yaw: Math.PI + (dir < 0 ? Math.PI : 0), onGround: !kit.def.cliff });
    s += 70;
  }
}

/** Slowing puddles from the course objects, drawn as one animated decal mesh. */
function hazards(kit: Kit, kind: HazardKind) {
  const palette: Record<HazardKind, [string, string, string, number]> = {
    mud: ['#3a2618', '#6b4a2c', '#c9a77a', 0], lava: ['#ff3d0d', '#ffb02e', '#fff2a0', 2.4], goo: ['#c2306f', '#ff7fb6', '#ffe1f0', .3], ink: ['#1e0f33', '#5b2a8c', '#c79bff', 1], water: ['#3b84b8', '#7fd0f0', '#ffffff', .2],
  };
  const [deep, mid, hi, glow] = palette[kind], noise = kit.own(noiseTexture(128));
  const mat = kit.own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNoise: { value: noise }, uDeep: { value: new THREE.Color(deep) }, uMid: { value: new THREE.Color(mid) }, uHi: { value: new THREE.Color(hi) }, uGlow: { value: glow } }]),
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime, uGlow; uniform sampler2D uNoise; uniform vec3 uDeep, uMid, uHi; varying vec2 vUv; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){ vec2 p = vUv * 2. - 1.; float edge = length(p * vec2(1., .8)) + (texture2D(uNoise, vUv * .5 + vW.xz * .01).r - .5) * .5;
        if (edge > .92) discard;
        float swirl = texture2D(uNoise, vW.xz * .06 + vec2(uTime * .02, -uTime * .015)).g, bub = texture2D(uNoise, vW.xz * .18 - uTime * .03).b;
        vec3 c = mix(uMid, uDeep, smoothstep(.85, .2, edge) * .8 + swirl * .3);
        c = mix(c, uHi, smoothstep(.6, .75, swirl) * .5 + smoothstep(.85, .92, edge) * .35 + step(.72, bub) * .3);
        c *= 1. + uGlow * (.6 + .4 * sin(uTime * 2. + swirl * 9.)) * smoothstep(.9, .3, edge);
        gl_FragColor = vec4(c, smoothstep(.92, .82, edge));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }));
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  courseObjects(kit.id).hazards.forEach((h, i) => {
    for (let j = 0; j <= 1; j++) for (let k = 0; k <= 1; k++) { const p = kit.at(h.s + (j - .5) * 6.4, h.x + (k - .5) * 6); pos.push(p.x, p.y + .05, p.z); uv.push(k, j); }
    const o = i * 4; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 1; mesh.name = 'hazards'; mesh.receiveShadow = true; kit.add(mesh);
  return mat;
}
