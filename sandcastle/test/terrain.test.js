import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ACTIVE_CHUNK_RADIUS, CELL_SIZE, SDF_CELL_SIZE, VoxelTerrain, terrainHeight } from '../src/terrain.js';
import { createRaceTrack } from '../src/track.js';

describe('procedural terrain', () => {
  it('is deterministic for a seed', () => expect(terrainHeight(12, -5, 42)).toBe(terrainHeight(12, -5, 42)));
  it('changes across the field', () => expect(terrainHeight(0, 0, 5)).not.toBe(terrainHeight(30, 30, 5)));

  it('generates a deterministic race track with two to four straights', () => {
    const baseHeight = (x, z) => 4 + Math.sin(x * 0.08) + Math.cos(z * 0.06);
    const first = createRaceTrack(42.25, { baseHeight });
    const second = createRaceTrack(42.25, { baseHeight });

    expect(first.straights.length).toBeGreaterThanOrEqual(2);
    expect(first.straights.length).toBeLessThanOrEqual(4);
    expect(first.samples.length).toBeGreaterThan(80);
    expect(first.length).toBeGreaterThan(500);
    expect(Math.max(first.bounds.maxX - first.bounds.minX, first.bounds.maxZ - first.bounds.minZ)).toBeGreaterThan(190);
    expect(first.startPose()).toEqual(second.startPose());
    expect(first.samples.slice(0, 8).map((sample) => [sample.x, sample.z, sample.height])).toEqual(
      second.samples.slice(0, 8).map((sample) => [sample.x, sample.z, sample.height]),
    );
  });

  it('smooths the track surface and banks generated corners', () => {
    const roughBase = (x, z) => 5 + Math.sin(x * 0.55) * 1.4 + Math.cos(z * 0.45) * 1.2;
    const track = createRaceTrack(12, { baseHeight: roughBase, straightCount: 4 });
    const banked = track.samples.find((sample) => Math.abs(sample.bankSlope) > 0.025);
    const straight = track.samples.find((sample) => sample.kind === 'straight');

    expect(banked).toBeTruthy();
    expect(straight).toBeTruthy();
    expect(Math.abs(straight.bankSlope)).toBeLessThan(0.005);

    const leftHeight = track.heightAt(banked.x + banked.normalX * 2.4, banked.z + banked.normalZ * 2.4);
    const rightHeight = track.heightAt(banked.x - banked.normalX * 2.4, banked.z - banked.normalZ * 2.4);
    expect(Math.abs(leftHeight - rightHeight)).toBeGreaterThan(0.1);

    const localGrades = track.samples.map((sample, index, samples) => {
      const next = samples[(index + 1) % samples.length];
      return Math.abs(next.height - sample.height) / Math.max(0.001, Math.hypot(next.x - sample.x, next.z - sample.z));
    });
    expect(Math.max(...localGrades)).toBeLessThan(0.11);
  });

  it('can disable the generated track layer for debugging', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 12, { trackEnabled: false });

    expect(terrain.track).toBeNull();
    terrain.dispose();
  });

  it('carves local terrain volume and rebuilds affected chunks', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 12);
    const before = terrain.removedVoxels.size;
    const removed = terrain.carveSphere(new THREE.Vector3(0, terrain.surfaceY(0, 0) - CELL_SIZE, 0), CELL_SIZE * 2.2);

    expect(removed.length).toBeGreaterThan(0);
    expect(terrain.removedVoxels.size).toBeGreaterThan(before);
    expect(terrain.chunks.size).toBe((ACTIVE_CHUNK_RADIUS * 2 + 1) ** 2);
    terrain.dispose();
  });

  it('streams high-detail chunks around a moving anchor and keeps far LOD meshes', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 12);
    const activeChunkCount = (ACTIVE_CHUNK_RADIUS * 2 + 1) ** 2;

    expect(terrain.chunks.size).toBe(activeChunkCount);
    expect(terrain.lodChunks.size).toBeGreaterThan(0);
    expect(terrain.lodChunks.get('0,0')?.geometry.index.count).toBeGreaterThan(0);

    terrain.updateVisibleChunks(new THREE.Vector3(420, 0, -360));
    expect(terrain.chunks.size).toBe(activeChunkCount);
    expect(terrain.chunks.has('0,0')).toBe(false);
    expect(terrain.chunks.has('28,-24')).toBe(true);
    expect(terrain.lodChunks.size).toBeGreaterThan(0);
    terrain.dispose();
  });

  it('reports smoothed visible surface height for collision checks', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 12);
    const cellX = terrain.worldToGrid(0);
    const cellZ = terrain.worldToGrid(0);
    const steppedSurface = terrain.columnTopGrid(cellX, cellZ) * CELL_SIZE;
    const renderedSurface = terrain.surfaceY(CELL_SIZE * 0.5, CELL_SIZE * 0.5);

    expect(Number.isFinite(renderedSurface)).toBe(true);
    expect(Math.abs(renderedSurface - steppedSurface)).toBeLessThanOrEqual(CELL_SIZE * 2);
    terrain.dispose();
  });

  it('samples the same triangle surface used by the rendered heightfield', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 20);
    const nodeX = 3;
    const nodeZ = -4;
    const a = terrain.nodeSurfaceY(nodeX, nodeZ);
    const b = terrain.nodeSurfaceY(nodeX + 1, nodeZ);
    const c = terrain.nodeSurfaceY(nodeX, nodeZ + 1);
    const d = terrain.nodeSurfaceY(nodeX + 1, nodeZ + 1);
    const lowerTx = 0.32;
    const lowerTz = 0.41;
    const upperTx = 0.72;
    const upperTz = 0.58;
    const lowerExpected = a + (b - a) * lowerTx + (c - a) * lowerTz;
    const upperExpected = d + (c - d) * (1 - upperTx) + (b - d) * (1 - upperTz);

    expect(terrain.surfaceY((nodeX + lowerTx) * CELL_SIZE, (nodeZ + lowerTz) * CELL_SIZE)).toBeCloseTo(lowerExpected, 5);
    expect(terrain.surfaceY((nodeX + upperTx) * CELL_SIZE, (nodeZ + upperTz) * CELL_SIZE)).toBeCloseTo(upperExpected, 5);
    terrain.dispose();
  });

  it('only reintegrates settled pieces that are near the terrain surface', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 18);
    const surface = terrain.surfaceY(0, 0);

    expect(terrain.reintegratePiece(new THREE.Vector3(0, surface + CELL_SIZE * 0.5, 0), CELL_SIZE * 1.2)).toBe(true);
    expect(terrain.surfaceY(0, 0)).toBeGreaterThanOrEqual(surface);
    expect(terrain.reintegratePiece(new THREE.Vector3(0, surface + CELL_SIZE * 5, 0))).toBe(false);
    terrain.dispose();
  });

  it('merges a settled mesh into destructible terrain volume', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 24);
    const surface = terrain.surfaceY(0, 0);
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(CELL_SIZE * 0.9, 1), material);
    mesh.position.set(0, surface + CELL_SIZE * 0.8, 0);
    mesh.rotation.set(0.4, 0.2, -0.15);
    const before = terrain.voxels.size;

    expect(terrain.addMeshShape(mesh, CELL_SIZE)).toBeGreaterThan(0);
    expect(terrain.voxels.size).toBeGreaterThan(before);

    const afterMerge = terrain.voxels.size;
    const removed = terrain.carveSphere(mesh.position, CELL_SIZE * 1.7);
    expect(removed.length).toBeGreaterThan(0);
    expect(terrain.voxels.size).toBeLessThan(afterMerge);
    terrain.dispose();
  });

  it('can merge a mesh using an explicit voxel budget', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 31);
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(CELL_SIZE * 1.3, 1), material);
    mesh.position.set(6, terrain.surfaceY(6, -6) + CELL_SIZE * 1.2, -6);
    mesh.rotation.set(-0.25, 0.6, 0.3);
    const before = terrain.voxels.size;
    const added = terrain.addMeshShape(mesh, CELL_SIZE * 1.2, 8);

    expect(added).toBe(8);
    expect(terrain.voxels.size - before).toBe(8);
    terrain.dispose();
  });

  it('keeps untouched chunks on the lightweight heightfield mesh', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 6);
    const mesh = terrain.chunks.get('0,0');

    expect(mesh.geometry.index.count / 3).toBe(CHUNK_SIZE_TRIANGLES);
    terrain.dispose();
  });

  it('uses sub-cell SDF geometry around carved edits', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 14);
    const center = new THREE.Vector3(0, terrain.surfaceY(0, 0) - CELL_SIZE * 0.55, 0);
    terrain.carveSphere(center, CELL_SIZE * 2.2);
    const mesh = terrain.chunks.get('0,0');
    const positions = mesh.geometry.attributes.position;
    let hasSubCellVertex = false;

    expect(SDF_CELL_SIZE).toBeLessThan(CELL_SIZE);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const onMaterialGrid = [x, y, z].every((value) => Math.abs(value / CELL_SIZE - Math.round(value / CELL_SIZE)) < 0.001);
      if (!onMaterialGrid) hasSubCellVertex = true;
    }

    expect(terrain.sdfChunks.has('0,0')).toBe(true);
    expect(mesh.geometry.index.count / 3).toBeGreaterThan(CHUNK_SIZE_TRIANGLES);
    expect(mesh.geometry.index.count / 3).toBeLessThan(2500);
    expect(hasSubCellVertex).toBe(true);
    terrain.dispose();
  });

  it('queries smooth SDF collision against carved cavity walls', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 9);
    const radius = CELL_SIZE * 2;
    const center = new THREE.Vector3(0, terrain.surfaceY(0, 0) - CELL_SIZE, 0);
    terrain.carveSphere(center, radius);
    const materialSide = center.clone().add(new THREE.Vector3(radius + 0.1, 0, 0));
    const voidCenterDistance = terrain.sampleSignedDistance(center);
    const collision = terrain.sphereCollision(materialSide, 0.35);

    expect(voidCenterDistance).toBeGreaterThan(0);
    expect(collision).not.toBeNull();
    expect(collision.normal.x).toBeLessThan(-0.7);
    terrain.dispose();
  });
});

const CHUNK_SIZE_TRIANGLES = 10 * 10 * 2;
