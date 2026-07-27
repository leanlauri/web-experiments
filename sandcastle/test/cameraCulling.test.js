import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CameraCuller } from '../src/cameraCulling.js';

function createCamera() {
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 1_000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  return camera;
}

describe('CameraCuller', () => {
  it('culls objects behind the camera and outside the distance budget', () => {
    const culler = new CameraCuller({ maxDistance: 30 });
    culler.update(createCamera());

    expect(culler.isPointVisible(new THREE.Vector3(0, 0, -10), 1)).toBe(true);
    expect(culler.isPointVisible(new THREE.Vector3(0, 0, 10), 1)).toBe(false);
    expect(culler.isPointVisible(new THREE.Vector3(0, 0, -50), 1)).toBe(false);
  });

  it('keeps original shadow intent while disabling distant shadow casting', () => {
    const culler = new CameraCuller({ shadowDistance: 20 });
    culler.update(createCamera());
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.castShadow = true;
    group.add(mesh);

    group.position.z = -10;
    culler.updateShadowCasting(group);
    expect(mesh.castShadow).toBe(true);

    group.position.z = -30;
    culler.updateShadowCasting(group);
    expect(mesh.castShadow).toBe(false);

    group.position.z = -10;
    culler.updateShadowCasting(group);
    expect(mesh.castShadow).toBe(true);
  });
});
