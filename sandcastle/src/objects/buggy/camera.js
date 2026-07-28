import * as THREE from 'three';

export function createBuggyCameraComponent(state) {
  return {
    update(delta, snap = false, enabled = true) {
      if (!enabled || !state.body || state.destroyed || !state.camera || !state.controls) return;
      const position = new THREE.Vector3().copy(state.body.position);
      const quaternion = new THREE.Quaternion().copy(state.body.quaternion);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion).normalize();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).lerp(new THREE.Vector3(0, 1, 0), .65).normalize();
      const target = position.clone().add(up.clone().multiplyScalar(1.05)).add(forward.clone().multiplyScalar(2.4));
      const desired = position.clone().add(forward.clone().multiplyScalar(-8.7)).add(up.clone().multiplyScalar(3.65));
      desired.y = Math.max(desired.y, state.terrain.surfaceY(desired.x, desired.z) + 1.5);
      const blend = snap || !state.chaseReady ? 1 : 1 - Math.exp(-delta * 6);
      state.camera.position.lerp(desired, blend);
      state.controls.target.lerp(target, blend);
      state.camera.lookAt(state.controls.target);
      state.chaseReady = true;
    },
  };
}
