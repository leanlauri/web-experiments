import { describe, it, expect } from 'vitest';
import { TrailSystem } from '../src/trail-system.js';

function createStubCanvas() {
  return {
    width: 0,
    height: 0,
    getContext() {
      return {
        fillStyle: null,
        fillRect() {},
        createRadialGradient() {
          return { addColorStop() {} };
        },
        beginPath() {},
        arc() {},
        fill() {},
      };
    },
  };
}

describe('TrailSystem', () => {
  it('maps world positions to UV space', () => {
    const trails = new TrailSystem({ size: 100, resolution: 64, canvas: createStubCanvas() });
    trails.updateOrigin(0, 0);

    const center = trails.worldToUV(0, 0);
    expect(center.u).toBeCloseTo(0.5, 5);
    expect(center.v).toBeCloseTo(0.5, 5);

    const edge = trails.worldToUV(50, 50);
    expect(edge.u).toBeCloseTo(1.0, 5);
    expect(edge.v).toBeCloseTo(1.0, 5);
  });
});
