import type { Race, Racer } from '../shared/game/index.ts';
import { angleDelta } from '../shared/math.ts';
/** Server-time interpolation. Arrival spacing only estimates jitter, not pose time. */
export class Interpolation {
  snapshots: { arrival: number; race: Race }[] = [];
  bufferMs = 85; jitterMs = 0; private offset = 0;
  reset() { this.snapshots = []; this.bufferMs = 85; this.jitterMs = 0; this.offset = 0; }
  push(race: Race, now: number) {
    const prev = this.snapshots.at(-1);
    if (prev?.race.id !== race.id) this.reset();
    if (prev && race.time < prev.race.time) return false;
    const offset = race.time * 1000 - now;
    if (!this.snapshots.length) this.offset = offset;
    else {
      // Fast adaptation to a shorter delivery time; slow decay avoids arrival jitter.
      this.offset += (offset-this.offset) * (offset > this.offset ? .5 : .01);
      if (prev && race.time > prev.race.time) {
        const variation = Math.abs(now-prev.arrival-(race.time-prev.race.time)*1000);
        this.jitterMs += (Math.min(150,variation)-this.jitterMs)*.1;
        this.bufferMs += (Math.max(70,Math.min(140,70+this.jitterMs*2))-this.bufferMs)*.1;
      }
    }
    this.snapshots.push({ arrival: now,race }); if (this.snapshots.length>32) this.snapshots.shift(); return true;
  }
  sample(now: number): { race: Race; underrun: boolean; ageMs: number } | null {
    const latest = this.snapshots.at(-1); if (!latest) return null;
    const clock = (now+this.offset)/1000, at = clock-this.bufferMs/1000;
    let before = this.snapshots[0], after = latest;
    for (let i=1;i<this.snapshots.length;i++) if (this.snapshots[i].race.time>=at) { before=this.snapshots[i-1]; after=this.snapshots[i]; break; }
    const underrun = at>latest.race.time;
    const t = Math.max(0,Math.min(1,(at-before.race.time)/Math.max(.000001,after.race.time-before.race.time)));
    const extrapolation = Math.max(0,Math.min(.1,at-latest.race.time));
    return { underrun, ageMs: Math.max(0,(clock-latest.race.time)*1000), race: { ...latest.race, racers: latest.race.racers.map(p=> {
      const a = before.race.racers.find(q=>q.id===p.id)||p, b = after.race.racers.find(q=>q.id===p.id)||p;
      if (a.lastRescue !== b.lastRescue || a.falling > 0 || b.falling > 0 || Math.hypot(b.px-a.px,b.pz-a.pz)>12) return { ...p };
      if (underrun) {
        const ahead = latest.race.phase==='racing' && p.finishTime===null && p.falling<=0 ? extrapolation : 0;
        return { ...p,px:p.px+p.vx*ahead,pz:p.pz+p.vz*ahead };
      }
      return { ...p,px:a.px+(b.px-a.px)*t,pz:a.pz+(b.pz-a.pz)*t,yaw:a.yaw+angleDelta(b.yaw,a.yaw)*t,s:a.s+(b.s-a.s)*t,x:a.x+(b.x-a.x)*t };
    }) } };
  }
}
