import * as CANNON from 'cannon-es';
import { ECSWorld } from './ecs/world.js';
import { COMPONENTS } from './ecs/components.js';
import { createBuggyEntity } from './objects/buggy.js';
import { createDefaultPluginRegistry } from './plugins/defaults.js';

export function createHeadlessSimulation({
  gravity = new CANNON.Vec3(0, -18, 0),
  terrainPlugin = 'flat',
  seed = 1,
} = {}) {
  const ecs = new ECSWorld();
  const physicsWorld = new CANNON.World({ gravity });
  const plugins = createDefaultPluginRegistry();
  const terrainHandle = plugins.activate('terrain', 'terrain', terrainPlugin, { seed, visuals: false });
  const terrain = terrainHandle.api;
  const keys = new Set();
  const buggy = createBuggyEntity({
    world: physicsWorld,
    terrain,
    keys,
    visuals: false,
  });
  ecs.add(buggy.entity);

  return {
    ecs,
    physicsWorld,
    plugins,
    terrain,
    buggy,
    keys,
    step(delta = 1 / 60, now = 0, driving = false) {
      buggy.entity.require(COMPONENTS.input).update(delta, now, driving);
      physicsWorld.step(1 / 60, delta, 3);
      buggy.entity.require(COMPONENTS.physics).afterStep(delta);
    },
    dispose() {
      ecs.dispose();
      plugins.dispose();
    },
  };
}
