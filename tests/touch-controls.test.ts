import { describe, expect, it } from 'vitest';
import { steerFromOffset } from '../src/touch-steering.ts';

describe('steering pad mapping', () => {
  it.each([
    [0, 0], [.1, 0], [-.1, 0], [1, -1], [-1, 1], [5, -1], [-5, 1],
  ])('maps offset %s to steer %s', (offset, steer) => {
    expect(steerFromOffset(offset)).toBeCloseTo(steer);
  });
  it('turns progressively between the deadzone and full lock', () => {
    const half = steerFromOffset(-.575);
    expect(half).toBeCloseTo(.5);
    expect(steerFromOffset(-.3)).toBeLessThan(half);
  });
});
