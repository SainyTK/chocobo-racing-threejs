import { damp } from '../math.ts';
import { POSE_SECONDS } from '../poses.ts';
import { Rig } from '../rig.ts';
import { anchor, overlay, skinnedModel } from '../skinned.ts';
import type { Build } from '../types.ts';

/** Loops blend by speed; Cast, Win and Lose follow the reaction's own clock so every viewer sees the same frame. */
const LOOPS = ['Idle', 'Ride'] as const, POSED = ['Cast', 'Win', 'Lose'] as const;
type ClipName = typeof LOOPS[number] | typeof POSED[number];
/** Seconds between blinks, and how long one lasts. */
const BLINK = { every: 3.4, seconds: .16 };

/** White Mage on the Cosmic Carpet: one skinned model for the girl and her floating carpet, which her clips ripple. */
export function whiteMage(): Build {
  const r = new Rig(), m = skinnedModel(r, 'white_mage');
  const action = (name: string) => { const a = m.actions.get(name); if (!a) throw new Error(`White Mage has no ${name} clip`); a.play(); a.weight = 0; return a; };
  const clips = Object.fromEntries([...LOOPS, ...POSED].map(n => [n, action(n)])) as Record<ClipName, ReturnType<typeof action>>, blink = action('Blink');
  for (const a of [...POSED.map(n => clips[n]), blink]) a.timeScale = 0;
  const turn = overlay(m, 'head'), head = turn.j, weights: Record<ClipName, number> = { Idle: 0, Ride: 0, Cast: 0, Win: 0, Lose: 0 };
  // A carpet has no engine: boost flames trail from its back corners, and drift sparks and dust come from the road below them.
  const exhausts = [anchor(m, 'carpet_tail', [.8, .9, -1]), anchor(m, 'carpet_tail', [-.8, .9, -1])];
  const contacts = [anchor(m, 'carpet', [.8, .1, -.9]), anchor(m, 'carpet', [-.8, .1, -.9])];
  let fresh = true;
  return { r, head, height: 3.4, wheels: [], steer: [], exhausts, smokes: false, contacts, outline: m.outline, sync: turn.sync, update(s, k) {
    const pose = s.pose, ended = pose?.kind === 'win' || pose?.kind === 'lose' ? pose : null;
    const casting = pose?.kind === 'cast' ? 1 : 0, cruise = ended ? 0 : 1 - casting, ride = s.menu ? 0 : Math.min(1, k * 3);
    const target: Record<ClipName, number> = { Idle: cruise * (1 - ride), Ride: cruise * ride, Cast: casting, Win: ended?.kind === 'win' ? 1 : 0, Lose: ended?.kind === 'lose' ? 1 : 0 };
    for (const n of [...LOOPS, ...POSED]) { weights[n] = fresh ? target[n] : damp(weights[n], target[n], 12, s.dt); clips[n].weight = weights[n]; }
    fresh = false;
    if (pose?.kind === 'cast') clips.Cast.time = Math.min(1, pose.t / POSE_SECONDS.cast) * clips.Cast.getClip().duration;
    if (ended) { const c = clips[ended.kind === 'win' ? 'Win' : 'Lose']; c.time = ended.t % c.getClip().duration; }
    clips.Ride.timeScale = .7 + k * .8;
    const b = (s.t + .9) % BLINK.every; blink.weight = b < BLINK.seconds ? 1 : 0; blink.time = Math.min(b, BLINK.seconds);
    m.update(s.dt);
    head.rotation.y = s.menu ? Math.sin(s.t * .8) * .3 : s.steer * .25;
  } };
}
