export type AbilityId = 'dash' | 'flap' | 'grip' | 'mug' | 'magic' | 'barrier' | 'receive' | 'charge';
export const ABILITIES: Record<AbilityId, { name: string; description: string; recharge: number; passive?: boolean }> = {
  dash: { name: 'Dash', description: 'A short burst of speed. Best used on a straight.', recharge: 12 },
  flap: { name: 'Flap', description: 'Fly above ice and rough terrain for five seconds.', recharge: 12 },
  grip: { name: 'Grip-Up', description: 'Extra traction, steering and acceleration.', recharge: 11 },
  mug: { name: 'Mug', description: 'Steal the last Magic Stone held by a nearby rival.', recharge: 13 },
  magic: { name: 'Magic Plus', description: 'Automatically adds a level to your latest spell.', recharge: 14, passive: true },
  barrier: { name: 'Barrier', description: 'Automatically blocks a hit when the gauge is full.', recharge: 16, passive: true },
  receive: { name: 'Receive', description: 'Receive the spell that hits you when charged.', recharge: 12, passive: true },
  charge: { name: 'Charge', description: 'Boost and ram rivals to make them crash.', recharge: 14 },
};
export const ABILITY_IDS = Object.keys(ABILITIES) as AbilityId[];
