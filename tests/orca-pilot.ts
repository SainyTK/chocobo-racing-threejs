import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pointAt, trackLength, type TrackId } from '../shared/track/index.ts';
// Pass the Orca browser page id from `orca tab list --json`.
const page = process.env.ORCA_PAGE;
if (!page) throw new Error('Set ORCA_PAGE to the Orca browserPageId running the game.');
const raw = JSON.parse(execFileSync('orca', ['eval', '--page', page, '--expression', 'window.__raceDebug', '--json'], { encoding: 'utf8' }));
const d = typeof raw.result.result === 'string' ? JSON.parse(raw.result.result) : raw.result.result;
const track = d.race.track as TrackId, len = trackLength(track), points = Array.from({ length: 1600 }, (_, i) => pointAt(track, i / 1600 * len));
const script = `(() => {
  const points = ${JSON.stringify(points)}, len = ${len};
  if (window.__orcaPilot) clearInterval(window.__orcaPilot);
  const held = new Set(), events = new Set(); let density = 0, direction = 0;
  window.__orcaReport = { track: ${JSON.stringify(track)}, keyEvents: 0, maxSpeed: 0, minFps: 999, events: [], finished: false };
  const point = s => points[Math.floor(((s % len + len) % len) / len * points.length) % points.length];
  window.__orcaPilot = setInterval(() => {
    const d = window.__raceDebug, r = d.race, desired = new Set();
    if (r && d.screen === 'race') {
      const p = r.racers.find(p => p.id === d.playerId), target = point(p.s + Math.max(15, Math.min(32, p.speed * .6 + 8)));
      const delta = ((Math.atan2(target.x - p.px, target.z - p.pz) - p.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      const curve = Math.max(...[12,25,40].map(v => Math.abs(point(p.s + v).curve)));
      const brake = p.speed > Math.max(13, Math.min(34, Math.sqrt(14 / Math.max(.001, curve))) + 1);
      if (r.time > -.16 && !brake) desired.add('KeyW'); if (brake) desired.add('KeyS');
      const steer = Math.max(-1,Math.min(1,delta*2.1)); if (Math.sign(steer) !== direction) density = 0; direction = Math.sign(steer); density += Math.abs(steer); if (density >= .7) { desired.add(steer > 0 ? 'KeyD' : 'KeyA'); density -= 1; }
      if (p.item && Math.sin(r.time*3)>.5) desired.add('Space'); if (p.ability >= 100 && curve < .013) desired.add('KeyE');
      if (Math.abs(p.x)>9 && p.speed<3 && r.time>6 || p.s > (p.gates+1)*len/12+15) desired.add('KeyR');
      for (const e of r.events) if (e.player === d.playerId || e.target === d.playerId) events.add(e.type);
      window.__orcaReport.maxSpeed = Math.max(window.__orcaReport.maxSpeed, p.speed); window.__orcaReport.minFps = Math.min(window.__orcaReport.minFps,d.fps);
    }
    const send = (code, down) => { document.body.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {code,bubbles:true})); window.__orcaReport.keyEvents++; };
    for (const k of held) if (!desired.has(k)) { send(k,false); held.delete(k); }
    for (const k of desired) if (!held.has(k)) { send(k,true); held.add(k); }
    window.__orcaReport.events = [...events];
    if (!r || d.screen === 'results') { clearInterval(window.__orcaPilot); window.__orcaReport.finished = d.screen === 'results'; window.__orcaReport.race = r; window.__orcaReport.graphics = d.graphics; }
  },33);
  return 'Keyboard pilot started. No simulation state is mutated.';
})()`;
mkdirSync('output/reference', { recursive: true }); writeFileSync('output/reference/orca-pilot-v2.js', script);
console.log(execFileSync('orca', ['eval', '--page', page, '--expression', script, '--json'], { encoding: 'utf8', maxBuffer: 3e6 }));
