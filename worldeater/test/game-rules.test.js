import { describe, expect, it } from 'vitest';
import { canSwallow, grownHoleRadius } from '../src/game-rules.js';

describe('World Eater game rules', () => {
  it('only swallows an object that fits and is centred over the aperture', () => {
    expect(canSwallow({ size: 0.6, holeRadius: 1.35, distance: 0.4, height: 0.5, bodyY: 0.5 })).toBe(true);
    expect(canSwallow({ size: 1.2, holeRadius: 1.35, distance: 0.2, height: 0.5, bodyY: 0.5 })).toBe(false);
    expect(canSwallow({ size: 0.6, holeRadius: 1.35, distance: 1.0, height: 0.5, bodyY: 0.5 })).toBe(false);
  });

  it('grows the aperture more for larger swallowed objects', () => {
    expect(grownHoleRadius(1.35, 1.2)).toBeGreaterThan(grownHoleRadius(1.35, 0.5));
  });
});
