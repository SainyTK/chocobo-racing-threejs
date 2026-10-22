import * as THREE from 'three';
import { damp } from '../math.ts';
import { POSE_SECONDS } from '../poses.ts';
import { Rig } from '../rig.ts';
import { anchor, driven, overlay, skinnedModel } from '../skinned.ts';
import type { Build } from '../types.ts';

/** Loops blend by speed; Cast, Win and Lose follow the reaction's own clock so every viewer sees the same frame. */
const LOOPS = ['Idle', 'Ride'] as const, POSED = ['Cast', 'Win', 'Lose'] as const;
type ClipName = typeof LOOPS[number] | typeof POSED[number];
/** Seconds between blinks, and how long one lasts. */
const BLINK = { every: 4.2, seconds: .18 };
const FRONT_RADIUS = .55, REAR_RADIUS = .6;
/** His wings rest on the handlebars, so the bars turn only a little with the steering and the wing tips stay on the grips. */
const STEER = .22;
/** Flap is a wingbeat layered on top of whatever the body is doing, so it plays as an additive copy, made once per clip. */
const additive = new WeakMap<THREE.AnimationClip, THREE.AnimationClip>();

/** Chubby Chocobo on the Phat-Burner Plus: one skinned model for the bird and his trike, with fork and wheels turned in code. */
export function chubby(): Build {
  const r = new Rig(), m = skinnedModel(r, 'chubby');
  const action = (name: string) => { const a = m.actions.get(name); if (!a) throw new Error(`Chubby Chocobo has no ${name} clip`); a.play(); a.weight = 0; return a; };
  const clips = Object.fromEntries([...LOOPS, ...POSED].map(n => [n, action(n)])) as Record<ClipName, ReturnType<typeof action>>, blink = action('Blink');
  for (const a of [...POSED.map(n => clips[n]), blink]) a.timeScale = 0;
  const beat = action('Flap').getClip();
  if (!additive.has(beat)) additive.set(beat, THREE.AnimationUtils.makeClipAdditive(beat.clone()));
  const flap = m.mixer.clipAction(additive.get(beat)!); flap.play(); flap.weight = 0;
  const turn = overlay(m, 'head'), head = turn.j, weights: Record<ClipName, number> = { Idle: 0, Ride: 0, Cast: 0, Win: 0, Lose: 0 };
  // The fork turns about its own raked axis, which runs from the front axle up to the steering head.
  const fork = driven(m, 'fork', [0, .87, -.16], 'y'), front = driven(m, 'wheel_front', [1, 0, 0], 'x'), rear = driven(m, 'wheel_rear', [1, 0, 0], 'x');
  // Boost flames and smoke leave the two exhaust tips; drift sparks and dust come from under the rear wheels.
  const exhausts = [anchor(m, 'trike', [.43, 1.76, -1.92]), anchor(m, 'trike', [-.43, 1.76, -1.92])];
  const contacts = [anchor(m, 'wheel_rear', [1.28, .02, -1.05]), anchor(m, 'wheel_rear', [-1.28, .02, -1.05])];
  let fresh = true, flapping = 0;
  return { r, head, height: 3.2, wheels: [{ j: front.j, r: FRONT_RADIUS }, { j: rear.j, r: REAR_RADIUS }], steer: [], exhausts, contacts, outline: m.outline, sync: turn.sync, update(s, k) {
    const pose = s.pose, ended = pose?.kind === 'win' || pose?.kind === 'lose' ? pose : null;
    const casting = pose?.kind === 'cast' ? 1 : 0, cruise = ended ? 0 : 1 - casting, ride = s.menu ? 0 : Math.min(1, k * 3);
    const target: Record<ClipName, number> = { Idle: cruise * (1 - ride), Ride: cruise * ride, Cast: casting, Win: ended?.kind === 'win' ? 1 : 0, Lose: ended?.kind === 'lose' ? 1 : 0 };
    for (const n of [...LOOPS, ...POSED]) { weights[n] = fresh ? target[n] : damp(weights[n], target[n], 12, s.dt); clips[n].weight = weights[n]; }
    fresh = false;
    flapping = damp(flapping, s.flying > 0 ? 1 : 0, 10, s.dt); flap.weight = flapping;
    if (pose?.kind === 'cast') clips.Cast.time = Math.min(1, pose.t / POSE_SECONDS.cast) * clips.Cast.getClip().duration;
    if (ended) { const c = clips[ended.kind === 'win' ? 'Win' : 'Lose']; c.time = ended.t % c.getClip().duration; }
    clips.Ride.timeScale = .6 + k * 1.1;
    const b = (s.t + 2.3) % BLINK.every; blink.weight = b < BLINK.seconds ? 1 : 0; blink.time = Math.min(b, BLINK.seconds);
    fork.j.rotation.y = damp(fork.j.rotation.y, s.menu ? 0 : s.steer * STEER, 12, s.dt);
    m.update(s.dt);
    for (const d of [fork, front, rear]) d.sync();
    head.rotation.y = s.menu ? Math.sin(s.t * .6) * .3 : s.steer * .25;
  } };
}
