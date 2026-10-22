import { MAX_STONES, spellName, type Item, type StoneStack } from '../shared/game/index.ts';
import { STONE_LOOKS } from './gfx/stones/looks.ts';

/**
 * HUD inventory: one slot per held stone, so a level 3 stack visibly fills all three.
 * Stones of one stack share its glow; the level badge sits on the stack's last stone and the next cast is outlined.
 */
export function stoneSlotsHtml(stones: StoneStack[], icon: (kind: Item) => string) {
  const slots = stones.flatMap((st, i) => Array.from({ length: st.level }, (_, n) => {
    const latest = i === stones.length - 1 ? ' latest' : '', badge = st.level > 1 && n === st.level - 1 ? ` data-level="${st.level}"` : '';
    return `<i style="--stone:${STONE_LOOKS[st.kind].body};background-image:url(${icon(st.kind)})" class="orb lv${st.level}${latest}"${badge} title="${spellName(st.kind, st.level)}"></i>`;
  }));
  while (slots.length < MAX_STONES) slots.push('<i style="--stone:#49475d">·</i>');
  return slots.join('');
}
