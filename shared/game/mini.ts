import type { Racer } from './types.ts';

/** A racer's size factor: 1 normally, smaller while shrunk by Mini. Contacts, stack reach and rendering all use it. */
export const miniScale = (p: Pick<Racer, 'mini' | 'miniLevel'>) => p.mini > 0 ? 1 - p.miniLevel * .18 : 1;
