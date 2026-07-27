import * as THREE from 'three';
import { createRaceTrack } from './track.js';

export const CHUNK_SIZE = 10;
export const CELL_SIZE = 1.5;
export const SDF_CELL_SIZE = CELL_SIZE * 0.6;
export const GRID_HEIGHT = 12;
export const ACTIVE_CHUNK_RADIUS = 4;
// Extend the low-detail field beyond the fog horizon so its outer edge cannot
// expose the scene background when the camera is pulled back.
export const LOD_CHUNK_RADIUS = 32;
export const LOD_CHUNK_SPAN = 4;
// Keep LOD tile edges on high-detail chunk edges. A coarser tile that straddles
// this boundary either reveals a gap when omitted or shows through a crater.
export const LOD_CELL_STEP = CHUNK_SIZE;
export const LOD_UNDERLAY_OFFSET = -0.08;
export const LOD_TRANSITION_SKIRT_DEPTH = CELL_SIZE * 3;
export const LOD_TRANSITION_APRON_WIDTH = CELL_SIZE * 0.24;
export const LOD_BACKSTOP_COLOR_GAIN = 1.85;
export const HORIZON_EXTRA_CHUNKS = 96;
export const HORIZON_CELL_STEP = CHUNK_SIZE * 4;

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

export function naturalTerrainHeight(x, z, seed = 8) {
  // Keep every part of the streamed map inside the voxel height range. The
  // previous distance-based rise eventually hit the ceiling and made far terrain flat.
  const continent = (noise(x * 0.012, z * 0.012, seed + 9) - .5) * 3.2;
  const broad = (noise(x * 0.055, z * 0.055, seed) - .5) * 5.6;
  const detail = (noise(x * 0.15, z * 0.15, seed + 4) - .5) * 1.9;
  const ridges = Math.sin(x * 0.022 + seed * .17) * Math.cos(z * 0.018 - seed * .11) * .7;
  return 7 + continent + broad + detail + ridges;
}

export function terrainHeight(x, z, seed = 8, track = null) {
  const base = naturalTerrainHeight(x, z, seed);
  return track ? track.heightAt(x, z, base) : base;
}

export function terrainColor(x, z, y, seed = 8, track = null) {
  const tint = hash(x, z, seed) * 0.08;
  const heightShade = THREE.MathUtils.clamp(y / (GRID_HEIGHT * CELL_SIZE), 0.58, 1);
  const color = new THREE.Color(
    (0.54 + tint) * heightShade,
    (0.45 + tint) * heightShade,
    (0.26 + tint * 0.5) * heightShade,
  );
  const trackColor = track?.colorAt?.(x * CELL_SIZE, z * CELL_SIZE);
  if (!trackColor) return color;
  const roadColor = new THREE.Color(0.27, 0.25, 0.22);
  const shoulderColor = new THREE.Color(0.62, 0.52, 0.32);
  const target = trackColor.shoulderMask > 0 ? shoulderColor : roadColor;
  target.multiplyScalar(heightShade);
  return color.lerp(target, trackColor.roadMask);
}

const key = (x, y, z) => `${x},${y},${z}`;
const chunkKey = (x, z) => `${x},${z}`;
const CUBE_CORNERS = [
  [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1],
  [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1],
];
const TETRAHEDRA = [
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
];

const averagePoints = (points, indices) => {
  const point = new THREE.Vector3();
  for (const index of indices) point.add(points[index]);
  return point.multiplyScalar(1 / indices.length);
};

const triangleSurfaceY = (a, b, c, d, tx, tz) => {
  if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
  return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
};

