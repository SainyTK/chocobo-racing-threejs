import * as THREE from 'three';
import { ABILITY_SECONDS } from '../../../../shared/game/abilities.ts';
import { Shape } from '../../particles/particles.ts';
import type { Effects } from '../index.ts';
import type { FlareBatch } from './flare-batch.ts';
import { FLARE_CAST as M, FLARE_STRIKE as S, SPIKE_HOLD } from './looks.ts';
import type { RacerFrame } from './racer-frame.ts';
import { hashIn, swell, within } from './timing.ts';

const glowColor = new THREE.Color(M.glowColor), orbCore = new THREE.Color(M.orbCore), orbMid = new THREE.Color(M.orbMid), orbRim = new THREE.Color(M.orbRim);
const beamCore = new THREE.Color(M.beamCore), beamEdge = new THREE.Color(M.beamEdge), rayColor = new THREE.Color(M.rayColor), white = new THREE.Color('#ffffff');
const shotCore = new THREE.Color(M.shotCore), shotRing = new THREE.Color(M.shotRing), shotRay = new THREE.Color(M.shotRay), shotTip = new THREE.Color(M.shotTip);
const flash = new THREE.Color(S.flash), fire = new THREE.Color(S.fire), fireEdge = new THREE.Color(S.fireEdge), streakRoot = new THREE.Color(S.streakRoot), streak = new THREE.Color(S.streak);
const at = new THREE.Vector3(), flat = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const SHOTS = 48, STRIKES = 12;

/** A warning shot falling on the road near a rival; it bursts for a few frames where it lands. */
interface Shot { from: THREE.Vector3; to: THREE.Vector3; age: number; size: number; live: boolean }
/** A strike's fire cone under its victim. */
interface Strike { at: THREE.Vector3; age: number; size: number; live: boolean }

/** How far into Megaflare's warning a caster is, in seconds, or -1. */
const elapsed = (flare: number) => flare > 0 ? ABILITY_SECONDS.megaflare - flare : -1;

/**
 * Bahamut's Megaflare. On Bahamut: a glow and cross flare, a ring of fire orbs on the road that spreads, then beams
 * shooting straight up. On every rival: starburst shots that fall from the sky and miss. Then the strike: a flame
 * starburst, a fire cone with red streaks, smoke and falling stars, and the victim drawn charred for a moment.
 */
