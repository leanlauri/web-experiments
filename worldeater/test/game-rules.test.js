import { describe, expect, it } from 'vitest';
import { canCancelSinking, canSwallow, grownHoleRadius, holeOpeningRadius, shaftContainment, shouldConsumeAtDepth, shouldReleaseIntoVoid } from '../src/game-rules.js';

describe('World Eater game rules', () => {
  it('derives the visual and physical aperture from one shared ratio', () => {
    expect(holeOpeningRadius(1.35)).toBeCloseTo(0.918);
    expect(holeOpeningRadius(2.7)).toBeCloseTo(1.836);
  });

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
    expect(canCancelSinking({ bodyY: 0.2, distance: 1.2, cancelRadius: 1, recoverHeight: 0.3 })).toBe(false);
  });

  it('consumes only objects that have fallen below the configured depth', () => {
    expect(shouldConsumeAtDepth({ bodyY: -4.4, consumeDepth: -4.3 })).toBe(true);
    expect(shouldConsumeAtDepth({ bodyY: -4.2, consumeDepth: -4.3 })).toBe(false);
    expect(shouldConsumeAtDepth({ bodyY: -9.99, consumeDepth: -10 })).toBe(false);
    expect(shouldConsumeAtDepth({ bodyY: -10, consumeDepth: -10 })).toBe(true);
  });

  it('releases swallowed objects from all contacts once they clear the shallow rim', () => {
    expect(shouldReleaseIntoVoid({ bodyY: -0.41, rimDepth: 0.42 })).toBe(false);
    expect(shouldReleaseIntoVoid({ bodyY: -0.42, rimDepth: 0.42 })).toBe(true);
  });

  it('returns a swallowed body to the shaft interior when the rim moves across it', () => {
    expect(shaftContainment({ offsetX: 1, offsetZ: 0, openingRadius: 0.8, footprintRadius: 0.4 })).toEqual({ x: -0.62, z: 0 });
    expect(shaftContainment({ offsetX: 0.2, offsetZ: 0, openingRadius: 0.8, footprintRadius: 0.4 })).toEqual({ x: 0, z: 0 });
  });
});
