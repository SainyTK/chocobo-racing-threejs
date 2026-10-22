import { describe, it, expect } from 'vitest';
import { TRACK_IDS, TRACKS, courseLayout, courseObjects, hazardState, locate, pointAt, projectOnTrack, shortcutPaths, shortcutPoint, trackLength } from '../shared/track/index.ts';
import { angleDelta } from '../shared/math.ts';
import { createRace, makeRacer, neutralInput, placeRacer, stepRace, type Race } from '../shared/game/index.ts';
import { decodeSnapshot, encodeSnapshot } from '../shared/wire.ts';
import { DRIVEN_STEP } from '../shared/game/progress.ts';

const tick = (r: Race, seconds: number) => { for (let i = 0; i < seconds * 60; i++) stepRace(r); };
function solo(track: Parameters<typeof createRace>[0]) { const r = createRace(track, [makeRacer('you', 'Test')], 1, 42, 'time'); r.time = .1; r.phase = 'racing'; return r; }
/** Drives the solo racer at full throttle, steering at a world point chosen each tick. */
function drive(r: Race, seconds: number, aim: () => { x: number; z: number }) {
  const p = r.racers[0];
  for (let i = 0; i < seconds * 60; i++) { const t = aim(), want = Math.atan2(t.x - p.px, t.z - p.pz), d = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)); p.input = { ...neutralInput(), throttle: true, steer: Math.max(-1, Math.min(1, d * 2.5)) }; stepRace(r); }
}

describe('course layouts', () => {
  for (const id of TRACK_IDS) it(`${id}: lap distance follows a racer along both road edges without skipping, so no bend folds the road`, () => {
    const len = trackLength(id), w = TRACKS[id].width;
    for (const side of [-1, 1]) { let s = 0; for (let d = .4; d <= len; d += .4) { const q = pointAt(id, d, side * (w - .3)), at = projectOnTrack(id, q.x, q.z, s).s; expect(Math.abs(angleDelta((at - s) / len * Math.PI * 2, 0)) / Math.PI / 2 * len).toBeLessThan(DRIVEN_STEP); s = at; } }
  });
  for (const id of TRACK_IDS) it(`${id}: gimmicks sit on the course and shortcuts leave and rejoin the road`, () => {
    const L = courseLayout(id), len = trackLength(id), w = TRACKS[id].width;
    for (const p of [...L.pads, ...L.patches, ...L.ramps]) { expect(p.s).toBeGreaterThanOrEqual(0); expect(p.s).toBeLessThan(len); expect(Math.abs(p.x)).toBeLessThan(w); }
    for (const path of shortcutPaths(id)) {
      expect(path.length).toBeLessThan(path.skipped);
      for (const u of [0, 1]) { const q = shortcutPoint(path, u); expect(Math.abs(Math.abs(projectOnTrack(id, q.x, q.z).offset) - w)).toBeLessThan(.5); }
      // In the middle a shortcut is its own route, clear of the road on either side.
      const mid = shortcutPoint(path, .5); expect(Math.abs(projectOnTrack(id, mid.x, mid.z).offset)).toBeGreaterThan(w + path.shortcut.width + 2);
      // It turns off the road at its join angle and back on at the same angle, and no stretch of it, ends included, turns sharply.
      const sc = path.shortcut, join = sc.side * sc.join * Math.PI / 180;
      expect(angleDelta(shortcutPoint(path, 0).yaw, pointAt(id, sc.from).yaw)).toBeCloseTo(join, 1);
      expect(angleDelta(pointAt(id, sc.to).yaw, shortcutPoint(path, 1).yaw)).toBeCloseTo(join, 1);
      for (let m = 0; m + 5 < path.length; m++) expect(Math.abs(angleDelta(shortcutPoint(path, (m + 5) / path.length).yaw, shortcutPoint(path, m / path.length).yaw)) / 5).toBeLessThan(2 * Math.PI / 180);
    }
  });
  it('timed hazards are a pure function of race time', () => {
    for (const id of TRACK_IDS) for (const h of courseLayout(id).hazards) for (const t of [0, 1.3, 7.77, 100.01]) expect(hazardState(h, t)).toEqual(hazardState(h, t));
    const h = courseLayout('volcano').hazards.find(x => x.kind === 'boulder')!;
    expect(hazardState(h, -(h.phase ?? 0)).live).toBe(true); expect(hazardState(h, h.period! - (h.phase ?? 0) - .2).warning).toBeGreaterThan(0);
  });
});

