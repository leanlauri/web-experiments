import * as THREE from 'three';
import { TERRAIN_CONFIG, sampleHeight } from './terrain.js';

export const FOOD_CONFIG = Object.freeze({
  count: 28,
  senseDistance: 12,
  size: 0.3,
});

const randomRange = (min, max) => min + Math.random() * (max - min);

export const createFoodItems = (count = FOOD_CONFIG.count) => {
  const foods = [];
  for (let i = 0; i < count; i += 1) {
    const x = randomRange(-TERRAIN_CONFIG.width / 2 + 2, TERRAIN_CONFIG.width / 2 - 2);
    const z = randomRange(-TERRAIN_CONFIG.depth / 2 + 2, TERRAIN_CONFIG.depth / 2 - 2);
    const y = sampleHeight(x, z) + FOOD_CONFIG.size * 0.55;
    foods.push({ id: i, position: new THREE.Vector3(x, y, z) });
  }
  return foods;
};

export const findNearestFood = (foods, position, maxDistance = FOOD_CONFIG.senseDistance) => {
  let nearest = null;
  let nearestDistanceSq = maxDistance * maxDistance;

  for (const food of foods) {
    const distanceSq = position.distanceToSquared(food.position);
    if (distanceSq <= nearestDistanceSq) {
      nearest = food;
      nearestDistanceSq = distanceSq;
    }
  }

  return nearest;
};

const createFoodVisual = () => {
  const group = new THREE.Group();
  const foodMaterial = new THREE.MeshToonMaterial({ color: 0xc84b31 });
  const leafMaterial = new THREE.MeshToonMaterial({ color: 0x3e7f4a });

  const berry = new THREE.Mesh(new THREE.IcosahedronGeometry(FOOD_CONFIG.size, 0), foodMaterial);
  berry.castShadow = true;
  berry.receiveShadow = true;
  group.add(berry);

  const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 5), leafMaterial);
  leaf.position.y = 0.22;
  leaf.rotation.z = 0.3;
  leaf.castShadow = true;
  group.add(leaf);

  return group;
};

export class FoodSystem {
  constructor({ scene, count = FOOD_CONFIG.count } = {}) {
    this.items = createFoodItems(count);
    this.meshes = [];

    for (const food of this.items) {
      const mesh = createFoodVisual();
      mesh.position.copy(food.position);
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }
}
