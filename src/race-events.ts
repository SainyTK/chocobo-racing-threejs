import { ITEMS, MEGAFLARE, crashTier, type GameEvent, type Item } from '../shared/game/index.ts';

/** How hard a crash lands, after the original's three hit types: 1 spin-out, 2 crash, 3 big crash. */
export type CrashTier = 1 | 2 | 3;
export interface CrashInfo { kind: Item | 'charge' | 'doom' | 'squash' | 'drift' | 'megaflare'; level: number; tier: CrashTier }

const SPELLS = (Object.keys(ITEMS) as Item[]).flatMap(kind => ITEMS[kind].names.map((name, i) => ({ name, kind, level: i + 1 })));

/**
 * Crash tier per cause. Spells use the simulation's tiers; Doom and squashing are crashes, contacts and over-drift spin
 * out, and Megaflare throws its victims into the air.
 */
function tierOf(kind: CrashInfo['kind'], level: number): CrashTier {
  if (kind === 'megaflare') return MEGAFLARE.tier;
  if (kind === 'doom' || kind === 'squash') return 2;
  if (kind === 'drift' || kind === 'mini') return 1;
  return crashTier(kind, level);
}

/** What caused a `crash` event and how hard it hit. Spell crashes read "Caster: Spell name!". */
export function crashInfo(e: GameEvent): CrashInfo {
  const text = e.text;
  if (text === 'Doom!') return { kind: 'doom', level: 1, tier: tierOf('doom', 1) };
  if (text.startsWith('Squashed')) return { kind: 'squash', level: 1, tier: tierOf('squash', 1) };
  if (text.startsWith('Over-drift')) return { kind: 'drift', level: 1, tier: tierOf('drift', 1) };
  if (text.endsWith(': Charge!')) return { kind: 'charge', level: 1, tier: tierOf('charge', 1) };
  if (text.endsWith(': Megaflare!')) return { kind: 'megaflare', level: 3, tier: tierOf('megaflare', 3) };
  const spell = SPELLS.find(s => text.endsWith(`: ${s.name}!`));
  return spell ? { kind: spell.kind, level: spell.level, tier: tierOf(spell.kind, spell.level) } : { kind: 'charge', level: 1, tier: 1 };
}

/** The spell and level of a cast event, whose type is the stone kind and whose text is the spell name. */
export function castInfo(e: GameEvent): { kind: Item; level: number } | null {
  if (!(e.type in ITEMS) || e.target) return null;
  const spell = SPELLS.find(s => e.text === `${s.name}!`);
  return { kind: e.type as Item, level: spell?.level ?? 1 };
}
