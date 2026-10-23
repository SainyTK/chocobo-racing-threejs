import * as THREE from 'three';
import { HANDLING, ITEMS, MAX_STONES, RACERS, stackPositions, type Race, type Racer } from '../../../shared/game/index.ts';
import { TRACKS } from '../../../shared/track/index.ts';
import { Particles, Shape, type Emit } from '../particles/particles.ts';
import type { Character } from '../characters/index.ts';
import { shell } from '../materials/shell.ts';
import { crystalMaterial } from '../materials/crystal.ts';
import { decalMaterial } from '../materials/decal.ts';
import { sphereGeo, ringGeo, shardGeo } from './geometries.ts';
import { Bolt, boltMaterial } from './bolt.ts';
import { Bursts } from './bursts.ts';
import { createStatus, drawDoom, disposeStatus, type Status } from './status.ts';
import { HeldStones } from '../stones/held.ts';
import { HELD_STONE } from '../stones/looks.ts';
import { rand, floorY } from './util.ts';
import { SpellFx } from './spells.ts';
import { castInfo, crashInfo, mugInfo, receiveInfo } from '../../race-events.ts';
import { AbilityFx } from './abilities/index.ts';

const v = new THREE.Vector3(), v2 = new THREE.Vector3(), tintColor = new THREE.Color(), white = new THREE.Color('#ffffff');
/** Fireball scale per spell level. */
const FIREBALL_SIZE = [1.15, 1.6, 2.1];

/** Where a fireball or ice trap is drawn this frame. `key` identifies it across frames. */
export interface FireballView { key: string; x: number; y: number; z: number; level: number }
export interface TrapView { key: string; x: number; y: number; z: number; radius: number }

export class Effects {
  group = new THREE.Group(); glow = new Particles(6000, true); smoke = new Particles(3000, false);
  /** Brief global brightening from lightning and Ultima, read by the world lighting. */
  flash = 0; shake = 0; density = 1; time = 0; bursts: Bursts;
  private fire = new Map<string, { g: THREE.Group; last: THREE.Vector3; level: number; age: number }>();
  private ice = new Map<string, { g: THREE.Group; age: number; px: number; pz: number; y: number }>();
  private bolts: Bolt[]; private statuses = new Map<string, Status>(); readonly spells = new SpellFx(this); readonly abilities = new AbilityFx(this);
  /** Every racer's held stones, room for twelve racers. */
  readonly held = new HeldStones(MAX_STONES * 12);
  private seen = new Set<number>(); private raceId = '';
  private boltMat = boltMaterial();
  private iceMat = crystalMaterial('#7fd6ff', { opacity: .72, intensity: 1.1 }); private frostMat = decalMaterial('frost', '#a6e8ff');
  private fireCore = shell('#fff3b0', '#ff6a1a', { power: 1.4, intensity: 1.9, wobble: .06 }); private fireShell = shell('#ff9a2a', '#ff3d0d', { power: 2.2, intensity: 1.2, wobble: .08 });
  private miniFireCore = shell('#fff6d0', '#ffa13a', { power: 1.2, intensity: 2.1, wobble: .1 });
  private shieldMat = shell('#2a0a24', '#ff6ad2', { power: 2.4, intensity: 1.1, hex: true });
  private frozenMat = crystalMaterial('#9fe3ff', { opacity: .55, intensity: 1.15 });
  constructor(scene: THREE.Scene) {
    this.bolts = Array.from({ length: 24 }, () => new Bolt(this.boltMat)); this.bursts = new Bursts(this.group);
    this.group.add(this.glow.mesh, this.smoke.mesh, this.held.root, this.abilities.batch.mesh, ...this.bolts.map(b => b.mesh)); scene.add(this.group);
  }
  /** Emits `n` particles from a template, randomised per particle. Scaled by `density` on lower quality settings. */
  spray(pool: Particles, n: number, f: (i: number) => Emit) { n = Math.max(1, Math.round(n * this.density)); for (let i = 0; i < n; i++) pool.emit(f(i)); }
  /** A racer's effect state if it is on screen; spell visuals previewed without racers have none. */
  racerStatus(id: string): Status | undefined { return this.statuses.get(id); }
  /** A racer's lasting effect state, created on first use. */
  private status(id: string): Status {
    let s = this.statuses.get(id);
    if (!s) { s = createStatus(this.group, this.shieldMat, this.frozenMat); this.statuses.set(id, s); }
    return s;
  }
  reset() {
    this.glow.clear(); this.smoke.clear(); this.seen.clear();
    for (const f of this.fire.values()) this.group.remove(f.g); this.fire.clear();
    for (const t of this.ice.values()) this.disposeIce(t.g); this.ice.clear();
    for (const s of this.statuses.values()) disposeStatus(this.group, s); this.statuses.clear();
    this.bolts.forEach(b => { b.age = 99; b.mesh.visible = false; }); this.bursts.reset(); this.abilities.reset(); this.held.begin(this.time); this.held.end();
  }
  private disposeIce(g: THREE.Group) { this.group.remove(g); }

