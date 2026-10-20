import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCourse } from '../src/gfx/stage/course.ts';
import { TrackField } from '../src/gfx/stage/terrain.ts';
import { TRACKS, TRACK_IDS, projectOnShortcut, shortcutPaths, shortcutPoint, trackTable } from '../shared/track/index.ts';

const triangles = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

describe.each(TRACK_IDS)('course %s', id => {
  const course = buildCourse(id), meshes: THREE.Mesh[] = [];
  course.root.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });

  it('builds a sky, a road and finite scenery', () => {
    expect(meshes.some(m => m.name === 'sky')).toBe(true);
    expect(meshes.filter(m => m.name === 'road').length).toBeGreaterThan(10);
    for (const m of meshes) { m.geometry.computeBoundingSphere(); expect(Number.isFinite(m.geometry.boundingSphere!.radius), m.name).toBe(true); }
  });

  it('stays within the scenery budget', () => {
    let total = 0, detail = 0;
    for (const m of meshes) if (m.name !== 'sky') { total += triangles(m.geometry); if (m.userData.detail) detail += triangles(m.geometry); }
    expect(total).toBeLessThan(720_000); expect(detail).toBeLessThan(180_000);
    expect(meshes.length).toBeLessThan(900);
  });

  // Nothing may stand on the driving line: inside the road, scenery is either paint or curbs on the surface or high overhead.
  // Timed hazards are the exception by design: they move into the racing line on a timer, so their moving parts are skipped here.
  it('keeps the road clear between the surface and overhead structures', () => {
    const field = new TrackField(id), w = TRACKS[id].width, v = new THREE.Vector3(), blocked: string[] = [];
    // The grid is a fast filter. Candidates are confirmed against the exact centre line, using the highest surface
    // where two stretches of road overlap (a start on a corner apex).
    // Shortcuts are checked the same way against their own surface.
    const table = trackTable(id), exact = (p: THREE.Vector3) => {
      let top = -Infinity; for (const t of table) if (Math.hypot(t.x - p.x, t.z - p.z) < w + .5) top = Math.max(top, t.y);
      for (const path of shortcutPaths(id)) { const q = projectOnShortcut(path, p.x, p.z); if (q.u > 0 && q.u < 1 && Math.abs(q.x) < path.shortcut.width - .3) top = Math.max(top, shortcutPoint(path, q.u).y); }
      return top > -Infinity && p.y > top + .3 && p.y < top + 9;
    };
    for (const m of meshes) {
      if (m.name === 'sky' || m.name === 'road' || m.name === 'ramp' || m.name === 'patches' || m.name === 'hazard' || m.name === 'hazard warning' || m.name === 'liquid' || m.name.startsWith('mountains') || m.name === 'terrain') continue;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute; m.updateWorldMatrix(true, false);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); const f = field.sample(v.x, v.z);
        if (f.d < w - 1.5 && v.y > f.y + .3 && v.y < f.y + 9 && exact(v)) { blocked.push(`${m.parent?.name ?? ''}/${m.name} at ${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)}`); break; }
      }
    }
    expect(blocked).toEqual([]);
  });

  it('switches detail with quality and releases every geometry on dispose', () => {
    course.setQuality('low');
    expect(meshes.filter(m => m.userData.detail).every(m => !m.visible)).toBe(true);
    course.setQuality('high');
    const disposed = new Set<THREE.BufferGeometry>(), owned = new Set(meshes.map(m => m.geometry));
    owned.forEach(g => g.addEventListener('dispose', () => disposed.add(g)));
    course.update(1, 1 / 60, new THREE.PerspectiveCamera());
    course.dispose();
    expect(disposed.size).toBe(owned.size);
  });
});
