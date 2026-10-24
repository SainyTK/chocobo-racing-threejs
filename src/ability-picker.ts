import './ability-picker.css';
import { ABILITIES, ABILITY_IDS, type AbilityId } from '../shared/game/abilities.ts';
import { abilityIcon, abilityTitle } from './hud/ability-icons.ts';

/** One choice made in a picker: the ability, and the name of the picker it was made in. */
export interface AbilityChange { ability: AbilityId; picker: string }

/**
 * The ability picker: one radio per ability with its badge and name, and the chosen ability's description below.
 * Arrow keys, Home and End move through it as through any radio group; Tab enters and leaves on the chosen ability.
 * It keeps no state of its own: `selected` is the host's, and `picker` names this picker in every change it reports,
 * so a page can host several and each host hears only its own.
 */
export function abilityPickerHtml(selected: AbilityId, picker: string) {
  const options = ABILITY_IDS.map(id => {
    const on = id === selected;
    return `<button type="button" role="radio" class="ability-option${on ? ' selected' : ''}" data-ability-option="${id}" aria-checked="${on}" tabindex="${on ? 0 : -1}" aria-label="${abilityTitle(id)}" title="${ABILITIES[id].description}">${abilityIcon(id)}<span>${ABILITIES[id].name}</span></button>`;
  }).join('');
  return `<div class="ability-picker" data-picker="${picker}"><span class="ability-picker-label" aria-hidden="true">ABILITY</span><div class="ability-options" role="radiogroup" aria-label="Ability">${options}</div><p class="ability-help" aria-live="polite">${helpHtml(selected)}</p></div>`;
}

const helpHtml = (id: AbilityId) => `<strong>${abilityTitle(id)}</strong> ${ABILITIES[id].description}`;

/** Marks `id` chosen in one rendered picker without re-rendering it, so focus and scroll stay put. */
function show(picker: HTMLElement, id: AbilityId) {
  for (const option of picker.querySelectorAll<HTMLElement>('[data-ability-option]')) {
    const on = option.dataset.abilityOption === id;
    option.classList.toggle('selected', on);
    option.setAttribute('aria-checked', String(on));
    option.tabIndex = on ? 0 : -1;
  }
  const help = picker.querySelector('.ability-help');
  if (help) help.innerHTML = helpHtml(id);
}

const KEY_STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
const handlers = new Set<(change: AbilityChange) => void>();
let listening = false;

const optionAt = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>('[data-ability-option]') : null;
function choose(option: HTMLElement, id: AbilityId) {
  const picker = option.closest<HTMLElement>('.ability-picker')!;
  show(picker, id);
  for (const handler of handlers) handler({ ability: id, picker: picker.dataset.picker! });
}
// One pair of delegated listeners serves every picker rendered now or later.
function listen() {
  listening = true;
  document.addEventListener('click', e => {
    const option = optionAt(e.target);
    if (option) choose(option, option.dataset.abilityOption as AbilityId);
  });
  document.addEventListener('keydown', e => {
    const option = optionAt(e.target);
    if (!option) return;
    const current = ABILITY_IDS.indexOf(option.dataset.abilityOption as AbilityId);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? ABILITY_IDS.length - 1 : e.key in KEY_STEPS ? (current + KEY_STEPS[e.key] + ABILITY_IDS.length) % ABILITY_IDS.length : -1;
    if (next < 0) return;
    e.preventDefault();
    choose(option, ABILITY_IDS[next]);
    option.parentElement?.querySelector<HTMLElement>(`[data-ability-option="${ABILITY_IDS[next]}"]`)?.focus();
  });
}

/** Calls `handler` with every choice made in any picker; the host filters by `change.picker`. Returns an unsubscribe. */
export function onAbilityChange(handler: (change: AbilityChange) => void) {
  if (!listening) listen();
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}
