import type { AbilityId } from './abilities.ts';

export const RACERS = [
  { name: 'Chocobo', color: '#ffd044', light: '#fff09a', vehicle: 'Jet-Blades CR', ability: 'dash' as AbilityId, speed: 38.4, acceleration: 23, grip: 10, steering: 1.65, size: 1 },
  { name: 'Mog', color: '#f7ece5', light: '#ffffff', vehicle: 'Mog-Mobile R2', ability: 'flap' as AbilityId, speed: 37.5, acceleration: 27, grip: 12, steering: 1.8, size: .93 },
  { name: 'Golem', color: '#a3937e', light: '#d8c8a2', vehicle: "Rockin' Roller V8", ability: 'grip' as AbilityId, speed: 38.4, acceleration: 19, grip: 14, steering: 1.83, size: 1.18 },
  { name: 'Goblin', color: '#83ba62', light: '#c4dc8c', vehicle: 'Gob-Cart H4', ability: 'mug' as AbilityId, speed: 40.2, acceleration: 24, grip: 9, steering: 1.65, size: .92 },
  { name: 'Black Magician', color: '#384fab', light: '#7993e3', vehicle: 'MagiCloud MK-1', ability: 'magic' as AbilityId, speed: 38.0, acceleration: 23, grip: 8.5, steering: 1.7, size: 1 },
  { name: 'White Mage', color: '#eee9dd', light: '#f6d3db', vehicle: 'Cosmic Carpet', ability: 'barrier' as AbilityId, speed: 36.6, acceleration: 26, grip: 12, steering: 1.8, size: .92 },
  { name: 'Chubby Chocobo', color: '#fff6d9', light: '#ffffff', vehicle: 'Phat-Burner Plus', ability: 'receive' as AbilityId, speed: 36.6, acceleration: 18, grip: 14, steering: 1.93, size: 1.3 },
  { name: 'Behemoth', color: '#9370b0', light: '#ceb1db', vehicle: 'Behemo-Buggy 99', ability: 'charge' as AbilityId, speed: 38.4, acceleration: 25, grip: 11, steering: 1.7, size: 1.2 },
];

export type RacerProfile = typeof RACERS[number];
