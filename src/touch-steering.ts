/** Fractions of the steering pad's half width: inside DEADZONE the racer goes straight, past FULL_LOCK it turns fully. */
const DEADZONE = .12, FULL_LOCK = .78;

/** Maps the thumb's offset from the pad centre (-1 left edge, 1 right edge) to Input.steer, where +1 turns left. */
export function steerFromOffset(offset: number): number {
  const amount = (Math.abs(offset) - DEADZONE) / (FULL_LOCK - DEADZONE);
  return amount <= 0 ? 0 : -Math.sign(offset) * Math.min(1, amount);
}
