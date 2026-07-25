import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CELL_SIZE, VoxelTerrain, terrainHeight } from '../src/terrain.js';

describe('procedural terrain', () => {
  it('is deterministic for a seed', () => expect(terrainHeight(12, -5, 42)).toBe(terrainHeight(12, -5, 42)));
  it('changes across the field', () => expect(terrainHeight(0, 0, 5)).not.toBe(terrainHeight(30, 30, 5)));

  it('carves local terrain volume and rebuilds affected chunks', () => {
    const scene = { add() {}, remove() {} };
    const material = new THREE.MeshBasicMaterial();
    const terrain = new VoxelTerrain(scene, material, 12);
    const before = terrain.voxels.size;
    const removed = terrain.carveSphere(new THREE.Vector3(0, terrain.surfaceY(0, 0) - CELL_SIZE, 0), CELL_SIZE * 2.2);

    expect(removed.length).toBeGreaterThan(0);
    expect(terrain.voxels.size).toBeLessThan(before);
    expect(terrain.chunks.size).toBe(36);
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
});
