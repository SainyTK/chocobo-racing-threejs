import * as THREE from 'three';
import { pointAt, type TrackId } from '../../shared/track/index.ts';
import { rbox, cyl } from './geometry/primitives.ts';
import { toon } from './materials/toon.ts';
import { skinUniforms } from './materials/skin.ts';

/** Block heights for 1st, 2nd and 3rd place, and where each stands across the podium (metres toward the viewer's left). */
const BLOCKS = [{ h: 2.2, x: 0, color: '#ffd45a' }, { h: 1.5, x: 3.8, color: '#d9e2f2' }, { h: 1, x: -3.8, color: '#e6a46a' }];
/** The podium stands this far before the finish line, so the start gate and its banner frame it from the camera. */
const BEHIND = 14;

function numberPlate(n: number) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.font = '900 italic 104px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = '#2a2140'; g.strokeText(String(n), 64, 70); g.fillStyle = '#fff7da'; g.fillText(String(n), 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
}

/** The winners' podium built on the road just before the finish line, facing back down the track, with places for the top three racers. */
export class Podium {
  readonly root = new THREE.Group();
  /** World positions where the 1st, 2nd and 3rd place racers stand, facing `facing`. */
  readonly spots: THREE.Vector3[] = []; readonly facing: number;
  private skin = skinUniforms();
  constructor(track: TrackId) {
    const p = pointAt(track, -BEHIND), right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    this.facing = p.yaw + Math.PI;
    this.root.position.set(p.x, p.y, p.z); this.root.rotation.y = p.yaw;
    const base = rbox(12.4, .3, 4.4, .12, [0, .15, 0]), carpet = rbox(2.4, .06, 9, .02, [0, .32, -4.4]);
    this.root.add(this.mesh(base, '#4a3f7a'), this.mesh(carpet, '#c8394a'));
    BLOCKS.forEach((b, i) => {
      this.root.add(this.mesh(rbox(3.2, b.h, 3, .14, [b.x, .3 + b.h / 2, 0]), b.color), this.mesh(rbox(3.35, .18, 3.15, .06, [b.x, .3 + b.h, 0]), '#fff3cf'));
      const plate = numberPlate(i + 1); plate.position.set(b.x, .3 + b.h * .5, -1.52); plate.rotation.y = Math.PI; this.root.add(plate);
      this.spots.push(new THREE.Vector3(p.x, p.y + .3 + b.h + .09, p.z).addScaledVector(right, b.x));
    });
    for (const x of [-5.9, 5.9]) { this.root.add(this.mesh(cyl(.08, .08, 7, [x, 3.8, 1.6]), '#e8e2d0')); this.root.add(this.mesh(rbox(1.8, 1.1, .05, .02, [x - Math.sign(x) * .95, 6.6, 1.6]), x < 0 ? '#ff5a7a' : '#5ad8ff')); }
  }
  dispose() { this.root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const m = o.material as THREE.MeshBasicMaterial; m.map?.dispose(); m.dispose(); } }); }
  private mesh(geometry: THREE.BufferGeometry, color: string) { const m = new THREE.Mesh(geometry, toon(color, this.skin)); m.castShadow = m.receiveShadow = true; return m; }
}
