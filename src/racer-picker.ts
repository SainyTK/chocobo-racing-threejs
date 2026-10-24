import { RACERS, ABILITIES, ABILITY_IDS, type AbilityId } from '../shared/game/index.ts';

/** Racer grid and ability choice, shared by the home screen and the online room. */
export function racerGridHtml(character: number, portrait: (i: number) => string) {
  return `<div class="racer-grid">${RACERS.map((r, i) => `<button class="racer-card ${i === character ? 'selected' : ''}" data-character="${i}" aria-label="Choose ${r.name}" aria-pressed="${i === character}">${portrait(i)}<span>${r.name}</span></button>`).join('')}</div>`;
}
/** `leading` is an optional field shown before the ability in the same row. */
export function abilitySelectHtml(abilityId: AbilityId, leading = '') {
  const options = ABILITY_IDS.map(id => `<option value="${id}" ${id === abilityId ? 'selected' : ''}>${ABILITIES[id].name}${ABILITIES[id].passive ? ' (auto)' : ''}</option>`).join('');
  return `<div class="ability-select">${leading}<label>ABILITY<select id="ability" aria-label="Ability">${options}</select></label><p id="ability-help">${ABILITIES[abilityId].description}</p></div>`;
}
