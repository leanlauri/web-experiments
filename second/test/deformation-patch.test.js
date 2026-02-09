import { describe, it, expect } from 'vitest';
import { DeformationPatch } from '../src/deformation-patch.js';

function getMinY(patch) {
  const positions = patch.geometry.attributes.position;
  let min = Infinity;
  for (let i = 0; i < positions.count; i++) {
    min = Math.min(min, positions.getY(i));
  }
  return min;
}

describe('DeformationPatch', () => {
  it('deforms vertices and resets when moved far', () => {
    const patch = new DeformationPatch({ size: 4, resolution: 8, resetDistance: 1, scene: null });
    patch.updateCenter(0, 0);
    patch.stamp(0, 0);

    const minAfter = getMinY(patch);
    expect(minAfter).toBeLessThan(0);

    patch.updateCenter(5, 0);
    const minReset = getMinY(patch);
    expect(minReset).toBeCloseTo(0, 5);
  });
});
