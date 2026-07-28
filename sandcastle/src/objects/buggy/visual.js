import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BUGGY_CONFIG as config } from './config.js';

function createMaterials() {
  return {
    body: new THREE.MeshStandardMaterial({ color: '#e24f3d', roughness: .62, metalness: .08, flatShading: true }),
    hood: new THREE.MeshStandardMaterial({ color: '#f5c84c', roughness: .68, metalness: .04, flatShading: true }),
    frame: new THREE.MeshStandardMaterial({ color: '#243235', roughness: .55, metalness: .28, flatShading: true }),
    shock: new THREE.MeshStandardMaterial({ color: '#dfe9df', roughness: .42, metalness: .55, flatShading: true }),
    spring: new THREE.MeshStandardMaterial({ color: '#2d8f82', roughness: .5, metalness: .25, flatShading: true }),
    tire: new THREE.MeshStandardMaterial({ color: '#151918', roughness: .9, flatShading: true }),
    rim: new THREE.MeshStandardMaterial({ color: '#d7d3b7', roughness: .48, metalness: .35, flatShading: true }),
  };
}

function addPart(group, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function setCylinderBetween(mesh, start, end) {
  const midpoint = start.clone().add(end).multiplyScalar(.5);
  const direction = end.clone().sub(start);
  const length = Math.max(.001, direction.length());
  mesh.position.copy(midpoint);
  mesh.scale.set(1, length, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}

function addBar(group, start, end, radius, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 7), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  setCylinderBetween(mesh, new THREE.Vector3(...start), new THREE.Vector3(...end));
  group.add(mesh);
  return mesh;
}

function createPanelGeometry(frontWidth, rearWidth, bottomWidth, height, length) {
  const frontZ = -length * .5;
  const rearZ = length * .5;
  const vertices = new Float32Array([
    -frontWidth * .5, height * .5, frontZ, frontWidth * .5, height * .5, frontZ, frontWidth * .5, -height * .5, frontZ, -frontWidth * .5, -height * .5, frontZ,
    -rearWidth * .5, height * .5, rearZ, rearWidth * .5, height * .5, rearZ, rearWidth * .5, -height * .5, rearZ, -rearWidth * .5, -height * .5, rearZ,
  ]);
  vertices[6] = bottomWidth * .5;
  vertices[9] = -bottomWidth * .5;
  vertices[18] = bottomWidth * .5;
  vertices[21] = -bottomWidth * .5;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex([
    0, 1, 2, 0, 2, 3,
    4, 7, 6, 4, 6, 5,
    0, 4, 5, 0, 5, 1,
    3, 2, 6, 3, 6, 7,
    1, 5, 6, 1, 6, 2,
    0, 3, 7, 0, 7, 4,
  ]);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

function createBuggyGroup(wheels, materials) {
  const group = new THREE.Group();
  addPart(group, createPanelGeometry(1.08, 1.48, 1.34, .32, 2.45), materials.body, [0, .34, .02]);
  addPart(group, createPanelGeometry(.78, 1.08, .94, .2, .92), materials.hood, [0, .6, -.76], [1, 1, 1], [-.08, 0, 0]);
  addPart(group, new THREE.BoxGeometry(1.08, .18, .68), materials.frame, [0, .52, .55]);
  addPart(group, new THREE.BoxGeometry(.72, .32, .52), materials.body, [0, .72, .72]);
  addPart(group, new THREE.BoxGeometry(.58, .16, .42), materials.frame, [0, .94, .8]);
  addPart(group, new THREE.BoxGeometry(.32, .1, .42), materials.hood, [0, .5, -1.16]);

  addBar(group, [-.92, .38, -1.28], [.92, .38, -1.28], .045, materials.frame);
  addBar(group, [-.98, .36, 1.22], [.98, .36, 1.22], .045, materials.frame);
  addBar(group, [-.82, .45, -1.05], [-.76, .54, 1.08], .035, materials.frame);
  addBar(group, [.82, .45, -1.05], [.76, .54, 1.08], .035, materials.frame);
  addBar(group, [-.58, .62, 1.02], [-.58, 1.62, 1.02], .045, materials.frame);
  addBar(group, [.58, .62, 1.02], [.58, 1.62, 1.02], .045, materials.frame);
  addBar(group, [-.58, 1.62, 1.02], [.58, 1.62, 1.02], .045, materials.frame);
  addBar(group, [-.52, .62, -.36], [-.52, 1.38, -.28], .043, materials.frame);
  addBar(group, [.52, .62, -.36], [.52, 1.38, -.28], .043, materials.frame);
  addBar(group, [-.52, 1.38, -.28], [.52, 1.38, -.28], .043, materials.frame);
  addBar(group, [-.58, 1.62, 1.02], [-.52, 1.38, -.28], .043, materials.frame);
  addBar(group, [.58, 1.62, 1.02], [.52, 1.38, -.28], .043, materials.frame);
  addBar(group, [-.58, .62, 1.02], [-.52, .62, -.36], .034, materials.frame);
  addBar(group, [.58, .62, 1.02], [.52, .62, -.36], .034, materials.frame);
  addBar(group, [-.52, 1.38, -.28], [-.58, .62, 1.02], .026, materials.frame);
  addBar(group, [.52, 1.38, -.28], [.58, .62, 1.02], .026, materials.frame);

  const steeringBase = new THREE.Vector3(-.18, .62, -.5);
  const steeringHub = new THREE.Vector3(-.18, .9, .16);
  addBar(group, steeringBase.toArray(), steeringHub.toArray(), .025, materials.frame);
  const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(.13, .014, 5, 16), materials.frame);
  steeringWheel.position.copy(steeringHub);
  steeringWheel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), steeringHub.clone().sub(steeringBase).normalize());
  steeringWheel.castShadow = true;
  group.add(steeringWheel);

  const tireGeometry = new THREE.CylinderGeometry(config.wheelRadius, config.wheelRadius, .34, 18);
  tireGeometry.rotateZ(Math.PI / 2);
  const rimGeometry = new THREE.CylinderGeometry(config.wheelRadius * .48, config.wheelRadius * .48, .38, 12);
  rimGeometry.rotateZ(Math.PI / 2);
  const fenderGeometry = new THREE.BoxGeometry(.12, .48, .58);
  for (const wheel of wheels) {
    const pivot = new THREE.Group();
    const tire = new THREE.Mesh(tireGeometry, materials.tire);
    const rim = new THREE.Mesh(rimGeometry, materials.rim);
    tire.castShadow = tire.receiveShadow = rim.castShadow = rim.receiveShadow = true;
    pivot.add(tire, rim);
    group.add(pivot);
    wheel.pivot = pivot;
    wheel.tire = tire;

    const side = Math.sign(wheel.localVisualAnchor.x);
    const fender = new THREE.Mesh(fenderGeometry, materials.body);
    fender.position.set(wheel.localVisualAnchor.x + side * .08, .18, wheel.localVisualAnchor.z);
    fender.rotation.z = side * -.08;
    fender.castShadow = fender.receiveShadow = true;
    group.add(fender);

    wheel.shock = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1, 8), materials.shock);
    wheel.spring = new THREE.Mesh(new THREE.TorusGeometry(.09, .012, 5, 16), materials.spring);
    wheel.upperArm = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, 1, 6), materials.frame);
    wheel.lowerArm = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, 1, 6), materials.frame);
    wheel.steeringLink = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 1, 6), materials.frame);
    wheel.shock.castShadow = wheel.spring.castShadow = wheel.upperArm.castShadow = wheel.lowerArm.castShadow = wheel.steeringLink.castShadow = true;
    group.add(wheel.shock, wheel.spring, wheel.upperArm, wheel.lowerArm, wheel.steeringLink);
  }
  return group;
}

