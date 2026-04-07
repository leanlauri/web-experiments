import { describe, expect, test } from 'vitest';
import { ANT_CONFIG, createRandomAntStates, getBrainIntervalForDistance } from '../src/ant-system.js';
import { TERRAIN_CONFIG } from '../src/terrain.js';

describe('ant system helpers', () => {
  test('creates 50 ants within the terrain bounds', () => {
    const ants = createRandomAntStates(ANT_CONFIG.count);

    expect(ants).toHaveLength(50);
    for (const ant of ants) {
      expect(ant.position.x).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.width / 2);
      expect(ant.position.x).toBeLessThanOrEqual(TERRAIN_CONFIG.width / 2);
      expect(ant.position.z).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.depth / 2);
      expect(ant.position.z).toBeLessThanOrEqual(TERRAIN_CONFIG.depth / 2);
      expect(ant.position.y).toBeGreaterThanOrEqual(ant.radius - TERRAIN_CONFIG.maxHeight - 0.001);
      expect(ant.position.y).toBeLessThanOrEqual(ant.radius + TERRAIN_CONFIG.maxHeight + 0.001);
      expect(ant.action).toBe('wander');
    }
  });

  test('slows brain cadence for distant ants', () => {
    expect(getBrainIntervalForDistance(5)).toBe(ANT_CONFIG.closeBrainInterval);
    expect(getBrainIntervalForDistance(40)).toBe(ANT_CONFIG.midBrainInterval);
    expect(getBrainIntervalForDistance(80)).toBe(ANT_CONFIG.farBrainInterval);
  });
});
