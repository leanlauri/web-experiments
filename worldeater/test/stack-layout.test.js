import { describe, expect, it } from 'vitest';
import { layoutStackLevels } from '../src/stack-layout.js';

describe('stack layout', () => {
  it('places every bottom at or above the previous top plus the configured margin', () => {
    const placements = layoutStackLevels([
      { id: 'base', halfHeight: 1 },
      { id: 'short', halfHeight: 0.25 },
      { id: 'tall', halfHeight: 0.75 },
      { id: 'cap', halfHeight: 0.4 },
    ], { groundMargin: 0.04, levelMargin: 0.08 });

    expect(placements[0].bottom).toBeCloseTo(0.04);
    for (let index = 1; index < placements.length; index += 1) {
      expect(placements[index].bottom).toBeCloseTo(placements[index - 1].top + 0.08);
      expect(placements[index].bottom).toBeGreaterThan(placements[index - 1].top);
    }
  });

  it('derives each centre and top from the level half-height', () => {
    const [level] = layoutStackLevels([{ halfHeight: 0.6 }], { groundMargin: 0.05 });
    expect(level.bottom).toBeCloseTo(0.05);
    expect(level.y).toBeCloseTo(0.65);
    expect(level.top).toBeCloseTo(1.25);
  });

  it('places adjacent levels exactly edge-to-edge when margin is zero', () => {
    const placements = layoutStackLevels([
      { halfHeight: 0.5 },
      { halfHeight: 0.75 },
    ], { levelMargin: 0 });
    expect(placements[1].bottom).toBeCloseTo(placements[0].top);
  });
});
