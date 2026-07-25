import * as THREE from 'three';

export const CHUNK_SIZE = 10;
export const CELL_SIZE = 1.5;
export const GRID_HEIGHT = 12;

// Fast deterministic value noise. Keeping density in a voxel grid makes spherical
// boolean subtraction local: only the chunks touched by a blast are rebuilt.
const hash = (x, z, seed) => {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 19.19) * 43758.5453;
  return value - Math.floor(value);
};
const smooth = (t) => t * t * (3 - 2 * t);
const noise = (x, z, seed) => {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, fx), THREE.MathUtils.lerp(c, d, fx), fz);
};

export function terrainHeight(x, z, seed = 8) {
  const broad = noise(x * 0.055, z * 0.055, seed) * 6;
  const detail = noise(x * 0.15, z * 0.15, seed + 4) * 2;
  const basin = Math.max(0, Math.hypot(x, z) - 34) * 0.045;
  return 2.5 + broad + detail + basin;
}

export function terrainColor(x, z, y, seed = 8) {
  const tint = hash(x, z, seed) * 0.08;
  const heightShade = THREE.MathUtils.clamp(y / (GRID_HEIGHT * CELL_SIZE), 0.58, 1);
  return new THREE.Color(
    (0.54 + tint) * heightShade,
    (0.45 + tint) * heightShade,
    (0.26 + tint * 0.5) * heightShade,
  );
}

const key = (x, y, z) => `${x},${y},${z}`;
const chunkKey = (x, z) => `${x},${z}`;

export class VoxelTerrain {
  constructor(scene, material, seed = 8) {
    this.scene = scene;
    this.material = material;
    this.seed = seed;
    this.voxels = new Set();
    this.chunks = new Map();
    this.radius = 3;
    this.generate();
  }

  generate() {
    this.dispose();
    const half = this.radius * CHUNK_SIZE;
    for (let x = -half; x < half; x++) {
      for (let z = -half; z < half; z++) {
        const height = Math.min(GRID_HEIGHT - 1, Math.floor(terrainHeight(x * CELL_SIZE, z * CELL_SIZE, this.seed) / CELL_SIZE) + 3);
        for (let y = 0; y <= height; y++) this.voxels.add(key(x, y, z));
      }
    }
    for (let cx = -this.radius; cx < this.radius; cx++) {
      for (let cz = -this.radius; cz < this.radius; cz++) this.rebuildChunk(cx, cz);
    }
  }

  has(x, y, z) { return this.voxels.has(key(x, y, z)); }
  worldToGrid(value) { return Math.floor(value / CELL_SIZE); }
  cellCenter(x, y, z) { return new THREE.Vector3((x + 0.5) * CELL_SIZE, (y + 0.5) * CELL_SIZE, (z + 0.5) * CELL_SIZE); }

  columnTopGrid(x, z) {
    for (let y = GRID_HEIGHT - 1; y >= 0; y--) if (this.has(x, y, z)) return y + 1;
    return 0;
  }