export class MegaflareFx {
  private shots: Shot[] = Array.from({ length: SHOTS }, () => ({ from: new THREE.Vector3(), to: new THREE.Vector3(), age: 0, size: 1, live: false }));
  private strikes: Strike[] = Array.from({ length: STRIKES }, () => ({ at: new THREE.Vector3(), age: 0, size: 1, live: false }));
  private burns = new Map<string, number>();
  constructor(private fx: Effects) {}
  reset() { for (const s of this.shots) s.live = false; for (const s of this.strikes) s.live = false; this.burns.clear(); }
  /** True while a caster is in the shot window, so the caller knows to rain shots on rivals. */
  shooting(flare: number) { return within(elapsed(flare), M.shots) >= 0; }
  caster(batch: FlareBatch, f: RacerFrame, flare: number, time: number) {
    const t = elapsed(flare); if (t < 0) return;
    const h = f.height, seed = Math.floor(time / SPIKE_HOLD), glow = swell(within(t, M.glow), .3), orbs = within(t, M.orbs), beams = within(t, M.beams);
    if (glow > 0) {
      at.copy(f.at).addScaledVector(batch.up, .2 * h).addScaledVector(batch.toward, .8 * h);
      batch.glow(at, h * .9, glowColor, glowColor, glow * .5, .5, .8, .5);
      for (let i = 0; i < 4; i++) batch.screenRay(at, i * Math.PI / 2, h * (i % 2 ? 1.2 : 2), h * .04, white, white, glow, 1, 1);
    }
    flat.copy(batch.right).setY(0).normalize();
    for (let i = 0; i < M.orbCount; i++) {
      const a = i / M.orbCount * Math.PI * 2 + .3, r = h * (M.ringFrom + (M.ringTo - M.ringFrom) * Math.max(0, orbs)), x = f.at.x + Math.cos(a) * r, z = f.at.z + Math.sin(a) * r;
      if (orbs >= 0) {
        const o = swell(orbs, .15); at.set(x, f.at.y + .35 * h, z);
        batch.glow(at, h * M.orbSize, orbMid, orbRim, o, .25, .45); batch.glow(at, h * M.orbSize * .45, orbCore, orbMid, o, .6, .5);
        if (orbs > .3) batch.screenRay(at.set(f.at.x, f.at.y + .4 * h, f.at.z), hashIn(seed * 3 + i, 0, Math.PI * 2), r * 1.4, h * .04, rayColor, rayColor, o * .7, .4, .7);
      }
      if (beams >= 0) { const b = swell(beams, .1), w = h * .55 * (1 - beams * .9); at.set(x, f.at.y, z); batch.ray(at, UP, flat, 40, w, beamEdge, beamEdge, b, 1, 0); batch.ray(at, UP, flat, 40, w * .45, beamCore, beamCore, b, 1, 0); }
    }
  }
  /** Rains warning shots round one rival this frame. */
  rain(f: RacerFrame, dt: number) {
    if (Math.random() > M.shotRate * dt * this.fx.density) return;
    const shot = this.shots.find(s => !s.live); if (!shot) return;
    const a = Math.random() * Math.PI * 2, d = M.missFrom + Math.random() * (M.missTo - M.missFrom);
    shot.to.set(f.at.x + Math.cos(a) * d, f.at.y, f.at.z + Math.sin(a) * d).addScaledVector(f.forward, 2);
    shot.from.copy(shot.to).addScaledVector(f.forward, 5).y += M.shotSpeed * M.shotLife;
    shot.age = 0; shot.size = f.height; shot.live = true;
  }
  strike(at: THREE.Vector3, victimId: string, size: number, mine: boolean) {
    const s = this.strikes.find(x => !x.live) ?? this.strikes[0]; s.at.copy(at); s.age = 0; s.size = size * (mine ? .75 : 1); s.live = true; this.burns.set(victimId, S.burn);
    const fx = this.fx, g = s.size, r = () => Math.random() - .5;
    fx.spray(fx.glow, 44, () => ({ x: at.x + r() * S.width * 2 * g, y: at.y - 1.3 * g + Math.random() * 1.4 * g, z: at.z + r() * S.width * g, vx: r() * 2, vy: .5 + Math.random() * 2.5, vz: r() * 2, life: .6 + Math.random() * .45, size: (1.4 + Math.random() * 1.1) * g, endSize: .6 * g, color: S.fire, endColor: S.fireEdge, drag: 2 }));
    fx.spray(fx.smoke, 10, () => ({ x: at.x + r() * S.width * g, y: at.y + .3 * g, z: at.z + r() * S.width * g, vx: r() * 1.5, vy: .8 + Math.random() * 1.5, vz: r() * 1.5, life: 1 + Math.random() * .6, size: .8 * g, endSize: 2.4 * g, color: '#5a4038', endColor: '#8b8480', alpha: .5, drag: 1.4, shape: Shape.Smoke }));
    fx.spray(fx.glow, 8, () => ({ x: at.x + r() * 2 * g, y: at.y + (1.5 + Math.random() * 1.5) * g, z: at.z + r() * 2 * g, vx: r(), vy: 1, vz: r(), life: .9 + Math.random() * .4, size: .45, color: '#ffe680', endColor: '#ffb030', gravity: 4, shape: Shape.Star }));
    fx.flash = Math.max(fx.flash, mine ? .3 : .45);
  }
  /** The charred tint on a struck racer, written to `out`; returns how strongly it applies. */
  tint(id: string, out: THREE.Color) { const b = this.burns.get(id); if (!b) return 0; out.set(S.charred); return Math.min(1, b / S.burn * 1.5) * .6; }
  /** Moves and draws the warning shots and strikes. */
  update(batch: FlareBatch, dt: number, time: number) {
    const seed = Math.floor(time / SPIKE_HOLD);
    for (const [id, b] of this.burns) if (b - dt <= 0) this.burns.delete(id); else this.burns.set(id, b - dt);
    this.shots.forEach((s, n) => {
      if (!s.live) return; s.age += dt;
      const k = s.age / M.shotLife, h = s.size; if (k > 1.6) { s.live = false; return; }
      // Falling, then a bigger burst on the road for a few frames.
      const landed = k >= 1; at.lerpVectors(s.from, s.to, Math.min(1, k)); if (landed) at.y += .4 * h;
      const size = landed ? 1.3 : .9, alpha = landed ? 1 - (k - 1) / .6 : 1;
      at.addScaledVector(batch.toward, .5 * h);
      batch.glow(at, h * .62 * size, shotCore, shotRing, alpha, .45, .5);
      for (let i = 0; i < 12; i++) batch.screenRay(at, i / 12 * Math.PI * 2 + hashIn(seed + n * 9 + i, -.2, .2), h * size * hashIn(seed * 3 + n + i, 1.1, 1.8), h * .1, shotRay, shotTip, alpha, .1, .9);
      if (landed && k - dt / M.shotLife < 1) this.fx.spray(this.fx.glow, 4, () => ({ x: s.to.x + (Math.random() - .5) * h, y: s.to.y + .3, z: s.to.z + (Math.random() - .5) * h, vy: 1 + Math.random(), life: .35, size: .6 * h, endSize: .2, color: S.fire, endColor: S.fireEdge, drag: 2 }));
    });
    this.strikes.forEach((s, n) => {
      if (!s.live) return; s.age += dt;
      const k = s.age / S.life, g = s.size; if (k > 1) { s.live = false; return; }
      if (s.age < 1 / 15) {
        // One frame of a flame starburst as the shot hits.
        at.copy(s.at).addScaledVector(batch.toward, 1); batch.glow(at, 1.6 * g, white, flash, 1, .5, .4);
        for (let i = 0; i < 12; i++) batch.screenRay(at, i / 12 * Math.PI * 2, 2.8 * g * hashIn(n + i, .7, 1.2), .3 * g, flash, flash, 1, .05, .9);
      }
      flat.copy(batch.right).setY(0).normalize(); const fade = 1 - k * k;
      at.copy(s.at).y -= 1.2 * g; batch.glow(at.addScaledVector(batch.toward, .5), 1.1 * g * S.width, fire, fireEdge, fade * .7, .4, .6, .6);
      for (let i = 0; i < S.streaks; i++) {
        at.set(s.at.x, s.at.y - 1.3 * g, s.at.z).addScaledVector(flat, (hashIn(n * 5 + i, -1, 1)) * S.width * g);
        batch.ray(at, UP, flat, S.height * g * hashIn(seed + i, .5, 1), .22 * g, streakRoot, streak, fade, .25, .5);
      }
    });
  }
}
