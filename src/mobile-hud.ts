import { ABILITIES, type AbilityId } from '../shared/game/abilities.ts';

// Small code-native skill glyphs. Stones reuse the renderer's existing icons.
const skillPaths: Record<AbilityId, string> = {
  dash: 'M8 10h18L18 24h22L16 44l6-15H8',
  flap: 'M24 38C4 30 5 12 5 12l16 10 3-14 3 14 16-10s1 18-19 26Z',
  grip: 'M13 8h22v32H13ZM13 16h22M13 24h22M13 32h22',
  mug: 'M14 22V12a3 3 0 0 1 6 0v10-14a3 3 0 0 1 6 0v14-10a3 3 0 0 1 6 0v12-6a3 3 0 0 1 6 0v12q0 14-14 14L10 30q-4-8 4-8Z',
  magic: 'm24 5 5 13 14 6-14 5-5 14-5-14-14-5 14-6ZM37 5v10M32 10h10',
  barrier: 'M24 5 40 12v13q-3 12-16 18Q11 37 8 25V12ZM16 24l6 6 12-14',
  receive: 'M8 29v12h32V29M24 5v27M14 22l10 10 10-10',
  charge: 'm6 10 16 14L6 38M24 10l16 14-16 14',
};
const glyph = (path: string) => `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
export function mobileControls(ability: AbilityId) {
  return `<div class="touch-controls" aria-label="Touchscreen gamepad"><div class="steering-pad" role="group" aria-label="Direction controls"><div data-touch="joystick" class="joystick" role="group" aria-label="Driving joystick: up accelerate, down brake, left and right steer"><span class="stick-directions" aria-hidden="true">↑</span><span class="stick-knob"></span></div></div><div class="action-pad" role="group" aria-label="Race actions"><div class="utility-controls"><button data-touch="behind" aria-label="Look behind">↶</button><button data-touch="rescue" aria-label="Recover racer">↺</button></div><button data-touch="item" aria-label="Activate item" class="mobile-item"><span id="mobile-stones" class="mobile-stones"></span><small id="mobile-item-label">NO STONES</small></button><button data-touch="ability" aria-label="Activate ability: ${ABILITIES[ability].name}" class="mobile-ability">${glyph(skillPaths[ability])}<small>${ABILITIES[ability].name}</small><span id="mobile-ability-state"></span></button><button data-touch="drift" aria-label="Drift" class="mobile-drift">${glyph('M10 10Q0 24 10 38M38 10q10 14 0 28M24 7a17 17 0 1 0 0 34 17 17 0 1 0 0-34M19 17v14M29 17v14')}<small>DRIFT</small></button></div></div>`;
}
