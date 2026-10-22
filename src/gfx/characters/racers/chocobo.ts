import * as THREE from 'three';
import { damp } from '../math.ts';
import { POSE_SECONDS } from '../poses.ts';
import { Rig } from '../rig.ts';
import { anchor, driven, skinnedModel } from '../skinned.ts';
import type { Build } from '../types.ts';

/** Loops blend by speed; Cast, Win and Lose follow the reaction's own clock so every viewer sees the same frame. */
const LOOPS = ['Idle', 'Skate'] as const, POSED = ['Cast', 'Win', 'Lose'] as const;
type ClipName = typeof LOOPS[number] | typeof POSED[number];
/** Seconds between blinks, and how long one lasts. */
const BLINK = { every: 3.5, seconds: .18 };
const FRONT_RADIUS = .13, REAR_RADIUS = .17;
/** Flap is a wingbeat layered on top of whatever the body is doing, so it plays as an additive copy, made once per clip. */
const additive = new WeakMap<THREE.AnimationClip, THREE.AnimationClip>();

/** Chocobo on the Jet-Blades CR: one skinned model for the bird and both rocket skates, with the wheels turned in code. */
export function chocobo(): Build {
  const r = new Rig(), m = skinnedModel(r, 'chocobo');
  const action = (name: string) => { const a = m.actions.get(name); if (!a) throw new Error(`Chocobo has no ${name} clip`); a.play(); a.weight = 0; return a; };
  const clips = Object.fromEntries([...LOOPS, ...POSED].map(n => [n, action(n)])) as Record<ClipName, ReturnType<typeof action>>, blink = action('Blink');
  for (const a of [...POSED.map(n => clips[n]), blink]) a.timeScale = 0;
  const beat = action('Flap').getClip();
  if (!additive.has(beat)) additive.set(beat, THREE.AnimationUtils.makeClipAdditive(beat.clone()));
  const flap = m.mixer.clipAction(additive.get(beat)!); flap.play(); flap.weight = 0;
  const head = m.bone('head'), weights: Record<ClipName, number> = { Idle: 0, Skate: 0, Cast: 0, Win: 0, Lose: 0 };
  const turning = [...['L', 'R'].map(s => ({ d: driven(m, `wheel_front.${s}`, [1, 0, 0], 'x'), r: FRONT_RADIUS })), ...['L', 'R'].map(s => ({ d: driven(m, `wheel_rear.${s}`, [1, 0, 0], 'x'), r: REAR_RADIUS }))];
  // Boost flames and smoke leave the exhaust tips; drift sparks and dust come from under the rear wheels.
  const exhausts = [anchor(m, 'foot.L', [1, .65, -.8]), anchor(m, 'foot.R', [-1, .65, -.8])];
  const contacts = [anchor(m, 'foot.L', [.58, .02, -.5]), anchor(m, 'foot.R', [-.58, .02, -.5])];
  let fresh = true, flapping = 0;
  return { r, head, height: 3.5, wheels: turning.map(w => ({ j: w.d.j, r: w.r })), steer: [], exhausts, contacts, outline: m.outline, update(s, k) {
    const pose = s.pose, ended = pose?.kind === 'win' || pose?.kind === 'lose' ? pose : null;
    const casting = pose?.kind === 'cast' ? 1 : 0, cruise = ended ? 0 : 1 - casting, skating = s.menu ? 0 : Math.min(1, k * 3);
    const target: Record<ClipName, number> = { Idle: cruise * (1 - skating), Skate: cruise * skating, Cast: casting, Win: ended?.kind === 'win' ? 1 : 0, Lose: ended?.kind === 'lose' ? 1 : 0 };
    for (const n of [...LOOPS, ...POSED]) { weights[n] = fresh ? target[n] : damp(weights[n], target[n], 12, s.dt); clips[n].weight = weights[n]; }
    fresh = false;
    flapping = damp(flapping, s.flying > 0 ? 1 : 0, 10, s.dt); flap.weight = flapping;
    if (pose?.kind === 'cast') clips.Cast.time = Math.min(1, pose.t / POSE_SECONDS.cast) * clips.Cast.getClip().duration;
    if (ended) { const c = clips[ended.kind === 'win' ? 'Win' : 'Lose']; c.time = ended.t % c.getClip().duration; }
    clips.Skate.timeScale = .6 + k * .9;
    const b = (s.t + .6) % BLINK.every; blink.weight = b < BLINK.seconds ? 1 : 0; blink.time = Math.min(b, BLINK.seconds);
    m.mixer.update(s.dt);
    for (const w of turning) w.d.sync();
    head.rotation.y += s.menu ? Math.sin(s.t * .7) * .35 : s.steer * .3;
  } };
}
