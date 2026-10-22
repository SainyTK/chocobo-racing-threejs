import { damp } from '../math.ts';
import { POSE_SECONDS } from '../poses.ts';
import { Rig } from '../rig.ts';
import { anchor, overlay, skinnedModel } from '../skinned.ts';
import type { Build } from '../types.ts';

/** Loops blend by speed; Cast, Win and Lose follow the reaction's own clock so every viewer sees the same frame. */
const LOOPS = ['Idle', 'Ride'] as const, POSED = ['Cast', 'Win', 'Lose'] as const;
type ClipName = typeof LOOPS[number] | typeof POSED[number];
/** Seconds between blinks, and how long one lasts. */
const BLINK = { every: 3.6, seconds: .18 };

/** Black Magician on the MagiCloud MK-1: one skinned model for the mage and his cloud, with the hat's tip swaying in code. */
export function blackMage(): Build {
  const r = new Rig(), m = skinnedModel(r, 'black_mage');
  const action = (name: string) => { const a = m.actions.get(name); if (!a) throw new Error(`Black Magician has no ${name} clip`); a.play(); a.weight = 0; return a; };
  const clips = Object.fromEntries([...LOOPS, ...POSED].map(n => [n, action(n)])) as Record<ClipName, ReturnType<typeof action>>, blink = action('Blink');
  for (const a of [...POSED.map(n => clips[n]), blink]) a.timeScale = 0;
  const turn = overlay(m, 'head'), head = turn.j, tip = overlay(m, 'hat_tip');
  const weights: Record<ClipName, number> = { Idle: 0, Ride: 0, Cast: 0, Win: 0, Lose: 0 };
  // Puffs trail from the back of the cloud; drift sparks and dust come from under it.
  const exhausts = [anchor(m, 'cloud', [.5, .62, -.86]), anchor(m, 'cloud', [-.5, .62, -.86])];
  const contacts = [anchor(m, 'cloud', [.6, .3, -.95]), anchor(m, 'cloud', [-.6, .3, -.95])];
  let fresh = true, sway = 0;
  return { r, head, height: 3.9, wheels: [], steer: [], exhausts, contacts, outline: m.outline,
    sync() { turn.sync(); tip.sync(); },
    update(s, k) {
      const pose = s.pose, ended = pose?.kind === 'win' || pose?.kind === 'lose' ? pose : null;
      const casting = pose?.kind === 'cast' ? 1 : 0, cruise = ended ? 0 : 1 - casting, ride = s.menu ? 0 : Math.min(1, k * 3);
      const target: Record<ClipName, number> = { Idle: cruise * (1 - ride), Ride: cruise * ride, Cast: casting, Win: ended?.kind === 'win' ? 1 : 0, Lose: ended?.kind === 'lose' ? 1 : 0 };
      for (const n of [...LOOPS, ...POSED]) { weights[n] = fresh ? target[n] : damp(weights[n], target[n], 12, s.dt); clips[n].weight = weights[n]; }
      fresh = false;
      if (pose?.kind === 'cast') clips.Cast.time = Math.min(1, pose.t / POSE_SECONDS.cast) * clips.Cast.getClip().duration;
      if (ended) { const c = clips[ended.kind === 'win' ? 'Win' : 'Lose']; c.time = ended.t % c.getClip().duration; }
      clips.Ride.timeScale = .7 + k * .8;
      const b = (s.t + 1.3) % BLINK.every; blink.weight = b < BLINK.seconds ? 1 : 0; blink.time = Math.min(b, BLINK.seconds);
      m.update(s.dt);
      // The hat's floppy tip lags behind: it leans back with speed and swings out of turns.
      sway = damp(sway, -k * .5 - s.steer * .2, 4, s.dt);
      tip.j.rotation.set(sway * .6 + Math.sin(s.t * 3) * .05, 0, s.steer * .25 + Math.sin(s.t * 2.2) * .05);
      head.rotation.y = s.menu ? Math.sin(s.t * .7) * .3 : s.steer * .25;
    } };
}
