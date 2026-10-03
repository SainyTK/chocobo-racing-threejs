import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TRACKS, courseObjects, pointAt, trackLength, type TrackId } from '../shared/track.ts';
import { ITEMS, type Race } from '../shared/game.ts';
import { createCharacter, type Character } from './gfx/characters.ts';
import { Effects, makePickup, FX_GEOMETRIES } from './gfx/effects.ts';
import { ghostMaterial } from './gfx/materials.ts';
import { Shape } from './gfx/particles.ts';
const sphere = new THREE.SphereGeometry(1, 12, 8), box = new THREE.BoxGeometry(1, 1, 1), cone = new THREE.ConeGeometry(1, 1, 8), crystal = new THREE.OctahedronGeometry(1), wheel = new THREE.CylinderGeometry(1, 1, 1, 12);
const padGeo = new THREE.PlaneGeometry(4.8, 7).rotateX(-Math.PI / 2);
const shared: THREE.BufferGeometry[] = [sphere, box, cone, crystal, wheel, padGeo, ...FX_GEOMETRIES];
const materials = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string) { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true, side: THREE.DoubleSide })); return materials.get(color)!; }
function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) { const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; }
function batch(group: THREE.Group) { const batches = new Map<THREE.Material, THREE.Mesh[]>(); for (const o of group.children) if (o instanceof THREE.Mesh) { const m = o.material as THREE.Material; if (!batches.has(m)) batches.set(m, []); batches.get(m)!.push(o); } for (const [m, parts] of batches) if (parts.length > 1) { const gs = parts.map(p => { p.updateMatrix(); return p.geometry.clone().applyMatrix4(p.matrix); }); const g = mergeGeometries(gs); gs.forEach(g => g.dispose()); if (g) { parts.forEach(p => group.remove(p)); group.add(new THREE.Mesh(g, m)); } } }
/** Boost pads: scrolling chevrons that read clearly from the chase camera. */
const padMaterial = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, uniforms: { uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ vec2 p = vUv; float edge = step(.06, p.x) * step(p.x, .94) * step(.03, p.y) * step(p.y, .97);
    float chev = fract((1. - p.y) * 3.5 + abs(p.x - .5) * 1.6 - uTime * 1.8); float c = smoothstep(.0, .06, chev) * smoothstep(.5, .42, chev);
    vec3 base = mix(vec3(.85, .38, .06), vec3(1., .62, .12), p.y); vec3 col = mix(base * .7, vec3(2.2, 1.7, .7), c) ;
    gl_FragColor = vec4(mix(vec3(1., .85, .4), col, edge), .95); }`,
});
export interface GhostPoint { t: number; x: number; z: number; yaw: number; s: number }
interface RacerView { c: Character; label?: THREE.Sprite; scale: number }
function makeLabel(name: string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d')!;
  g.font = 'bold 30px "Barlow Condensed", Arial, sans-serif'; const w = Math.min(244, g.measureText(name).width + 34);
  g.fillStyle = '#121334c8'; g.beginPath(); g.roundRect(128 - w / 2, 8, w, 46, 23); g.fill(); g.strokeStyle = '#ffffff55'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true })); s.scale.set(3.2, .8, 1); return s;
}
/** Software rasterisers (SwiftShader, llvmpipe) cannot afford bloom, shadows or MSAA. */
function softwareRenderer() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''; gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch { return false; }
}
export class World {
  readonly software = softwareRenderer(); readonly recommendedQuality = this.software ? 'low' : 'high';
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(58, 1, .2, 950);
  terrain = new THREE.Group(); dynamic = new THREE.Group(); racers = new Map<string, RacerView>(); hero = createCharacter(0); heroIndex = 0; track: TrackId = 'test'; raceId = ''; mode: 'menu' | 'race' = 'menu'; clock = 0; cameraReady = false; stones: THREE.Group[] = []; ghost: Character | null = null;
  fx: Effects; hemi = new THREE.HemisphereLight('#fff5dc', '#4a4868', 1.7); sun = new THREE.DirectionalLight('#fff2d4', 2.6);
  private composer: EffectComposer; private bloom: UnrealBloomPass; private quality = 'high'; private ghostMat = ghostMaterial(); private portraits: string[] = [];
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.software, powerPreference: 'high-performance' }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.info.autoReset = false; this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); Object.assign(this.sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 }); this.sun.shadow.camera.updateProjectionMatrix(); this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .04;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.terrain, this.dynamic, this.hero.root);
    this.fx = new Effects(this.scene);
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt); this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .7, .45, 1.6); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.buildTrack('test'); this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() { this.renderer.setSize(innerWidth, innerHeight, false); this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
  setQuality(q: string) { this.quality = q; this.fx.density = q === 'high' ? 1 : .5; this.renderer.setPixelRatio(q === 'retro' ? .65 : q === 'low' ? 1 : Math.min(devicePixelRatio, 1.5)); this.renderer.shadowMap.enabled = q === 'high'; this.sun.castShadow = q === 'high'; this.scene.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.Material) o.material.needsUpdate = true; }); this.resize(); }
  disposeObject(obj: THREE.Object3D) { const keep = [...materials.values()] as THREE.Material[]; keep.push(padMaterial); obj.traverse(o => { if (o instanceof THREE.Mesh) { if (!shared.includes(o.geometry)) o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!keep.includes(m)) { (m as THREE.MeshBasicMaterial).map?.dispose(); m.dispose(); } } if (o instanceof THREE.Sprite) { o.material.map?.dispose(); o.material.dispose(); } }); }
  setHero(ch: number) { this.scene.remove(this.hero.root); this.hero.dispose(); this.hero = createCharacter(ch); this.heroIndex = ch; this.hero.root.visible = this.mode === 'menu'; this.scene.add(this.hero.root); }
  setGhost(ch: number | null) {
    if (this.ghost) { this.scene.remove(this.ghost.root); this.ghost.dispose(); this.ghost = null; } if (ch === null) return;
    this.ghost = createCharacter(ch); this.ghostMat = ghostMaterial(); this.ghost.root.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = false; if (o.userData.outline) o.visible = false; else { o.material.dispose(); o.material = this.ghostMat; } } }); this.scene.add(this.ghost.root);
  }
  /** Head-and-shoulders render of a racer's 3D model, cached as a data URL for menus and the HUD. */
  portrait(i: number) {
    if (this.portraits[i]) return this.portraits[i];
    const size = 160, scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 50), c = createCharacter(i), rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    scene.add(new THREE.HemisphereLight('#ffffff', '#6a6890', 2.2)); const key = new THREE.DirectionalLight('#fff4e0', 2.4); key.position.set(3, 5, 6); scene.add(key, c.root);
    c.animate({ t: 0, dt: 0, speed: 0, steer: 0, drifting: false, flying: 0, stun: 0, boost: 0, menu: true });
    c.root.rotation.y = -.35; c.root.updateMatrixWorld(true); const head = c.head.getWorldPosition(new THREE.Vector3());
    cam.position.set(head.x - 1.4, head.y + .35, head.z + 5.2); cam.lookAt(head.x, head.y - .25, head.z);
    const prevTarget = this.renderer.getRenderTarget(), prevTone = this.renderer.toneMapping; this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setRenderTarget(rt); this.renderer.setClearColor(0x000000, 0); this.renderer.clear(); this.renderer.render(scene, cam);
    const px = new Uint8Array(size * size * 4); this.renderer.readRenderTargetPixels(rt, 0, 0, size, size, px); this.renderer.setRenderTarget(prevTarget); this.renderer.toneMapping = prevTone; this.renderer.setClearColor(0x000000, 1);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; const g = canvas.getContext('2d')!, img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    g.putImageData(img, 0, 0); this.portraits[i] = canvas.toDataURL('image/png'); c.dispose(); rt.dispose(); return this.portraits[i];
  }
  buildTrack(id: TrackId) {
    this.track = id; this.cameraReady = false; this.disposeObject(this.terrain); this.disposeObject(this.dynamic); this.terrain.clear(); this.dynamic.clear(); this.stones = [];
    const t = TRACKS[id], len = trackLength(id), w = t.width;
    this.scene.background = new THREE.Color(t.sky); this.scene.fog = new THREE.Fog(t.fog, id === 'mines' || id === 'manor' ? 80 : 175, id === 'mines' || id === 'manor' ? 230 : 650);
    const scenery = new THREE.Group(), add = (geo: THREE.BufferGeometry, color: string, s: number, offset: number, y: number, sx: number, sy: number, sz: number, ry = 0) => { const p = pointAt(id, s, offset); const m = part(scenery, geo, color, p.x, p.y + y, p.z, sx, sy, sz); m.rotation.y = p.yaw + ry; return m; };
    const ribbon = (a: number, b: number, color: string, height = 0) => { const ps: number[] = [], ix: number[] = []; for (let i = 0; i <= 800; i++) for (const x of [a, b]) { const p = pointAt(id, i / 800 * len, x); ps.push(p.x, p.y + height, p.z); } for (let i = 0; i < 800; i++) { const k = i * 2; ix.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); g.setIndex(ix); g.computeVertexNormals(); this.terrain.add(new THREE.Mesh(g, mat(color))); };
    if (!t.cliff) ribbon(-55, 55, t.ground, -.2); else ribbon(-w - 1.5, w + 1.5, t.edge, -1);
    ribbon(-w, w, t.road); ribbon(-w, -w + .45, '#eee4d0', .02); ribbon(w - .45, w, '#eee4d0', .02);
    part(scenery, box, t.ground, 0, t.cliff ? -52 : -12, 0, 2000, 2, 2000);
    for (let s = 0; s < len; s += 5) for (const side of [-1, 1]) {
      add(box, Math.floor(s / 5) % 2 ? t.edge : '#eee4d5', s, side * (w + .3), .05, .65, .12, 5.1);
      if (t.wall) add(box, id === 'test' ? '#617384' : t.edge, s, side * (w + .7), id === 'manor' ? 3.5 : 1, 1, id === 'manor' ? 7 : 2, 5.15);
    }
    for (let i = 0; i < 180; i++) {
      const s = i * len / 180, side = i % 2 ? 1 : -1, off = side * (w + 6 + (i * 17 % 24)), h = 4 + i * 7 % 9;
      if (id === 'forest') { add(box, '#73503d', s, off, h * .65, 1.1, h * 1.3, 1.1); add(cone, i % 3 ? '#437f43' : '#78a844', s, off, h * 1.45, h * .75, h * 1.7, h * .75); if (i % 5 === 0) { add(wheel, '#f4e4b4', s, off - side * 3, 1, .45, 2, .45); add(sphere, '#df5354', s, off - side * 3, 2, 1.8, .65, 1.8); } }
      if (id === 'gate' || id === 'gardens') { add(box, t.edge, s, off, h, 3, h * 2, 3); add(box, '#e1dcc3', s, off, h * 2, 4, .9, 4); if (i % 5 === 0) { add(box, '#d3c9ae', s, off + side * 3, 3, 9, 6, 8); add(cone, '#729baa', s, off + side * 3, 8, 7, 4, 6); } }
      if (id === 'mines') { add(crystal, '#514255', s, off, 4, 6, 9, 6); if (i % 3 === 0) add(crystal, i % 2 ? '#9a7cda' : '#62bfc8', s, side * (w + 2), 2, 1.5, 3.8, 1.5); }
      if (id === 'manor') { add(box, '#514467', s, off, h, 5, h * 2, 5); add(cone, '#302944', s, off, h * 2 + 3, 4.2, 6, 4.2); if (i % 3 === 0) add(sphere, '#d0d6e8', s, side * (w + 3), 5, 1, 1.5, 1); }
      if (id === 'gingerbread') { if (i % 3) { add(box, '#f1d5a3', s, off, 3, .8, 6, .8); add(sphere, ['#f076ad', '#6bded2', '#e9c553'][i % 3], s, off, 6.4, 2.7, 2.7, .9); } else { add(box, '#b6814e', s, off, 3, 7, 6, 7); add(cone, '#fcaabd', s, off, 7.8, 6, 5, 6); add(sphere, '#fff0db', s, off, 7, 5, .65, 5); } }
      if (id === 'volcano') { add(crystal, i % 2 ? '#533b46' : '#703e42', s, off, 1, 5 + h, 6 + h, 6 + h); if (i % 5 === 0) add(cone, '#f09b38', s, off, 9, 1.4, 13, 1.4); }
      if (id === 'test' && i % 4 === 0) { add(box, '#536780', s, off + side * 8, 3, 12, 6, 15); add(box, '#90a9bb', s, off + side * 8, 6.3, 14, .5, 16); for (let j = 0; j < 4; j++) add(box, j % 2 ? '#dc7b57' : '#ddd2ac', s + j * 2.5, off, 1.2 + j * .6, 6, .5, 2); }
    }
    for (let s = 60; s < len; s += id === 'mines' ? 22 : 120) {
      if (id === 'mines' || id === 'gate' || id === 'manor') { for (const sign of [-1, 1]) add(box, id === 'mines' ? '#92684a' : '#b3a58c', s, sign * (w + .3), 5.5, 1.2, 11, 1.4); add(box, id === 'mines' ? '#92684a' : '#b3a58c', s, 0, 10.7, w * 2 + 2, 1.2, 1.8); if (id === 'mines') add(box, '#443c49', s, 0, 13, w * 2 + 7, 3, 24); }
      if (id === 'gingerbread') { const p = pointAt(id, s); const arch = part(scenery, new THREE.TorusGeometry(w + 1, 1, 6, 18, Math.PI), '#f7a8ca', p.x, p.y, p.z, 1, 1, 1); arch.rotation.y = p.yaw; }
      // Direction boards face approaching racers and mark the outside of bends.
      const p = pointAt(id, s + 15); const sign = p.curve >= 0 ? 1 : -1; add(box, '#f2ce54', s, -sign * (w + 2), 2.8, 3, 1.9, .15); const arrow = add(cone, '#382c37', s - .12, -sign * (w + 2), 2.8, .65, 1.2, .09); arrow.rotation.z = -sign * Math.PI / 2;
    }
    for (let s = 0; s < len; s += 12) if (id === 'test') add(box, '#b5b2ab', s, 0, .03, .22, .04, 4);
    for (let j = 0; j < 2; j++) for (let i = 0; i < Math.floor(w); i++) add(box, (i + j) % 2 ? '#ffffff' : '#222237', j * 1.8, -w + 1 + i * 2, .07, 2, .05, 1.8);
    for (const side of [-1, 1]) add(box, '#c0c8d2', 0, side * (w + 1), 5, .8, 10, .8);
    add(box, '#354877', 0, 0, 9.5, w * 2 + 3, 2.4, .8);
    const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const ctx = c.getContext('2d')!; ctx.fillStyle = '#ffdf62'; ctx.font = 'italic bold 72px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CHOCOBO RACING', 512, 88); const banner = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.8, 2.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, side: THREE.DoubleSide })); const start = pointAt(id, -.46); banner.position.set(start.x, start.y + 9.5, start.z); banner.rotation.y = start.yaw + Math.PI; this.dynamic.add(banner);
    const objects = courseObjects(id);
    for (const st of objects.stones) { const p = pointAt(id, st.s, st.x), group = makePickup(st.kind === 'random' ? '#fff6d6' : ITEMS[st.kind].color, st.kind === 'random'); group.position.set(p.x, p.y + 1.5, p.z); this.dynamic.add(group); this.stones.push(group); }
    for (const pad of objects.pads) { const p = pointAt(id, pad.s, pad.x), m = new THREE.Mesh(padGeo, padMaterial); m.position.set(p.x, p.y + .07, p.z); m.rotation.y = p.yaw; this.dynamic.add(m); }
    for (const h of objects.hazards) add(sphere, id === 'volcano' ? '#ff8c36' : '#756350', h.s, h.x, .08, 2.6, .08, 3.5);
    for (let i = 0; i < 24; i++) { const a = i * 2.4; part(scenery, sphere, id === 'volcano' ? '#844952' : '#ebe7ef', Math.sin(a) * 340, id === 'gardens' ? -14 : 85 + i % 4 * 12, Math.cos(a) * 340, 28, 9, 17); }
    batch(scenery); this.terrain.add(scenery);
    this.terrain.traverse(o => { if (o instanceof THREE.Mesh) o.receiveShadow = true; });
  }
  private addRacer(id: string, character: number, name?: string) {
    const c = createCharacter(character), view: RacerView = { c, scale: 1 };
    if (name) { view.label = makeLabel(name); view.label.position.y = c.height + .7; c.root.add(view.label); }
    this.racers.set(id, view); this.scene.add(c.root);
  }
  private clearRacers() { this.racers.forEach(r => { this.scene.remove(r.c.root); if (r.label) { r.label.material.map?.dispose(); r.label.material.dispose(); } r.c.dispose(); }); this.racers.clear(); }
  enterRace(race: Race) { this.mode = 'race'; this.hero.root.visible = false; if (this.track !== race.track) this.buildTrack(race.track); if (race.id !== this.raceId) { this.clearRacers(); for (const p of race.racers) this.addRacer(p.id, p.character, p.name); this.raceId = race.id; this.cameraReady = false; } }
  menu() { this.mode = 'menu'; this.hero.root.visible = true; this.racers.forEach(r => r.c.root.visible = false); if (this.ghost) this.ghost.root.visible = false; }
  render(dt: number, race: Race | null, playerId: string, steer = 0, lookBack = false, ghost?: GhostPoint, paused = false) {
    const live = paused ? 0 : dt; this.clock += live; const t = this.clock;
    padMaterial.uniforms.uTime.value = t;
    this.stones.forEach((g, i) => {
      g.rotation.y = t * 1.4 + i; g.children[0].position.y = Math.sin(t * 2 + i) * .2; g.children[0].rotation.x = Math.sin(t * .9 + i) * .25;
      g.visible = !race || race.mode !== 'time' && race.pickups[i] <= 0;
      g.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.ShaderMaterial && o.material.uniforms.uTime) o.material.uniforms.uTime.value = t; });
      if (g.visible && live && Math.random() < .05) { const a = Math.random() * 6.28; this.fx.glow.emit({ x: g.position.x + Math.cos(a) * .9, y: g.position.y + Math.random() - .4, z: g.position.z + Math.sin(a) * .9, vy: .7, life: .8, size: .35, color: '#ffffff', endColor: '#ffe6a0', shape: Shape.Star }); }
    });
    const target = new THREE.Vector3();
    if (this.mode === 'menu' || !race) {
      const p = pointAt(this.track, -12); this.hero.root.position.set(p.x, p.y, p.z); this.hero.root.rotation.y = p.yaw + .4 + Math.sin(t * .35) * .9;
      this.hero.animate({ t, dt: live, speed: 0, steer: 0, drifting: false, flying: 0, stun: 0, boost: 0, menu: true });
      const a = p.yaw + .6, narrow = innerWidth <= 900, distance = narrow ? 14.5 : 9; target.set(p.x, p.y + 1.8, p.z);
      this.camera.position.set(p.x + Math.sin(a) * distance, p.y + (narrow ? 6.5 : 5.3), p.z + Math.cos(a) * distance); this.camera.lookAt(target); this.camera.setViewOffset(innerWidth, innerHeight, narrow ? -innerWidth * .13 : innerWidth * .23, narrow ? innerHeight * .5 - 205 : 0, innerWidth, innerHeight);
      if (live) for (const ex of this.hero.exhausts) if (Math.random() < .25) { ex.getWorldPosition(target); this.fx.smoke.emit({ x: target.x, y: target.y, z: target.z, vx: (Math.random() - .5) * .4, vy: .6 + Math.random() * .5, vz: (Math.random() - .5) * .4, life: .9, size: .18, endSize: .8, color: '#d8d2c8', alpha: .35, drag: 1.5, shape: Shape.Smoke }); }
      target.set(p.x, p.y + 1.8, p.z);
      this.fx.update(live, null, new Map(), playerId, this.camera, paused);
    } else {
      this.camera.clearViewOffset();
      const self = race.racers.find(q => q.id === playerId) || race.racers[0], chars = new Map<string, Character>();
      for (const p of race.racers) {
        const r = this.racers.get(p.id); if (!r) continue; const c = r.c; chars.set(p.id, c); c.root.visible = true;
        const floor = pointAt(race.track, p.s).y; c.root.position.set(p.px, floor + (p.flying > 0 ? 2.4 + Math.sin(t * 4) * .15 : 0) - (p.falling > 0 ? (1.3 - p.falling) * 12 : 0), p.pz); c.root.rotation.y = p.yaw;
        r.scale += ((p.mini > 0 ? 1 - p.miniLevel * .18 : 1) - r.scale) * (1 - Math.exp(-live * 10)); c.root.scale.setScalar(r.scale);
        c.animate({ t: t + p.character * 1.7, dt: live, speed: p.speed, steer: p.input.steer, drifting: p.drifting, flying: p.flying, stun: p.stun, boost: p.boost, menu: false });
        if (r.label) { const ahead = (p.px - self.px) * Math.sin(self.yaw) + (p.pz - self.pz) * Math.cos(self.yaw); const distance = this.camera.position.distanceTo(c.root.position); r.label.visible = p.id !== playerId && distance > 7 && distance < 60 && ahead * (lookBack ? -1 : 1) > 0; }
      }
      const p = self, floor = pointAt(race.track, p.s).y, a = p.yaw + (lookBack ? Math.PI : 0), distance = 10.5 + Math.min(4, Math.abs(p.speed) * .055);
      const desired = new THREE.Vector3(p.px - Math.sin(a) * distance, floor + 6.3 + (p.flying > 0 ? 2 : 0), p.pz - Math.cos(a) * distance);
      if (!this.cameraReady || desired.distanceTo(this.camera.position) > 55) this.camera.position.copy(desired); else this.camera.position.lerp(desired, 1 - Math.exp(-dt * 8)); this.cameraReady = true;
      target.set(p.px + Math.sin(a) * 8, floor + 1.8, p.pz + Math.cos(a) * 8); this.camera.lookAt(target);
      const fov = 58 + Math.min(1, p.boost) * 7; if (Math.abs(this.camera.fov - fov) > .05) { this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 5)); this.camera.updateProjectionMatrix(); }
      if (this.ghost) { this.ghost.root.visible = !!ghost; if (ghost) { this.ghost.root.position.set(ghost.x, pointAt(race.track, ghost.s).y, ghost.z); this.ghost.root.rotation.y = ghost.yaw; this.ghost.animate({ t, dt: live, speed: 30, steer: 0, drifting: false, flying: 0, stun: 0, boost: 0, menu: false }); } }
      this.ghostMat.uniforms.uTime.value = t;
      this.scene.updateMatrixWorld();
      this.fx.update(live, race, chars, playerId, this.camera, paused);
      if (this.fx.shake > 0) { const k = this.fx.shake * .5; this.camera.position.add(new THREE.Vector3((Math.random() - .5) * k, (Math.random() - .5) * k, (Math.random() - .5) * k)); }
    }
    // The shadow frustum follows the focus point so racers always cast crisp shadows.
    this.sun.position.set(target.x - 22, target.y + 70, target.z + 16); this.sun.target.position.copy(target);
    this.hemi.intensity = 1.7 + this.fx.flash * 1.6;
    this.renderer.info.reset(); if (this.quality === 'high') this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
  stats() { return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, ...this.fx.stats() }; }
}