export class VoxelTerrain {
  constructor(scene, material, seed = 8, options = {}) {
    this.scene = scene;
    this.material = material;
    this.seed = seed;
    this.trackEnabled = options.trackEnabled ?? true;
    this.addedVoxels = new Set();
    this.removedVoxels = new Set();
    this.voxels = this.addedVoxels;
    this.chunks = new Map();
    this.lodChunks = new Map();
    this.skirtMaterial = material.clone();
    this.skirtMaterial.side = THREE.DoubleSide;
    this.skirtMaterial.shadowSide = THREE.DoubleSide;
    this.skirtMaterial.needsUpdate = true;
    this.backstopMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true });
    this.lodTransitionSkirt = null;
    this.lodOuterSkirt = null;
    this.horizonMesh = null;
    this.lodBounds = null;
    this.highChunkKeys = new Set();
    this.visualEdits = [];
    this.sdfChunks = new Set();
    this.activeRadius = ACTIVE_CHUNK_RADIUS;
    this.lodRadius = LOD_CHUNK_RADIUS;
    this.lodChunkSpan = LOD_CHUNK_SPAN;
    this.lodCellStep = LOD_CELL_STEP;
    this.streamAnchor = { cx: null, cz: null };
    this.track = null;
    this.generate();
  }

  generate() {
    this.dispose();
    this.track = this.trackEnabled ? createRaceTrack(this.seed, { baseHeight: (x, z) => naturalTerrainHeight(x, z, this.seed) }) : null;
    this.visualEdits = [];
    this.sdfChunks.clear();
    this.addedVoxels.clear();
    this.removedVoxels.clear();
    this.highChunkKeys.clear();
    this.streamAnchor = { cx: null, cz: null };
    this.updateVisibleChunks(new THREE.Vector3(0, 0, 0), true);
  }

  isBaseSolid(x, y, z) {
    return y >= 0 && y < GRID_HEIGHT && y < this.baseColumnTopGrid(x, z);
  }

  has(x, y, z) {
    if (y < 0 || y >= GRID_HEIGHT) return false;
    const id = key(x, y, z);
    if (this.removedVoxels.has(id)) return false;
    if (this.addedVoxels.has(id)) return true;
    return this.isBaseSolid(x, y, z);
  }

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
    return triangleSurfaceY(a, b, c, d, tx, tz);
  }

  baseColumnTopGrid(x, z) {
    return Math.min(GRID_HEIGHT - 1, Math.floor(terrainHeight(x * CELL_SIZE, z * CELL_SIZE, this.seed, this.track) / CELL_SIZE) + 3) + 1;
  }

  baseNodeSurfaceY(nodeX, nodeZ) {
    let total = 0;
    let samples = 0;
    for (let x = nodeX - 1; x <= nodeX; x++) {
      for (let z = nodeZ - 1; z <= nodeZ; z++) {
        total += this.baseColumnTopGrid(x, z);
        samples++;
      }
    }
    return (total / samples) * CELL_SIZE;
  }

  baseSurfaceY(worldX, worldZ) {
    const gx = worldX / CELL_SIZE;
    const gz = worldZ / CELL_SIZE;
    const x = Math.floor(gx);
    const z = Math.floor(gz);
    const tx = gx - x;
    const tz = gz - z;
    const a = this.baseNodeSurfaceY(x, z);
    const b = this.baseNodeSurfaceY(x + 1, z);
    const c = this.baseNodeSurfaceY(x, z + 1);
    const d = this.baseNodeSurfaceY(x + 1, z + 1);
    return triangleSurfaceY(a, b, c, d, tx, tz);
  }

  sampleSignedDistance(point, edits = this.visualEdits) {
    return this.sampleSignedDistanceAt(point.x, point.y, point.z, edits);
  }

  sampleSignedDistanceAt(x, y, z, edits = this.visualEdits) {
    return this.applyVisualEdits(y - this.baseSurfaceY(x, z), x, y, z, edits);
  }

  applyVisualEdits(baseDistance, x, y, z, edits) {
    let distance = baseDistance;
    for (const edit of edits) {
      const dx = x - edit.center.x;
      const dy = y - edit.center.y;
      const dz = z - edit.center.z;
      const sphereDistance = Math.hypot(dx, dy, dz) - edit.radius;
      if (edit.type === 'carve') distance = Math.max(distance, -sphereDistance);
      else distance = Math.min(distance, sphereDistance);
    }
    return distance;
  }

  estimateNormal(point, edits = this.visualEdits) {
    const step = SDF_CELL_SIZE * 0.6;
    const dx = this.sampleSignedDistanceAt(point.x + step, point.y, point.z, edits) - this.sampleSignedDistanceAt(point.x - step, point.y, point.z, edits);
    const dy = this.sampleSignedDistanceAt(point.x, point.y + step, point.z, edits) - this.sampleSignedDistanceAt(point.x, point.y - step, point.z, edits);
    const dz = this.sampleSignedDistanceAt(point.x, point.y, point.z + step, edits) - this.sampleSignedDistanceAt(point.x, point.y, point.z - step, edits);
    const normal = new THREE.Vector3(dx, dy, dz);
    if (normal.lengthSq() < 0.0001) return new THREE.Vector3(0, 1, 0);
    return normal.normalize();
  }

  sphereCollision(center, radius, minNormalY = -1) {
    const distance = this.sampleSignedDistance(center);
    if (distance >= radius) return null;
    const normal = this.estimateNormal(center);
    if (normal.y < minNormalY) return null;
    return { penetration: radius - distance, normal, distance };
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
      const id = key(x, y, z);
      if (position.distanceTo(center) < radius * wobble && this.has(x, y, z)) {
        if (!this.addedVoxels.delete(id)) this.removedVoxels.add(id);
        removed.push({ x, y, z, position });
        this.markDirty(dirty, x, z);
      }
    }
    if (removed.length) this.addVisualEdit('carve', center, radius, dirty);
    this.refreshDirtyChunks(dirty);
    return removed;
  }

  addSphere(center, radius = CELL_SIZE * 1.15) {
    const gx = this.worldToGrid(center.x), gy = Math.max(0, this.worldToGrid(center.y)), gz = this.worldToGrid(center.z);
    const reach = Math.max(1, Math.ceil(radius / CELL_SIZE) + 1);
    const dirty = new Set();
    let changed = false;
    for (let x = gx - reach; x <= gx + reach; x++) for (let y = Math.max(0, gy - reach); y <= Math.min(GRID_HEIGHT - 1, gy + reach); y++) for (let z = gz - reach; z <= gz + reach; z++) {
      if (this.cellCenter(x, y, z).distanceTo(center) <= radius) {
        if (!this.has(x, y, z)) {
          const id = key(x, y, z);
          if (!this.removedVoxels.delete(id)) this.addedVoxels.add(id);
          this.markDirty(dirty, x, z);
          changed = true;
        }
      }
    }
    if (changed) this.addVisualEdit('add', center, radius, dirty);
    if (changed) this.refreshDirtyChunks(dirty);
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
      if (this.has(x, y, z)) continue;
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
      if (!this.removedVoxels.delete(item.id)) this.addedVoxels.add(item.id);
      this.markDirty(dirty, item.x, item.z);
    }
    if (limit > 0) {
      const centerWorld = worldBox.getCenter(new THREE.Vector3());
      this.addVisualEdit('add', centerWorld, equivalentRadius, dirty);
    }
    if (limit > 0) this.refreshDirtyChunks(dirty);
    return limit;
  }

  addVisualEdit(type, center, radius, dirty = new Set()) {
    const meshRadius = radius + SDF_CELL_SIZE * 2.5;
    const skipRadius = radius + SDF_CELL_SIZE * 1.5;
    this.visualEdits.push({
      type,
      center: center.clone(),
      radius,
      meshRadius,
      meshRadiusSq: meshRadius * meshRadius,
      skipRadiusSq: skipRadius * skipRadius,
      minX: center.x - meshRadius,
      maxX: center.x + meshRadius,
      minY: Math.max(0, center.y - meshRadius),
      maxY: Math.min(GRID_HEIGHT * CELL_SIZE, center.y + meshRadius),
      minZ: center.z - meshRadius,
      maxZ: center.z + meshRadius,
    });
    const padding = radius + SDF_CELL_SIZE * 2;
    const minX = this.worldToGrid(center.x - padding), maxX = this.worldToGrid(center.x + padding);
    const minZ = this.worldToGrid(center.z - padding), maxZ = this.worldToGrid(center.z + padding);
    const minCx = Math.floor(minX / CHUNK_SIZE), maxCx = Math.floor(maxX / CHUNK_SIZE);
    const minCz = Math.floor(minZ / CHUNK_SIZE), maxCz = Math.floor(maxZ / CHUNK_SIZE);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const id = chunkKey(cx, cz);
        this.sdfChunks.add(id);
        dirty.add(id);
      }
    }
  }

  markDirty(dirty, x, z) {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    dirty.add(chunkKey(cx, cz));
    if (x % CHUNK_SIZE === 0) dirty.add(chunkKey(cx - 1, cz));
    if (x % CHUNK_SIZE === CHUNK_SIZE - 1 || x % CHUNK_SIZE === -1) dirty.add(chunkKey(cx + 1, cz));
    if (z % CHUNK_SIZE === 0) dirty.add(chunkKey(cx, cz - 1));
    if (z % CHUNK_SIZE === CHUNK_SIZE - 1 || z % CHUNK_SIZE === -1) dirty.add(chunkKey(cx, cz + 1));
  }

  refreshDirtyChunks(dirty) {
    const lodDirty = new Set();
    for (const item of dirty) {
      const [cx, cz] = item.split(',').map(Number);
      if (this.chunks.has(item)) this.rebuildChunk(cx, cz);
      lodDirty.add(this.lodKeyForChunk(cx, cz));
    }
    for (const item of lodDirty) {
      const [lx, lz] = item.split(',').map(Number);
      if (this.lodChunks.has(item)) this.rebuildLodChunk(lx, lz);
    }
    if (dirty.size > 0) {
      this.rebuildLodTransitionSkirt();
      this.rebuildLodOuterSkirt();
    }
  }

  lodKeyForChunk(cx, cz) {
    return chunkKey(Math.floor(cx / this.lodChunkSpan), Math.floor(cz / this.lodChunkSpan));
  }

  updateVisibleChunks(anchor = new THREE.Vector3(), force = false) {
    const centerX = Math.floor(this.worldToGrid(anchor.x) / CHUNK_SIZE);
    const centerZ = Math.floor(this.worldToGrid(anchor.z) / CHUNK_SIZE);
    if (!force && centerX === this.streamAnchor.cx && centerZ === this.streamAnchor.cz) return false;
    const previousHighKeys = new Set(this.highChunkKeys);
    this.streamAnchor = { cx: centerX, cz: centerZ };

    const highKeys = new Set();
    for (let cz = centerZ - this.activeRadius; cz <= centerZ + this.activeRadius; cz++) {
      for (let cx = centerX - this.activeRadius; cx <= centerX + this.activeRadius; cx++) {
        const id = chunkKey(cx, cz);
        highKeys.add(id);
        if (!this.chunks.has(id)) this.rebuildChunk(cx, cz);
      }
    }

    for (const [id, mesh] of this.chunks) {
      if (highKeys.has(id)) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.chunks.delete(id);
    }
    this.highChunkKeys = highKeys;

    const lodKeys = new Set();
    const minLx = Math.floor((centerX - this.lodRadius) / this.lodChunkSpan);
    const maxLx = Math.floor((centerX + this.lodRadius) / this.lodChunkSpan);
    const minLz = Math.floor((centerZ - this.lodRadius) / this.lodChunkSpan);
    const maxLz = Math.floor((centerZ + this.lodRadius) / this.lodChunkSpan);
    for (let lz = minLz; lz <= maxLz; lz++) {
      for (let lx = minLx; lx <= maxLx; lx++) {
        const id = chunkKey(lx, lz);
        lodKeys.add(id);
      }
    }

    for (const [id, mesh] of this.lodChunks) {
      if (lodKeys.has(id)) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.lodChunks.delete(id);
    }

    const highCoverageLodKeys = new Set();
    for (const id of previousHighKeys) {
      const [cx, cz] = id.split(',').map(Number);
      highCoverageLodKeys.add(this.lodKeyForChunk(cx, cz));
    }
    for (const id of highKeys) {
      const [cx, cz] = id.split(',').map(Number);
      highCoverageLodKeys.add(this.lodKeyForChunk(cx, cz));
    }

    for (const id of lodKeys) {
      const [lx, lz] = id.split(',').map(Number);
      if (force || !this.lodChunks.has(id) || highCoverageLodKeys.has(id)) this.rebuildLodChunk(lx, lz);
    }
    this.lodBounds = { minLx, maxLx, minLz, maxLz };
    this.rebuildLodTransitionSkirt();
    this.rebuildLodOuterSkirt();
    this.rebuildHorizonTerrain();
    return true;
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
    const edits = this.sdfChunks.has(id) ? this.chunkVisualEdits(startX, startZ) : [];
    if (edits.length > 0) {
      this.addHeightfieldSurface(positions, colors, indices, startX, startZ, (minX, minZ, maxX, maxZ) => this.shouldSkipHeightfieldQuad(minX, minZ, maxX, maxZ, edits));
      this.addSdfSurface(positions, colors, indices, startX, startZ, edits);
    } else this.addHeightfieldSurface(positions, colors, indices, startX, startZ);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.material); mesh.receiveShadow = true; mesh.castShadow = true;
    this.chunks.set(id, mesh); this.scene.add(mesh);
  }

  rebuildLodChunk(lx, lz) {
    const id = chunkKey(lx, lz);
    const old = this.lodChunks.get(id);
    if (old) { this.scene.remove(old); old.geometry.dispose(); this.lodChunks.delete(id); }
    const positions = [], colors = [], indices = [];
    const startX = lx * this.lodChunkSpan * CHUNK_SIZE;
    const startZ = lz * this.lodChunkSpan * CHUNK_SIZE;
    const cellSpan = this.lodChunkSpan * CHUNK_SIZE;
    const step = this.lodCellStep;
    const offsets = [];
    for (let value = 0; value < cellSpan; value += step) offsets.push(value);
    if (offsets[offsets.length - 1] !== cellSpan) offsets.push(cellSpan);

    for (const z of offsets) {
      for (const x of offsets) {
        const worldX = (startX + x) * CELL_SIZE;
        const worldZ = (startZ + z) * CELL_SIZE;
        const y = this.nodeSurfaceY(startX + x, startZ + z) + LOD_UNDERLAY_OFFSET;
        const color = terrainColor(startX + x, startZ + z, y, this.seed, this.track);
        positions.push(worldX, y, worldZ);
        colors.push(color.r, color.g, color.b);
      }
    }

    const stride = offsets.length;
    const isHighDetailCell = (x, z) => {
      const centerCellX = startX + (offsets[x] + offsets[x + 1]) * 0.5;
      const centerCellZ = startZ + (offsets[z] + offsets[z + 1]) * 0.5;
      return this.highChunkKeys.has(chunkKey(Math.floor(centerCellX / CHUNK_SIZE), Math.floor(centerCellZ / CHUNK_SIZE)));
    };
    for (let z = 0; z < offsets.length - 1; z++) for (let x = 0; x < offsets.length - 1; x++) {
      if (isHighDetailCell(x, z)) continue;
      const a = z * stride + x;
      const b = a + 1;
      const d = (z + 1) * stride + x;
      const c = d + 1;
      indices.push(a, d, b, b, d, c);
    }
    if (indices.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.lodChunks.set(id, mesh);
    this.scene.add(mesh);
  }

  rebuildLodTransitionSkirt() {
    if (this.lodTransitionSkirt) {
      this.scene.remove(this.lodTransitionSkirt);
      this.lodTransitionSkirt.geometry.dispose();
      this.lodTransitionSkirt = null;
    }
    if (this.highChunkKeys.size === 0) return;

    const positions = [], colors = [], indices = [], backstopIndices = [];
    const apronWidth = LOD_TRANSITION_APRON_WIDTH / CELL_SIZE;
    const lowDetailY = (gridX, gridZ) => {
      const cellX = Math.floor(gridX / this.lodCellStep) * this.lodCellStep;
      const cellZ = Math.floor(gridZ / this.lodCellStep) * this.lodCellStep;
      const tx = (gridX - cellX) / this.lodCellStep;
      const tz = (gridZ - cellZ) / this.lodCellStep;
      const a = this.nodeSurfaceY(cellX, cellZ) + LOD_UNDERLAY_OFFSET;
      const b = this.nodeSurfaceY(cellX + this.lodCellStep, cellZ) + LOD_UNDERLAY_OFFSET;
      const c = this.nodeSurfaceY(cellX, cellZ + this.lodCellStep) + LOD_UNDERLAY_OFFSET;
      const d = this.nodeSurfaceY(cellX + this.lodCellStep, cellZ + this.lodCellStep) + LOD_UNDERLAY_OFFSET;
      return triangleSurfaceY(a, b, c, d, tx, tz);
    };
    const addQuad = (startX, startZ, endX, endZ, outwardX, outwardZ) => {
      const topStart = this.nodeSurfaceY(startX, startZ);
      const topEnd = this.nodeSurfaceY(endX, endZ);
      const outerStartX = startX + outwardX * apronWidth;
      const outerStartZ = startZ + outwardZ * apronWidth;
      const outerEndX = endX + outwardX * apronWidth;
      const outerEndZ = endZ + outwardZ * apronWidth;
      const lowStart = lowDetailY(outerStartX, outerStartZ);
      const lowEnd = lowDetailY(outerEndX, outerEndZ);
      const backstopTopStart = Math.max(topStart, lowStart);
      const backstopTopEnd = Math.max(topEnd, lowEnd);
      const backstopBottomStart = Math.min(topStart, lowStart) - LOD_TRANSITION_SKIRT_DEPTH;
      const backstopBottomEnd = Math.min(topEnd, lowEnd) - LOD_TRANSITION_SKIRT_DEPTH;
      const start = positions.length / 3;
      const addVertex = (x, y, z, colorY, colorGain = 1) => {
        const color = terrainColor(x, z, colorY, this.seed, this.track);
        color.multiplyScalar(colorGain);
        positions.push(x * CELL_SIZE, y, z * CELL_SIZE);
        colors.push(color.r, color.g, color.b);
      };
      addVertex(startX, topStart, startZ, topStart);
      addVertex(endX, topEnd, endZ, topEnd);
      addVertex(outerStartX, lowStart, outerStartZ, lowStart);
      addVertex(outerEndX, lowEnd, outerEndZ, lowEnd);
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
      const backstop = positions.length / 3;
      addVertex(outerStartX, backstopTopStart, outerStartZ, backstopTopStart, LOD_BACKSTOP_COLOR_GAIN);
      addVertex(outerStartX, backstopBottomStart, outerStartZ, backstopTopStart, LOD_BACKSTOP_COLOR_GAIN);
      addVertex(outerEndX, backstopTopEnd, outerEndZ, backstopTopEnd, LOD_BACKSTOP_COLOR_GAIN);
      addVertex(outerEndX, backstopBottomEnd, outerEndZ, backstopTopEnd, LOD_BACKSTOP_COLOR_GAIN);
      backstopIndices.push(backstop, backstop + 1, backstop + 2, backstop + 2, backstop + 1, backstop + 3);
    };
    const addEdge = (cx, cz, dx, dz) => {
      for (let step = 0; step < CHUNK_SIZE; step++) {
        if (dx !== 0) {
          const x = dx < 0 ? cx * CHUNK_SIZE : (cx + 1) * CHUNK_SIZE;
          addQuad(x, cz * CHUNK_SIZE + step, x, cz * CHUNK_SIZE + step + 1, dx, 0);
        } else {
          const z = dz < 0 ? cz * CHUNK_SIZE : (cz + 1) * CHUNK_SIZE;
          addQuad(cx * CHUNK_SIZE + step, z, cx * CHUNK_SIZE + step + 1, z, 0, dz);
        }
      }
    };
    for (const id of this.highChunkKeys) {
      const [cx, cz] = id.split(',').map(Number);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (!this.highChunkKeys.has(chunkKey(cx + dx, cz + dz))) addEdge(cx, cz, dx, dz);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const apronIndexCount = indices.length;
    indices.push(...backstopIndices);
    geometry.setIndex(indices);
    geometry.addGroup(0, apronIndexCount, 0);
    geometry.addGroup(apronIndexCount, backstopIndices.length, 1);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    this.lodTransitionSkirt = new THREE.Mesh(geometry, [this.skirtMaterial, this.backstopMaterial]);
    this.lodTransitionSkirt.receiveShadow = true;
    this.lodTransitionSkirt.castShadow = false;
    this.scene.add(this.lodTransitionSkirt);
  }

  rebuildLodOuterSkirt() {
    if (this.lodOuterSkirt) {
      this.scene.remove(this.lodOuterSkirt);
      this.lodOuterSkirt.geometry.dispose();
      this.lodOuterSkirt = null;
    }
    if (!this.lodBounds) return;

    const { minLx, maxLx, minLz, maxLz } = this.lodBounds;
    const span = this.lodChunkSpan * CHUNK_SIZE;
    const minX = minLx * span;
    const maxX = (maxLx + 1) * span;
    const minZ = minLz * span;
    const maxZ = (maxLz + 1) * span;
    const positions = [], colors = [], indices = [];
    const addQuad = (startX, startZ, endX, endZ) => {
      const topStart = this.nodeSurfaceY(startX, startZ) + LOD_UNDERLAY_OFFSET;
      const topEnd = this.nodeSurfaceY(endX, endZ) + LOD_UNDERLAY_OFFSET;
      const start = positions.length / 3;
      const addVertex = (x, y, z, colorY) => {
        const color = terrainColor(x, z, colorY, this.seed, this.track);
        positions.push(x * CELL_SIZE, y, z * CELL_SIZE);
        colors.push(color.r, color.g, color.b);
      };
      addVertex(startX, topStart, startZ, topStart);
      addVertex(startX, topStart - LOD_TRANSITION_SKIRT_DEPTH * 2, startZ, topStart);
      addVertex(endX, topEnd, endZ, topEnd);
      addVertex(endX, topEnd - LOD_TRANSITION_SKIRT_DEPTH * 2, endZ, topEnd);
      indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
      indices.push(start + 2, start + 1, start, start + 3, start + 1, start + 2);
    };
    for (let x = minX; x < maxX; x += this.lodCellStep) {
      const endX = Math.min(x + this.lodCellStep, maxX);
      addQuad(x, minZ, endX, minZ);
      addQuad(x, maxZ, endX, maxZ);
    }
    for (let z = minZ; z < maxZ; z += this.lodCellStep) {
      const endZ = Math.min(z + this.lodCellStep, maxZ);
      addQuad(minX, z, minX, endZ);
      addQuad(maxX, z, maxX, endZ);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    this.lodOuterSkirt = new THREE.Mesh(geometry, this.skirtMaterial);
    this.lodOuterSkirt.receiveShadow = true;
    this.lodOuterSkirt.castShadow = false;
    this.scene.add(this.lodOuterSkirt);
  }

  rebuildHorizonTerrain() {
    if (this.horizonMesh) {
      this.scene.remove(this.horizonMesh);
      this.horizonMesh.geometry.dispose();
      this.horizonMesh = null;
    }
    if (!this.lodBounds) return;

    const { minLx, maxLx, minLz, maxLz } = this.lodBounds;
    const span = this.lodChunkSpan * CHUNK_SIZE;
    const padding = HORIZON_EXTRA_CHUNKS * CHUNK_SIZE;
    const innerMinX = minLx * span;
    const innerMaxX = (maxLx + 1) * span;
    const innerMinZ = minLz * span;
    const innerMaxZ = (maxLz + 1) * span;
    const minX = innerMinX - padding;
    const maxX = innerMaxX + padding;
    const minZ = innerMinZ - padding;
    const maxZ = innerMaxZ + padding;
    const offsetsX = [];
    const offsetsZ = [];
    for (let x = minX; x < maxX; x += HORIZON_CELL_STEP) offsetsX.push(x);
    for (let z = minZ; z < maxZ; z += HORIZON_CELL_STEP) offsetsZ.push(z);
    offsetsX.push(maxX);
    offsetsZ.push(maxZ);

    const positions = [], colors = [], indices = [];
    for (const z of offsetsZ) {
      for (const x of offsetsX) {
        const y = this.nodeSurfaceY(x, z) + LOD_UNDERLAY_OFFSET;
        const color = terrainColor(x, z, y, this.seed, this.track);
        positions.push(x * CELL_SIZE, y, z * CELL_SIZE);
        colors.push(color.r, color.g, color.b);
      }
    }
    const stride = offsetsX.length;
    for (let z = 0; z < offsetsZ.length - 1; z++) for (let x = 0; x < offsetsX.length - 1; x++) {
      const centerX = (offsetsX[x] + offsetsX[x + 1]) * 0.5;
      const centerZ = (offsetsZ[z] + offsetsZ[z + 1]) * 0.5;
      if (centerX >= innerMinX && centerX < innerMaxX && centerZ >= innerMinZ && centerZ < innerMaxZ) continue;
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
    this.horizonMesh = new THREE.Mesh(geometry, this.material);
    this.horizonMesh.receiveShadow = true;
    this.horizonMesh.castShadow = false;
    this.scene.add(this.horizonMesh);
  }

  addHeightfieldSurface(positions, colors, indices, startX, startZ, skipQuad = null) {
    for (let z = 0; z <= CHUNK_SIZE; z++) {
      for (let x = 0; x <= CHUNK_SIZE; x++) {
        const worldX = (startX + x) * CELL_SIZE;
        const worldZ = (startZ + z) * CELL_SIZE;
        const y = this.nodeSurfaceY(startX + x, startZ + z);
        const color = terrainColor(startX + x, startZ + z, y, this.seed, this.track);
        positions.push(worldX, y, worldZ);
        colors.push(color.r, color.g, color.b);
      }
    }
    const stride = CHUNK_SIZE + 1;
    for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) {
      if (skipQuad?.(
        (startX + x) * CELL_SIZE,
        (startZ + z) * CELL_SIZE,
        (startX + x + 1) * CELL_SIZE,
        (startZ + z + 1) * CELL_SIZE,
      )) continue;
      const a = z * stride + x;
      const b = a + 1;
      const d = (z + 1) * stride + x;
      const c = d + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  chunkVisualEdits(startX, startZ) {
    const minX = startX * CELL_SIZE;
    const maxX = (startX + CHUNK_SIZE) * CELL_SIZE;
    const minZ = startZ * CELL_SIZE;
    const maxZ = (startZ + CHUNK_SIZE) * CELL_SIZE;
    return this.visualEdits.filter((edit) => edit.maxX >= minX && edit.minX <= maxX && edit.maxZ >= minZ && edit.minZ <= maxZ);
  }

  shouldSkipHeightfieldQuad(minX, minZ, maxX, maxZ, edits) {
    return edits.some((edit) => {
      for (const [x, z] of [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ]]) {
        const dx = x - edit.center.x;
        const dy = this.baseSurfaceY(x, z) - edit.center.y;
        const dz = z - edit.center.z;
        if (dx * dx + dy * dy + dz * dz > edit.skipRadiusSq) return false;
      }
      return true;
    });
  }

  isNearVisualEditAt(x, y, z, edits) {
    return edits.some((edit) => {
      const dx = x - edit.center.x;
      const dy = y - edit.center.y;
      const dz = z - edit.center.z;
      return dx * dx + dy * dy + dz * dz <= edit.meshRadiusSq;
    });
  }

  addSdfSurface(positions, colors, indices, startX, startZ, edits) {
    const worldStartX = startX * CELL_SIZE;
    const worldStartZ = startZ * CELL_SIZE;
    const worldEndX = (startX + CHUNK_SIZE) * CELL_SIZE;
    const worldEndZ = (startZ + CHUNK_SIZE) * CELL_SIZE;
    const xSteps = Math.ceil((CHUNK_SIZE * CELL_SIZE) / SDF_CELL_SIZE);
    const ySteps = Math.ceil((GRID_HEIGHT * CELL_SIZE) / SDF_CELL_SIZE);
    const zSteps = Math.ceil((CHUNK_SIZE * CELL_SIZE) / SDF_CELL_SIZE);
    const bounds = this.sdfMarchBounds(edits, worldStartX, worldStartZ, worldEndX, worldEndZ, xSteps, ySteps, zSteps);
    const gridX = bounds.maxIx - bounds.minIx + 2;
    const gridY = bounds.maxIy - bounds.minIy + 2;
    const gridZ = bounds.maxIz - bounds.minIz + 2;
    const sdfValues = new Float32Array(gridX * gridY * gridZ);
    const baseSurfaces = new Float32Array(gridX * gridZ);
    const valueIndex = (x, y, z) => x + gridX * (y + gridY * z);
    const surfaceIndex = (x, z) => x + gridX * z;
    for (let gz = 0; gz < gridZ; gz++) {
      const worldZ = worldStartZ + (bounds.minIz + gz) * SDF_CELL_SIZE;
      for (let gx = 0; gx < gridX; gx++) {
        const worldX = worldStartX + (bounds.minIx + gx) * SDF_CELL_SIZE;
        baseSurfaces[surfaceIndex(gx, gz)] = this.baseSurfaceY(worldX, worldZ);
      }
    }
    for (let gz = 0; gz < gridZ; gz++) {
      const worldZ = worldStartZ + (bounds.minIz + gz) * SDF_CELL_SIZE;
      for (let gy = 0; gy < gridY; gy++) {
        const worldY = (bounds.minIy + gy) * SDF_CELL_SIZE;
        for (let gx = 0; gx < gridX; gx++) {
          const worldX = worldStartX + (bounds.minIx + gx) * SDF_CELL_SIZE;
          sdfValues[valueIndex(gx, gy, gz)] = this.applyVisualEdits(worldY - baseSurfaces[surfaceIndex(gx, gz)], worldX, worldY, worldZ, edits);
        }
      }
    }
    const cubePoints = Array.from({ length: 8 }, () => new THREE.Vector3());
    const cubeValues = new Array(8);

    for (let ix = bounds.minIx; ix <= bounds.maxIx; ix++) {
      for (let iy = bounds.minIy; iy <= bounds.maxIy; iy++) {
        for (let iz = bounds.minIz; iz <= bounds.maxIz; iz++) {
          const baseX = worldStartX + ix * SDF_CELL_SIZE;
          const baseY = iy * SDF_CELL_SIZE;
          const baseZ = worldStartZ + iz * SDF_CELL_SIZE;
          if (!this.isNearVisualEditAt(baseX + SDF_CELL_SIZE * 0.5, baseY + SDF_CELL_SIZE * 0.5, baseZ + SDF_CELL_SIZE * 0.5, edits)) continue;
          for (let i = 0; i < CUBE_CORNERS.length; i++) {
            const [ox, oy, oz] = CUBE_CORNERS[i];
            cubePoints[i].set(baseX + ox * SDF_CELL_SIZE, baseY + oy * SDF_CELL_SIZE, baseZ + oz * SDF_CELL_SIZE);
            cubeValues[i] = sdfValues[valueIndex(ix - bounds.minIx + ox, iy - bounds.minIy + oy, iz - bounds.minIz + oz)];
          }
          for (const tet of TETRAHEDRA) this.addTetraSurface(positions, colors, indices, cubePoints, cubeValues, tet, edits);
        }
      }
    }
  }

  sdfMarchBounds(edits, worldStartX, worldStartZ, worldEndX, worldEndZ, xSteps, ySteps, zSteps) {
    let minX = worldEndX;
    let maxX = worldStartX;
    let minY = GRID_HEIGHT * CELL_SIZE;
    let maxY = 0;
    let minZ = worldEndZ;
    let maxZ = worldStartZ;
    for (const edit of edits) {
      minX = Math.min(minX, Math.max(worldStartX, edit.minX));
      maxX = Math.max(maxX, Math.min(worldEndX, edit.maxX));
      minY = Math.min(minY, edit.minY);
      maxY = Math.max(maxY, edit.maxY);
      minZ = Math.min(minZ, Math.max(worldStartZ, edit.minZ));
      maxZ = Math.max(maxZ, Math.min(worldEndZ, edit.maxZ));
    }
    const toCell = (value, origin, max) => THREE.MathUtils.clamp(Math.floor((value - origin) / SDF_CELL_SIZE) - 1, 0, max - 1);
    const toEndCell = (value, origin, max) => THREE.MathUtils.clamp(Math.ceil((value - origin) / SDF_CELL_SIZE) + 1, 0, max - 1);
    return {
      minIx: toCell(minX, worldStartX, xSteps),
      maxIx: toEndCell(maxX, worldStartX, xSteps),
      minIy: toCell(minY, 0, ySteps),
      maxIy: toEndCell(maxY, 0, ySteps),
      minIz: toCell(minZ, worldStartZ, zSteps),
      maxIz: toEndCell(maxZ, worldStartZ, zSteps),
    };
  }

  addTetraSurface(positions, colors, indices, points, values, tet, edits) {
    const inside = tet.filter((index) => values[index] < 0);
    const outside = tet.filter((index) => values[index] >= 0);
    if (inside.length === 0 || inside.length === 4) return;

    const edgePoint = (a, b) => {
      const av = values[a];
      const bv = values[b];
      const t = THREE.MathUtils.clamp(av / (av - bv), 0, 1);
      return points[a].clone().lerp(points[b], t);
    };

    if (inside.length === 1 || outside.length === 1) {
      const anchor = inside.length === 1 ? inside[0] : outside[0];
      const others = inside.length === 1 ? outside : inside;
      const gradient = inside.length === 1
        ? averagePoints(points, others).sub(points[anchor])
        : points[anchor].clone().sub(averagePoints(points, others));
      this.addSdfTriangle(
        positions,
        colors,
        indices,
        edgePoint(anchor, others[0]),
        edgePoint(anchor, others[1]),
        edgePoint(anchor, others[2]),
        gradient,
      );
      return;
    }

    const a = edgePoint(inside[0], outside[0]);
    const b = edgePoint(inside[1], outside[0]);
    const c = edgePoint(inside[1], outside[1]);
    const d = edgePoint(inside[0], outside[1]);
    const gradient = averagePoints(points, outside).sub(averagePoints(points, inside));
    this.addSdfTriangle(positions, colors, indices, a, b, c, gradient);
    this.addSdfTriangle(positions, colors, indices, a, c, d, gradient);
  }

  addSdfTriangle(positions, colors, indices, a, b, c, gradient) {
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const ordered = normal.dot(gradient) < 0 ? [a, c, b] : [a, b, c];
    const start = positions.length / 3;
    for (const point of ordered) {
      const color = terrainColor(point.x / CELL_SIZE, point.z / CELL_SIZE, point.y, this.seed, this.track);
      positions.push(point.x, point.y, point.z);
      colors.push(color.r, color.g, color.b);
    }
    indices.push(start, start + 1, start + 2);
  }

  dispose() {
    for (const mesh of this.chunks.values()) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    for (const mesh of this.lodChunks?.values?.() ?? []) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    if (this.lodTransitionSkirt) { this.scene.remove(this.lodTransitionSkirt); this.lodTransitionSkirt.geometry.dispose(); }
    if (this.lodOuterSkirt) { this.scene.remove(this.lodOuterSkirt); this.lodOuterSkirt.geometry.dispose(); }
    if (this.horizonMesh) { this.scene.remove(this.horizonMesh); this.horizonMesh.geometry.dispose(); }
    this.chunks.clear(); this.lodChunks?.clear();
    this.lodTransitionSkirt = null;
    this.lodOuterSkirt = null;
    this.horizonMesh = null;
    this.lodBounds = null;
    this.addedVoxels?.clear(); this.removedVoxels?.clear();
    this.highChunkKeys?.clear();
    this.sdfChunks?.clear();
  }
}
