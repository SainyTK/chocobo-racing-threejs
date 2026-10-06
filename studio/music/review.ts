import type { StudioElement } from '../types.ts';

/** Legacy `score` links point to the revised in-game score. Prior compositions are studio-only. */
export function musicForVariant(element: StudioElement | null | undefined, variant: string) {
  return (variant === 'previous' ? element?.previousMusic : element?.music) ?? null;
}
