import { trackLength } from '../../track/sampling.ts';
import { courseLayout } from '../../track/layouts/index.ts';
import { hazardState } from '../../track/hazards.ts';
import { MAIN_ROUTE } from '../../track/route.ts';
import { along } from '../../track/surface.ts';
import { RACERS } from '../racers.ts';
import { HANDLING } from '../handling.ts';
import { crash } from '../combat.ts';
import { event } from '../events.ts';
import type { Race, Racer } from '../types.ts';

/** A racer this high above the road clears any timed hazard. */
const CLEARANCE = 2.6;

/** Course gimmicks that act on contact: boost pads and timed hazards. Surfaces act through traction, ramps and gaps through the air step. */
export function stepCourse(r: Race, p: Racer, oldS: number) {
  if (p.route !== MAIN_ROUTE) return;
  const layout = courseLayout(r.track), len = trackLength(r.track);
  for (const pad of layout.pads) if (oldS < p.s && Math.floor((oldS - pad.s) / len) !== Math.floor((p.s - pad.s) / len) && Math.abs(p.x - pad.x) < 3) { p.boost = Math.max(p.boost, HANDLING.boostPad); event(r, p, 'pad', 'BOOST'); }
  if (p.invincible > 0 || p.stun > 0 || p.alt > CLEARANCE) return;
  const reach = RACERS[p.character].size * .9;
  for (const h of layout.hazards) {
    if (Math.abs(along(r.track, h.s, p.routeS)) > h.length / 2 + reach) continue;
    const state = hazardState(h, r.time);
    if (state.live && Math.abs(p.x - state.x) < h.width / 2 + reach) { crash(r, p, h.stun, h.text); return; }
  }
}
