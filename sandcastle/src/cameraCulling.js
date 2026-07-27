import * as THREE from 'three';

export class CameraCuller {
  constructor({ maxDistance = 260, shadowDistance = 72 } = {}) {
    this.maxDistance = maxDistance;
    this.shadowDistance = shadowDistance;
    this.frustum = new THREE.Frustum();
    this.projectionMatrix = new THREE.Matrix4();
    this.cameraPosition = new THREE.Vector3();
    this.objectCenter = new THREE.Vector3();
  }

  update(camera) {
    camera.updateMatrixWorld();
    this.projectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projectionMatrix);
    this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
  }

  isPointVisible(position, radius = 0, maxDistance = this.maxDistance) {
    if (!this.isPointWithinDistance(position, radius, maxDistance)) return false;
    return this.frustum.intersectsSphere(new THREE.Sphere(position, radius));
  }

  isPointWithinDistance(position, radius = 0, maxDistance = this.maxDistance) {
    return this.cameraPosition.distanceTo(position) - radius <= maxDistance;
  }

  isObjectVisible(object, maxDistance = this.maxDistance) {
    object.updateWorldMatrix(true, false);
    if (!this.frustum.intersectsObject(object)) return false;
    const radius = this.objectCenterAndRadius(object);
    return this.cameraPosition.distanceTo(this.objectCenter) - radius <= maxDistance;
  }

  isObjectWithinDistance(object, maxDistance) {
    const radius = this.objectCenterAndRadius(object);
    return this.cameraPosition.distanceTo(this.objectCenter) - radius <= maxDistance;
  }

  objectCenterAndRadius(object) {
    object.updateWorldMatrix(true, false);
    const sphere = object.geometry?.boundingSphere;
    if (!sphere) {
      object.getWorldPosition(this.objectCenter);
      return 0;
    }
    this.objectCenter.copy(sphere.center).applyMatrix4(object.matrixWorld);
    return sphere.radius * object.matrixWorld.getMaxScaleOnAxis();
  }

  updateObject(object, radius = 0) {
    object.updateWorldMatrix(true, false);
    object.getWorldPosition(this.objectCenter);
    // Three.js has accurate geometry bounds for per-mesh frustum culling.
    // Groups do not, so custom group frustum tests can hide visible children.
    object.visible = this.isPointWithinDistance(this.objectCenter, radius);
    return object.visible;
  }

  updateShadowCasting(root, position = null) {
    const shadowPosition = position ?? root.getWorldPosition(this.objectCenter);
    const shouldCastShadow = this.cameraPosition.distanceTo(shadowPosition) <= this.shadowDistance;
    root.traverse((child) => {
      if (!child.isMesh) return;
      child.userData.baseCastShadow ??= child.castShadow;
      child.castShadow = child.userData.baseCastShadow && shouldCastShadow;
    });
  }
}
