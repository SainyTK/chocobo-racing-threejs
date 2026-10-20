export type AbilityId = 'dash' | 'flap' | 'grip' | 'mug' | 'magic' | 'barrier' | 'receive' | 'charge';
/**
 * Recharge seconds are the original's measured charge times, except Magic Plus: stones are scarcer here, so a free level
 * every 13 s made Black Magician win 40% of all-CPU races. Every gauge starts empty and fills at a constant rate.
 */
export const ABILITIES: Record<AbilityId, { name: string; description: string; recharge: number; passive?: boolean }> = {
  dash: { name: 'Dash', description: 'A burst of speed. Best used on a straight.', recharge: 16 },
  flap: { name: 'Flap', description: 'Fly above ice and rough terrain for five seconds.', recharge: 11 },
  grip: { name: 'Grip-Up', description: 'Extra traction, steering and acceleration.', recharge: 11 },
  mug: { name: 'Mug', description: 'Steal a stone from the best placed rival who holds one, or get a random stone.', recharge: 18 },
  magic: { name: 'Magic Plus', description: 'Automatically adds a level to your latest spell.', recharge: 20, passive: true },
  barrier: { name: 'Barrier', description: 'Raises itself when the gauge fills and blocks one hit for four seconds.', recharge: 16, passive: true },
  receive: { name: 'Receive', description: 'When charged, a spell that hits you also lands in your inventory.', recharge: 18, passive: true },
  charge: { name: 'Charge', description: 'A short boost. Ram rivals to spin them out.', recharge: 10 },
};
export const ABILITY_IDS = Object.keys(ABILITIES) as AbilityId[];
/** Seconds of the timed abilities. Charge is shorter than Dash but recharges fastest. */
export const ABILITY_SECONDS = { dash: 4, flap: 5, grip: 7, charge: 3 } as const;