  // ---- One-shot spell and event effects. Public so the studio can preview them outside a race. ----
  explode(at: THREE.Vector3, scale = 1) {
    this.spray(this.glow, Math.round(60 * scale), () => { const d = new THREE.Vector3(rand(), rand(-.2, 1), rand()).normalize().multiplyScalar(rand(3, 12) * scale); return { x: at.x, y: at.y, z: at.z, vx: d.x, vy: d.y, vz: d.z, life: rand(.4, .8), size: rand(1.4, 2.6) * scale, endSize: .3, color: '#fff1c0', endColor: '#ff3a10', drag: 3.2, gravity: -1.5 }; });
    this.spray(this.glow, 5, () => ({ x: at.x + rand() * .4, y: at.y + rand() * .4, z: at.z + rand() * .4, life: rand(.12, .2), size: rand(3, 4.5) * scale, endSize: 1.5, color: '#ffe2a0', endColor: '#ff8a30' }));
    this.spray(this.glow, Math.round(26 * scale), () => { const d = new THREE.Vector3(rand(), rand(0, 1.3), rand()).normalize().multiplyScalar(rand(9, 20) * scale); return { x: at.x, y: at.y, z: at.z, vx: d.x, vy: d.y, vz: d.z, life: rand(.4, .9), size: .14, color: '#fff2b8', endColor: '#ff6a20', drag: 1.5, gravity: 18, stretch: .05, shape: Shape.Shard }; });
    this.spray(this.smoke, Math.round(16 * scale), () => ({ x: at.x + rand() * .8, y: at.y + rand(0, .6), z: at.z + rand() * .8, vx: rand() * 2.5, vy: rand(1.5, 4), vz: rand() * 2.5, life: rand(1, 1.8), size: rand(1, 1.6) * scale, endSize: rand(3, 4.5) * scale, color: '#4a3a36', endColor: '#8b8480', alpha: .55, drag: 1.6, gravity: -.4, shape: Shape.Smoke }));
    this.bursts.spawn('ring', v.set(at.x, at.y - .9, at.z), '#ff8a3a', 5 * scale, .5); this.bursts.spawn('sphere', at, '#ff9a3a', 1.8 * scale, .3, { grow: 2 });
  }
  strike(at: THREE.Vector3, level: number, pillar = true) {
    const top = v2.set(at.x + rand() * 3, at.y + 34, at.z + rand() * 3).clone(), hit = at.clone();
    this.bolt(top, hit, 1.1 + level * .2, .5);
    for (let i = 0; i < 2 + level; i++) { const mid = new THREE.Vector3().lerpVectors(top, hit, rand(.25, .7)); this.bolt(mid, mid.clone().add(new THREE.Vector3(rand() * 6, -rand(3, 8), rand() * 6)), .45, .32); }
    this.spray(this.glow, 40, () => { const a = rand(0, 6.28), sp = rand(6, 16); return { x: hit.x, y: hit.y + .2, z: hit.z, vx: Math.cos(a) * sp, vy: rand(2, 9), vz: Math.sin(a) * sp, life: rand(.25, .55), size: .12, color: '#ffffff', endColor: '#7dffa0', drag: 2, gravity: 16, stretch: .04, shape: Shape.Shard }; });
    this.spray(this.glow, 10, () => ({ x: hit.x + rand() * .6, y: hit.y + rand(0, 2.5), z: hit.z + rand() * .6, life: rand(.2, .4), size: rand(1.8, 3), endSize: .5, color: '#e9ffd8', endColor: '#5adf7c' }));
    this.bursts.spawn('ring', v.set(hit.x, hit.y - 1.3, hit.z), '#9dffb0', 4 + level * 2.5, .45); this.flash = Math.max(this.flash, .35 + level * .15);
    if (level === 3 && pillar) this.bursts.spawn('pillar', v.set(hit.x, hit.y - 1.5, hit.z), '#c8ffd4', 1.2, .5, { height: 30 });
  }
  bolt(a: THREE.Vector3, b: THREE.Vector3, w: number, life: number) { const free = this.bolts.find(x => x.age >= x.life); free?.fire(a, b, w, life); }
  shatter(at: THREE.Vector3, n = 26) {
    this.spray(this.glow, n, () => { const d = new THREE.Vector3(rand(), rand(.3, 1.4), rand()).normalize().multiplyScalar(rand(4, 10)); return { x: at.x, y: at.y, z: at.z, vx: d.x, vy: d.y, vz: d.z, life: rand(.5, .9), size: rand(.18, .3), color: '#e6fbff', endColor: '#5ab8ff', drag: 1, gravity: 20, stretch: .03, shape: Shape.Shard }; });
    this.spray(this.smoke, 10, () => ({ x: at.x + rand(), y: at.y, z: at.z + rand(), vx: rand() * 2, vy: rand(.2, 1.5), vz: rand() * 2, life: rand(.8, 1.4), size: 1, endSize: 3, color: '#e8f7ff', alpha: .45, drag: 1.4, shape: Shape.Smoke }));
    this.spray(this.glow, 14, () => ({ x: at.x + rand() * 1.5, y: at.y + rand(0, 2), z: at.z + rand() * 1.5, vy: rand(.5, 2), life: rand(.5, 1.1), size: rand(.4, .8), color: '#ffffff', endColor: '#7fd6ff', shape: Shape.Star }));
    this.bursts.spawn('ring', v.set(at.x, at.y - .5, at.z), '#a6e8ff', 4, .5);
  }
  sparkle(at: THREE.Vector3, color: string, n = 24, radius = 1.4, rise = 2) {
    this.spray(this.glow, n, i => { const a = i / n * 6.28 + rand() * .3, r = radius * rand(.5, 1); return { x: at.x + Math.cos(a) * r, y: at.y + rand(-.5, 1.5), z: at.z + Math.sin(a) * r, vx: Math.cos(a) * 1.5, vy: rand(.5, rise * 2), vz: Math.sin(a) * 1.5, life: rand(.5, 1), size: rand(.35, .7), endSize: .1, color: '#ffffff', endColor: color, drag: 1.5, shape: Shape.Star }; });
  }
  swirl(at: THREE.Vector3, color: string, height = 3.5, n = 50, inward = false) {
    this.spray(this.glow, n, i => { const a = i * .55, h = i / n * height, r = inward ? 2.2 : 1.1; return { x: at.x + Math.cos(a) * r, y: at.y + h, z: at.z + Math.sin(a) * r, vx: -Math.sin(a) * 3 - (inward ? Math.cos(a) * 3 : 0), vy: 1.2, vz: Math.cos(a) * 3 - (inward ? Math.sin(a) * 3 : 0), life: rand(.5, .8), size: rand(.3, .55), endSize: .08, color: '#ffffff', endColor: color, drag: .8, stretch: .025, shape: i % 3 ? Shape.Glow : Shape.Star }; });
  }
  stream(from: THREE.Vector3, to: THREE.Vector3, color: string, n = 30) {
    this.spray(this.glow, n, i => { const t = rand(.6, 1.1); return { x: from.x + rand() * .5, y: from.y + rand() * .5, z: from.z + rand() * .5, vx: (to.x - from.x) / t, vy: (to.y - from.y) / t + rand(2, 5), vz: (to.z - from.z) / t, life: t, size: rand(.25, .5), color: '#ffffff', endColor: color, gravity: 6, stretch: .02, shape: i % 2 ? Shape.Star : Shape.Glow }; });
  }
  /** Ultima landing on a racer. Around the player's own racer it stays rim-lit so the road stays visible. */
  ultimaHit(at: THREE.Vector3, level = 1, mine = false) {
    this.sparkle(at, '#c9b4ff', 20 + level * 10, 1.6, 4); this.bursts.spawn('ring', v.set(at.x, at.y - 1.4, at.z), '#efe6ff', 4 + level * 2, .6);
    if (mine) { this.bursts.spawn('dome', v.set(at.x, at.y - 1.5, at.z), '#d9c8ff', 3 + level, .6); return; }
    this.bursts.spawn('pillar', v.set(at.x, at.y - 1.5, at.z), '#d9c8ff', 1.6 + level * .6, .7 + level * .15, { height: 12 + level * 6 }); this.bursts.spawn('sphere', at, '#e7dcff', 2 + level, .5, { grow: 1.5 });
  }
  /** A puff of road dust kicked up by a spin-out or a squash. */
  dust(at: THREE.Vector3, n: number) { this.spray(this.smoke, n, () => ({ x: at.x + rand(), y: at.y - 1.2, z: at.z + rand(), vx: rand() * 3, vy: rand(.5, 2), vz: rand() * 3, life: rand(.6, 1.1), size: .8, endSize: 2.4, color: '#b9a98f', alpha: .45, drag: 2, shape: Shape.Smoke })); }
  doomHit(at: THREE.Vector3) { this.bursts.spawn('sphere', at, '#9b3dff', 4, .6, { grow: 1.6 }); this.spray(this.smoke, 26, () => ({ x: at.x + rand(), y: at.y + rand(), z: at.z + rand(), vx: rand() * 4, vy: rand(1, 5), vz: rand() * 4, life: rand(1, 1.7), size: 1.2, endSize: 4, color: '#2a0d3a', endColor: '#5a2a7a', alpha: .7, drag: 1.5, shape: Shape.Smoke })); this.bursts.spawn('ring', v.set(at.x, at.y - 1.4, at.z), '#b45cff', 7, .6); }
  confetti(at: THREE.Vector3) {
    const colors = ['#ff5a7a', '#ffd84a', '#5ad8ff', '#8cff7a', '#c58bff'];
    this.spray(this.glow, 70, i => ({ x: at.x, y: at.y + 2, z: at.z, vx: rand() * 8, vy: rand(6, 14), vz: rand() * 8, life: rand(1.2, 2), size: rand(.25, .4), color: colors[i % 5], drag: 1.6, gravity: 9, shape: i % 2 ? Shape.Star : Shape.Shard, stretch: .01 }));
  }

