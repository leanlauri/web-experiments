import { describe, expect, it } from 'vitest';
import { OBJECT_LOD_ENTER_DISTANCE, OBJECT_LOD_EXIT_DISTANCE, shouldUseObjectLod } from '../src/objectLod.js';

describe('object LOD selection', () => {
  it('uses hysteresis around the high-detail terrain boundary', () => {
    expect(shouldUseObjectLod(OBJECT_LOD_ENTER_DISTANCE - .01)).toBe(false);
    expect(shouldUseObjectLod(OBJECT_LOD_ENTER_DISTANCE)).toBe(true);
    expect(shouldUseObjectLod(OBJECT_LOD_EXIT_DISTANCE + .01, true)).toBe(true);
    expect(shouldUseObjectLod(OBJECT_LOD_EXIT_DISTANCE, true)).toBe(false);
  });
});
