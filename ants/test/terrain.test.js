import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { createTerrainGeometry, createTerrainMaterial, getTriangleCount } from '../src/terrain.js';

describe('terrain bootstrap helpers', () => {
  test('creates a densely triangulated X/Z ground plane', () => {
    const geometry = createTerrainGeometry({ width: 20, depth: 10, widthSegments: 8, depthSegments: 4, maxHeight: 1.5 });
    geometry.computeBoundingBox();

    expect(getTriangleCount(geometry)).toBe(8 * 4 * 2);
    expect(geometry.boundingBox.min.x).toBeCloseTo(-10, 5);
    expect(geometry.boundingBox.max.x).toBeCloseTo(10, 5);
    expect(geometry.boundingBox.min.z).toBeCloseTo(-5, 5);
    expect(geometry.boundingBox.max.z).toBeCloseTo(5, 5);
    expect(geometry.boundingBox.max.y - geometry.boundingBox.min.y).toBeGreaterThan(0.5);
  });

  test('uses nearest-filtered gradient steps for toon shading', () => {
    const material = createTerrainMaterial();

    expect(material.type).toBe('MeshToonMaterial');
    expect(material.gradientMap).toBeTruthy();
    expect(material.gradientMap.magFilter).toBe(THREE.NearestFilter);
    expect(material.gradientMap.minFilter).toBe(THREE.NearestFilter);
  });
});
