/** Race classes, as in the original Grand Prix. A class sets every racer's top speed and how well CPU racers drive. */
export type DifficultyId = 'chocobo' | 'behemoth' | 'bahamut';
export interface Difficulty {
  name: string; description: string;
  /** Top speed multiplier for every racer. */
  speed: number;
  /** CPU top speed against the class speed, and the share of the real cornering limit CPU racers plan with. */
  cpuPace: number; cpuCorner: number;
  /** Brake taps a CPU racer plans to use in a corner (0 to 3); more taps carry more speed. */
  cpuTaps: number;
  /** Largest CPU top-speed lift when far behind the leading human, and cut when far ahead. */
  catchUp: number; holdBack: number;
}
export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  chocobo: { name: 'Chocobo Class', description: 'Relaxed rivals.', speed: 1, cpuPace: .94, cpuCorner: .85, cpuTaps: 0, catchUp: .03, holdBack: .05 },
  behemoth: { name: 'Behemoth Class', description: 'Rivals who brake and drift well.', speed: 1, cpuPace: 1.03, cpuCorner: 1, cpuTaps: 1, catchUp: .04, holdBack: .01 },
  bahamut: { name: 'Bahamut Class', description: 'Faster racers and rivals at the limit.', speed: 1.1, cpuPace: 1.06, cpuCorner: 1, cpuTaps: 2, catchUp: .06, holdBack: .015 },
};
export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as DifficultyId[];
export const DEFAULT_DIFFICULTY: DifficultyId = 'behemoth';
