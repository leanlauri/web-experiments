import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { ANT_CONFIG, ANT_LOD, buildSpatialHash, createRandomAntStates, getBrainIntervalForDistance, getLodBandForDistance, querySpatialHash } from '../src/ant-system.js';
import { TERRAIN_CONFIG } from '../src/terrain.js';

describe('ant system helpers', () => {
  test('creates 200 ants within the terrain bounds', () => {
    const ants = createRandomAntStates(ANT_CONFIG.count);

    expect(ants).toHaveLength(200);
    for (const ant of ants) {
      expect(ant.position.x).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.width / 2);
      expect(ant.position.x).toBeLessThanOrEqual(TERRAIN_CONFIG.width / 2);
      expect(ant.position.z).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.depth / 2);
      expect(ant.position.z).toBeLessThanOrEqual(TERRAIN_CONFIG.depth / 2);
      expect(ant.position.y).toBeGreaterThanOrEqual(ant.radius - TERRAIN_CONFIG.maxHeight - 0.001);
      expect(ant.position.y).toBeLessThanOrEqual(ant.radius + TERRAIN_CONFIG.maxHeight + 0.001);
      expect(ANT_CONFIG.renderOffsetY).toBeLessThan(0);
      expect(ant.action).toBe('wander');
    }
  });

  test('slows brain cadence for distant ants', () => {
    expect(getBrainIntervalForDistance(5)).toBe(ANT_CONFIG.closeBrainInterval);
    expect(getBrainIntervalForDistance(40)).toBe(ANT_CONFIG.midBrainInterval);
    expect(getBrainIntervalForDistance(80)).toBe(ANT_CONFIG.farBrainInterval);
  });

  test('assigns explicit simulation LOD bands by camera distance', () => {
    expect(getLodBandForDistance(5)).toBe(ANT_LOD.near);
    expect(getLodBandForDistance(40)).toBe(ANT_LOD.mid);
    expect(getLodBandForDistance(80)).toBe(ANT_LOD.far);
  });

  test('uses a spatial hash to retrieve nearby ants', () => {
    const ants = createRandomAntStates(3);
    ants[0].position.set(0, ants[0].position.y, 0);
    ants[1].position.set(1.2, ants[1].position.y, 0.6);
    ants[2].position.set(20, ants[2].position.y, 20);

    const hash = buildSpatialHash(ants, ANT_CONFIG.cellSize);
    const neighbors = querySpatialHash(hash, 0, 0, ANT_CONFIG.cellSize);

    expect(neighbors).toContain(ants[0]);
    expect(neighbors).toContain(ants[1]);
    expect(neighbors).not.toContain(ants[2]);
  });

  test('rendered impostor body is smaller than the full collision sphere', () => {
    expect(ANT_CONFIG.impostorRadius).toBeLessThan(ANT_CONFIG.bodyRadius);
    expect(new THREE.Vector3(0, ANT_CONFIG.renderOffsetY, 0).y).toBeLessThan(0);
  });
});
