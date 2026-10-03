import * as THREE from 'three';
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { configureRenderer, createComposer, createLights } from '../src/gfx/pipeline.ts';
import { Effects } from '../src/gfx/effects/index.ts';
import { BACKGROUNDS, type Background, type Quality } from './state.ts';
import type { Instance, StudioElement } from './types.ts';

/** Orbit angles and zoom. Linked panes share one object, so dragging any of them turns all of them. */
export interface ViewState { az: number; el: number; zoom: number }
export const defaultView = (): ViewState => ({ az: .6, el: .32, zoom: 1 });
/** `quality` mirrors the game's setting: Low drops bloom and halves particle density. Orb detail is set globally by the caller. */
export interface PaneOptions { background: Background; ground: boolean; quality: Quality }

const FOV = 35, sunOffset = new THREE.Vector3(-22, 70, 16);

/** One comparison pane: its own canvas, renderer, scene, effects pool and orbit camera. */
export class Viewport {
  readonly canvas = document.createElement('canvas');
  readonly scene = new THREE.Scene(); readonly camera = new THREE.PerspectiveCamera(FOV, 1, .05, 600);
  element: StudioElement | null = null; variant = '';
  private renderer: THREE.WebGLRenderer; private composer: EffectComposer; private fx: Effects; private lights = createLights();
  private instance: Instance | null = null; private target = new THREE.Vector3(); private distance = 6; private bloom = true;
  private ground = new THREE.Group(); private gridMat: THREE.LineBasicMaterial;
  private size = { w: 0, h: 0 };

  constructor(public view: ViewState) {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: false }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); configureRenderer(this.renderer);
    this.composer = createComposer(this.renderer, this.scene, this.camera);
    this.fx = new Effects(this.scene);
    const { hemi, sun } = this.lights; this.scene.add(hemi, sun, sun.target);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: .28 })); shadow.receiveShadow = true;
    const grid = new THREE.GridHelper(60, 60); this.gridMat = grid.material as THREE.LineBasicMaterial; this.gridMat.transparent = true; this.gridMat.depthWrite = false; grid.position.y = .002;
    this.ground.add(shadow, grid); this.scene.add(this.ground);
    this.bindPointer();
  }

  load(element: StudioElement, variant: string) {
    this.unload(); this.element = element; this.variant = variant;
    this.instance = element.create(variant, { scene: this.scene, fx: this.fx, camera: this.camera });
    const o = this.instance.object;
    if (o) { o.traverse(m => { if (m instanceof THREE.Mesh && !(m.material instanceof THREE.ShaderMaterial)) m.castShadow = true; }); this.scene.add(o); }
    this.instance.update?.(0, 0);
    if (element.view) { this.target.set(0, element.view.y, 0); this.distance = element.view.distance; }
    else if (o) { const sphere = new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere()); this.target.copy(sphere.center); this.distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2)) * 1.08; }
  }

  private unload() {
    if (!this.instance) return;
    this.instance.dispose?.(); if (this.instance.object) this.scene.remove(this.instance.object); this.instance = null; this.fx.reset();
  }

  setOptions(o: PaneOptions) {
    const bg = new THREE.Color(BACKGROUNDS[o.background]); this.scene.background = bg; this.ground.visible = o.ground; this.bloom = o.quality === 'high'; this.fx.density = o.quality === 'high' ? 1 : .5;
    const light = bg.r * .3 + bg.g * .59 + bg.b * .11 > .5; this.gridMat.color.set(light ? '#000000' : '#ffffff'); this.gridMat.opacity = light ? .12 : .08;
  }

  resize(w: number, h: number) {
    if (w === this.size.w && h === this.size.h || !w || !h) return; this.size = { w, h };
    this.renderer.setSize(w, h, false); this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  render(t: number, dt: number) {
    // Back off in panes taller than wide, so the subject still fits across.
    const { az, el, zoom } = this.view, d = this.distance * zoom / Math.min(1, this.camera.aspect) ** .6;
    this.camera.position.set(this.target.x + Math.sin(az) * Math.cos(el) * d, this.target.y + Math.sin(el) * d, this.target.z + Math.cos(az) * Math.cos(el) * d); this.camera.lookAt(this.target);
    this.instance?.update?.(t, dt);
    this.scene.updateMatrixWorld(); this.fx.preview(dt, this.camera);
    const { hemi, sun } = this.lights; hemi.intensity = 1.7 + this.fx.flash * 1.6; sun.position.copy(this.target).add(sunOffset); sun.target.position.copy(this.target);
    if (this.bloom) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  private bindPointer() {
    let drag: { x: number; y: number } | null = null;
    this.canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', e => {
      if (!drag) return; const v = this.view;
      v.az -= (e.clientX - drag.x) * .008; v.el = THREE.MathUtils.clamp(v.el + (e.clientY - drag.y) * .006, -.15, 1.45); drag = { x: e.clientX, y: e.clientY };
    });
    const end = () => { drag = null; }; this.canvas.addEventListener('pointerup', end); this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.view.zoom = THREE.MathUtils.clamp(this.view.zoom * Math.exp(e.deltaY * .0015), .25, 4); }, { passive: false });
    this.canvas.addEventListener('dblclick', () => Object.assign(this.view, defaultView()));
  }

  dispose() { this.unload(); this.composer.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); }
}
