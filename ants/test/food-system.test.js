import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { FOOD_CONFIG, NEST_CONFIG, createFoodItems, findNearestFood, getNestPosition } from '../src/food-system.js';
import { TERRAIN_CONFIG } from '../src/terrain.js';

describe('food system helpers', () => {
  test('creates food items within terrain bounds', () => {
    const foods = createFoodItems(FOOD_CONFIG.count);

    expect(foods).toHaveLength(FOOD_CONFIG.count);
    for (const food of foods) {
      expect(food.position.x).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.width / 2);
      expect(food.position.x).toBeLessThanOrEqual(TERRAIN_CONFIG.width / 2);
      expect(food.position.z).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.depth / 2);
      expect(food.position.z).toBeLessThanOrEqual(TERRAIN_CONFIG.depth / 2);
    }
  });

  test('finds the nearest food within sensing range', () => {
    const foods = [
      { id: 1, position: new THREE.Vector3(2, 0, 2) },
      { id: 2, position: new THREE.Vector3(8, 0, 8) },
    ];

    expect(findNearestFood(foods, new THREE.Vector3(0, 0, 0), 5)?.id).toBe(1);
    expect(findNearestFood(foods, new THREE.Vector3(0, 0, 0), 1)).toBeNull();
  });

  test('provides a nest location anchored to terrain height', () => {
    const nest = getNestPosition();

    expect(nest.x).toBe(NEST_CONFIG.position.x);
    expect(nest.z).toBe(NEST_CONFIG.position.z);
    expect(nest.y).toBeTypeOf('number');
  });
});
