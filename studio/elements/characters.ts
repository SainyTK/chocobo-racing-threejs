import { RACERS } from '../../shared/game/index.ts';
import { createCharacter, type AnimState } from '../../src/gfx/characters/index.ts';
import type { StudioElement } from '../types.ts';

const POSES: Record<string, Partial<AnimState>> = {
  idle: { menu: true },
  drive: { speed: 32 },
  drift: { speed: 28, steer: 1, drifting: true },
  spin: { speed: 6, stun: 1 },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const characters: StudioElement[] = RACERS.map((r, index) => ({
  id: `char.${slug(r.name)}`, name: r.name, category: 'Characters', tags: [r.vehicle, r.ability, 'racer'],
  variants: [{ id: 'idle', label: 'Menu idle' }, { id: 'drive', label: 'Driving' }, { id: 'drift', label: 'Drifting' }, { id: 'spin', label: 'Spin-out' }],
  create(variant) {
    const c = createCharacter(index), pose = POSES[variant] ?? POSES.idle;
    return {
      object: c.root,
      update(t, dt) { c.animate({ t: t + index * 1.7, dt, speed: 0, steer: 0, drifting: false, flying: 0, stun: 0, boost: 0, menu: false, ...pose }); },
      dispose() { c.dispose(); },
    };
  },
}));
