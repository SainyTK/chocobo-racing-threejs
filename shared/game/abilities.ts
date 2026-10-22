export type AbilityId = 'dash' | 'flap' | 'grip' | 'mug' | 'magic' | 'barrier' | 'receive' | 'charge' | 'megaflare' | 'braver';
/**
 * Recharge seconds are the original's measured charge times, with three exceptions measured in all-CPU races. Stones are
 * scarcer here, so Magic Plus every 13 s made Black Magician win 40%; boosts are stronger, so Charge every 10 s made
 * Behemoth win over half. Megaflare's 45 s made Bahamut win 63%; at 80 s, with a shorter stall than the heavy crash, he
 * wins about as often as Chubby Chocobo. Every gauge starts empty and fills at a constant rate.
 */
export const ABILITIES: Record<AbilityId, { name: string; description: string; recharge: number; passive?: boolean }> = {
  dash: { name: 'Dash', description: 'A burst of speed. Best used on a straight.', recharge: 16 },
  flap: { name: 'Flap', description: 'Fly above ice and rough terrain for five seconds.', recharge: 11 },
  grip: { name: 'Grip-Up', description: 'Extra traction, steering and acceleration.', recharge: 11 },
  mug: { name: 'Mug', description: 'Steal a stone from the best placed rival who holds one, or get a random stone.', recharge: 18 },
  magic: { name: 'Magic Plus', description: 'Automatically adds a level to your latest spell.', recharge: 20, passive: true },
  barrier: { name: 'Barrier', description: 'Raises itself when the gauge fills and blocks one hit for four seconds.', recharge: 16, passive: true },
  receive: { name: 'Receive', description: 'When charged, catch the next spell that hits you as a stone instead of crashing.', recharge: 18, passive: true },
  charge: { name: 'Charge', description: 'A short boost. Ram rivals to spin them out.', recharge: 14 },
  megaflare: { name: 'Megaflare', description: 'Flare shots rain down, then every rival crashes. Barrier and Reflect cannot stop it.', recharge: 80 },
  braver: { name: 'Braver', description: 'Swing the Buster Sword in a wide arc: every rival within reach spins out. Barrier blocks it; Reflect cannot.', recharge: 14 },
};
export const ABILITY_IDS = Object.keys(ABILITIES) as AbilityId[];
/**
 * Seconds of the timed abilities. Boosts reach 1.55x top speed through nearly every corner with the current grip, so
 * the original's 3 to 5 s Dash made Chocobo and Behemoth win far more than the rest. Charge is shorter than Dash but
 * recharges sooner. Megaflare's is the warning before it strikes: the original's first flare shots always miss.
 * Braver's is the whole sword swing, which strikes halfway through.
 */
export const ABILITY_SECONDS = { dash: 2, flap: 5, grip: 7, charge: 1, megaflare: 1.5, braver: .9 } as const;
