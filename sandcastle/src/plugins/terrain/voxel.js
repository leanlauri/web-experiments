import { VoxelTerrain } from '../../terrain.js';

export const voxelTerrainPlugin = {
  id: 'voxel',
  type: 'terrain',
  create({ scene, material, seed, trackEnabled = true }) {
    if (!scene || !material) throw new Error('The voxel terrain plugin requires a scene and material');
    const terrain = new VoxelTerrain(scene, material, seed, { trackEnabled, deferRemesh: true });
    return { api: terrain, dispose: () => terrain.dispose() };
  },
};
