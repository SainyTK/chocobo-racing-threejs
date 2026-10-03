import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRace, makeRacer, stepRace } from '../shared/game/index.ts';
import { TRACK_IDS } from '../shared/track/index.ts';
const report = [];
for (const id of TRACK_IDS) {
  let dnf = 0, maxSeconds = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const r = createRace(id, [makeRacer('p', 'CPU', seed % 8, true)], 3, seed * 913);
    while (r.phase !== 'finished') stepRace(r);
    dnf += r.racers.filter(p => p.finishTime === null).length;
    maxSeconds = Math.max(maxSeconds, r.time);
    for (const p of r.racers) { assert.ok([p.px, p.pz, p.s, p.yaw].every(Number.isFinite)); assert.equal(p.gates, 36, `${id}/${seed}/${p.name}`); }
  }
  assert.equal(dnf, 0, id); report.push({ course: id, races: 10, racers: 60, dnf, maxSeconds });
}
mkdirSync('output/testing', { recursive: true }); writeFileSync('output/testing/v2-simulation-stress.json', JSON.stringify(report, null, 2)); console.table(report);
