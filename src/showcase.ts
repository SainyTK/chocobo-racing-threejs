import { RACERS } from '../shared/game/index.ts';

/** The left column beside the 3D hero: the chosen racer's name, vehicle and stats. */
export function showcaseHtml(character: number, title: string, caption: string) {
  const ch = RACERS[character];
  const stats = [['SPEED', ch.speed / 41], ['ACCEL', ch.acceleration / 28], ['GRIP', ch.grip / 15]].map(([name, n]) => `<span>${name}<i style="--value:${Number(n) * 100}%"></i></span>`).join('');
  return `<section class="showcase"><div class="section-title">${title}</div><div class="vehicle-label"><span class="racer-number">${String(character + 1).padStart(2, '0')}</span><h1>${ch.name}</h1><p>${ch.vehicle}</p><div class="stats">${stats}</div></div><div class="preview-caption">${caption}</div></section>`;
}
