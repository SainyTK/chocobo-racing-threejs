import type { TrackId } from '../track/types.ts';
import type { AbilityId } from './abilities.ts';
import type { Item } from './items.ts';
import type { Input } from './input.ts';

/** One held slot: a stone and how many matching stones merged into it. */
export interface StoneStack { kind: Item; level: number }
export interface Racer {
  id: string; name: string; character: number; abilityId: AbilityId; bot: boolean; connected: boolean;
  px: number; pz: number; yaw: number; vx: number; vz: number; speed: number; s: number; routeS: number; x: number;
  drift: number; drifting: boolean; boost: number; shield: number; stun: number; invincible: number; flying: number; gripUp: number; charging: number;
  mini: number; miniLevel: number; doom: number; doomOwner: string; falling: number; wrongWay: boolean;
  ability: number; stones: StoneStack[]; item: Item | null; itemLevel: number;
  finishTime: number | null; rank: number; lap: number; lapTimes: number[]; lapStart: number; gates: number; lastSafeS: number;
  lastRescue: number; contactCooldown: number; wallCooldown: number; pickupCooldown: number; lastItem: boolean; lastAbility: boolean; lastThrottle: boolean; throttleAt: number; spinReleased: boolean; spinDash: boolean; input: Input;
}
export interface GameEvent { id: number; time: number; type: string; player: string; text: string; target?: string }
export interface Trap { id: number; px: number; pz: number; owner: string; life: number; radius: number }
export interface Projectile { id: number; px: number; pz: number; yaw: number; owner: string; target: string | null; level: number; life: number }
export type RaceMode = 'race' | 'time' | 'versus';
export interface Race { id: string; track: TrackId; laps: number; mode: RaceMode; time: number; phase: 'countdown' | 'racing' | 'finished'; racers: Racer[]; pickups: number[]; traps: Trap[]; projectiles: Projectile[]; events: GameEvent[]; eventId: number; firstFinish: number | null; seed: number }
