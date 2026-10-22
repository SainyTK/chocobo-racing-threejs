import { damp } from '../math.ts';
import { POSE_SECONDS } from '../poses.ts';
import { Rig } from '../rig.ts';
import { anchor, driven, overlay, skinnedModel } from '../skinned.ts';
import type { Build } from '../types.ts';

/** Loops blend by speed; Cast, Win and Lose follow the reaction's own clock so every viewer sees the same frame. */
const LOOPS = ['Idle', 'Drive'] as const, POSED = ['Cast', 'Win', 'Lose'] as const;
type ClipName = typeof LOOPS[number] | typeof POSED[number];
/** Seconds between blinks, and how long one lasts. */
const BLINK = { every: 4.4, seconds: .18 };
/** The tyres' radius, as built in scripts/characters/golem. */
const WHEEL_RADIUS = .56;

/** Golem in the Rockin' Roller V8: one skinned model for the rock giant and his jeep, with wheels and steering turned in code. */
export function golem(): Build {
  const r = new Rig(), m = skinnedModel(r, 'golem');
  const action = (name: string) => { const a = m.actions.get(name); if (!a) throw new Error(`Golem has no ${name} clip`); a.play(); a.weight = 0; return a; };
  const clips = Object.fromEntries([...LOOPS, ...POSED].map(n => [n, action(n)])) as Record<ClipName, ReturnType<typeof action>>, blink = action('Blink');
  for (const a of [...POSED.map(n => clips[n]), blink]) a.timeScale = 0;
  const turn = overlay(m, 'head'), head = turn.j, weights: Record<ClipName, number> = { Idle: 0, Drive: 0, Cast: 0, Win: 0, Lose: 0 };
  // The front wheels hang on steering knuckles; each knuckle steers before its wheel spins.
  const knuckles = ['L', 'R'].map(side => driven(m, `steer.${side}`, [0, 1, 0], 'y'));
  const wheels = ['L', 'R'].flatMap(side => [driven(m, `wheel_front.${side}`, [1, 0, 0], 'x'), driven(m, `wheel_rear.${side}`, [1, 0, 0], 'x')]);
  // Smoke and boost flames from the two exhaust stacks at the back; drift sparks from under the rear tyres.
  const exhausts = [anchor(m, 'jeep', [.66, 1.56, -1.36]), anchor(m, 'jeep', [-.66, 1.56, -1.36])];
  const contacts = [anchor(m, 'jeep', [1.08, .04, -.92]), anchor(m, 'jeep', [-1.08, .04, -.92])];
  let fresh = true;
  return { r, head, height: 3.9, wheels: wheels.map(w => ({ j: w.j, r: WHEEL_RADIUS })), steer: knuckles.map(k => k.j), exhausts, contacts, outline: m.outline, sync: turn.sync, update(s, k) {
    const pose = s.pose, ended = pose?.kind === 'win' || pose?.kind === 'lose' ? pose : null;
    const casting = pose?.kind === 'cast' ? 1 : 0, cruise = ended ? 0 : 1 - casting, drive = s.menu ? 0 : Math.min(1, k * 3);
    const target: Record<ClipName, number> = { Idle: cruise * (1 - drive), Drive: cruise * drive, Cast: casting, Win: ended?.kind === 'win' ? 1 : 0, Lose: ended?.kind === 'lose' ? 1 : 0 };
    for (const n of [...LOOPS, ...POSED]) { weights[n] = fresh ? target[n] : damp(weights[n], target[n], 12, s.dt); clips[n].weight = weights[n]; }
    fresh = false;
    if (pose?.kind === 'cast') clips.Cast.time = Math.min(1, pose.t / POSE_SECONDS.cast) * clips.Cast.getClip().duration;
    if (ended) { const c = clips[ended.kind === 'win' ? 'Win' : 'Lose']; c.time = ended.t % c.getClip().duration; }
    clips.Drive.timeScale = .7 + k * .8;
    const b = (s.t + 3.1) % BLINK.every; blink.weight = b < BLINK.seconds ? 1 : 0; blink.time = Math.min(b, BLINK.seconds);
    m.update(s.dt);
    for (const d of [...knuckles, ...wheels]) d.sync();
    head.rotation.y = s.menu ? Math.sin(s.t * .5) * .3 : s.steer * .2;
  } };
}
