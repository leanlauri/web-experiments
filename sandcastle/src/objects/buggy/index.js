import { Entity } from '../../ecs/entity.js';
import { COMPONENTS } from '../../ecs/components.js';
import { createBuggyCameraComponent } from './camera.js';
import { createBuggyDamageComponent } from './damage.js';
import { createBuggyPhysicsComponent } from './physics.js';
import { createBuggyVisualComponent } from './visual.js';

export function createBuggyEntity({
  scene = null,
  world,
  terrain,
  camera = null,
  controls = null,
  keys = new Set(),
  createParticleBurst = () => {},
  spawnShard = () => {},
  triggerScreenShake = () => {},
  getSpawnObstacles = () => ({ buildingBlueprints: [], props: [] }),
  onDestroyed = () => {},
  visuals = true,
} = {}) {
  const state = {
    scene,
    world,
    terrain,
    camera,
    controls,
    keys,
    createParticleBurst,
    spawnShard,
    triggerScreenShake,
    getSpawnObstacles,
    onDestroyed,
    visualEnabled: visuals,
    materials: null,
    body: null,
    group: null,
    wheels: [],
    destroyed: true,
    steering: 0,
    throttle: 0,
    groundedWheels: 0,
    chaseReady: false,
    lastRoofHopAt: -Infinity,
    visual: null,
  };

  const entity = new Entity('dune-buggy');
  const physics = createBuggyPhysicsComponent(state);
  const input = {
    keys,
    update: (delta, now, driving) => physics.update(delta, now, driving),
  };
  const damage = createBuggyDamageComponent(state, physics);

  entity
    .add(COMPONENTS.physics, physics)
    .add(COMPONENTS.input, input)
    .add(COMPONENTS.damage, damage);

  if (visuals) {
    state.visual = createBuggyVisualComponent(state);
    entity.add(COMPONENTS.visual, state.visual);
  }
  if (camera && controls) entity.add(COMPONENTS.camera, createBuggyCameraComponent(state));

  return entity;
}
