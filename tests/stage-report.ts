/** Prints build time, mesh count and triangle budget for every course's scenery. Run with `npx tsx tests/stage-report.ts [ids]`. */
import * as THREE from 'three';
import { buildCourse } from '../src/gfx/stage/course.ts';
import { TRACK_IDS, type TrackId } from '../shared/track/index.ts';

for (const id of (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].split(',') : TRACK_IDS) as TrackId[]) {
  const t0 = performance.now(), c = buildCourse(id), ms = performance.now() - t0;
  let meshes = 0, tris = 0, detail = 0;
  c.root.traverse(o => { if (o instanceof THREE.Mesh && o.name !== 'sky') { meshes++; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += n; if (o.userData.detail) detail += n; } });
  console.log(`${id.padEnd(12)} ${ms.toFixed(0).padStart(5)} ms  ${String(meshes).padStart(4)} meshes  ${(tris / 1000).toFixed(0).padStart(5)}k triangles (${(detail / 1000).toFixed(0)}k detail)`);
  c.dispose();
}

// Per-prop cost, so heavy props are easy to spot. `--props` lists every catalog entry.
if (process.argv.includes('--props')) {
  const { COURSE_ART } = await import('../src/gfx/stage/courses/index.ts'), { rng } = await import('../src/gfx/stage/noise.ts');
  for (const id of (process.argv[2]?.startsWith('--') ? TRACK_IDS : process.argv[2].split(',')) as TrackId[]) for (const [name, f] of Object.entries(COURSE_ART[id].catalog ?? {})) {
    const p = f(rng(1)).bake(); let n = 0; for (const [, [g]] of p.layers) n += g.attributes.position.count / 3;
    console.log(`  ${id.padEnd(12)} ${name.padEnd(22)} ${String(Math.round(n)).padStart(6)} triangles`); p.dispose();
  }
}
