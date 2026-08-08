import { describe, expect, it } from 'vitest';
import { INDIVIDUALS_PER_TILE, OBJECTS_PER_STACK, scatteredPoint, scatteredPoints, STACKS_PER_TILE, WORLD_GRID_COLUMNS, WORLD_GRID_ROWS, WORLD_OBJECT_COUNT } from '../src/world-layout.js';

describe('World layout', () => {
  it('populates one hundred tiles with 1,900 props', () => {
    expect(WORLD_GRID_COLUMNS * WORLD_GRID_ROWS).toBe(100);
    expect(INDIVIDUALS_PER_TILE).toBe(11);
    expect(STACKS_PER_TILE * OBJECTS_PER_STACK).toBe(8);
    expect(WORLD_OBJECT_COUNT).toBe(1900);
  });

  it('adds each scattered point to its occupied set exactly once', () => {
    const occupied = [];
    const point = scatteredPoint(() => 0.25, occupied);
    expect(occupied).toEqual([point]);
  });

  it('creates distinct, separated stack centres', () => {
    const values = [0.1, 0.1, 0.9, 0.9];
    const centers = scatteredPoints(() => values.shift(), 2);
    expect(centers).toHaveLength(2);
    expect(centers[0]).not.toEqual(centers[1]);
    expect(Math.hypot(centers[0].x - centers[1].x, centers[0].z - centers[1].z)).toBeGreaterThan(2.5);
  });
});
