import { RACERS } from '../../shared/game/index.ts';
import { createCharacter, type AnimState, type Pose } from '../../src/gfx/characters/index.ts';
import type { StudioElement } from '../types.ts';

const POSES: Record<string, Partial<AnimState>> = {
  idle: { menu: true },
  drive: { speed: 32 },
  drift: { speed: 28, steer: 1, drifting: true },
  spin: { speed: 6, stun: 1 },
};

/** Reactions loop every `period` seconds so each can be judged on its own. */
const REACTIONS: Record<string, { label: string; period: number; pose: (t: number) => Pose; state?: Partial<AnimState> }> = {
  'hit-1': { label: 'Hit: spin-out', period: 1.6, pose: t => ({ kind: 'hit', t, tier: 1 }), state: { stun: 1 } },
  'hit-2': { label: 'Hit: flattened', period: 1.8, pose: t => ({ kind: 'hit', t, tier: 2 }), state: { stun: 1 } },
  'hit-3': { label: 'Hit: tumble', period: 2, pose: t => ({ kind: 'hit', t, tier: 3 }), state: { stun: 1 } },
  cast: { label: 'Casting', period: 1.2, pose: t => ({ kind: 'cast', t }), state: { speed: 30 } },
  slash: { label: 'Braver swing', period: 1.6, pose: t => ({ kind: 'slash', t }), state: { speed: 30 } },
  overtake: { label: 'Overtaking', period: 1.4, pose: t => ({ kind: 'overtake', t }), state: { speed: 30 } },
  win: { label: 'Winning', period: 6, pose: t => ({ kind: 'win', t }) },
  lose: { label: 'Losing', period: 4, pose: t => ({ kind: 'lose', t }) },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const characters: StudioElement[] = RACERS.map((r, index) => ({
  id: `char.${slug(r.name)}`, name: r.name, category: 'Characters', tags: [r.vehicle, r.ability, 'racer'],
  variants: [{ id: 'idle', label: 'Menu idle' }, { id: 'drive', label: 'Driving' }, { id: 'drift', label: 'Drifting' }, { id: 'spin', label: 'Spin-out' }, ...Object.entries(REACTIONS).map(([id, r]) => ({ id, label: r.label }))],
  create(variant) {
    const c = createCharacter(index), reaction = REACTIONS[variant], pose = reaction?.state ?? POSES[variant] ?? POSES.idle;
    return {
      object: c.root,
      update(t, dt) { c.animate({ t: t + index * 1.7, dt, speed: 0, steer: 0, drifting: false, flying: 0, stun: 0, boost: 0, menu: false, ...pose, pose: reaction?.pose(t % reaction.period) }); },
      dispose() { c.dispose(); },
    };
  },
}));
