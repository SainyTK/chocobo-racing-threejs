/** Fractions of the pad's travel, the distance from where the thumb landed to full lock: inside DEADZONE the racer goes straight. */
const DEADZONE = .15;
/**
 * Fraction of the pad's vertical travel the thumb must push before it drives or brakes. It is wider than the steering
 * deadzone because a thumb sweeping left and right also drifts up and down.
 */
const PEDAL_DEADZONE = .45;

/** Maps the thumb's offset from where it landed (-1 full travel left, 1 full travel right) to Input.steer, where +1 turns left. */
export function steerFromOffset(offset: number): number {
  const amount = (Math.abs(offset) - DEADZONE) / (1 - DEADZONE);
  return amount <= 0 ? 0 : -Math.sign(offset) * Math.min(1, amount);
}

export type StickPedal = 'throttle' | 'brake' | null;
/** Maps the thumb's vertical offset (-1 full travel up, 1 full travel down) to a pedal: up drives, down brakes and then reverses. */
export function pedalFromOffset(offset: number): StickPedal {
  if (Math.abs(offset) < PEDAL_DEADZONE) return null;
  return offset < 0 ? 'throttle' : 'brake';
}
