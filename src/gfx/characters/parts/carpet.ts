import * as THREE from 'three';

/** Red carpet texture with a gold border and star motif, drawn once. */
let carpetTexture: THREE.CanvasTexture | null = null;
export function carpet() {
  if (carpetTexture) return carpetTexture;
  const c = document.createElement('canvas'); c.width = 128; c.height = 192; const g = c.getContext('2d')!;
  g.fillStyle = '#9e2245'; g.fillRect(0, 0, 128, 192); g.strokeStyle = '#ffcf6a'; g.lineWidth = 8; g.strokeRect(8, 8, 112, 176); g.lineWidth = 3; g.strokeRect(20, 20, 88, 152);
  g.fillStyle = '#4a2a8c'; g.fillRect(24, 24, 80, 144); g.fillStyle = '#ffcf6a';
  for (const [x, y, rr] of [[64, 96, 22], [44, 50, 9], [84, 142, 9], [84, 50, 6], [44, 142, 6]]) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, d = i % 2 ? rr * .45 : rr; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } g.fill(); }
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#ffcf6a' : '#e85a7a'; g.fillRect(12 + i * 9, 2, 5, 4); g.fillRect(12 + i * 9, 186, 5, 4); }
  carpetTexture = new THREE.CanvasTexture(c); carpetTexture.colorSpace = THREE.SRGBColorSpace; carpetTexture.anisotropy = 4; return carpetTexture;
}