export function createBuggyVisualComponent(state) {
  const component = {
    get object() {
      return state.group;
    },

    setEnabled(enabled) {
      state.visualEnabled = enabled;
      if (enabled) component.attach();
      else component.detach();
    },

    attach() {
      if (state.group || !state.body || !state.scene) return;
      state.materials ??= createMaterials();
      state.group = createBuggyGroup(state.wheels, state.materials);
      state.scene.add(state.group);
      component.sync(0);
    },

    detach() {
      if (!state.group) return;
      state.scene?.remove(state.group);
      state.group.traverse((child) => { if (child.isMesh) child.geometry.dispose(); });
      state.group = null;
      for (const wheel of state.wheels) {
        wheel.pivot = null;
        wheel.tire = null;
        wheel.shock = null;
        wheel.spring = null;
        wheel.upperArm = null;
        wheel.lowerArm = null;
        wheel.steeringLink = null;
      }
    },

    sync(delta) {
      if (!state.group || !state.body) return;
      const worldCenterOfMass = state.body.vectorToWorldFrame(new CANNON.Vec3(...config.centerOfMass), new CANNON.Vec3());
      state.group.position.set(
        state.body.position.x - worldCenterOfMass.x,
        state.body.position.y - worldCenterOfMass.y,
        state.body.position.z - worldCenterOfMass.z,
      );
      state.group.quaternion.copy(state.body.quaternion);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(state.group.quaternion);
      const speed = new THREE.Vector3(state.body.velocity.x, state.body.velocity.y, state.body.velocity.z).dot(forward);
      for (const wheel of state.wheels) {
        const wheelLocal = wheel.localVisualAnchor.clone();
        wheelLocal.y -= wheel.currentLength;
        wheel.pivot.position.copy(wheelLocal);
        wheel.pivot.rotation.y = wheel.front ? state.steering : 0;
        wheel.spin += speed * delta / Math.max(.01, config.wheelRadius);
        wheel.tire.rotation.x = wheel.spin;

        const chassisMountX = wheel.localVisualAnchor.x * .48;
        const upperMount = new THREE.Vector3(chassisMountX, .54, wheel.localVisualAnchor.z + (wheel.front ? .06 : -.06));
        const lowerMount = new THREE.Vector3(chassisMountX, .24, wheel.localVisualAnchor.z);
        const hubTop = wheelLocal.clone().add(new THREE.Vector3(0, config.wheelRadius * .42, 0));
        const hubCenter = wheelLocal.clone();
        setCylinderBetween(wheel.shock, upperMount, hubTop);
        setCylinderBetween(wheel.upperArm, upperMount.clone().add(new THREE.Vector3(0, -.08, 0)), hubCenter.clone().add(new THREE.Vector3(0, config.wheelRadius * .24, 0)));
        setCylinderBetween(wheel.lowerArm, lowerMount, hubCenter.clone().add(new THREE.Vector3(0, -config.wheelRadius * .18, 0)));
        setCylinderBetween(wheel.steeringLink, lowerMount.clone().add(new THREE.Vector3(0, .14, wheel.front ? -.12 : .12)), hubCenter.clone().add(new THREE.Vector3(0, .08, 0)));

        const springCenter = wheel.localVisualAnchor.clone().lerp(wheelLocal, .55);
        wheel.spring.position.copy(springCenter);
        wheel.spring.scale.set(1, Math.max(.55, wheel.currentLength / config.suspensionRest), 1);
        wheel.spring.rotation.set(Math.PI / 2, 0, wheel.spin * .25);
      }
    },

    dispose() {
      component.detach();
    },
  };
  return component;
}
