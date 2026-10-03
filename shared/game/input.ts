import { clamp } from '../math.ts';

// steer is in yaw space: +1 increases yaw, which is a left turn from the chase camera.
export interface Input { steer: number; throttle: boolean; brake: boolean; reverse: boolean; drift: boolean; item: boolean; ability: boolean; rescue: boolean }
export const neutralInput = (): Input => ({ steer: 0, throttle: false, brake: false, reverse: false, drift: false, item: false, ability: false, rescue: false });
export function cleanInput(value: unknown): Input {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { steer: typeof v.steer === 'number' && Number.isFinite(v.steer) ? clamp(v.steer, -1, 1) : 0, throttle: v.throttle === true, brake: v.brake === true, reverse: v.reverse === true, drift: v.drift === true, item: v.item === true, ability: v.ability === true, rescue: v.rescue === true };
}
