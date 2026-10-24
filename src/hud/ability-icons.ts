import { ABILITIES, type AbilityId } from '../../shared/game/abilities.ts';

/**
 * One badge per ability, the single source for every place an ability is shown: the home picker, the desktop HUD and the
 * mobile ability button. The original's ability screen shows the owning racer's portrait and no symbol, so each badge
 * draws what the ability does in this remake, in the colours of its in-race effect (src/gfx/effects/abilities/looks.ts).
 * Each badge is a disc in the ability's colour with a light top bevel and a white symbol outlined in the HUD's ink.
 * No gradients or ids, so many copies can share a page and stay correct while some are hidden.
 */
interface Badge {
  /** Disc fill and its darker rim. */
  base: string; rim: string;
  /** White filled shapes, white strokes, and ink strokes drawn on top of the white. */
  fill?: string; line?: string; ink?: string;
}

const INK = '#17152d';

/** An n-pointed star centred on (cx, cy), as a closed path. */
function star(cx: number, cy: number, outer: number, inner: number, points: number) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer, a = Math.PI * i / points - Math.PI / 2;
    return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join('') + 'Z';
}
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
/** Twelve tread notches round a tyre's rim. */
const tread = Array.from({ length: 12 }, (_, i) => {
  const a = Math.PI * i / 6, x = (r: number) => (24 + r * Math.cos(a)).toFixed(1), y = (r: number) => (24 + r * Math.sin(a)).toFixed(1);
  return `M${x(12)} ${y(12)}L${x(14.5)} ${y(14.5)}`;
}).join('');

const BADGES: Record<AbilityId, Badge> = {
  // A speed arrow with motion lines: the blue spike fans of a Dash.
  dash: { base: '#3f78ff', rim: '#1c3c9c', fill: 'M22 13 39 24 22 35 25.5 24Z', line: 'M8 18h8M6 24h11M8 30h8' },
  // A charging arrow hitting a star: the boost and the ram that spins a rival.
  charge: { base: '#ff8030', rim: '#9a2a08', fill: star(33, 24, 10.5, 4.5, 8), line: 'M7 24h13M15 18.5l5.5 5.5-5.5 5.5' },
  // A feathered wing: Flap lifts the racer over the road.
  flap: { base: '#d860b8', rim: '#6c3a9a', fill: 'M7 33C9 19 21 11 41 12c-3 3-6 4-9 5 3 1 6 1 8 3-4 2-8 3-12 3 3 1 5 3 6 5-6 1-11 1-15-1-3 3-9 6-12 6Z' },
  // Bahamut's flare: a many-rayed burst of light.
  megaflare: { base: '#d0281c', rim: '#6a0c10', fill: star(24, 24, 16.5, 7.5, 12) },
  // A tyre with chevron tread: Grip-Up's traction.
  grip: { base: '#b4468c', rim: '#5c1c4a', fill: circle(24, 24, 14.5), ink: `${circle(24, 24, 7.5)}${circle(24, 24, 2.5)}${tread}` },
  // A thief's sack with a stolen stone: Mug takes one from a rival.
  mug: { base: '#8a2ad4', rim: '#43106c', fill: `${circle(33, 12, 5.5)}M15 15h12l-3 5c7 3 11 9 11 14 0 4-3 7-7 7H14c-4 0-7-3-7-7 0-5 4-11 11-14Z`, ink: 'M17.5 20.5h8' },
  // A plus with a sparkle: Magic Plus adds a level to the latest spell.
  magic: { base: '#3aa848', rim: '#145a24', fill: `M18 14h8v10h10v8H26v10h-8V32H8v-8h10Z${star(38, 11, 6, 2, 4)}` },
  // A shield: Barrier blocks one hit.
  barrier: { base: '#3f9eb0', rim: '#145462', fill: 'M24 6 39 11.5V23c0 9.5-6 15.5-15 19.5C15 38.5 9 32.5 9 23V11.5Z', ink: 'M24 12v24' },
  // A stone dropping into open hands: Receive catches a spell as a stone.
  receive: { base: '#6f64d4', rim: '#2e2680', fill: 'M8 25h32c0 9-7 16-16 16S8 34 8 25Z', line: 'M24 7v11M18.5 13.5 24 19l5.5-5.5', ink: circle(24, 31, 4) },
};

/**
 * The ability's badge as inline SVG. With a `label` the badge is an image with that accessible name; without one it is
 * decorative, for buttons and pickers that already name the ability.
 */
export function abilityIcon(id: AbilityId, label?: string) {
  const b = BADGES[id], a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  const shapes = [
    `<circle cx="24" cy="24" r="22.5" fill="${b.rim}" stroke="${INK}" stroke-width="2"/>`,
    `<circle cx="24" cy="24" r="19" fill="${b.base}"/>`,
    '<path d="M8.5 21a16 16 0 0 1 31 0c-8-5-23-5-31 0Z" fill="#fff" opacity=".28"/>',
    b.fill ? `<path d="${b.fill}" fill="${INK}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` : '',
    b.line ? `<path d="${b.line}" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` : '',
    b.fill ? `<path d="${b.fill}" fill="#fff"/>` : '',
    b.line ? `<path d="${b.line}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` : '',
    b.ink ? `<path d="${b.ink}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` : '',
  ];
  return `<svg class="ability-icon" data-ability="${id}" viewBox="0 0 48 48" ${a11y}>${shapes.join('')}</svg>`;
}

/** The ability's name with its auto tag, as pickers and tooltips show it. */
export const abilityTitle = (id: AbilityId) => `${ABILITIES[id].name}${ABILITIES[id].passive ? ' (auto)' : ''}`;
