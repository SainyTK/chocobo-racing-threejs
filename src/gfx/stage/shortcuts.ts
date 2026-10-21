import * as THREE from 'three';
import { projectOnTrack, shortcutPaths, shortcutPoint, type PatchSurface, type ShortcutPath } from '../../../shared/track/index.ts';
import { Parts, type Kit } from './kit.ts';
import { patchMaterial } from './patches.ts';
import type { PatchLook, ShortcutStyle } from './types.ts';

/** Rows along a shortcut, about every two metres. */
const rows = (path: ShortcutPath) => Math.max(8, Math.round(path.length / 2));

/**
 * World point on a shortcut, `lift` above its surface. Where it lies over the main road it sinks below the road surface,
 * so the shortcut's own ribbon, walls and lips vanish cleanly into the road at its mouth and exit.
 */
function point(kit: Kit, path: ShortcutPath, u: number, offset: number, lift: number, clearance = 0) {
  const q = shortcutPoint(path, u, offset), main = projectOnTrack(kit.id, q.x, q.z, path.shortcut.from + u * path.skipped);
  const inside = Math.abs(main.offset) < kit.w + clearance;
  return new THREE.Vector3(q.x, inside ? Math.min(q.y + lift, kit.at(main.s).y - .4) : q.y + lift, q.z);
}

/** Strip of quads between two offsets, sampled along the shortcut, as a world-space geometry with uvs (across, metres along / tile). */
function strip(kit: Kit, path: ShortcutPath, o0: number, o1: number, y0: number, y1: number, clearance: number, tile: number) {
  const n = rows(path), pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = point(kit, path, u, o0, y0, clearance), b = point(kit, path, u, o1, y1, clearance);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z); uv.push(0, u * path.length / tile, 1, u * path.length / tile);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

/** Wall or lip profile swept along both edges, painted like the course's own barriers. Each strip faces inward, upward or outward. */
function edges(kit: Kit, path: ShortcutPath, style: ShortcutStyle) {
  const sc = path.shortcut, parts = new Parts(), c = shortcutPoint(path, .5), m = shortcutPoint(path, .5, 1);
  const leftward = new THREE.Vector3(m.x - c.x, 0, m.z - c.z).normalize(), up = new THREE.Vector3(0, 1, 0);
  // Built around the shortcut's middle, so it lands in the right scenery chunk for culling.
  const add = (o0: number, o1: number, y0: number, y1: number, paint: string, facing: 'in' | 'up' | 'out') => {
    for (const side of [-1, 1]) {
      const g = strip(kit, path, side * o0, side * o1, y0, y1, .6, 1).translate(-c.x, -c.y, -c.z), n = g.attributes.normal as THREE.BufferAttribute, mid = g.index!.array[Math.floor(g.index!.count / 6) * 3];
      const want = facing === 'up' ? up : leftward.clone().multiplyScalar(facing === 'in' ? -side : side);
      if (n.getX(mid) * want.x + n.getY(mid) * want.y + n.getZ(mid) * want.z < 0) { g.index!.array.reverse(); g.computeVertexNormals(); }
      parts.add(g, paint, { ao: false });
    }
  };
  if (sc.edge === 'wall') { add(sc.width + .1, sc.width + .1, 0, 1.2, style.wall, 'in'); add(sc.width + .1, sc.width + .6, 1.2, 1.2, style.cap, 'up'); add(sc.width + .6, sc.width + .6, 1.2, -.5, style.wall, 'out'); }
  else if (sc.edge === 'fall') { add(sc.width, sc.width + .5, .02, .18, style.cap, 'up'); add(sc.width + .5, sc.width * .4, .18, -3.2, style.wall, 'out'); }
  else add(sc.width, sc.width + 1.4, .02, -.25, style.cap, 'up');
  kit.place(parts.bake(), c.x, c.y, c.z, { shortcut: true }); parts.dispose();
}

/**
 * Spots every `step` metres along a shortcut, `offset` from its centre line, that lie clear of the main road.
 * Courses dress their shortcuts with these, so nothing they add stands in the road at a mouth or exit.
 */
export function shortcutSpots(kit: Kit, path: ShortcutPath, step: number, offset = 0) {
  const spots: { x: number; y: number; z: number; yaw: number; u: number }[] = [];
  for (let d = step / 2; d < path.length; d += step) {
    const u = d / path.length, q = shortcutPoint(path, u, offset);
    if (Math.abs(projectOnTrack(kit.id, q.x, q.z, path.shortcut.from + u * path.skipped).offset) > kit.w + 1.2) spots.push({ ...q, u });
  }
  return spots;
}

/** The first point from the mouth (or the last before the exit) where a shortcut is fully clear of the main road, for portals and arches over it. */
export function shortcutGate(kit: Kit, path: ShortcutPath, end: 'mouth' | 'exit') {
  for (let k = 0; k <= 50; k++) {
    const u = end === 'mouth' ? k / 100 : 1 - k / 100, q = shortcutPoint(path, u);
    if (Math.abs(projectOnTrack(kit.id, q.x, q.z, path.shortcut.from + u * path.skipped).offset) > kit.w + path.shortcut.width + 3) return q;
  }
  return shortcutPoint(path, .5);
}

/**
 * Every shortcut on the course: a ribbon of the course's own road surface (so the safe surface reads the same everywhere),
 * its edges, and a glossy or muddy overlay when the shortcut has a special surface.
 */
export function buildShortcuts(kit: Kit, road: THREE.Material, style: ShortcutStyle | undefined, looks: Record<PatchSurface, PatchLook>) {
  const paths = shortcutPaths(kit.id); if (!paths.length) return [];
  if (!style) throw new Error(`${kit.id} has shortcuts but its scenery defines no shortcut style`);
  const overlays: THREE.ShaderMaterial[] = [];
  for (const path of paths) {
    const sc = path.shortcut, ribbon = new THREE.Mesh(strip(kit, path, -sc.width, sc.width, .02, .02, 0, kit.w * 2), road);
    // The road texture tiles once across the main road's width; scale it so the shortcut's features keep their size.
    const uv = ribbon.geometry.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, .5 + (uv.getX(i) - .5) * sc.width / kit.w);
    ribbon.receiveShadow = true; ribbon.name = 'road'; kit.add(ribbon);
    edges(kit, path, style);
    if (sc.surface) {
      const g = strip(kit, path, -sc.width + .3, sc.width - .3, .05, .05, 0, path.length), size = new Float32Array(g.attributes.position.count * 2).map((_, i) => i % 2 ? path.length : sc.width * 2 - .6);
      g.setAttribute('size', new THREE.BufferAttribute(size, 2));
      const mat = patchMaterial(kit, looks[sc.surface]), mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 1; mesh.name = 'patches'; kit.add(mesh); overlays.push(mat);
    }
  }
  return overlays;
}