describe('course gimmicks in the simulation', () => {
  it('a shortcut is its own route, counts the road it skips and still credits every lap gate', () => {
    const r = solo('gingerbread'), p = r.racers[0], path = shortcutPaths('gingerbread')[0], len = trackLength('gingerbread');
    placeRacer('gingerbread', p, path.shortcut.from - 40, 0); p.gates = Math.floor(p.s / (len / 12));
    let used = false;
    drive(r, 10, () => { used ||= p.route === 0; return p.route === 0 ? shortcutPoint(path, Math.min(1, (p.s + 20 - path.shortcut.from) / path.skipped)) : p.s < path.shortcut.from ? shortcutPoint(path, .06) : pointAt('gingerbread', p.s + 20); });
    expect(used).toBe(true); expect(p.s).toBeGreaterThan(path.shortcut.from + path.skipped);
    expect(p.gates).toBe(Math.floor(p.s / (len / 12)));
  });
  it('a stone on a shortcut is collected from the shortcut only', () => {
    const r = createRace('gingerbread', [makeRacer('you', 'Test')], 1, 42, 'race'); r.time = .1; r.phase = 'racing';
    const p = r.racers[0], stone = courseObjects('gingerbread').stones.find(s => s.route === 0)!, path = shortcutPaths('gingerbread')[0];
    for (const q of r.racers.slice(1)) placeRacer('gingerbread', q, 300, 0);
    placeRacer('gingerbread', p, stone.s, 0); stepRace(r); expect(p.stones).toHaveLength(0);
    const at = shortcutPoint(path, (stone.s - path.shortcut.from) / path.skipped); p.px = at.x; p.pz = at.z; p.route = 0; p.routeS = stone.s; p.s = stone.s; p.vx = p.vz = 0; stepRace(r);
    expect(p.stones).toHaveLength(1);
  });
  it('locating a point on a shortcut maps it to the road distance it stands for', () => {
    const path = shortcutPaths('mines')[0], q = shortcutPoint(path, .5), place = locate('mines', q.x, q.z, 0, path.shortcut.from + path.skipped / 2);
    expect(place.route).toBe(0); expect(place.s).toBeCloseTo(path.shortcut.from + path.skipped / 2, 0); expect(Math.abs(place.x)).toBeLessThan(.1);
  });
  it('a ramp throws a fast racer into the air and it lands again', () => {
    const r = solo('test'), p = r.racers[0], ramp = courseLayout('test').ramps[0];
    placeRacer('test', p, ramp.s - 60, ramp.x); let top = 0;
    drive(r, 4, () => { top = Math.max(top, p.alt); return pointAt('test', p.s + 20, ramp.x); });
    expect(top).toBeGreaterThan(ramp.height + .5); expect(p.alt).toBe(0); expect(p.vy).toBe(0); expect(p.falling).toBe(0);
  });
  it('the ramp before a gap throws even a crawling racer clear of it', () => {
    const r = solo('gardens'), p = r.racers[0], gap = courseLayout('gardens').gaps[0];
    placeRacer('gardens', p, gap.s - 6, 0); p.input = { ...neutralInput(), throttle: true }; tick(r, 1.5);
    expect(r.events.some(e => e.type === 'fall')).toBe(false); expect(p.s).toBeGreaterThan(gap.s + gap.length);
  });
  it('a racer that comes down inside a gap falls in, and is rescued with a run-up', () => {
    const r = solo('gardens'), p = r.racers[0], gap = courseLayout('gardens').gaps[0];
    placeRacer('gardens', p, gap.s + 4, 0); p.alt = 1; p.vy = -1; p.input = { ...neutralInput(), throttle: true }; tick(r, 1);
    expect(r.events.some(e => e.type === 'fall')).toBe(true);
    tick(r, 1.5); expect(p.s).toBeLessThan(gap.s - 60);
  });
  it('a live hazard crashes a racer that drives into it', () => {
    const r = solo('gingerbread'), p = r.racers[0], fork = courseLayout('gingerbread').hazards[0];
    placeRacer('gingerbread', p, fork.s - 15, fork.x); p.input = { ...neutralInput(), throttle: true }; tick(r, 1.5);
    expect(r.events.some(e => e.type === 'crash' && e.text === fork.text)).toBe(true);
  });
  it('route and jump state survive the network snapshot', () => {
    const r = solo('test'), p = r.racers[0]; p.route = 0; p.alt = 1.25; p.vy = 3.5;
    const back = decodeSnapshot(r, encodeSnapshot(r, 1))!.racers[0]; expect([back.route, back.alt, back.vy]).toEqual([0, 1.25, 3.5]);
  });
});
