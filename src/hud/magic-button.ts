import { spellName, type Item } from '../../shared/game/index.ts';
import { LEVEL_FLASH } from '../gfx/stones/level-flash.ts';

/** The stone markup inside the mobile MAGIC button: the ball, the level 2 and 3 band, and the level 3 flash and ring. */
export const MAGIC_STONE_HTML = '<span class="magic-stone" aria-hidden="true"><span class="stone-ball"><img alt=""><i class="stone-band"></i></span><i class="stone-flash"></i><i class="stone-ring"></i></span><small class="magic-label"></small>';

const { period, sweep, flash, flashRadius, ring, ringRadius } = LEVEL_FLASH;
/** The level 3 band ends just before the next flash, as on the held stones. */
const SWEEP_START_3 = period[1] - sweep[1] - .01;
/** The band's centre runs from just above the ball to just below it, in band heights: the band is one stone radius tall. */
const BAND_FROM = 'translateY(-65%)', BAND_TO = 'translateY(165%)';

/** One cycle of the held stack's level effect, timed from the same numbers as the stone shader. */
function levelAnimations(stone: HTMLElement, level: number): Animation[] {
  if (level < 2) return [];
  const band = stone.querySelector<HTMLElement>('.stone-band')!, cycle = period[level > 2 ? 1 : 0];
  const start = level > 2 ? SWEEP_START_3 / cycle : 0, end = start + sweep[level > 2 ? 1 : 0] / cycle;
  const options = { duration: cycle * 1000, iterations: Infinity };
  const animations = [band.animate([
    { offset: 0, opacity: 0, transform: BAND_FROM },
    { offset: start, opacity: 1, transform: BAND_FROM },
    { offset: end, opacity: 1, transform: BAND_TO },
    { offset: Math.min(1, end + .001), opacity: 0, transform: BAND_TO },
    { offset: 1, opacity: 0, transform: BAND_TO },
  ], options)];
  if (level > 2) {
    const flashEnd = flash / cycle, ringEnd = (flash + ring) / cycle;
    animations.push(stone.querySelector<HTMLElement>('.stone-flash')!.animate([
      { offset: 0, opacity: .95, transform: `scale(${flashRadius[0]})` },
      { offset: flashEnd, opacity: .85, transform: `scale(${flashRadius[1]})` },
      { offset: flashEnd + .001, opacity: 0, transform: `scale(${flashRadius[1]})` },
      { offset: 1, opacity: 0, transform: `scale(${flashRadius[0]})` },
    ], options));
    animations.push(stone.querySelector<HTMLElement>('.stone-ring')!.animate([
      { offset: 0, opacity: 0, transform: `scale(${flashRadius[1]})` },
      { offset: flashEnd, opacity: 1, transform: `scale(${flashRadius[1]})` },
      { offset: ringEnd, opacity: 0, transform: `scale(${ringRadius})` },
      { offset: 1, opacity: 0, transform: `scale(${ringRadius})` },
    ], options));
  }
  return animations;
}

/**
 * The mobile MAGIC button shows the stack that casts next, drawn from the real stone model, with its level shown as the
 * held stones show it. With no stones it dims and reads NO MAGIC. It redraws only when the stack changes.
 */
export class MagicButton {
  private shown = ''; private animations: Animation[] = [];
  private stone: HTMLElement; private image: HTMLImageElement; private label: HTMLElement;
  constructor(private button: HTMLElement, private icon: (kind: Item) => string) {
    this.stone = button.querySelector('.magic-stone')!; this.image = this.stone.querySelector('img')!; this.label = button.querySelector('.magic-label')!;
  }
  update(kind: Item | null, level: number) {
    const key = kind ? `${kind}:${level}` : '';
    if (key === this.shown && this.label.textContent) return;
    this.shown = key;
    for (const animation of this.animations) animation.cancel();
    const name = kind ? spellName(kind, level) : '';
    this.button.classList.toggle('empty', !kind);
    this.button.setAttribute('aria-label', kind ? `Cast ${name}` : 'Cast magic: no stones held');
    this.label.textContent = kind ? name : 'NO MAGIC';
    if (kind) this.image.src = this.icon(kind); else this.image.removeAttribute('src');
    this.stone.dataset.level = String(kind ? level : 0);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.animations = kind && !still ? levelAnimations(this.stone, level) : [];
  }
}
