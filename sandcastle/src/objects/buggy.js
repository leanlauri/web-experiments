import { Entity } from '../ecs/entity.js';
import { COMPONENTS } from '../ecs/components.js';
import { createDuneBuggy } from '../duneBuggy.js';

export function createBuggyEntity(options = {}) {
  const visuals = options.visuals ?? true;
  const model = createDuneBuggy({ ...options, visualEnabled: visuals });
  const entity = new Entity('dune-buggy');

  const physics = {
    get body() { return model.body; },
    get position() { return model.position; },
    get alive() { return model.alive; },
    spawn: (position, heading) => model.spawn(position, heading),
    update: (delta, now, driving) => model.updatePhysics(delta, now, driving),
    afterStep: () => model.applyChassisTerrainContact(),
    dispose: (destroyed = false) => model.dispose(destroyed),
  };
  const input = {
    keys: options.keys ?? new Set(),
    update: (delta, now, driving) => physics.update(delta, now, driving),
  };
  const damage = {
    explosion: (center, radius) => model.damageFromExplosion(center, radius),
  };

  entity
    .add(COMPONENTS.physics, physics)
    .add(COMPONENTS.input, input)
    .add(COMPONENTS.damage, damage);

  const visual = visuals ? {
    get object() { return model.group; },
    sync: (delta) => model.updateVisuals(delta),
    setEnabled: (enabled) => model.setVisualEnabled(enabled),
  } : null;
  if (visual) entity.add(COMPONENTS.visual, visual);

  const camera = options.camera && options.controls ? {
    update: (delta, snap, enabled) => model.updateChaseCamera(delta, snap, enabled),
  } : null;
  if (camera) entity.add(COMPONENTS.camera, camera);

  // Compatibility facade while the rest of the game is migrated system by
  // system. New code should read components from `entity`.
  const api = {
    entity,
    get alive() { return physics.alive; },
    get body() { return physics.body; },
    get position() { return physics.position; },
    get group() { return visual?.object ?? null; },
    get wheels() { return model.wheels; },
    spawn: physics.spawn,
    dispose: physics.dispose,
    updatePhysics: input.update,
    afterPhysicsStep(delta) {
      physics.afterStep(delta);
      visual?.sync(delta);
    },
    updateChaseCamera(delta, snap = false, enabled = true) {
      camera?.update(delta, snap, enabled);
    },
    damageFromExplosion: damage.explosion,
  };

  return api;
}
