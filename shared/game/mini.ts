import { MINI_SHRINK } from './spells.ts';
import type { Racer } from './types.ts';

/** Size and top-speed factor of a racer under Mini; 1 when unaffected. */
export const miniScale = (p: Pick<Racer, 'mini' | 'miniLevel'>) => p.mini > 0 ? 1 - p.miniLevel * MINI_SHRINK : 1;
