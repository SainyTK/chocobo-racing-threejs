import * as THREE from 'three';
import { clamp, damp } from '../math.ts';
import { POSE_SECONDS } from '../poses.ts';
import { Rig } from '../rig.ts';
import { anchor, driven, overlay, skinnedModel } from '../skinned.ts';
import type { Build } from '../types.ts';

/** Loops blend by speed; Cast, Win and Lose follow the reaction's own clock so every viewer sees the same frame. */
const LOOPS = ['Idle', 'Ride'] as const, POSED = ['Cast', 'Win', 'Lose'] as const;
type ClipName = typeof LOOPS[number] | typeof POSED[number];
const FRONT_RADIUS = .25, REAR_RADIUS = .3;
/** Flap is a wingbeat layered on top of whatever the body is doing, so it plays as an additive copy, made once per clip. */
const additive = new WeakMap<THREE.AnimationClip, THREE.AnimationClip>();

/**
 * The pom-pom's antenna lags behind steering and speed on a damped spring, so it swings as Mog turns and leans back
 * as he speeds up. Angles are in model axes: `x` tips it forward and back, `z` to the sides.
 */
function pomSpring() {
  let vx = 0, x = 0, vz = 0, z = 0;
  return (j: THREE.Object3D, dt: number, steer: number, push: number, t: number) => {
    vz += ((-steer * 3 - z) * 60 - vz * 5) * dt; z += vz * dt;
    vx += ((-push * 1.2 - x) * 60 - vx * 5) * dt; x += vx * dt;
    j.rotation.set(clamp(x * .3 + Math.sin(t * 18) * .04 * push, -.8, .8), 0, clamp(z * .3, -.8, .8));
  };
}

/** Mog on the Mog-Mobile R2: one skinned model for the moogle and his kick scooter, with wheels, fork and antenna moved in code. */
export function mog(): Build {
  const r = new Rig(), m = skinnedModel(r, 'mog', { selfShadow: false });
  const action = (name: string) => { const a = m.actions.get(name); if (!a) throw new Error(`Mog has no ${name} clip`); a.play(); a.weight = 0; return a; };
  const clips = Object.fromEntries([...LOOPS, ...POSED].map(n => [n, action(n)])) as Record<ClipName, ReturnType<typeof action>>;
  for (const n of POSED) clips[n].timeScale = 0;
  const beat = action('Flap').getClip();
  if (!additive.has(beat)) additive.set(beat, THREE.AnimationUtils.makeClipAdditive(beat.clone()));
  const flap = m.mixer.clipAction(additive.get(beat)!); flap.play(); flap.weight = 0;
  const turn = overlay(m, 'head'), head = turn.j, antenna = overlay(m, 'antenna'), sway = pomSpring();
  const weights: Record<ClipName, number> = { Idle: 0, Ride: 0, Cast: 0, Win: 0, Lose: 0 };
  // The fork turns about the stem's raked line; the stem and handlebar stay put so the paws keep their grip.
  const fork = driven(m, 'fork', [0, 1.04, -.1], 'y'), front = driven(m, 'wheel_front', [1, 0, 0], 'x'), rear = driven(m, 'wheel_rear', [1, 0, 0], 'x');
  // Boost flames leave the foot of the batteries; drift sparks and dust come from under the rear wheel.
  const exhausts = [anchor(m, 'scooter', [.25, .62, -1.14]), anchor(m, 'scooter', [-.25, .62, -1.14])];
  const contacts = [anchor(m, 'scooter', [.13, .02, -1.22]), anchor(m, 'scooter', [-.13, .02, -1.22])];
  let fresh = true, flapping = 0;
  return { r, head, height: 3.7, wheels: [{ j: front.j, r: FRONT_RADIUS }, { j: rear.j, r: REAR_RADIUS }], steer: [fork.j], exhausts, smokes: false, contacts, outline: m.outline,
    sync() { turn.sync(); antenna.sync(); },
    update(s, k) {
      const pose = s.pose, ended = pose?.kind === 'win' || pose?.kind === 'lose' ? pose : null;
      const casting = pose?.kind === 'cast' ? 1 : 0, cruise = ended ? 0 : 1 - casting, ride = s.menu ? 0 : Math.min(1, k * 3);
      const target: Record<ClipName, number> = { Idle: cruise * (1 - ride), Ride: cruise * ride, Cast: casting, Win: ended?.kind === 'win' ? 1 : 0, Lose: ended?.kind === 'lose' ? 1 : 0 };
      for (const n of [...LOOPS, ...POSED]) { weights[n] = fresh ? target[n] : damp(weights[n], target[n], 12, s.dt); clips[n].weight = weights[n]; }
      fresh = false;
      flapping = damp(flapping, s.flying > 0 ? 1 : 0, 10, s.dt); flap.weight = flapping;
      if (pose?.kind === 'cast') clips.Cast.time = Math.min(1, pose.t / POSE_SECONDS.cast) * clips.Cast.getClip().duration;
      if (ended) { const c = clips[ended.kind === 'win' ? 'Win' : 'Lose']; c.time = ended.t % c.getClip().duration; }
      clips.Ride.timeScale = .7 + k * .8;
      m.update(s.dt);
      for (const d of [fork, front, rear]) d.sync();
      sway(antenna.j, s.dt, s.menu ? 0 : s.steer, s.menu ? 0 : k, s.t);
      head.rotation.y = s.menu ? Math.sin(s.t * .8) * .3 : s.steer * .25;
    } };
}
