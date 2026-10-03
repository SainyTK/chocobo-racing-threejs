import * as THREE from 'three';
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { courseObjects, pointAt, type TrackId } from '../shared/track/index.ts';
import type { Item, Race } from '../shared/game/index.ts';
import { createCharacter, type Character } from './gfx/characters/index.ts';
import { Effects } from './gfx/effects/index.ts';
import { makePickup, type Pickup } from './gfx/effects/pickup.ts';
import { makeOrb, setOrbDetail, ORB_GEOMETRIES } from './gfx/orbs/index.ts';
import { FX_GEOMETRIES } from './gfx/effects/geometries.ts';
import { AURA_GEOMETRIES } from './gfx/orbs/stack.ts';
import { ghostMaterial } from './gfx/materials/ghost.ts';
import { Shape } from './gfx/particles/particles.ts';
import { configureRenderer, createComposer, createLights } from './gfx/pipeline.ts';
import { makeBoostPad, padGeo, padMaterial } from './gfx/stage/boost-pad.ts';
import { buildCourse, applyEnvironment, sunOffset, type Course, type StageQuality } from './gfx/stage/course.ts';
const shared: THREE.BufferGeometry[] = [padGeo, ...FX_GEOMETRIES, ...ORB_GEOMETRIES, ...AURA_GEOMETRIES];
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
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(58, 1, .2, 1500);
  course: Course | null = null; dynamic = new THREE.Group(); racers = new Map<string, RacerView>(); hero = createCharacter(0); heroIndex = 0; track: TrackId = 'test'; raceId = ''; mode: 'menu' | 'race' = 'menu'; clock = 0; cameraReady = false; stones: Pickup[] = []; ghost: Character | null = null;
  fx: Effects; hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight;
  private composer: EffectComposer; private quality = 'high'; private ghostMat = ghostMaterial(); private portraits: string[] = []; private icons = new Map<Item, string>(); private sunOffset = new THREE.Vector3();
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.software, powerPreference: 'high-performance' }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.info.autoReset = false; configureRenderer(this.renderer);
    ({ hemi: this.hemi, sun: this.sun } = createLights());
    this.scene.add(this.hemi, this.sun, this.sun.target, this.dynamic, this.hero.root);
    this.fx = new Effects(this.scene);
    this.composer = createComposer(this.renderer, this.scene, this.camera);
    this.buildTrack('test'); this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() { this.renderer.setSize(innerWidth, innerHeight, false); this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
  setQuality(q: string) { this.quality = q; this.fx.density = q === 'high' ? 1 : .5; setOrbDetail(q === 'high' ? 1 : .5); this.renderer.setPixelRatio(q === 'retro' ? .65 : q === 'low' ? (this.software ? .75 : 1) : Math.min(devicePixelRatio, 1.5)); this.renderer.shadowMap.enabled = q === 'high'; this.sun.castShadow = q === 'high'; if (this.course) { this.course.setQuality(q as StageQuality); applyEnvironment(this.course.env, this.scene, this.hemi, this.sun); } this.scene.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.Material) o.material.needsUpdate = true; }); this.resize(); }
  disposeObject(obj: THREE.Object3D) { const keep = [padMaterial]; obj.traverse(o => { if (o instanceof THREE.Mesh) { if (!shared.includes(o.geometry)) o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!keep.includes(m)) { (m as THREE.MeshBasicMaterial).map?.dispose(); m.dispose(); } } if (o instanceof THREE.Sprite) { if (!o.material.map?.userData.shared) o.material.map?.dispose(); o.material.dispose(); } }); }
  setHero(ch: number) { this.scene.remove(this.hero.root); this.hero.dispose(); this.hero = createCharacter(ch); this.heroIndex = ch; this.hero.root.visible = this.mode === 'menu'; this.scene.add(this.hero.root); }
  setGhost(ch: number | null) {
    if (this.ghost) { this.scene.remove(this.ghost.root); this.ghost.dispose(); this.ghost = null; } if (ch === null) return;
    this.ghost = createCharacter(ch); this.ghostMat = ghostMaterial(); this.ghost.root.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = false; if (o.userData.outline) o.visible = false; else { o.material.dispose(); o.material = this.ghostMat; } } }); this.scene.add(this.ghost.root);
  }
  /** Head-and-shoulders render of a racer's 3D model, cached as a data URL for menus and the HUD. */
  portrait(i: number) {
    if (this.portraits[i]) return this.portraits[i];
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 50), c = createCharacter(i);
    scene.add(new THREE.HemisphereLight('#ffffff', '#6a6890', 2.2)); const key = new THREE.DirectionalLight('#fff4e0', 2.4); key.position.set(3, 5, 6); scene.add(key, c.root);
    c.animate({ t: 0, dt: 0, speed: 0, steer: 0, drifting: false, flying: 0, stun: 0, boost: 0, menu: true });
    c.root.rotation.y = -.35; c.root.updateMatrixWorld(true); const head = c.head.getWorldPosition(new THREE.Vector3());
    cam.position.set(head.x - 1.4, head.y + .35, head.z + 5.2); cam.lookAt(head.x, head.y - .25, head.z);
    this.portraits[i] = this.snapshot(scene, cam, 160); c.dispose(); return this.portraits[i];
  }
  /** A held Magic Stone's orb, frozen mid-animation, cached as a data URL for the HUD stone slots. */
  stoneIcon(kind: Item) {
    if (this.icons.has(kind)) return this.icons.get(kind)!;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 20), orb = makeOrb(kind, { halo: false });
    orb.update(1.3); cam.position.set(0, .25, 4.1); cam.lookAt(0, 0, 0); scene.add(orb.root);
    const url = this.snapshot(scene, cam, 96); orb.dispose(); this.icons.set(kind, url); return url;
  }
  /** Renders a small offscreen scene on a transparent background into a PNG data URL. */
  private snapshot(scene: THREE.Scene, cam: THREE.Camera, size: number) {
    const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
    const prevTarget = this.renderer.getRenderTarget(), prevTone = this.renderer.toneMapping; this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setRenderTarget(rt); this.renderer.setClearColor(0x000000, 0); this.renderer.clear(); this.renderer.render(scene, cam);
    const px = new Uint8Array(size * size * 4); this.renderer.readRenderTargetPixels(rt, 0, 0, size, size, px); this.renderer.setRenderTarget(prevTarget); this.renderer.toneMapping = prevTone; this.renderer.setClearColor(0x000000, 1);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; const g = canvas.getContext('2d')!, img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    g.putImageData(img, 0, 0); rt.dispose(); return canvas.toDataURL('image/png');
  }
  buildTrack(id: TrackId) {
    this.track = id; this.cameraReady = false; this.disposeObject(this.dynamic); this.dynamic.clear(); this.stones = [];
    if (this.course) { this.scene.remove(this.course.root); this.course.dispose(); }
    this.course = buildCourse(id); this.course.setQuality(this.quality as StageQuality); this.scene.add(this.course.root);
    applyEnvironment(this.course.env, this.scene, this.hemi, this.sun);
    const objects = courseObjects(id);
    objects.stones.forEach((st, i) => { const p = pointAt(id, st.s, st.x), stone = makePickup(st.kind, i); stone.root.position.set(p.x, p.y + 1.5, p.z); this.dynamic.add(stone.root); this.stones.push(stone); });
    for (const pad of objects.pads) { const p = pointAt(id, pad.s, pad.x), m = makeBoostPad(); m.position.set(p.x, p.y + .07, p.z); m.rotation.y = p.yaw; this.dynamic.add(m); }
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
    this.stones.forEach((stone, i) => {
      const g = stone.root; g.visible = !race || race.mode !== 'time' && race.pickups[i] <= 0; if (g.visible) stone.update(t);
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
    const env = this.course!.env; this.sun.position.copy(target).add(sunOffset(env, this.sunOffset)); this.sun.target.position.copy(target);
    this.hemi.intensity = env.hemi.intensity + this.fx.flash * 1.6;
    this.course!.update(t, live, this.camera);
    this.renderer.info.reset(); if (this.quality === 'high') this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
  stats() { return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, ...this.fx.stats() }; }
}
