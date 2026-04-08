import * as THREE from 'three';
import { TERRAIN_CONFIG, sampleHeight } from './terrain.js';

export const FOOD_CONFIG = Object.freeze({
  count: 28,
  senseDistance: 12,
  size: 0.3,
  pickupDistance: 0.7,
});

export const NEST_CONFIG = Object.freeze({
  radius: 2.4,
  rimHeight: 0.5,
  dropoffDistance: 1.8,
  position: new THREE.Vector3(0, 0, 0),
});

const randomRange = (min, max) => min + Math.random() * (max - min);

export const createFoodItems = (count = FOOD_CONFIG.count) => {
  const foods = [];
  for (let i = 0; i < count; i += 1) {
    const x = randomRange(-TERRAIN_CONFIG.width / 2 + 2, TERRAIN_CONFIG.width / 2 - 2);
    const z = randomRange(-TERRAIN_CONFIG.depth / 2 + 2, TERRAIN_CONFIG.depth / 2 - 2);
    const y = sampleHeight(x, z) + FOOD_CONFIG.size * 0.55;
    foods.push({ id: i, position: new THREE.Vector3(x, y, z), claimedBy: null, delivered: false, carried: false });
  }
  return foods;
};

export const getNestPosition = () => {
  const x = NEST_CONFIG.position.x;
  const z = NEST_CONFIG.position.z;
  return new THREE.Vector3(x, sampleHeight(x, z), z);
};

export const findNearestFood = (foods, position, maxDistance = FOOD_CONFIG.senseDistance) => {
  let nearest = null;
  let nearestDistanceSq = maxDistance * maxDistance;

  for (const food of foods) {
    if (food.delivered || food.carried || food.claimedBy != null) continue;
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

const createNestVisual = () => {
  const group = new THREE.Group();
  const nestMaterial = new THREE.MeshToonMaterial({ color: 0x8b5a2b });
  const innerMaterial = new THREE.MeshToonMaterial({ color: 0x5a3414 });

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(NEST_CONFIG.radius, NEST_CONFIG.radius * 0.9, NEST_CONFIG.rimHeight, 24, 1, true), nestMaterial);
  rim.position.y = NEST_CONFIG.rimHeight * 0.5;
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(NEST_CONFIG.radius * 0.78, NEST_CONFIG.radius * 0.84, 0.16, 24), innerMaterial);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  group.add(floor);

  return group;
};

export class FoodSystem {
  constructor({ scene, count = FOOD_CONFIG.count } = {}) {
    this.items = createFoodItems(count);
    this.meshes = [];
    this.nestStored = 0;
    this.nestPosition = getNestPosition();
    this.nestMesh = createNestVisual();
    this.nestMesh.position.copy(this.nestPosition);
    scene.add(this.nestMesh);

    for (const food of this.items) {
      const mesh = createFoodVisual();
      mesh.position.copy(food.position);
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  claimFood(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || food.delivered || food.carried || food.claimedBy != null) return false;
    food.claimedBy = antId;
    return true;
  }

  pickUpFood(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || food.delivered || food.claimedBy !== antId) return false;
    food.carried = true;
    return true;
  }

  dropFoodInNest(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || !food.carried || food.claimedBy !== antId) return false;
    food.delivered = true;
    food.carried = false;
    food.claimedBy = null;
    this.nestStored += 1;
    return true;
  }

  syncCarriedFood(foodId, carrierPosition) {
    const foodIndex = this.items.findIndex((item) => item.id === foodId);
    if (foodIndex === -1) return;
    const food = this.items[foodIndex];
    const mesh = this.meshes[foodIndex];
    if (!food || !mesh || !food.carried) return;
    food.position.copy(carrierPosition);
    mesh.position.copy(carrierPosition);
    mesh.position.y += 0.22;
  }

  updateVisuals() {
    for (let i = 0; i < this.items.length; i += 1) {
      const food = this.items[i];
      const mesh = this.meshes[i];
      if (!mesh) continue;
      mesh.visible = !food.delivered;
    }
  }
}
