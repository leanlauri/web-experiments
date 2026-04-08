import * as THREE from 'three';
import { TERRAIN_CONFIG, sampleHeight } from './terrain.js';

export const FOOD_CONFIG = Object.freeze({
  count: 28,
  senseDistance: 24,
  size: 0.3,
  pickupDistance: 0.7,
  regrowDelayMin: 8,
  regrowDelayMax: 16,
});

export const NEST_CONFIG = Object.freeze({
  radius: 2.4,
  rimHeight: 0.5,
  dropoffDistance: 1.6,
  queueRadius: 3.8,
  queueSlots: 6,
  position: new THREE.Vector3(0, 0, 0),
});

const randomRange = (min, max) => min + Math.random() * (max - min);

const randomFoodPosition = () => {
  const x = randomRange(-TERRAIN_CONFIG.width / 2 + 2, TERRAIN_CONFIG.width / 2 - 2);
  const z = randomRange(-TERRAIN_CONFIG.depth / 2 + 2, TERRAIN_CONFIG.depth / 2 - 2);
  const y = sampleHeight(x, z) + FOOD_CONFIG.size * 0.55;
  return new THREE.Vector3(x, y, z);
};

export const createFoodItems = (count = FOOD_CONFIG.count) => {
  const foods = [];
  for (let i = 0; i < count; i += 1) {
    foods.push({ id: i, position: randomFoodPosition(), claimedBy: null, delivered: false, carried: false, regrowAt: null });
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
    if (food.delivered || food.carried) continue;
    const distanceSq = position.distanceToSquared(food.position);
    if (distanceSq <= nearestDistanceSq) {
      nearest = food;
      nearestDistanceSq = distanceSq;
    }
  }

  return nearest;
};

export const getFoodById = (foods, foodId) => foods.find((food) => food.id === foodId) ?? null;

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
  const queueMaterial = new THREE.MeshToonMaterial({ color: 0xceb07a, transparent: true, opacity: 0.45 });

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(NEST_CONFIG.radius, NEST_CONFIG.radius * 0.9, NEST_CONFIG.rimHeight, 24, 1, true), nestMaterial);
  rim.position.y = NEST_CONFIG.rimHeight * 0.5;
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(NEST_CONFIG.radius * 0.78, NEST_CONFIG.radius * 0.84, 0.16, 24), innerMaterial);
  floor.position.y = 0.08;
  floor.receiveShadow = true;
  group.add(floor);

  for (let i = 0; i < NEST_CONFIG.queueSlots; i += 1) {
    const angle = (i / NEST_CONFIG.queueSlots) * Math.PI * 2;
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 10), queueMaterial);
    marker.position.set(Math.cos(angle) * NEST_CONFIG.queueRadius, 0.03, Math.sin(angle) * NEST_CONFIG.queueRadius);
    group.add(marker);
  }

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
    this.queueAssignments = new Map();

    for (const food of this.items) {
      const mesh = createFoodVisual();
      mesh.position.copy(food.position);
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  claimFood(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || food.delivered || food.carried) return false;
    food.claimedBy = antId;
    return true;
  }

  pickUpFood(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || food.delivered || food.carried) return false;
    food.carried = true;
    food.claimedBy = antId;
    return true;
  }

  reserveNestSlot(antId, antPosition) {
    if (this.queueAssignments.has(antId)) {
      return this.queueAssignments.get(antId);
    }

    const candidates = [];
    for (let i = 0; i < NEST_CONFIG.queueSlots; i += 1) {
      const occupied = [...this.queueAssignments.values()].some((slot) => slot.index === i);
      if (occupied) continue;
      const angle = (i / NEST_CONFIG.queueSlots) * Math.PI * 2;
      const position = new THREE.Vector3(
        this.nestPosition.x + Math.cos(angle) * NEST_CONFIG.queueRadius,
        this.nestPosition.y,
        this.nestPosition.z + Math.sin(angle) * NEST_CONFIG.queueRadius,
      );
      candidates.push({ index: i, position, distanceSq: antPosition.distanceToSquared(position) });
    }

    candidates.sort((a, b) => a.distanceSq - b.distanceSq);
    const chosen = candidates[0] ?? { index: 0, position: this.nestPosition.clone() };
    this.queueAssignments.set(antId, chosen);
    return chosen;
  }

  releaseNestSlot(antId) {
    this.queueAssignments.delete(antId);
  }

  dropFoodInNest(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || !food.carried || food.claimedBy !== antId) return false;
    food.delivered = true;
    food.carried = false;
    food.claimedBy = null;
    food.regrowAt = randomRange(FOOD_CONFIG.regrowDelayMin, FOOD_CONFIG.regrowDelayMax);
    this.nestStored += 1;
    this.releaseNestSlot(antId);
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

  update(dt) {
    for (const food of this.items) {
      if (!food.delivered || food.regrowAt == null) continue;
      food.regrowAt -= dt;
      if (food.regrowAt > 0) continue;
      food.delivered = false;
      food.carried = false;
      food.claimedBy = null;
      food.regrowAt = null;
      food.position.copy(randomFoodPosition());
    }
    this.updateVisuals();
  }

  updateVisuals() {
    for (let i = 0; i < this.items.length; i += 1) {
      const food = this.items[i];
      const mesh = this.meshes[i];
      if (!mesh) continue;
      mesh.visible = !food.delivered;
      if (!food.carried && !food.delivered) {
        mesh.position.copy(food.position);
      }
    }
  }
}
