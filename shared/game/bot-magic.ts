import { angleDelta, mod } from '../math.ts';
import { courseObjects } from '../track/objects.ts';
import { trackLength } from '../track/sampling.ts';
import { MAIN_ROUTE } from '../track/route.ts';
import type { TrackStone } from '../track/types.ts';
import { BOT_MAGIC } from './bot-personalities.ts';
import { aboveGround } from './combat.ts';
import { TICK } from './constants.ts';
import { MAX_STONES, canAddStone, heldStones, maxLevel } from './inventory.ts';
import type { Item } from './items.ts';
import { raceProgress } from './progress.ts';
import { activeRivals, racerAhead, racerBehind, spellTarget } from './targeting.ts';
import type { Race, Racer, StoneStack } from './types.ts';

const ATTACKS: readonly TrackStone[] = ['fire', 'ice', 'thunder', 'mini', 'ultima'];
/** A CPU racer considers casting once per this many seconds, so it never empties its inventory in one burst. */
const CAST_PERIOD = 1.2;
/** Road curvature below which Haste, Dash and Charge are worth using. */
const STRAIGHT = .013;

/** Lateral position of the stone a CPU racer wants in the field ahead, or null when it wants none. */
export function botStoneLane(r: Race, p: Racer): number | null {
  if (!canAddStone(p)) return null;
  const len = trackLength(r.track), top = p.stones.at(-1), style = BOT_MAGIC[p.character];
  // Builders match the latest stack to level a spell up; otherwise the racer's favourite, then "?" and attacks.
  const want = (kind: TrackStone) => top && style.hold !== 'quick' && kind === top.kind && top.level < maxLevel(top.kind) ? 3 : kind === style.favourite ? 2 : kind === 'random' ? 1.3 : ATTACKS.includes(kind) || kind === 'doom' ? 1 : .7;
  let best: { x: number; score: number } | null = null;
  for (const stone of courseObjects(r.track).stones) {
    if ((stone.route ?? MAIN_ROUTE) !== p.route) continue;
    const ahead = mod(stone.s - p.routeS, len);
    // Only stones that will be back by the time the racer arrives.
    if (ahead < 3 || ahead > 45 || r.pickups[stone.id] > ahead / Math.max(10, p.speed)) continue;
    const score = want(stone.kind) - Math.abs(stone.x - p.x) * .04;
    if (!best || score > best.score) best = { x: stone.x, score };
  }
  return best?.x ?? null;
}

const hittable = (q: Racer | undefined): q is Racer => !!q && q.invincible <= 0 && q.falling <= 0;
/** True when casting `stack` now would reach a rival or help the caster. */
function worthCasting(r: Race, p: Racer, stack: StoneStack, curve: number) {
  const { kind, level } = stack;
  if (kind === 'haste') return curve < STRAIGHT && p.boost <= 0;
  if (kind === 'shield') return true;
  if (kind === 'ultima' || level === 3) { const rivals = activeRivals(r, p); return rivals.filter(hittable).length >= Math.ceil(rivals.length / 2); }
  if (kind === 'ice') { const q = racerBehind(r, p), gap = q ? raceProgress(r, p) - raceProgress(r, q) : Infinity; return hittable(q) && !aboveGround(q) && gap > 4 && gap < 50; }
  if (kind === 'fire') {
    const q = racerAhead(r, p); if (!hittable(q)) return false;
    if (level === 2) return raceProgress(r, q) - raceProgress(r, p) < 150;
    const d = Math.hypot(q.px - p.px, q.pz - p.pz);
    return d > 8 && d < 70 && Math.abs(angleDelta(Math.atan2(q.px - p.px, q.pz - p.pz), p.yaw)) < .12;
  }
  const q = spellTarget(r, p);
  return hittable(q) && (kind !== 'mini' || q.mini <= 0) && (kind !== 'doom' || q.doom <= 0);
}
/** True while the racer's personality wants to keep building its latest stack. */
function holding(r: Race, p: Racer, kind: Item, level: number) {
  const style = BOT_MAGIC[p.character], full = heldStones(p) >= MAX_STONES, attack = ATTACKS.includes(kind), trailing = r.racers.length > 2 && p.rank >= r.racers.length - 1;
  if (kind === 'doom') return false;
  if (kind === 'shield') return !full;
  if (style.hold === 'hoard') return !full;
  if (style.hold === 'build') return attack && !full && !trailing;
  if (style.hold === 'quick') return attack && trailing && level < maxLevel(kind) && !full;
  return kind === style.favourite && level < maxLevel(kind) && !full;
}
/** Item and ability buttons for a CPU racer. `curve` is the sharpest road curvature just ahead. */
export function botMagic(r: Race, p: Racer, curve: number) {
  const top = p.stones.at(-1), i = r.racers.indexOf(p), phase = i * .37;
  const decide = Math.floor(r.time / CAST_PERIOD + phase) !== Math.floor((r.time - TICK) / CAST_PERIOD + phase);
  // A full leader with no use for its latest stack spends it to make room.
  const item = !!top && !p.lastItem && decide && !holding(r, p, top.kind, top.level) && (worthCasting(r, p, top, curve) || heldStones(p) >= MAX_STONES && !racerAhead(r, p));
  const id = p.abilityId, ready = p.ability >= 100 && !p.lastAbility;
  const ability = ready && (id === 'dash' || id === 'charge' ? curve < STRAIGHT : id === 'mug' ? canAddStone(p) : id === 'flap' || id === 'grip');
  return { item, ability };
}
