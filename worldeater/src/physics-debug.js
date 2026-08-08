import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const DEFAULT_PLANE_SIZE = { width: 300, height: 280 };

function geometrySignature(shape) {
  if (shape instanceof CANNON.Box) {
    const { x, y, z } = shape.halfExtents;
    return `box:${x}:${y}:${z}`;
  }
  if (shape instanceof CANNON.Sphere) return `sphere:${shape.radius}`;
  if (shape instanceof CANNON.Cylinder) {
    return `cylinder:${shape.radiusTop}:${shape.radiusBottom}:${shape.height}:${shape.numSegments}`;
  }
  if (shape instanceof CANNON.Plane) return 'plane';
  return `unsupported:${shape.type}`;
}

function geometryFor(shape) {
  if (shape instanceof CANNON.Box) {
    return new THREE.BoxGeometry(
      shape.halfExtents.x * 2,
      shape.halfExtents.y * 2,
      shape.halfExtents.z * 2,
    );
  }
  if (shape instanceof CANNON.Sphere) {
    return new THREE.SphereGeometry(shape.radius, 16, 12);
  }
  if (shape instanceof CANNON.Cylinder) {
    return new THREE.CylinderGeometry(
      shape.radiusTop,
      shape.radiusBottom,
      shape.height,
      shape.numSegments,
    );
  }
  if (shape instanceof CANNON.Plane) {
    return new THREE.PlaneGeometry(
      DEFAULT_PLANE_SIZE.width,
      DEFAULT_PLANE_SIZE.height,
      24,
      22,
    );
  }
  return null;
}

export class PhysicsDebugView {
  constructor(scene, world, colorForBody) {
    this.world = world;
    this.colorForBody = colorForBody;
    this.enabled = false;
    this.meshes = new Map();
    this.materials = new Map();
    this.bodyQuaternion = new THREE.Quaternion();
    this.shapeQuaternion = new THREE.Quaternion();
    this.root = new THREE.Group();
    this.root.name = 'physics-collider-debug-view';
    this.root.visible = false;
    scene.add(this.root);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.root.visible = enabled;
    if (enabled) this.update();
  }

  materialFor(body) {
    const color = this.colorForBody(body);
    if (!this.materials.has(color)) {
      this.materials.set(color, new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.82,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }));
    }
    return this.materials.get(color);
  }

  rebuildBody(body) {
    const oldMeshes = this.meshes.get(body) ?? [];
    for (const mesh of oldMeshes) {
      if (!mesh) continue;
      this.root.remove(mesh);
      mesh.geometry.dispose();
    }

    const meshes = body.shapes.map((shape) => {
      const geometry = geometryFor(shape);
      if (!geometry) return null;
      const mesh = new THREE.Mesh(geometry, this.materialFor(body));
      mesh.userData.colliderSignature = geometrySignature(shape);
      mesh.renderOrder = 1000;
      this.root.add(mesh);
      return mesh;
    });
    this.meshes.set(body, meshes);
    return meshes;
  }

  update() {
    if (!this.enabled) return;

    const activeBodies = new Set(this.world.bodies);
    for (const [body, meshes] of this.meshes) {
      if (activeBodies.has(body)) continue;
      for (const mesh of meshes) {
        if (!mesh) continue;
        this.root.remove(mesh);
        mesh.geometry.dispose();
      }
      this.meshes.delete(body);
    }

    for (const body of this.world.bodies) {
      let meshes = this.meshes.get(body);
      const needsRebuild = !meshes
        || meshes.length !== body.shapes.length
        || body.shapes.some((shape, index) => meshes[index]?.userData.colliderSignature !== geometrySignature(shape));
      if (needsRebuild) meshes = this.rebuildBody(body);

      const bodyQuaternion = this.bodyQuaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
      );
      body.shapes.forEach((_, index) => {
        const mesh = meshes[index];
        if (!mesh) return;
        const offset = body.shapeOffsets[index];
        const orientation = body.shapeOrientations[index];
        mesh.position.set(offset.x, offset.y, offset.z)
          .applyQuaternion(bodyQuaternion);
        mesh.position.x += body.position.x;
        mesh.position.y += body.position.y;
        mesh.position.z += body.position.z;
        this.shapeQuaternion.set(
          orientation.x,
          orientation.y,
          orientation.z,
          orientation.w,
        );
        mesh.quaternion.copy(bodyQuaternion).multiply(this.shapeQuaternion);
        mesh.material = this.materialFor(body);
      });
    }
  }
}
