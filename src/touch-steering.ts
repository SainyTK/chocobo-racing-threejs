/** Fractions of the pad's travel, the distance from where the thumb landed to full lock: inside DEADZONE the racer goes straight. */
const DEADZONE = .15;

/** Maps the thumb's offset from where it landed (-1 full travel left, 1 full travel right) to Input.steer, where +1 turns left. */
export function steerFromOffset(offset: number): number {
  const amount = (Math.abs(offset) - DEADZONE) / (1 - DEADZONE);
  return amount <= 0 ? 0 : -Math.sign(offset) * Math.min(1, amount);
}
