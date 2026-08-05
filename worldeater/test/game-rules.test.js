import { describe, expect, it } from 'vitest';
import { canCancelSinking, canSwallow, grownHoleRadius, shouldConsumeAtDepth } from '../src/game-rules.js';

describe('World Eater game rules', () => {
  it('only swallows an object that fits and is centred over the aperture', () => {
    expect(canSwallow({ footprintRadius: 0.6, openingRadius: 1.0, distance: 0.4, height: 0.5, bodyY: 0.5 })).toBe(true);
    expect(canSwallow({ footprintRadius: 1.0, openingRadius: 1.0, distance: 0.2, height: 0.5, bodyY: 0.5 })).toBe(false);
    expect(canSwallow({ footprintRadius: 0.6, openingRadius: 1.0, distance: 1.0, height: 0.5, bodyY: 0.5 })).toBe(false);
  });

  it('grows the aperture more for larger swallowed objects', () => {
    expect(grownHoleRadius(1.35, 1.2)).toBeGreaterThan(grownHoleRadius(1.35, 0.5));
  });

  it('only cancels a fall before the object has crossed the surface', () => {
    expect(canCancelSinking({ bodyY: 0.2, distance: 1.2, cancelRadius: 1 })).toBe(true);
    expect(canCancelSinking({ bodyY: -0.2, distance: 1.2, cancelRadius: 1 })).toBe(false);
  });

  it('consumes only objects that have fallen below the configured depth', () => {
    expect(shouldConsumeAtDepth({ bodyY: -4.4, consumeDepth: -4.3 })).toBe(true);
    expect(shouldConsumeAtDepth({ bodyY: -4.2, consumeDepth: -4.3 })).toBe(false);
  });
});
