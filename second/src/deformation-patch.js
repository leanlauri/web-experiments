import * as THREE from 'three';

export class DeformationPatch {
  constructor({
    size = 8,
    resolution = 32,
    maxDepth = 0.18,
    resetDistance = 3,
    offsetY = -0.05,
    scene = null,
  } = {}) {
    this.size = size;
    this.resolution = resolution;
    this.maxDepth = maxDepth;
    this.resetDistance = resetDistance;
    this.offsetY = offsetY;

    this.geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
    this.geometry.rotateX(-Math.PI / 2);

    const positions = this.geometry.attributes.position;
    this.basePositions = new Float32Array(positions.array);

    this.material = new THREE.MeshStandardMaterial({
      color: 0xff3333,
      roughness: 0.8,
      metalness: 0,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.position.y = offsetY;

    if (scene) scene.add(this.mesh);

    this.center = new THREE.Vector2(0, 0);
  }

  updateCenter(x, z, groundY = 0) {
    if (this.center == null) {
      this.center = new THREE.Vector2(x, z);
      this.mesh.position.set(x, groundY + this.offsetY, z);
      return;
    }

    const dx = x - this.center.x;
    const dz = z - this.center.y;
    const dist = Math.hypot(dx, dz);
    if (dist > this.resetDistance) this.clear();

    this.center.set(x, z);
    this.mesh.position.set(x, groundY + this.offsetY, z);
  }

  clear() {
    const positions = this.geometry.attributes.position;
    positions.array.set(this.basePositions);
    positions.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  stamp(worldX, worldZ, strength = 1) {
    const localX = worldX - this.center.x;
    const localZ = worldZ - this.center.y;
    const half = this.size / 2;
    if (Math.abs(localX) > half || Math.abs(localZ) > half) return;

    const positions = this.geometry.attributes.position;
    const count = positions.count;
    const radius = 0.6;

    for (let i = 0; i < count; i++) {
      const vx = positions.getX(i);
      const vz = positions.getZ(i);
      const dx = vx - localX;
      const dz = vz - localZ;
      const dist = Math.hypot(dx, dz);
      if (dist > radius) continue;
      const falloff = 1 - dist / radius;
      const depth = this.maxDepth * falloff * strength;
      const current = positions.getY(i);
      positions.setY(i, Math.max(current - depth, -this.maxDepth));
    }

    positions.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}
