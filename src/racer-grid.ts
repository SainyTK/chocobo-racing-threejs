import { RACERS } from '../shared/game/index.ts';

/** The racer grid, shared by the home screen and the online room. */
export function racerGridHtml(character: number, portrait: (i: number) => string) {
  return `<div class="racer-grid">${RACERS.map((r, i) => `<button class="racer-card ${i === character ? 'selected' : ''}" data-character="${i}" aria-label="Choose ${r.name}" aria-pressed="${i === character}">${portrait(i)}<span>${r.name}</span></button>`).join('')}</div>`;
}
