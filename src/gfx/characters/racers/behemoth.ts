import * as THREE from 'three';
import { damp } from '../math.ts';
import { POSE_SECONDS } from '../poses.ts';
import { Rig } from '../rig.ts';
import { anchor, driven, overlay, skinnedModel, type SkinnedModel } from '../skinned.ts';
import type { Build } from '../types.ts';

/** Loops blend by speed; Charge, Win and Lose follow the reaction's own clock so every viewer sees the same frame. */
const LOOPS = ['Idle', 'Drive'] as const, POSED = ['Charge', 'Win', 'Lose'] as const;
type ClipName = typeof LOOPS[number] | typeof POSED[number];
/** Seconds between blinks, and how long one lasts. */
const BLINK = { every: 4.1, seconds: .18 };
/** Road wheels per track, their radius, and the spacing of the track pads, as built in scripts/characters/behemoth. */
const ROAD_WHEELS = 4, WHEEL_RADIUS = .2, PAD_PITCH = .2;

/**
 * The track pads under a tank: a bone slid backwards by the distance driven, wrapped to one pad spacing so the evenly
 * spaced pads look like an endless belt. `sync` places it after the mixer update.
 */
function pads(m: SkinnedModel, bone: string) {
  const b = m.bone(bone), rest = b.position.clone();
  m.root.updateMatrixWorld(true);
  const toParent = b.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(m.root.getWorldQuaternion(new THREE.Quaternion()));
  const back = new THREE.Vector3(0, 0, -1).applyQuaternion(toParent);
  return { sync(distance: number) { b.position.copy(rest).addScaledVector(back, ((distance % PAD_PITCH) + PAD_PITCH) % PAD_PITCH); } };
}

/** Behemoth in the Behemo-Buggy 99: one skinned model for the beast and his tank, with road wheels and pads moved in code. */
export function behemoth(): Build {
  const r = new Rig(), m = skinnedModel(r, 'behemoth');
  const action = (name: string) => { const a = m.actions.get(name); if (!a) throw new Error(`Behemoth has no ${name} clip`); a.play(); a.weight = 0; return a; };
  const clips = Object.fromEntries([...LOOPS, ...POSED].map(n => [n, action(n)])) as Record<ClipName, ReturnType<typeof action>>, blink = action('Blink');
  for (const a of [...POSED.map(n => clips[n]), blink]) a.timeScale = 0;
  const turn = overlay(m, 'head'), head = turn.j, weights: Record<ClipName, number> = { Idle: 0, Drive: 0, Charge: 0, Win: 0, Lose: 0 };
  const wheels = ['L', 'R'].flatMap(side => Array.from({ length: ROAD_WHEELS }, (_, i) => driven(m, `wheel${i + 1}.${side}`, [1, 0, 0], 'x')));
  const belts = [pads(m, 'pads.L'), pads(m, 'pads.R')];
  // Smoke from the two exhausts at the back of the hull; drift sparks from the rear of the tracks.
  const exhausts = [anchor(m, 'tank', [.42, .76, -1.42]), anchor(m, 'tank', [-.42, .76, -1.42])];
  const contacts = [anchor(m, 'tank', [1.06, .04, -1.3]), anchor(m, 'tank', [-1.06, .04, -1.3])];
  let fresh = true;
  return { r, head, height: 3.9, wheels: wheels.map(w => ({ j: w.j, r: WHEEL_RADIUS })), steer: [], exhausts, contacts, outline: m.outline, sync: turn.sync, update(s, k) {
    const pose = s.pose, ended = pose?.kind === 'win' || pose?.kind === 'lose' ? pose : null;
    const charging = pose?.kind === 'cast' ? 1 : 0, cruise = ended ? 0 : 1 - charging, drive = s.menu ? 0 : Math.min(1, k * 3);
    const target: Record<ClipName, number> = { Idle: cruise * (1 - drive), Drive: cruise * drive, Charge: charging, Win: ended?.kind === 'win' ? 1 : 0, Lose: ended?.kind === 'lose' ? 1 : 0 };
    for (const n of [...LOOPS, ...POSED]) { weights[n] = fresh ? target[n] : damp(weights[n], target[n], 12, s.dt); clips[n].weight = weights[n]; }
    fresh = false;
    if (pose?.kind === 'cast') clips.Charge.time = Math.min(1, pose.t / POSE_SECONDS.cast) * clips.Charge.getClip().duration;
    if (ended) { const c = clips[ended.kind === 'win' ? 'Win' : 'Lose']; c.time = ended.t % c.getClip().duration; }
    clips.Drive.timeScale = .7 + k * .8;
    const b = (s.t + 2.3) % BLINK.every; blink.weight = b < BLINK.seconds ? 1 : 0; blink.time = Math.min(b, BLINK.seconds);
    m.update(s.dt);
    for (const w of wheels) w.sync();
    for (const belt of belts) belt.sync(wheels[0].j.rotation.x * WHEEL_RADIUS);
    head.rotation.y = s.menu ? Math.sin(s.t * .6) * .3 : s.steer * .25;
  } };
}
