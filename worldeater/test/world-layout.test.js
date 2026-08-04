import { describe, expect, it } from 'vitest';
import { WORLD_GRID_COLUMNS, WORLD_GRID_ROWS, WORLD_OBJECT_COUNT } from '../src/world-layout.js';

describe('World layout', () => {
  it('populates one hundred tiles with 1,900 props', () => {
    expect(WORLD_GRID_COLUMNS * WORLD_GRID_ROWS).toBe(100);
    expect(WORLD_OBJECT_COUNT).toBe(1900);
  });
});
