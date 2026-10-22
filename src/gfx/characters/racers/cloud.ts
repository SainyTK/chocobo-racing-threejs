import { damp } from '../math.ts';
import { POSE_SECONDS } from '../poses.ts';
import { Rig } from '../rig.ts';
import { anchor, driven, skinnedModel } from '../skinned.ts';
import type { Build } from '../types.ts';

/** Loops blend by speed; Cast, Win and Lose follow the reaction's own clock so every viewer sees the same frame. */
const LOOPS = ['Idle', 'Ride'] as const, POSED = ['Cast', 'Win', 'Lose'] as const;
type ClipName = typeof LOOPS[number] | typeof POSED[number];
/** Seconds between blinks, and how long one lasts. */
const BLINK = { every: 3.9, seconds: .16 };
const FRONT_RADIUS = .46, REAR_RADIUS = .5;

/** Cloud on the Hardy-Daytona: one skinned model for rider and bike, with wheels and fork turned in code. */
export function cloud(): Build {
  const r = new Rig(), m = skinnedModel(r, 'cloud');
  const action = (name: string) => { const a = m.actions.get(name); if (!a) throw new Error(`Cloud has no ${name} clip`); a.play(); a.weight = 0; return a; };
  const clips = Object.fromEntries([...LOOPS, ...POSED].map(n => [n, action(n)])) as Record<ClipName, ReturnType<typeof action>>, blink = action('Blink');
  for (const a of [...POSED.map(n => clips[n]), blink]) a.timeScale = 0;
  const head = m.bone('head'), weights: Record<ClipName, number> = { Idle: 0, Ride: 0, Cast: 0, Win: 0, Lose: 0 };
  // The fork turns about its own raked axis, which runs from the front axle up to the steering head.
  const fork = driven(m, 'fork', [0, 1.04, -.44], 'y'), front = driven(m, 'wheel_front', [1, 0, 0], 'x'), rear = driven(m, 'wheel_rear', [1, 0, 0], 'x');
  const exhausts = [anchor(m, 'bike', [.41, .78, -2.22]), anchor(m, 'bike', [-.41, .78, -2.22])];
  const contacts = [anchor(m, 'wheel_rear', [.2, .04, -1.9]), anchor(m, 'wheel_rear', [-.2, .04, -1.9])];
  let fresh = true;
  return { r, head, height: 3.6, wheels: [{ j: front.j, r: FRONT_RADIUS }, { j: rear.j, r: REAR_RADIUS }], steer: [fork.j], exhausts, contacts, outline: m.outline, update(s, k) {
    const pose = s.pose, ended = pose?.kind === 'win' || pose?.kind === 'lose' ? pose : null;
    const casting = pose?.kind === 'cast' ? 1 : 0, cruise = ended ? 0 : 1 - casting, ride = s.menu ? 0 : Math.min(1, k * 3);
    const target: Record<ClipName, number> = { Idle: cruise * (1 - ride), Ride: cruise * ride, Cast: casting, Win: ended?.kind === 'win' ? 1 : 0, Lose: ended?.kind === 'lose' ? 1 : 0 };
    for (const n of [...LOOPS, ...POSED]) { weights[n] = fresh ? target[n] : damp(weights[n], target[n], 12, s.dt); clips[n].weight = weights[n]; }
    fresh = false;
    if (pose?.kind === 'cast') clips.Cast.time = Math.min(1, pose.t / POSE_SECONDS.cast) * clips.Cast.getClip().duration;
    if (ended) { const c = clips[ended.kind === 'win' ? 'Win' : 'Lose']; c.time = ended.t % c.getClip().duration; }
    clips.Ride.timeScale = .7 + k * .8;
    const b = (s.t + 1.7) % BLINK.every; blink.weight = b < BLINK.seconds ? 1 : 0; blink.time = Math.min(b, BLINK.seconds);
    m.mixer.update(s.dt);
    for (const d of [fork, front, rear]) d.sync();
    head.rotation.y += s.menu ? 0 : s.steer * .25;
  } };
}
