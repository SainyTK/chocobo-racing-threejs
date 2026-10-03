import * as THREE from 'three';
import { crystalMaterial } from '../materials/crystal.ts';
import { sphereGeo, shardGeo, gemGeo } from './geometries.ts';
import { Trail } from './trail.ts';

/** Per-racer effect state: boost trails, held stones, shield bubble, freeze shell and Doom rune. */
export interface Status {
  trails: Trail[]; stones: THREE.Mesh[]; shield: THREE.Mesh; frozen: THREE.Group; doom: THREE.Sprite; doomCanvas: HTMLCanvasElement; doomValue: number;
  boostColor: THREE.Color; frozenUntil: number; flash: number; emitAcc: number; lastStun: number;
}

export function createStatus(group: THREE.Group, shieldMat: THREE.Material, frozenMat: THREE.Material): Status {
  const stones = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(gemGeo, crystalMaterial('#ffffff', { opacity: .95, intensity: 1.5 })); m.scale.setScalar(.32); m.visible = false; group.add(m); return m; });
  const shield = new THREE.Mesh(sphereGeo, shieldMat); shield.visible = false; group.add(shield);
  const frozen = new THREE.Group(); for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(shardGeo, frozenMat); const a = i / 9 * Math.PI * 2; m.position.set(Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1); m.rotation.set(Math.cos(a) * .35, a, -Math.sin(a) * .35); m.scale.set(1.5, 2 + (i % 3) * .5, 1.5); frozen.add(m); } frozen.visible = false; group.add(frozen);
  const doomCanvas = document.createElement('canvas'); doomCanvas.width = doomCanvas.height = 128; const doom = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(doomCanvas), transparent: true, depthWrite: false })); doom.scale.setScalar(1.8); doom.visible = false; group.add(doom);
  const s: Status = { trails: [new Trail(new THREE.Color('#ffb347')), new Trail(new THREE.Color('#ffb347'))], stones, shield, frozen, doom, doomCanvas, doomValue: -1, boostColor: new THREE.Color('#ffb347'), frozenUntil: 0, flash: 0, emitAcc: 0, lastStun: 0 };
  s.trails.forEach(t => group.add(t.mesh));
  return s;
}

/** Redraws the Doom countdown rune with the number `n`. */
export function drawDoom(s: Status, n: number) {
  const g = s.doomCanvas.getContext('2d')!; g.clearRect(0, 0, 128, 128);
  const grd = g.createRadialGradient(64, 64, 10, 64, 64, 62); grd.addColorStop(0, '#2a0c3dcc'); grd.addColorStop(.75, '#4a1670cc'); grd.addColorStop(1, '#00000000'); g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
  g.strokeStyle = '#d27bff'; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.stroke();
  g.fillStyle = '#ffe3ff'; g.font = 'bold 60px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#c04dff'; g.shadowBlur = 14; g.fillText(String(n), 64, 68);
  (s.doom.material as THREE.SpriteMaterial).map!.needsUpdate = true; s.doomValue = n;
}

export function disposeStatus(group: THREE.Group, s: Status) {
  s.trails.forEach(t => { group.remove(t.mesh); t.dispose(); }); s.stones.forEach(m => { group.remove(m); (m.material as THREE.Material).dispose(); });
  group.remove(s.shield, s.frozen, s.doom); (s.doom.material as THREE.SpriteMaterial).map?.dispose(); s.doom.material.dispose();
}
