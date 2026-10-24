import { ABILITIES, ABILITY_IDS, type AbilityId } from '../shared/game/abilities.ts';
import { abilityIcon, abilityTitle } from './hud/ability-icons.ts';

/**
 * The ability picker: one radio per ability with its badge and name, and the chosen ability's description below.
 * Arrow keys move through it as through any radio group; Tab enters and leaves on the chosen ability.
 */
export function abilityPickerHtml(selected: AbilityId) {
  const options = ABILITY_IDS.map(id => {
    const on = id === selected;
    return `<button type="button" role="radio" class="ability-option${on ? ' selected' : ''}" data-ability-option="${id}" aria-checked="${on}" tabindex="${on ? 0 : -1}" aria-label="${abilityTitle(id)}" title="${ABILITIES[id].description}">${abilityIcon(id)}<span>${ABILITIES[id].name}</span></button>`;
  }).join('');
  return `<div class="ability-picker"><span class="ability-picker-label" aria-hidden="true">ABILITY</span><div class="ability-options" role="radiogroup" aria-label="Ability">${options}</div><p class="ability-help" aria-live="polite">${helpHtml(selected)}</p></div>`;
}

const helpHtml = (id: AbilityId) => `<strong>${abilityTitle(id)}</strong> ${ABILITIES[id].description}`;

/** Marks `id` chosen in every picker on the page without re-rendering it, so focus and scroll stay put. */
function show(id: AbilityId) {
  for (const picker of document.querySelectorAll('.ability-picker')) {
    for (const option of picker.querySelectorAll<HTMLElement>('[data-ability-option]')) {
      const on = option.dataset.abilityOption === id;
      option.classList.toggle('selected', on);
      option.setAttribute('aria-checked', String(on));
      option.tabIndex = on ? 0 : -1;
    }
    const help = picker.querySelector('.ability-help');
    if (help) help.innerHTML = helpHtml(id);
  }
}

const KEY_STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Wires every picker the page renders, now or later. `onSelect` hears each new choice. */
export function installAbilityPicker(onSelect: (id: AbilityId) => void) {
  const choose = (id: AbilityId) => {
    show(id);
    onSelect(id);
  };
  document.addEventListener('click', e => {
    const option = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-ability-option]') : null;
    if (option) choose(option.dataset.abilityOption as AbilityId);
  });
  document.addEventListener('keydown', e => {
    const option = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-ability-option]') : null;
    if (!option) return;
    const current = ABILITY_IDS.indexOf(option.dataset.abilityOption as AbilityId);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? ABILITY_IDS.length - 1 : e.key in KEY_STEPS ? (current + KEY_STEPS[e.key] + ABILITY_IDS.length) % ABILITY_IDS.length : -1;
    if (next < 0) return;
    e.preventDefault();
    choose(ABILITY_IDS[next]);
    option.parentElement?.querySelector<HTMLElement>(`[data-ability-option="${ABILITY_IDS[next]}"]`)?.focus();
  });
}