  private onEvent(e: Race['events'][number], race: Race, playerId: string) {
    const by = (id?: string) => race.racers.find(p => p.id === id), p = by(e.player), q = by(e.target);
    const pos = (r?: Racer, up = 1.5) => r ? new THREE.Vector3(r.px, floorY(race, r.px, r.pz) + up, r.pz) : null;
    const at = pos(p), tAt = pos(q); if (!at || !p) return;
    const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)), text = e.text.toLowerCase(), ground = v.set(at.x, at.y - 1.4, at.z).clone();
    const cast = castInfo(e);
    if (cast) { this.spells.cast(cast.kind, cast.level, at, fwd, p.id, p.id === playerId); return; }
    switch (e.type) {
      case 'crash': this.spells.impact(crashInfo(e), at, p.id, p.id === playerId); return;
      case 'mini': if (q && tAt) this.spells.shrink(tAt, q.miniLevel || 1, q.id); return;
      case 'doom': if (tAt) { this.bursts.spawn('ring', v.set(tAt.x, tAt.y - 1.4, tAt.z), '#b45cff', 4, .6); this.swirl(v.set(tAt.x, tAt.y - 1.4, tAt.z).clone(), '#9b3dff', 3.5, 40, true); } return;
      case 'reflect': case 'block': {
        // The original shows no block sprite for Barrier: the spell plays out, then one last pulse.
        if (text === 'barrier!') { this.abilities.blocked(p.id); return; }
        const c = e.type === 'reflect' ? ITEMS.shield.color : '#ffffff'; this.bursts.spawn('dome', ground, c, 2.8, .5); this.sparkle(at, c, 28, 1.6); if (e.type === 'reflect' && tAt) this.stream(at, tAt, c, 26); return; }
      case 'bump': if (tAt) { const mid = at.clone().lerp(tAt, .5); this.spray(this.glow, 16, () => ({ x: mid.x, y: mid.y - .4, z: mid.z, vx: rand() * 6, vy: rand(1.5, 5), vz: rand() * 6, life: rand(.2, .4), size: .09, color: '#ffffff', endColor: '#ffc45a', gravity: 16, stretch: .04, shape: Shape.Shard })); this.spray(this.glow, 3, () => ({ x: mid.x, y: mid.y, z: mid.z, life: .12, size: rand(1.2, 1.8), endSize: .4, color: '#fff6d0', endColor: '#ffb040' })); if (p.id === playerId || q?.id === playerId) this.shake = Math.max(this.shake, .18); } return;
      case 'receive': { const caught = receiveInfo(e), top = p.stones.at(-1); if (caught && top) this.abilities.received(p.id, caught.kind, caught.level, top.level === caught.level ? p.stones.length - 1 : undefined); return; }
      case 'pad': case 'start': case 'spindash': this.abilities.boosted(p.id, e.type); return;
      case 'ability': {
        const id = text.includes('magic plus') ? 'magic' : p.abilityId, color = id === 'grip' ? '#8cff7a' : id === 'mug' ? '#ffd84a' : id === 'magic' ? '#c58bff' : '#ffc45a';
        if (id === 'magic' && p.stones.length) this.abilities.raised(p.id, p.stones.length - 1);
        // Mug sends its helper out whether it robbed a rival (a `steal` event this tick) or conjured a stone.
        if (id === 'mug' && !race.events.some(x => x.type === 'steal' && x.player === p.id && x.time === e.time)) this.mugged(p, 1);
        if (this.abilities.used(id, p.id)) return;
        this.bursts.spawn('ring', ground, color, 4, .5);
        this.sparkle(at, color, 22);
        return;
      }
      case 'steal': { const taken = mugInfo(e); if (taken) this.mugged(p, taken.level, q); else if (tAt) this.stream(tAt, at, '#ffd84a', 26); return; }
      case 'doom-pass': if (tAt) this.stream(at, tAt, '#b45cff', 30); return;
      case 'wall': { const f = at.clone().addScaledVector(fwd, 1.5); this.spray(this.glow, 16, () => ({ x: f.x, y: f.y - .6, z: f.z, vx: rand() * 7, vy: rand(1, 6), vz: rand() * 7, life: rand(.2, .45), size: .1, color: '#fff2b8', endColor: '#ff8a3a', gravity: 18, stretch: .04, shape: Shape.Shard })); if (p.id === playerId) this.shake = Math.max(this.shake, .22); return; }
      case 'recover': this.bursts.spawn('pillar', v.set(at.x, at.y - 1.5, at.z), '#bfe9ff', 1.6, .8, { height: 10 }); this.sparkle(at, '#bfe9ff', 20); return;
      case 'finish': this.confetti(at); return;
    }
  }

  /** Goblin's Mug brought the racer's latest stack, of `level` stones, from `victim` or out of nowhere. */
  private mugged(p: Racer, level: number, victim?: Racer) {
    const top = p.stones.at(-1); if (top) this.abilities.mugged(p.id, victim?.id, top.kind, top.level === level ? p.stones.length - 1 : undefined);
  }

  update(dt: number, race: Race | null, chars: Map<string, Character>, playerId: string, camera: THREE.Camera, paused: boolean) {
    this.time += dt; this.flash = Math.max(0, this.flash - dt * 3.5); this.shake = Math.max(0, this.shake - dt * 1.6);
    if (!race) { if (this.raceId) { this.reset(); this.raceId = ''; } this.glow.update(dt); this.smoke.update(dt); return; }
    if (race.id !== this.raceId) { this.reset(); this.raceId = race.id; for (const e of race.events) if (race.time - e.time > .5) this.seen.add(e.id); }
    if (paused) dt = 0;
    for (const e of race.events) if (!this.seen.has(e.id)) { this.seen.add(e.id); this.onEvent(e, race, playerId); }
    if (this.seen.size > 400) { const keep = new Set(race.events.map(e => e.id)); for (const id of this.seen) if (!keep.has(id)) this.seen.delete(id); }
    this.syncFireballs(dt, race.projectiles.map(o => ({ key: `f${o.id}`, x: o.px, y: floorY(race, o.px, o.pz) + 1.3, z: o.pz, level: o.level })));
    this.syncTraps(dt, race.traps.map(o => ({ key: `t${o.id}`, x: o.px, y: floorY(race, o.px, o.pz), z: o.pz, radius: o.radius })));
    this.updateRacers(dt, race, chars);
    this.abilities.update(dt, camera, race.racers, chars);
    this.animate(dt, camera, race);
  }
  /** Advances effects with no race running. The studio previews one-shot effects, fireballs and traps through this. */
  preview(dt: number, camera: THREE.Camera) { this.time += dt; this.flash = Math.max(0, this.flash - dt * 3.5); this.shake = Math.max(0, this.shake - dt * 1.6); this.animate(dt, camera, null); }
  /** Advances bolts, bursts, shader time and particles. */
  private animate(dt: number, camera: THREE.Camera, race: Race | null) {
    for (const b of this.bolts) if (b.age < b.life) b.update(dt, camera);
    this.bursts.update(dt, race, this.time);
    for (const m of [this.fireCore, this.fireShell, this.miniFireCore, this.shieldMat, this.iceMat, this.frostMat, this.frozenMat]) m.uniforms.uTime.value = this.time;
    this.glow.update(dt); this.smoke.update(dt);
  }

  /** Shows exactly the fireballs listed, creating new ones and bursting the ones that disappeared. */
  syncFireballs(dt: number, balls: FireballView[]) {
    const live = new Set<string>();
    for (const o of balls) {
      const key = o.key, y = o.y; live.add(key);
      let f = this.fire.get(key);
      if (!f) {
        const g = new THREE.Group(), big = FIREBALL_SIZE[o.level - 1] ?? 1, core = new THREE.Mesh(sphereGeo, o.level >= 2 ? this.miniFireCore : this.fireCore), outer = new THREE.Mesh(sphereGeo, this.fireShell);
        core.scale.setScalar(.62 * big); outer.scale.setScalar(1.1 * big); g.add(core, outer);
        if (o.level === 3) for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(sphereGeo, this.fireCore); m.scale.setScalar(.3); m.userData.orbit = i; g.add(m); }
        f = { g, last: new THREE.Vector3(o.x, y, o.z), level: o.level, age: 0 }; this.group.add(g); this.fire.set(key, f);
      }
      f.age += dt; const g = f.g, prev = f.last.clone(); g.position.set(o.x, y + Math.sin(f.age * 9) * .08, o.z); f.last.copy(g.position);
      // Grow in over the first moments so several fireballs leaving one caster do not flare into a white blob.
      g.scale.setScalar(.35 + .65 * Math.min(1, f.age / .18));
      const vel = v.subVectors(g.position, prev).divideScalar(Math.max(dt, 1e-3));
      const big = FIREBALL_SIZE[f.level - 1] ?? 1;
      g.children.forEach(c => { if (c.userData.orbit !== undefined) { const a = f!.age * 9 + c.userData.orbit * 2.09; c.position.set(Math.cos(a) * 1.4, Math.sin(a * 1.3) * .4, Math.sin(a) * 1.4); } });
      if (dt > 0) {
        // Fill the whole distance travelled this frame with flame, so a fast fireball leaves an unbroken trail.
        const steps = Math.min(10, Math.ceil(prev.distanceTo(g.position) / .6)), n = Math.max(1, Math.round(steps * this.density));
        for (let i = 0; i < n; i++) { const k = (i + rand(0, 1)) / n, x = prev.x + (g.position.x - prev.x) * k, y = prev.y + (g.position.y - prev.y) * k, z = prev.z + (g.position.z - prev.z) * k; this.glow.emit({ x: x + rand() * .3 * big, y: y + rand() * .3 * big, z: z + rand() * .3 * big, vx: -vel.x * .05 + rand() * 1.2, vy: rand(0, 1.5), vz: -vel.z * .05 + rand() * 1.2, life: rand(.35, .6), size: rand(.8, 1.2) * big, endSize: .15, color: '#ffc060', endColor: '#ff2a08', drag: 2 }); }
        if (Math.random() < .5) this.smoke.emit({ x: g.position.x, y: g.position.y, z: g.position.z, vx: rand() * .5, vy: rand(.6, 1.6), vz: rand() * .5, life: rand(.6, 1), size: .45, endSize: 1.6, color: '#3b302c', endColor: '#77706a', alpha: .35, drag: 1.2, shape: Shape.Smoke });
        if (Math.random() < .35) this.glow.emit({ x: g.position.x, y: g.position.y, z: g.position.z, vx: rand() * 4, vy: rand(1, 4), vz: rand() * 4, life: rand(.3, .6), size: .09, color: '#fff2b8', endColor: '#ff6a20', gravity: 8, stretch: .04, shape: Shape.Shard });
      }
    }
    for (const [key, f] of this.fire) if (!live.has(key)) { this.spray(this.glow, 12, () => ({ x: f.g.position.x, y: f.g.position.y, z: f.g.position.z, vx: rand() * 4, vy: rand(0, 4), vz: rand() * 4, life: rand(.2, .4), size: rand(.5, .9), endSize: .1, color: '#ffd27a', endColor: '#ff3a10', drag: 3 })); this.group.remove(f.g); this.fire.delete(key); }
  }

  /** Shows exactly the ice traps listed, growing new ones and shattering the ones that disappeared. */
  syncTraps(dt: number, traps: TrapView[]) {
    const live = new Set<string>();
    for (const o of traps) {
      const key = o.key; live.add(key); let t = this.ice.get(key);
      if (!t) {
        const g = new THREE.Group(), y = o.y;
        const frost = new THREE.Mesh(ringGeo, this.frostMat); frost.scale.setScalar(o.radius * 1.15); frost.position.y = .06; g.add(frost);
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + i, r = i === 0 ? 0 : o.radius * rand(.3, .6), m = new THREE.Mesh(shardGeo, this.iceMat); m.position.set(Math.cos(a) * r, -.1, Math.sin(a) * r); m.rotation.set(Math.sin(a) * .5 * (i ? 1 : 0), a, Math.cos(a) * .5 * (i ? 1 : 0)); const h = i === 0 ? 1.6 : rand(.7, 1.2); m.userData.s = [h * .9, h, h * .9]; g.add(m); }
        g.position.set(o.x, y, o.z); this.group.add(g); t = { g, age: 0, px: o.x, pz: o.z, y }; this.ice.set(key, t);
        this.spray(this.smoke, 8, () => ({ x: o.x + rand(), y: y + .3, z: o.z + rand(), vx: rand(), vy: rand(.2, .8), vz: rand(), life: 1, size: .8, endSize: 2, color: '#eaf8ff', alpha: .4, drag: 1, shape: Shape.Smoke }));
      }
      t.age += dt; const grow = Math.min(1, t.age / .25), pop = 1 + Math.sin(Math.min(1, t.age / .35) * Math.PI) * .15;
      t.g.children.forEach(c => { const sc = c.userData.s as number[] | undefined; if (sc) c.scale.set(sc[0] * grow * pop, sc[1] * grow * pop, sc[2] * grow * pop); });
      if (dt > 0 && Math.random() < .12) this.glow.emit({ x: t.px + rand() * o.radius * .7, y: t.y + rand(.3, 1.6), z: t.pz + rand() * o.radius * .7, vy: .3, life: rand(.4, .8), size: rand(.3, .5), color: '#ffffff', endColor: '#8fdcff', shape: Shape.Star });
      if (dt > 0 && Math.random() < .08) this.smoke.emit({ x: t.px + rand() * o.radius, y: t.y + .15, z: t.pz + rand() * o.radius, vx: rand() * .3, vy: .1, vz: rand() * .3, life: 1.6, size: 1, endSize: 2.2, color: '#eaf8ff', alpha: .22, drag: .5, shape: Shape.Smoke });
    }
    for (const [key, t] of this.ice) if (!live.has(key)) { this.shatter(new THREE.Vector3(t.px, t.y + .6, t.pz), 18); this.disposeIce(t.g); this.ice.delete(key); }
  }

  private updateRacers(dt: number, race: Race, chars: Map<string, Character>) {
    const width = TRACKS[race.track].width, alive = new Set<string>(); this.held.begin(this.time);
    for (const p of race.racers) {
      const c = chars.get(p.id); if (!c) continue; alive.add(p.id); const s = this.status(p.id), y = c.root.position.y, scale = c.root.scale.x;
      const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)), side = new THREE.Vector3(fwd.z, 0, -fwd.x), live = dt > 0;
      // Hit flash and post-crash blink, or an ability's tint over the whole model.
      s.flash = Math.max(0, s.flash - dt * 4);
      const blink = p.invincible > 0 && p.stun <= 0 ? (Math.sin(this.time * 40) > 0 ? .45 : 0) : 0, hit = Math.max(s.flash * .85, blink), tint = this.abilities.tint(p, tintColor);
      c.skin.flash.value = Math.max(hit, tint); c.skin.flashColor.value.copy(tint > hit ? tintColor : white);
      // Exhaust smoke while cruising. Boosts draw their spike fans in the ability effects.
      if (live && p.boost <= 0 && Math.abs(p.speed) > 4) c.exhausts.forEach(ex => { if (Math.random() < .12) { ex.getWorldPosition(v); this.smoke.emit({ x: v.x, y: v.y, z: v.z, vx: -fwd.x * 2, vy: rand(.4, 1), vz: -fwd.z * 2, life: rand(.4, .7), size: .18, endSize: .7, color: '#9a958e', alpha: .3, drag: 2, shape: Shape.Smoke }); } });
      // Drift sparks colour-coded by spin-out risk, plus tyre smoke.
      if (live && p.drifting && Math.abs(p.speed) > 5) {
        const risk = p.drift / HANDLING.overDrift, col = risk < .45 ? '#7fd0ff' : risk < .75 ? '#ffa040' : '#ff4f8a';
        c.contacts.forEach(ct => { ct.getWorldPosition(v); for (let i = 0; i < 2; i++) this.glow.emit({ x: v.x, y: v.y + .05, z: v.z, vx: -fwd.x * rand(3, 7) + side.x * rand(-3, 3), vy: rand(1.5, 4.5), vz: -fwd.z * rand(3, 7) + side.z * rand(-3, 3), life: rand(.18, .35), size: .07, color: '#ffffff', endColor: col, gravity: 14, stretch: .035, shape: Shape.Shard }); if (Math.random() < .35) this.smoke.emit({ x: v.x, y: v.y + .2, z: v.z, vx: rand(), vy: rand(.3, 1), vz: rand(), life: rand(.6, 1), size: .5, endSize: 1.8, color: '#d9d4cc', alpha: .3, drag: 1.5, shape: Shape.Smoke }); });
      }
      // Off-road dust.
      if (live && Math.abs(p.x) > width && Math.abs(p.speed) > 6 && p.flying <= 0 && !RACERS[p.character].hovers && Math.random() < .5) { const ct = c.contacts[Math.floor(Math.random() * c.contacts.length)]; if (ct) { ct.getWorldPosition(v); this.smoke.emit({ x: v.x, y: v.y + .1, z: v.z, vx: -fwd.x * 2 + rand(), vy: rand(.5, 1.6), vz: -fwd.z * 2 + rand(), life: rand(.6, 1.1), size: .5, endSize: 1.9, color: '#a8916a', alpha: .4, drag: 1.4, gravity: .2, shape: Shape.Smoke }); } }
      // Stun stars circling the head.
      if (live && p.stun > 0) { c.head.getWorldPosition(v); const a = this.time * 7; for (let i = 0; i < 3; i++) { const b = a + i * 2.09; this.glow.emit({ x: v.x + Math.cos(b) * .9 * scale, y: v.y + .8 * scale, z: v.z + Math.sin(b) * .9 * scale, life: .18, size: .45 * scale, color: '#fff3a0', endColor: '#ffb340', shape: Shape.Star }); } }
      // Status auras.
      if (live && p.mini > 0 && Math.random() < .2) this.glow.emit({ x: p.px + rand() * .8, y: y + rand(.2, 1.6) * scale, z: p.pz + rand() * .8, vy: .8, life: .6, size: .3, color: '#ffffff', endColor: '#b68bef', shape: Shape.Star });
      // Reflect bubble while the manual shield is up. Barrier draws its own pulses.
      s.shield.visible = p.shield > 0; if (s.shield.visible) { s.shield.position.set(p.px, y + c.height * .45 * scale, p.pz); s.shield.scale.setScalar(c.height * .6 * scale * (1 + Math.sin(this.time * 6) * .02)); s.shield.rotation.y = this.time * .5; }
      // Blizzaga freeze shell.
      const frozen = this.time < s.frozenUntil && p.stun > 0; s.frozen.visible = frozen; if (frozen) { s.frozen.position.set(p.px, y, p.pz); s.frozen.scale.setScalar(scale * c.height / 3.2); }
      // Doom countdown rune.
      s.doom.visible = p.doom > 0;
      if (p.doom > 0) { const n = Math.ceil(p.doom); if (n !== s.doomValue) drawDoom(s, n); c.head.getWorldPosition(v); s.doom.position.set(v.x, v.y + 1.7 * scale, v.z); s.doom.scale.setScalar(1.8 + Math.max(0, Math.sin(this.time * (14 - n))) * .2); if (live && Math.random() < .5) this.glow.emit({ x: p.px + rand() * .8, y: y + rand(.5, 2.5), z: p.pz + rand() * .8, vy: rand(.8, 1.8), life: rand(.5, .9), size: rand(.35, .6), color: '#c46cff', endColor: '#3a0a5a', drag: .5 }); }
      // Held stacks trail behind the racer on the road where the simulation places them, so what you see is what a rival can grab.
      const at = stackPositions(p);
      s.stones.forEach((h, i) => {
        const stack = p.stones[i]; if (!stack) { h.placed = false; return; }
        v2.set(at[i].x, y + HELD_STONE.lift * scale, at[i].z);
        // Ease toward the target so the line sways through corners, but snap on the first frame and after respawns.
        if (!h.placed || h.at.distanceTo(v2) > 8) h.at.copy(v2); else h.at.lerp(v2, 1 - Math.exp(-dt * 18));
        h.placed = true; const look = this.abilities.heldLook(p.id, i);
        if (!look.hidden) this.held.add(h.at, stack.kind, stack.level, scale, p.character * 1.7 + i * 2.1, look.blink);
      });
    }
    for (const [id, s] of this.statuses) if (!alive.has(id)) { disposeStatus(this.group, s); this.statuses.delete(id); }
    this.held.end();
  }
  stats() { return { particles: this.glow.count + this.smoke.count, fireballs: this.fire.size, ice: this.ice.size }; }
}