  surfaceY(worldX, worldZ) {
    const gx = worldX / CELL_SIZE;
    const gz = worldZ / CELL_SIZE;
    const x = Math.floor(gx);
    const z = Math.floor(gz);
    const tx = gx - x;
    const tz = gz - z;
    const a = this.nodeSurfaceY(x, z);
    const b = this.nodeSurfaceY(x + 1, z);
    const c = this.nodeSurfaceY(x, z + 1);
    const d = this.nodeSurfaceY(x + 1, z + 1);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(a, b, tx),
      THREE.MathUtils.lerp(c, d, tx),
      tz,
    );
  }

  carveSphere(center, radius) {
    const removed = [];
    const minX = this.worldToGrid(center.x - radius), maxX = this.worldToGrid(center.x + radius);
    const minY = Math.max(0, this.worldToGrid(center.y - radius)), maxY = this.worldToGrid(center.y + radius);
    const minZ = this.worldToGrid(center.z - radius), maxZ = this.worldToGrid(center.z + radius);
    const dirty = new Set();
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      const position = this.cellCenter(x, y, z);
      const wobble = 0.82 + hash(x + y, z - y, this.seed) * 0.32;
      if (position.distanceTo(center) < radius * wobble && this.voxels.delete(key(x, y, z))) {
        removed.push({ x, y, z, position });
        this.markDirty(dirty, x, z);
      }
    }
    for (const item of dirty) { const [cx, cz] = item.split(',').map(Number); this.rebuildChunk(cx, cz); }
    return removed;
  }

  addSphere(center, radius = CELL_SIZE * 1.15) {
    const gx = this.worldToGrid(center.x), gy = Math.max(0, this.worldToGrid(center.y)), gz = this.worldToGrid(center.z);
    const reach = Math.max(1, Math.ceil(radius / CELL_SIZE) + 1);
    const dirty = new Set();
    let changed = false;
    for (let x = gx - reach; x <= gx + reach; x++) for (let y = Math.max(0, gy - reach); y <= Math.min(GRID_HEIGHT - 1, gy + reach); y++) for (let z = gz - reach; z <= gz + reach; z++) {
      if (this.cellCenter(x, y, z).distanceTo(center) <= radius) {
        const id = key(x, y, z);
        if (!this.voxels.has(id)) {
          this.voxels.add(id);
          this.markDirty(dirty, x, z);
          changed = true;
        }
      }
    }
    if (changed) for (const item of dirty) { const [cx, cz] = item.split(',').map(Number); this.rebuildChunk(cx, cz); }
    return changed;
  }

  reintegratePiece(center, radius = CELL_SIZE * 0.9) {
    const surface = this.surfaceY(center.x, center.z);
    if (surface <= 0 || Math.abs(center.y - surface) > CELL_SIZE * 2.7) return false;
    return this.addSphere(new THREE.Vector3(center.x, surface + radius * 0.45, center.z), radius);
  }

  addMeshShape(mesh, radius = CELL_SIZE, targetCells = null) {
    mesh.updateMatrixWorld(true);
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) return 0;
    const inverse = mesh.matrixWorld.clone().invert();
    const worldBox = new THREE.Box3().setFromObject(mesh);
    const budget = targetCells == null ? null : Math.max(1, Math.round(targetCells));
    const equivalentRadius = budget == null ? radius : CELL_SIZE * Math.cbrt((3 * budget) / (4 * Math.PI));
    const padding = Math.max(CELL_SIZE, equivalentRadius * 1.2);
    const minX = this.worldToGrid(worldBox.min.x - padding), maxX = this.worldToGrid(worldBox.max.x + padding);
    const minY = Math.max(0, this.worldToGrid(worldBox.min.y - padding)), maxY = Math.min(GRID_HEIGHT - 1, this.worldToGrid(worldBox.max.y + padding));
    const minZ = this.worldToGrid(worldBox.min.z - padding), maxZ = this.worldToGrid(worldBox.max.z + padding);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const minHalfSize = Math.max(radius * 0.55, equivalentRadius * 0.95);
    size.set(
      Math.max(size.x, minHalfSize),
      Math.max(size.y, minHalfSize * 0.75),
      Math.max(size.z, minHalfSize),
    );
    const local = new THREE.Vector3();
    const worldPosition = new THREE.Vector3();
    const candidates = [];
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      const id = key(x, y, z);
      if (this.voxels.has(id)) continue;
      worldPosition.copy(this.cellCenter(x, y, z));
      local.copy(worldPosition).applyMatrix4(inverse).sub(center);
      const nx = local.x / Math.max(size.x, 0.001);
      const ny = local.y / Math.max(size.y, 0.001);
      const nz = local.z / Math.max(size.z, 0.001);
      const wobble = 0.9 + hash(x + y, z - y, this.seed) * 0.34;
      const score = nx * nx + ny * ny + nz * nz;
      const nearShape = score <= wobble || (budget != null && score <= wobble * 1.65);
      if (nearShape) candidates.push({ x, y, z, id, score: score + hash(x - y, z + y, this.seed) * 0.18 });
    }
    candidates.sort((a, b) => a.score - b.score);
    const dirty = new Set();
    const limit = budget == null ? candidates.length : Math.min(budget, candidates.length);
    for (let i = 0; i < limit; i++) {
      const item = candidates[i];
      this.voxels.add(item.id);
      this.markDirty(dirty, item.x, item.z);
    }
    if (limit > 0) for (const item of dirty) { const [cx, cz] = item.split(',').map(Number); this.rebuildChunk(cx, cz); }
    return limit;
  }

  markDirty(dirty, x, z) {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    dirty.add(chunkKey(cx, cz));
    if (x % CHUNK_SIZE === 0) dirty.add(chunkKey(cx - 1, cz));
    if (x % CHUNK_SIZE === CHUNK_SIZE - 1 || x % CHUNK_SIZE === -1) dirty.add(chunkKey(cx + 1, cz));
    if (z % CHUNK_SIZE === 0) dirty.add(chunkKey(cx, cz - 1));
    if (z % CHUNK_SIZE === CHUNK_SIZE - 1 || z % CHUNK_SIZE === -1) dirty.add(chunkKey(cx, cz + 1));
  }

  nodeSurfaceY(nodeX, nodeZ) {
    let total = 0;
    let samples = 0;
    for (let x = nodeX - 1; x <= nodeX; x++) {
      for (let z = nodeZ - 1; z <= nodeZ; z++) {
        total += this.columnTopGrid(x, z);
        samples++;
      }
    }
    return (total / samples) * CELL_SIZE;
  }

  rebuildChunk(cx, cz) {
    const id = chunkKey(cx, cz);
    const old = this.chunks.get(id);
    if (old) { this.scene.remove(old); old.geometry.dispose(); }
    const positions = [], colors = [], indices = [];
    const startX = cx * CHUNK_SIZE, startZ = cz * CHUNK_SIZE;
    for (let z = 0; z <= CHUNK_SIZE; z++) {
      for (let x = 0; x <= CHUNK_SIZE; x++) {
        const worldX = (startX + x) * CELL_SIZE;
        const worldZ = (startZ + z) * CELL_SIZE;
        const y = this.nodeSurfaceY(startX + x, startZ + z);
        const color = terrainColor(startX + x, startZ + z, y, this.seed);
        positions.push(worldX, y, worldZ);
        colors.push(color.r, color.g, color.b);
      }
    }
    const stride = CHUNK_SIZE + 1;
    for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) {
      const a = z * stride + x;
      const b = a + 1;
      const d = (z + 1) * stride + x;
      const c = d + 1;
      indices.push(a, d, b, b, d, c);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.material); mesh.receiveShadow = true; mesh.castShadow = true;
    this.chunks.set(id, mesh); this.scene.add(mesh);
  }

  dispose() {
    for (const mesh of this.chunks.values()) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    this.chunks.clear(); this.voxels.clear();
  }
}
