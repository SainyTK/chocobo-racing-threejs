import type { Race, Racer } from './game/types.ts';
/** Version 2: fixed-order fields avoid repeating JSON property names at 20 Hz.
 * Full initial state establishes static metadata. All reconciliation fields remain.
 * Legacy clients keep receiving v1 state until they reload. */
export const DYNAMIC_FIELDS = ['bot','connected','px','pz','yaw','vx','vz','speed','s','routeS','x','drift','drifting','boost','shield','stun','invincible','flying','gripUp','charging','mini','miniLevel','doom','doomOwner','falling','wrongWay','ability','stones','item','itemLevel','finishTime','rank','lap','lapTimes','lapStart','gates','lastSafeS','lastRescue','contactCooldown','wallCooldown','pickupCooldown','lastItem','lastAbility','lastThrottle','throttleAt','spinReleased','spinDash','input'] as const satisfies readonly (keyof Racer)[];
export interface Snapshot { id: string; tick: number; time: number; phase: Race['phase']; racers: unknown[][]; pickups: number[]; traps: Race['traps']; projectiles: Race['projectiles']; events: Race['events']; eventId: number; firstFinish: number | null; ack: Record<string, number> }
const rounded = (v: unknown) => typeof v === 'number' ? Math.round(v * 10000) / 10000 : v;
export function encodeSnapshot(r: Race, tick: number, ack: Record<string, number> = {}): Snapshot {
  return { id: r.id, tick, time: r.time, phase: r.phase, racers: r.racers.map(p => DYNAMIC_FIELDS.map(k => rounded(p[k]))), pickups: r.pickups, traps: r.traps, projectiles: r.projectiles, events: r.events, eventId: r.eventId, firstFinish: r.firstFinish, ack };
}
export function decodeSnapshot(meta: Race, s: Snapshot): Race | null {
  if (meta.id !== s.id || meta.racers.length !== s.racers.length) return null;
  return { ...meta, ...s, racers: meta.racers.map((p,i) => {
    const result = { ...p }; DYNAMIC_FIELDS.forEach((k,j) => { (result as any)[k] = s.racers[i][j]; }); return result;
  }) };
}
