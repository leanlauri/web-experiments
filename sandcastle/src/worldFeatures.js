import { createBuggyEntity } from './objects/buggy.js';
import { createDefaultPluginRegistry } from './plugins/defaults.js';
import { flatColor } from './plugins/terrain/flat.js';

function booleanParam(params, name, fallback = true) {
  const value = params.get(name);
  return value === null ? fallback : value !== 'false' && value !== '0';
}

function citySizeParam(value) {
  if (value === 'small' || value === 'large') return value;
  return 'medium';
}

export function readWorldFeatures(params = new URLSearchParams(location.search)) {
  const terrainEnabled = booleanParam(params, 'terrain');
  const proceduralCity = booleanParam(params, 'city');
  return {
    terrain: terrainEnabled,
    terrainPlugin: params.get('terrainPlugin') ?? (terrainEnabled ? 'voxel' : 'flat'),
    buggy: booleanParam(params, 'buggy'),
    city: proceduralCity,
    cityPlugin: params.get('cityPlugin') ?? (proceduralCity ? 'procedural' : 'settlements'),
    citySize: citySizeParam(params.get('citySize')),
    track: booleanParam(params, 'track'),
  };
}

export function createTerrainFeature({
  enabled,
  plugin = enabled ? 'voxel' : 'flat',
  registry = createDefaultPluginRegistry(),
  ...context
}) {
  return registry.activate('terrain', 'terrain', plugin, context).api;
}

function createDisabledBuggy() {
  return {
    alive: false,
    body: null,
    group: null,
    spawn() {},
    dispose() {},
    updatePhysics() {},
    afterPhysicsStep() {},
    updateChaseCamera() {},
    damageFromExplosion() {},
  };
}

export function createBuggyFeature(options, enabled = true) {
  return enabled ? createBuggyEntity(options) : createDisabledBuggy();
}

export { flatColor };
