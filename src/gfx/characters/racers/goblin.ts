import { damp } from '../math.ts';
import { POSE_SECONDS } from '../poses.ts';
import { Rig } from '../rig.ts';
import { anchor, driven, overlay, skinnedModel } from '../skinned.ts';
import { swingSpring } from '../spring.ts';
import type { Build } from '../types.ts';

/** Loops blend by speed; Cast, Win and Lose follow the reaction's own clock so every viewer sees the same frame. */
const LOOPS = ['Idle', 'Ride'] as const, POSED = ['Cast', 'Win', 'Lose'] as const;
type ClipName = typeof LOOPS[number] | typeof POSED[number];
/** Seconds between blinks, and how long one lasts. */
const BLINK = { every: 3.7, seconds: .18 };
/** All four wooden wheels are alike, as built in scripts/characters/goblin. */
const WHEEL_RADIUS = .5;

/** Goblin in the Gob-Cart H4: one skinned model for the goblin and his mine cart, with wheels, steering and lantern moved in code. */
export function goblin(): Build {
  const r = new Rig(), m = skinnedModel(r, 'goblin');
  const action = (name: string) => { const a = m.actions.get(name); if (!a) throw new Error(`Goblin has no ${name} clip`); a.play(); a.weight = 0; return a; };
  const clips = Object.fromEntries([...LOOPS, ...POSED].map(n => [n, action(n)])) as Record<ClipName, ReturnType<typeof action>>, blink = action('Blink');
  for (const a of [...POSED.map(n => clips[n]), blink]) a.timeScale = 0;
  const turn = overlay(m, 'head'), head = turn.j, lantern = overlay(m, 'lantern'), sway = swingSpring();
  const weights: Record<ClipName, number> = { Idle: 0, Ride: 0, Cast: 0, Win: 0, Lose: 0 };
  // The front wheels steer about upright pivots at their hubs and spin on axles that turn with them; the rear pair shares one axle.
  const steer = ['L', 'R'].map(side => driven(m, `steer.${side}`, [0, 1, 0], 'y'));
  const wheels = [...['L', 'R'].map(side => driven(m, `wheel_front.${side}`, [1, 0, 0], 'x')), driven(m, 'wheel_rear', [1, 0, 0], 'x')];
  // A push cart has no engine: boost flames leave the back corners of the box, and drift sparks and dust come from under the rear wheels.
  const exhausts = [anchor(m, 'cart', [.6, .75, -1.26]), anchor(m, 'cart', [-.6, .75, -1.26])];
  const contacts = [anchor(m, 'cart', [1.08, .02, -.78]), anchor(m, 'cart', [-1.08, .02, -.78])];
  let fresh = true;
  return { r, head, height: 3.1, wheels: wheels.map(w => ({ j: w.j, r: WHEEL_RADIUS })), steer: steer.map(s => s.j), exhausts, smokes: false, contacts, outline: m.outline,
    sync() { turn.sync(); lantern.sync(); },
    update(s, k) {
      const pose = s.pose, ended = pose?.kind === 'win' || pose?.kind === 'lose' ? pose : null;
      const casting = pose?.kind === 'cast' ? 1 : 0, cruise = ended ? 0 : 1 - casting, ride = s.menu ? 0 : Math.min(1, k * 3);
      const target: Record<ClipName, number> = { Idle: cruise * (1 - ride), Ride: cruise * ride, Cast: casting, Win: ended?.kind === 'win' ? 1 : 0, Lose: ended?.kind === 'lose' ? 1 : 0 };
      for (const n of [...LOOPS, ...POSED]) { weights[n] = fresh ? target[n] : damp(weights[n], target[n], 12, s.dt); clips[n].weight = weights[n]; }
      fresh = false;
      if (pose?.kind === 'cast') clips.Cast.time = Math.min(1, pose.t / POSE_SECONDS.cast) * clips.Cast.getClip().duration;
      if (ended) { const c = clips[ended.kind === 'win' ? 'Win' : 'Lose']; c.time = ended.t % c.getClip().duration; }
      clips.Ride.timeScale = .7 + k * .8;
      const b = (s.t + 1.1) % BLINK.every; blink.weight = b < BLINK.seconds ? 1 : 0; blink.time = Math.min(b, BLINK.seconds);
      m.update(s.dt);
      for (const d of [...steer, ...wheels]) d.sync();
      // The lantern hangs below its hook, so it swings the opposite way to a part standing on its spring. It only swings
      // sideways: tipping back with speed would push it into the front wall.
      sway(lantern.j, s.dt, s.menu ? 0 : -s.steer * .6, 0, s.t);
      head.rotation.y = s.menu ? Math.sin(s.t * .7) * .3 : s.steer * .25;
    } };
}
