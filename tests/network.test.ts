import { describe, it, expect } from 'vitest';
import { createRace, makeRacer, neutralInput, stepRace, TICK } from '../shared/game/index.ts';
import { encodeSnapshot, decodeSnapshot } from '../shared/wire.ts';
import { Prediction } from '../src/prediction.ts';
import { Interpolation } from '../src/interpolation.ts';
const race = () => { const r = createRace('test',[makeRacer('human','Human',0,false)],1,123); r.time=1; r.phase='racing'; return r; };
describe('multiplayer driving and wire state',()=> {
  it('responds to acceleration before any next server state and never runs race side effects',()=> {
    const r=race(), before=structuredClone(r), p=new Prediction(); p.reconcile(r,'human',0);
    const input={...neutralInput(),throttle:true,steer:.5,item:true,ability:true,rescue:true};
    for(let i=0;i<8;i++) p.advance(input,TICK);
    expect(p.pose!.speed).toBeGreaterThan(2); expect(p.pose!.yaw).not.toBe(r.racers[0].yaw);
    expect(r).toEqual(before); expect(p.pose!.stones).toEqual(before.racers[0].stones); expect(p.pose!.lastRescue).toBe(before.racers[0].lastRescue);
  });
  it('acknowledges input history and replays only outstanding driving frames',()=> {
    const r=race(), p=new Prediction(), input={...neutralInput(),throttle:true}; p.reconcile(r,'human',0);
    for(let i=0;i<6;i++) { p.advance(input,TICK); r.racers[0].input=input; stepRace(r); }
    p.reconcile(r,'human',6); expect(p.history).toHaveLength(0); expect(p.pose!.speed).toBeCloseTo(r.racers[0].speed,6);
    p.advance(input,TICK); const speed=p.pose!.speed; p.reconcile(r,'human',6); expect(p.history).toHaveLength(1); expect(p.pose!.speed).toBeCloseTo(speed,6);
  });
  it('bounds history and prediction on stale connections, clears corrections on respawn and finish',()=> {
    const r=race(), p=new Prediction(); p.reconcile(r,'human',0);
    for(let i=0;i<600;i++) p.advance({...neutralInput(),throttle:true},TICK);
    expect(p.history.length).toBeLessThanOrEqual(16); const px=p.pose!.px;
    p.advance({...neutralInput(),throttle:true},TICK); expect(p.pose!.px).toBe(px);
    r.racers[0].lastRescue=5; r.racers[0].px+=40; p.reconcile(r,'human',600);
    expect(p.history).toHaveLength(0); expect(p.render(r.racers[0]).px).toBe(r.racers[0].px);
    r.racers[0].finishTime=6; p.reconcile(r,'human',601); p.advance({...neutralInput(),throttle:true},TICK); expect(p.pose!.px).toBe(r.racers[0].px);
  });
  it('takes authoritative collision velocity and stun without replaying hits or changing results',()=> {
    const r=race(), p=new Prediction(); p.reconcile(r,'human',0); p.advance({...neutralInput(),throttle:true},TICK);
    r.racers[0].stun=2; r.racers[0].vx=-3; r.racers[0].vz=-4; p.reconcile(r,'human',1);
    expect(p.pose!.stun).toBe(2); expect(p.pose!.vx).toBe(-3); p.advance({...neutralInput(),throttle:true},TICK); expect(p.pose!.speed).toBeLessThan(5);
    expect(r.events).toHaveLength(0); expect(r.racers[0].finishTime).toBeNull();
  });
  it('round trips all six racers, keeps reconciliation fields and rejects mismatched metadata',()=> {
    const r=race(); for(let i=0;i<100;i++) stepRace(r);
    const packet=encodeSnapshot(r,100,{human:42}), out=decodeSnapshot(r,packet)!;
    expect(out.racers).toHaveLength(6); expect(out.racers[0].lastRescue).toBe(r.racers[0].lastRescue); expect(out.racers[0].vx).toBeCloseTo(r.racers[0].vx,3);
    expect(out.racers[0].stones).toEqual(r.racers[0].stones); expect(packet.ack.human).toBe(42);
    expect(JSON.stringify(packet).length).toBeLessThan(JSON.stringify(r).length*.7);
    expect(decodeSnapshot({...r,id:'other'},packet)).toBeNull();
  });
});
describe('server-time remote interpolation',()=> {
  it('uses simulation timestamps despite compressed arrivals, handles yaw wrap and rejects old time',()=> {
    const r=race(), b=new Interpolation(); b.push(structuredClone(r),1000); r.time+=.05; r.racers[0].px+=1; r.racers[0].yaw=3.13; b.push(structuredClone(r),1100);
    r.time+=.05; r.racers[0].px+=1; r.racers[0].yaw=-3.13; b.push(structuredClone(r),1101);
    expect(b.sample(1150)).not.toBeNull(); expect(b.bufferMs).toBeGreaterThanOrEqual(70); expect(b.bufferMs).toBeLessThanOrEqual(140);
    const older={...r,time:r.time-.2}; expect(b.push(older,1200)).toBe(false);
    expect(Math.abs(b.sample(1150)!.race.racers[0].yaw)).toBeGreaterThan(3);
  });
  it('caps extrapolation at 100ms and never blends respawn or falling states',()=> {
    const r=race(), b=new Interpolation(); r.racers[0].vx=10; b.push(structuredClone(r),1000);
    const a=b.sample(1300)!, c=b.sample(3000)!; expect(a.underrun).toBe(true); expect(a.race.racers[0].px).toBeCloseTo(c.race.racers[0].px);
    r.time+=.05; r.racers[0].lastRescue=2; r.racers[0].px+=50; b.push(structuredClone(r),3050);
    expect(b.sample(3050)!.race.racers[0].px).toBe(r.racers[0].px);
    r.racers[0].falling=1; r.time+=.05; b.push(structuredClone(r),3100); expect(b.sample(3100)!.race.racers[0].px).toBe(r.racers[0].px);
  });
});
