import { courseLayout } from '../../../shared/track/index.ts';
import { Parts, type Kit } from './kit.ts';
import { block, cyl } from './props/common.ts';
import type { RailStyle } from './types.ts';

type Profile = [number, number][];
/** A two-tone tube rail, its inner face on the physical wall at w + 0.7: the lower half in the rail colour, the upper half and top in the top colour. */
const TUBE: Profile = [[.7, .72], [.7, .92], [.7, 1.12], [.98, 1.12], [.98, .92], [.98, .72], [.7, .72]];
const TOP = new Set([1, 2, 3]);
/** A thinner bar below it. */
const BAR: Profile = [[.76, .34], [.76, .48], [.92, .48], [.92, .34], [.76, .34]];
/** Profiles sweep outward from the road edge; on the right they run mirrored so their faces still point out. */
const mirror = (p: Profile): Profile => p.map(([x, y]) => [-x, y] as [number, number]).reverse();
const POST_GAP = 3.2;

function post(style: RailStyle) {
  return new Parts().add(block(.22, 1.16, .22), style.post, { ao: [0, .4, .7] }).add(cyl(.17, .17, .08, [0, 1.16, 0], [0, 0, 0], 8), style.top, { ao: false });
}

/** Every railing on a cliff course, in the course's own colours, exactly where the simulation stops racers. */
export function buildRails(kit: Kit, style: RailStyle | undefined) {
  const rails = courseLayout(kit.id).rails; if (!rails.length) return;
  if (!style) throw new Error(`${kit.id} has rails but its scenery defines no rail style`);
  for (const rail of rails) {
    const s0 = rail.s, s1 = rail.s + rail.length, side = rail.side, offset = side * kit.w;
    const tube = side > 0 ? TUBE : mirror(TUBE), bar = side > 0 ? BAR : mirror(BAR);
    kit.extrude(tube, { s0, s1, offset, mirror: false, step: 1.5, paint: (_s, k, _i, out) => out.set(TOP.has(side > 0 ? k : TUBE.length - 2 - k) ? style.top : style.rail) });
    kit.extrude(bar, { s0, s1, offset, mirror: false, step: 1.5, paint: style.rail });
    const posts = Math.max(1, Math.round(rail.length / POST_GAP));
    for (let i = 0; i <= posts; i++) kit.onTrack(kit.prop('rail post', () => post(style)), s0 + rail.length * i / posts, side * (kit.w + .84));
  }
}
