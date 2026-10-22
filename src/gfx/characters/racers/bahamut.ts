import { damp } from '../math.ts';
import { POSE_SECONDS } from '../poses.ts';
import { Rig } from '../rig.ts';
import { anchor, skinnedModel } from '../skinned.ts';
import type { Build } from '../types.ts';

/** Loops blend by speed; Roar, Win and Lose follow the reaction's own clock so every viewer sees the same frame. */
const LOOPS = ['Hover', 'Fly'] as const, POSED = ['Roar', 'Win', 'Lose'] as const;
type ClipName = typeof LOOPS[number] | typeof POSED[number];
/** Seconds between blinks, and how long one lasts. */
const BLINK = { every: 3.4, seconds: .18 };

/** Bahamut flies on his own wings: a skinned model with flight clips instead of a vehicle. */
export function bahamut(): Build {
  const r = new Rig(), m = skinnedModel(r, 'bahamut');
  const action = (name: string) => { const a = m.actions.get(name); if (!a) throw new Error(`Bahamut has no ${name} clip`); a.play(); a.weight = 0; return a; };
  const clips = Object.fromEntries([...LOOPS, ...POSED].map(n => [n, action(n)])) as Record<ClipName, ReturnType<typeof action>>, blink = action('Blink');
  for (const a of [...POSED.map(n => clips[n]), blink]) a.timeScale = 0;
  const head = m.bone('head'), weights: Record<ClipName, number> = { Hover: 0, Fly: 0, Roar: 0, Win: 0, Lose: 0 };
  // Boost streams trail from the wing wrists; drift sparks and dust come from under the heels.
  const exhausts = [anchor(m, 'wing_fore.L', [2.12, 2.98, -.3]), anchor(m, 'wing_fore.R', [-2.12, 2.98, -.3])];
  const contacts = [anchor(m, 'foot.L', [.42, .58, -.14]), anchor(m, 'foot.R', [-.42, .58, -.14])];
  let fresh = true;
  return { r, head, height: 3.9, wheels: [], steer: [], exhausts, contacts, outline: m.outline, update(s, k) {
    const pose = s.pose, ended = pose?.kind === 'win' || pose?.kind === 'lose' ? pose : null;
    const roar = pose?.kind === 'cast' ? 1 : 0, cruise = ended ? 0 : 1 - roar;
    const target: Record<ClipName, number> = { Hover: cruise * (s.menu ? 1 : 1 - k), Fly: cruise * (s.menu ? 0 : k), Roar: roar, Win: ended?.kind === 'win' ? 1 : 0, Lose: ended?.kind === 'lose' ? 1 : 0 };
    for (const n of [...LOOPS, ...POSED]) { weights[n] = fresh ? target[n] : damp(weights[n], target[n], 12, s.dt); clips[n].weight = weights[n]; }
    fresh = false;
    if (pose?.kind === 'cast') clips.Roar.time = Math.min(1, pose.t / POSE_SECONDS.cast) * clips.Roar.getClip().duration;
    if (ended) { const c = clips[ended.kind === 'win' ? 'Win' : 'Lose']; c.time = ended.t % c.getClip().duration; }
    clips.Fly.timeScale = .8 + k * .7;
    const b = (s.t + 1.1) % BLINK.every; blink.weight = b < BLINK.seconds ? 1 : 0; blink.time = Math.min(b, BLINK.seconds);
    m.mixer.update(s.dt);
    head.rotation.y += s.menu ? Math.sin(s.t * .6) * .3 : s.steer * .3;
  } };
}
