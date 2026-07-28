export const COMPONENTS = Object.freeze({
  transform: 'transform',
  physics: 'physics',
  visual: 'visual',
  input: 'input',
  camera: 'camera',
  damage: 'damage',
  simulation: 'simulation',
  pluginOwned: 'plugin-owned',
});

export function createTransformComponent(position = null, quaternion = null) {
  return { position, quaternion };
}

export function createPhysicsComponent(body, extra = {}) {
  return { body, ...extra };
}

export function createVisualComponent(object, extra = {}) {
  return { object, ...extra };
}
