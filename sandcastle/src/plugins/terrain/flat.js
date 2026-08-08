import * as THREE from 'three';

const flatColor = new THREE.Color('#b9b18f');

export class FlatTerrain {
  constructor({ scene = null, material = null, visuals = true, roadNetwork = null } = {}) {
    this.scene = scene;
    this.material = material;
    this.seed = 0;
    this.track = roadNetwork;
    this.chunks = new Map();
    this.lodChunks = new Map();
    this.lodTransitionSkirt = null;
    this.lodOuterSkirt = null;
    this.horizonMesh = null;
    if (visuals && scene && material) this.createMesh();
  }

  createMesh() {
    const material = this.material.clone();
    material.vertexColors = false;
    material.color.copy(flatColor);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2_400, 2_400), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.name = 'flat-ground';
    this.scene.add(mesh);
    this.chunks.set('flat', mesh);
  }

  generate() {}
  updateVisibleChunks() {}
  processRemeshQueue() { return { high: 0, lod: 0, pendingHigh: 0, pendingLod: 0 }; }
  worldToGrid(value) { return Math.floor(value); }
  has(_x, y) { return y < 0; }
  surfaceY() { return 0; }
  baseSurfaceY() { return 0; }
  sampleSignedDistance(point) { return point.y; }
  estimateNormal() { return new THREE.Vector3(0, 1, 0); }
  sphereCollision(center, radius) {
    if (center.y >= radius) return null;
    return { penetration: radius - center.y, normal: new THREE.Vector3(0, 1, 0), distance: center.y };
  }
  carveSphere() { return []; }
  addMeshShape() { return false; }
  dispose() {
    for (const mesh of this.chunks.values()) {
      this.scene?.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.chunks.clear();
  }
}

export const flatTerrainPlugin = {
  id: 'flat',
  type: 'terrain',
  create(context) {
    const terrain = new FlatTerrain(context);
    return { api: terrain, dispose: () => terrain.dispose() };
  },
};

export { flatColor };
