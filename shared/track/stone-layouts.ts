import type { StoneField, TrackId } from './types.ts';

/**
 * Magic Stone fields per course, on straight road so racers can pick a lane. Fields stay clear of shortcut forks, ramps,
 * the Floating Gardens gap and timed hazards such as Vulcan-O Valley's boulders.
 * Every course uses the stone set the original introduced in its Story chapter: Haste and "?" in Moogle Forest,
 * then Fire, Ice, Thunder, Mini, Reflect and Doom one chapter at a time. The original's first course had no stones;
 * here it shares Moogle Forest's set so a quick race on it still has magic. Ultima only comes from "?" stones.
 * The first field of a lap has two rows, so holding a lane there stacks a level 2 spell; a level 3 spell takes a second field.
 */
export const STONE_LAYOUTS: Record<TrackId, StoneField[]> = {
  test: [
    { at: .10, rows: 2, lanes: ['haste', 'random', 'haste'] },
    { at: .37, rows: 1, lanes: ['random', 'haste', 'random'] },
    { at: .57, rows: 1, lanes: ['haste', 'random', 'haste'] },
  ],
  forest: [
    { at: .08, rows: 2, lanes: ['haste', 'random', 'haste'] },
    { at: .48, rows: 1, lanes: ['random', 'haste', 'random'] },
    { at: .73, rows: 1, lanes: ['haste', 'random', 'haste'] },
  ],
  gate: [
    { at: .10, rows: 2, lanes: ['fire', 'haste', 'fire'] },
    { at: .54, rows: 1, lanes: ['haste', 'random', 'fire'] },
    { at: .88, rows: 1, lanes: ['fire', 'random', 'haste'] },
  ],
  mines: [
    { at: .10, rows: 2, lanes: ['fire', 'ice', 'haste'] },
    { at: .52, rows: 1, lanes: ['ice', 'random', 'fire'] },
    { at: .71, rows: 1, lanes: ['haste', 'fire', 'ice'] },
  ],
  manor: [
    { at: .08, rows: 2, lanes: ['thunder', 'fire', 'ice', 'haste'] },
    { at: .51, rows: 1, lanes: ['fire', 'random', 'thunder', 'ice'] },
    { at: .73, rows: 1, lanes: ['haste', 'thunder', 'random', 'fire'] },
  ],
  gardens: [
    { at: .08, rows: 2, lanes: ['mini', 'fire', 'thunder', 'haste'] },
    { at: .33, rows: 1, lanes: ['ice', 'random', 'mini', 'fire'] },
    { at: .76, rows: 1, lanes: ['thunder', 'haste', 'ice', 'random'] },
  ],
  gingerbread: [
    { at: .08, rows: 2, lanes: ['fire', 'shield', 'ice', 'thunder'] },
    { at: .39, rows: 1, lanes: ['mini', 'random', 'haste', 'fire'] },
    // The original's lone "?" stone on the syrup shortcut, halfway along it.
    { at: .5, rows: 1, lanes: ['random'], route: 0 },
    { at: .86, rows: 1, lanes: ['thunder', 'ice', 'shield', 'random'] },
  ],
  volcano: [
    { at: .08, rows: 2, lanes: ['fire', 'thunder', 'doom', 'haste'] },
    { at: .40, rows: 1, lanes: ['ice', 'random', 'mini', 'fire'] },
    { at: .80, rows: 1, lanes: ['shield', 'thunder', 'random', 'ice'] },
  ],
};
