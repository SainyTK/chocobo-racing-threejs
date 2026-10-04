import type { Input, Race, Racer } from '../shared/game/index.ts';
import { TICK } from '../shared/game/index.ts';
import { integrateDriving } from '../shared/game/driving.ts';
import { projectOnTrack, trackLength } from '../shared/track/index.ts';
import { angleDelta, mod } from '../shared/math.ts';
type Command = { seq: number; dt: number; input: Input };
/** Approximate acknowledged held-input replay, bounded to 250ms/120 commands.
 * Commands describe elapsed client frames, not authoritative server ticks.
 * Only driving is speculative. The server alone handles every race side effect. */
export class Prediction {
  seq = 0; history: Command[] = []; pose: Racer | null = null;
  private race: Race | null = null; private age = 0;
  private offset = { x: 0, z: 0, yaw: 0 }; correction = 0;
  reset() { this.seq = 0; this.history = []; this.pose = null; this.race = null; this.age = 0; this.offset = { x: 0, z: 0, yaw: 0 }; }
  private drive(p: Racer, input: Input, duration: number) {
    if (!this.race || this.race.phase !== 'racing' || p.finishTime !== null || p.falling > 0) return;
    p.input = { ...input, item: false, ability: false, rescue: false };
    let remaining = Math.min(.1, duration);
    while (remaining > .000001) {
      const dt = Math.min(TICK, remaining); remaining -= dt;
      for (const k of ['boost','stun','flying','gripUp','mini'] as const) p[k] = Math.max(0,p[k]-dt);
      p.drifting = (input.drift || input.throttle && input.brake) && Math.abs(input.steer) > .12 && p.speed > 9 && p.stun <= 0;
      integrateDriving(this.race.track,p,dt);
      const projection = projectOnTrack(this.race.track,p.px,p.pz,p.routeS), len = trackLength(this.race.track);
      p.s += mod(projection.s-p.routeS+len/2,len)-len/2; p.routeS = projection.s; p.x = projection.offset;
    }
  }
  reconcile(race: Race, id: string, ack: number) {
    const p = race.racers.find(p=>p.id===id); if (!p) return;
    const old = this.pose, visual = old ? this.view(old) : null;
    const discontinuity = !old || old.lastRescue !== p.lastRescue || old.falling !== p.falling && (old.falling > 0 || p.falling > 0) || Math.hypot(old.px-p.px,old.pz-p.pz)>12 || p.finishTime !== null || race.phase !== 'racing';
    this.race = race; this.age = 0;
    this.history = discontinuity ? [] : this.history.filter(c=>c.seq>ack);
    this.pose = { ...p, input: { ...p.input } };
    // Oldest outstanding frames are not allowed to grow speculative time without bound.
    let duration = this.history.reduce((s,c)=>s+c.dt,0);
    while (duration > .25 && this.history.length) duration -= this.history.shift()!.dt;
    for (const c of this.history) this.drive(this.pose,c.input,c.dt);
    this.correction = old ? Math.hypot(this.pose.px-old.px,this.pose.pz-old.pz) : 0;
    this.offset = visual && !discontinuity ? { x: visual.px-this.pose.px, z: visual.pz-this.pose.pz, yaw: angleDelta(visual.yaw,this.pose.yaw) } : { x: 0,z: 0,yaw: 0 };
    // Never hide major authoritative corrections behind a long visual glide.
    if (Math.hypot(this.offset.x,this.offset.z)>3) this.offset = { x: 0,z: 0,yaw: 0 };
  }
  advance(input: Input, dt: number) {
    const command = { seq: ++this.seq, dt: Math.min(.1,Math.max(0,dt)), input: { ...input } };
    this.age += command.dt;
    if (this.pose && this.age <= .25) { this.history.push(command); if (this.history.length>120) this.history.shift(); this.drive(this.pose,input,command.dt); }
    const decay = Math.exp(-dt/0.08); this.offset.x *= decay; this.offset.z *= decay; this.offset.yaw *= decay;
    return this.seq;
  }
  private view(p: Racer): Racer { return { ...p, px: p.px+this.offset.x,pz:p.pz+this.offset.z,yaw:p.yaw+this.offset.yaw }; }
  render(authority: Racer) { if (!this.pose) return authority; const p = this.view(this.pose); return { ...authority, px:p.px,pz:p.pz,yaw:p.yaw,vx:p.vx,vz:p.vz,speed:p.speed,s:p.s,routeS:p.routeS,x:p.x,drifting:p.drifting }; }
}
