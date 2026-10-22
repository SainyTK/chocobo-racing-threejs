import type { AbilityId } from './abilities.ts';

/** `hovers`: rides above the road, so Ice sheets and rough-ground dust pass underneath. */
export const RACERS = [
  { name: 'Chocobo', color: '#ffb52e', light: '#ffd98a', vehicle: 'Jet-Blades CR', ability: 'dash' as AbilityId, speed: 39.3, acceleration: 23, grip: 10, steering: 1.65, size: 1, hovers: false },
  { name: 'Mog', color: '#f7ece5', light: '#ffffff', vehicle: 'Mog-Mobile R2', ability: 'flap' as AbilityId, speed: 39.3, acceleration: 27, grip: 10, steering: 1.8, size: .93, hovers: false },
  { name: 'Golem', color: '#a3937e', light: '#d8c8a2', vehicle: "Rockin' Roller V8", ability: 'grip' as AbilityId, speed: 38.9, acceleration: 19, grip: 13, steering: 1.83, size: 1.18, hovers: false },
  { name: 'Goblin', color: '#83ba62', light: '#c4dc8c', vehicle: 'Gob-Cart H4', ability: 'mug' as AbilityId, speed: 39.9, acceleration: 24, grip: 8.5, steering: 1.65, size: .92, hovers: false },
  { name: 'Black Magician', color: '#384fab', light: '#7993e3', vehicle: 'MagiCloud MK-1', ability: 'magic' as AbilityId, speed: 39.3, acceleration: 23, grip: 9.5, steering: 1.7, size: 1, hovers: true },
  { name: 'White Mage', color: '#eee9dd', light: '#f6d3db', vehicle: 'Cosmic Carpet', ability: 'barrier' as AbilityId, speed: 38.5, acceleration: 26, grip: 13, steering: 1.8, size: .92, hovers: true },
  { name: 'Chubby Chocobo', color: '#fff6d9', light: '#ffffff', vehicle: 'Phat-Burner Plus', ability: 'receive' as AbilityId, speed: 38.5, acceleration: 23, grip: 14, steering: 1.93, size: 1.3, hovers: false },
  { name: 'Behemoth', color: '#6c389c', light: '#8e64c4', vehicle: 'Behemo-Buggy 99', ability: 'charge' as AbilityId, speed: 38.9, acceleration: 25, grip: 11, steering: 1.7, size: 1.2, hovers: false },
  { name: 'Bahamut', color: '#3a50cc', light: '#36c98a', vehicle: 'Dragon Wings', ability: 'megaflare' as AbilityId, speed: 39.9, acceleration: 24, grip: 9, steering: 1.7, size: 1.15, hovers: true },
  { name: 'Cloud', color: '#5d6f3a', light: '#f0cf3a', vehicle: 'Hardy-Daytona', ability: 'dash' as AbilityId, speed: 39.9, acceleration: 24, grip: 8.5, steering: 1.65, size: 1.05, hovers: false },
];

export type RacerProfile = typeof RACERS[number];
