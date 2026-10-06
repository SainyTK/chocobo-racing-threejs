import { describe, expect, it } from 'vitest';
import { joystickActions } from '../src/touch-controls.ts';

describe('joystick arrow mappings', () => {
  it.each([
    [0, 0, []], [.1, -.1, []], [0, -1, ['throttle']], [0, 1, ['brake']],
    [-1, 0, ['left']], [1, 0, ['right']], [-.7, -.7, ['left', 'throttle']],
    [.7, -.7, ['right', 'throttle']], [-.7, .7, ['left', 'brake']],
    [10, -10, ['right', 'throttle']],
  ])('maps (%s, %s)', (x, y, actions) => {
    expect(joystickActions(x as number, y as number)).toEqual(actions);
  });
});
