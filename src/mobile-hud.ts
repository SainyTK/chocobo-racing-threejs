import { ABILITIES, type AbilityId } from '../shared/game/abilities.ts';
import { abilityIcon } from './hud/ability-icons.ts';

const controlPaths = {
  behind: 'M4 24q20-22 40 0-20 22-40 0ZM24 18a6 6 0 1 0 0 12 6 6 0 1 0 0-12',
  rescue: 'M38 24a14 14 0 1 1-4-10M38 8v8h-8',
  magic: 'M24 9a15 15 0 1 0 .01 0ZM24 16l2.5 5.5L32 24l-5.5 2.5L24 32l-2.5-5.5L16 24l5.5-2.5Z',
  brake: 'M17 6h14l11 11v14L31 42H17L6 31V17ZM15 24h18',
  drift: 'M12 42C12 24 22 14 38 14M31 7l7 7-7 7M5 32l7 2M7 23l7 3',
  drive: 'M10 30 24 14l14 16M10 42l14-16 14 16',
};
const glyph = (path: string) => `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;

/**
 * Two-thumb layout: the left thumb steers on a small pad that floats to wherever it lands in the left steering zone,
 * and the right thumb rests on DRIVE.
 * DRIVE, DRIFT and BRAKE share a slide group so the right thumb can roll between them without lifting.
 * DRIFT holds the accelerator too, so sliding off DRIVE keeps the racer driving.
 * BRAKE, like pulling the stick down, reverses once the racer stops.
 * MAGIC casts the latest stone and shows no stones: as in the original, held stones are seen rolling behind the racer.
 * Look behind and recover sit in a small row on the right, a deliberate reach away from the pedals.
 */
export function mobileControls(ability: AbilityId, magic: boolean) {
  return `<div class="touch-controls" aria-label="Touchscreen gamepad">`
    + `<div class="steering-side" role="group" aria-label="Direction controls">`
    + `<div data-touch="steer" class="steering-zone" role="group" aria-label="Stick: put your left thumb down anywhere here, slide left or right to steer, up to accelerate and down to brake and reverse"><div class="steering-pad"><span class="steer-arrow left" aria-hidden="true">‹</span><span class="steer-arrow right" aria-hidden="true">›</span><span class="steer-arrow up" aria-hidden="true">‹</span><span class="steer-arrow down" aria-hidden="true">‹</span><span class="steer-knob"></span></div></div>`
    + `</div>`
    + `<div class="action-pad" role="group" aria-label="Race actions">`
    + `<div class="utility-controls"><button data-touch="behind" aria-label="Look behind">${glyph(controlPaths.behind)}</button><button data-touch="rescue" aria-label="Recover racer">${glyph(controlPaths.rescue)}</button></div>`
    + `<button data-touch="ability" aria-label="Activate ability: ${ABILITIES[ability].name}" class="mobile-ability">${abilityIcon(ability)}<span id="mobile-ability-state"></span></button>`
    + (magic ? `<button data-touch="item" aria-label="Cast magic" class="mobile-item">${glyph(controlPaths.magic)}<small>MAGIC</small></button>` : '')
    + `<div class="pedals" data-touch-slide>`
    + `<button data-touch="drift" data-hold="throttle drift" aria-label="Drift" class="mobile-drift">${glyph(controlPaths.drift)}<small>DRIFT</small></button>`
    + `<button data-touch="brake" aria-label="Brake and reverse" class="mobile-brake">${glyph(controlPaths.brake)}<small>BRAKE</small></button>`
    + `<button data-touch="throttle" aria-label="Drive" class="mobile-drive">${glyph(controlPaths.drive)}<small class="drive-label">DRIVE</small><small class="auto-label">AUTO</small></button>`
    + `</div></div></div>`;
}
