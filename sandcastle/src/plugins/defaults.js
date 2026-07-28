import { PluginRegistry } from './registry.js';
import { flatTerrainPlugin } from './terrain/flat.js';
import { voxelTerrainPlugin } from './terrain/voxel.js';
import { proceduralCityPlugin } from './city/procedural.js';
import { settlementsCityPlugin } from './city/settlements.js';

export function createDefaultPluginRegistry() {
  return new PluginRegistry()
    .register(voxelTerrainPlugin)
    .register(flatTerrainPlugin)
    .register(proceduralCityPlugin)
    .register(settlementsCityPlugin);
}
