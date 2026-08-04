import { describe, expect, it } from 'vitest';
import { INDIVIDUALS_PER_TILE, OBJECTS_PER_STACK, STACKS_PER_TILE, WORLD_GRID_COLUMNS, WORLD_GRID_ROWS, WORLD_OBJECT_COUNT } from '../src/world-layout.js';

describe('World layout', () => {
  it('populates one hundred tiles with 1,900 props', () => {
    expect(WORLD_GRID_COLUMNS * WORLD_GRID_ROWS).toBe(100);
    expect(INDIVIDUALS_PER_TILE).toBe(11);
    expect(STACKS_PER_TILE * OBJECTS_PER_STACK).toBe(8);
    expect(WORLD_OBJECT_COUNT).toBe(1900);
  });
});
