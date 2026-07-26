import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const config = {
  wheelRadius: .38,
  suspensionRest: .84,
  suspensionMax: 1.42,
  suspensionMin: .18,
  spring: 190,
  damper: 30,
  engineForce: 138,
  cornerStiffness: 68,
  frontGripBias: 1.12,
  rearGripBias: .92,
  maxSteer: .54,
  handbrakeForce: 168,
  activeRollingDrag: 4.2,
  passiveRollingDrag: 9.5,
  chassisRadius: .72,
};

const wheelSpecs = [
  ['front-left', [-.92, .1, -1.08], true, .55],
  ['front-right', [.92, .1, -1.08], true, .55],
  ['rear-left', [-.94, .1, 1.04], false, 1],
  ['rear-right', [.94, .1, 1.04], false, 1],
];

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

function createWheel(name, localAnchor, front, powered) {
  return {
    name,
    localAnchor: new CANNON.Vec3(localAnchor[0], localAnchor[1], localAnchor[2]),
    localVisualAnchor: new THREE.Vector3(localAnchor[0], localAnchor[1], localAnchor[2]),
    front,
    powered,
    compression: 0,
    currentLength: config.suspensionRest,
    contact: false,
    contactPoint: new THREE.Vector3(),
    spin: 0,
    lastSprayAt: 0,
    pivot: null,
    tire: null,
    shock: null,
    spring: null,
    upperArm: null,
    lowerArm: null,
    steeringLink: null,
  };
}

function createPanelGeometry(frontWidth, rearWidth, bottomWidth, height, length) {
  const frontZ = -length * .5;
  const rearZ = length * .5;
  const vertices = new Float32Array([
    -frontWidth * .5, height * .5, frontZ, frontWidth * .5, height * .5, frontZ, frontWidth * .5, -height * .5, frontZ, -frontWidth * .5, -height * .5, frontZ,
    -rearWidth * .5, height * .5, rearZ, rearWidth * .5, height * .5, rearZ, rearWidth * .5, -height * .5, rearZ, -rearWidth * .5, -height * .5, rearZ,
  ]);
  vertices[6] = bottomWidth * .5; vertices[9] = -bottomWidth * .5;
  vertices[18] = bottomWidth * .5; vertices[21] = -bottomWidth * .5;
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

function createDuneBuggyGroup(wheels, materials) {
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

function velocityAtPoint(body, point) {
  const rx = point.x - body.position.x;
  const ry = point.y - body.position.y;
  const rz = point.z - body.position.z;
  const ax = body.angularVelocity.x;
  const ay = body.angularVelocity.y;
  const az = body.angularVelocity.z;
  return new CANNON.Vec3(
    body.velocity.x + ay * rz - az * ry,
    body.velocity.y + az * rx - ax * rz,
    body.velocity.z + ax * ry - ay * rx,
  );
}

function projectOnPlane(vector, normal) {
  const projected = vector.clone().addScaledVector(normal, -vector.dot(normal));
  if (projected.lengthSq() < 0.0001) return null;
  return projected.normalize();
}

function cannonToThree(vector) {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

export function createDuneBuggy(options) {
  return new DuneBuggy(options);
}

class DuneBuggy {
  constructor({
    scene,
    world,
    terrain,
    camera,
    controls,
    keys,
    createParticleBurst,
    spawnShard,
    triggerScreenShake,
    getSpawnObstacles = () => ({ buildingBlueprints: [], props: [] }),
    onDestroyed = () => {},
  }) {
    this.scene = scene;
    this.world = world;
    this.terrain = terrain;
    this.camera = camera;
    this.controls = controls;
    this.keys = keys;
    this.createParticleBurst = createParticleBurst;
    this.spawnShard = spawnShard;
    this.triggerScreenShake = triggerScreenShake;
    this.getSpawnObstacles = getSpawnObstacles;
    this.onDestroyed = onDestroyed;
    this.materials = createMaterials();
    this.body = null;
    this.group = null;
    this.wheels = [];
    this.destroyed = true;
    this.steering = 0;
    this.throttle = 0;
    this.groundedWheels = 0;
    this.chaseReady = false;
  }

  get alive() {
    return !!this.body && !this.destroyed;
  }

  get position() {
    return this.body?.position ?? null;
  }

  defaultSpawn() {
    const pose = this.terrain.track?.startPose?.();
    if (!pose) return this.findOpenSpawn();
    return this.createSpawnTransform(pose.x, pose.z, pose.heading);
  }

  spawnRoughness(x, z, heading) {
    const transform = this.createSpawnTransform(x, z, heading);
    const surfaces = wheelSpecs.map(([, localAnchor]) => {
      const offset = new THREE.Vector3(...localAnchor).applyQuaternion(transform.quaternion);
      return this.terrain.surfaceY(x + offset.x, z + offset.z);
    });
    return Math.max(...surfaces) - Math.min(...surfaces);
  }

  openSpawnPenalty(x, z) {
    const { buildingBlueprints = [], props = [] } = this.getSpawnObstacles();
    let penalty = 0;
    for (const blueprint of buildingBlueprints) {
      const reach = Math.max(blueprint.width ?? 6, blueprint.depth ?? 6) * .75 + 7;
      const distance = Math.hypot(x - blueprint.x, z - blueprint.z);
      if (distance < reach) penalty += (reach - distance) * 8;
    }
    for (const prop of props) {
      const reach = (prop.actor?.radius ?? prop.blastRadius ?? prop.dynamicRadius ?? 1.5) + 5.5;
      const distance = Math.hypot(x - prop.group.position.x, z - prop.group.position.z);
      if (distance < reach) penalty += (reach - distance) * 10;
    }
    return penalty;
  }

  findOpenSpawn() {
    let best = { score: Infinity, x: -8, z: -12, heading: 0 };
    const headings = [0, Math.PI * .5, Math.PI, Math.PI * 1.5];
    for (let z = -54; z <= 54; z += 9) {
      for (let x = -54; x <= 54; x += 9) {
        const openness = this.openSpawnPenalty(x, z);
        if (openness > 120) continue;
        for (const heading of headings) {
          const roughness = this.spawnRoughness(x, z, heading);
          const centerBias = Math.abs(Math.hypot(x, z) - 42) * .035;
          const score = roughness * 18 + openness + centerBias;
          if (score < best.score) best = { score, x, z, heading };
        }
      }
    }
    return this.createSpawnTransform(best.x, best.z, best.heading);
  }

  createSpawnTransform(x, z, heading) {
    const surfaceY = this.terrain.surfaceY(x, z);
    const normal = this.terrain.estimateNormal(new THREE.Vector3(x, surfaceY, z));
    const yawForward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    const forward = projectOnPlane(yawForward, normal) ?? yawForward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, normal).normalize();
    const matrix = new THREE.Matrix4().makeBasis(right, normal, forward.clone().negate());
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);
    const desiredRest = config.suspensionRest * .86;
    let totalY = 0;
    let minimumY = -Infinity;
    for (const [, localAnchor] of wheelSpecs) {
      const offset = new THREE.Vector3(...localAnchor).applyQuaternion(quaternion);
      const wheelSurfaceY = this.terrain.surfaceY(x + offset.x, z + offset.z);
      totalY += wheelSurfaceY + config.wheelRadius + desiredRest - offset.y;
      minimumY = Math.max(minimumY, wheelSurfaceY + config.wheelRadius + .28 - offset.y);
    }
    const bodyY = Math.max(totalY / wheelSpecs.length, minimumY);
    return { position: new THREE.Vector3(x, bodyY, z), heading, quaternion };
  }

  spawn(position = null, heading = null) {
    this.dispose(false);
    const fallback = position ? { position, heading: heading ?? 0, quaternion: null } : this.defaultSpawn();
    const spawn = fallback.position;
    const wheels = wheelSpecs.map((spec) => createWheel(...spec));
    const group = createDuneBuggyGroup(wheels, this.materials);
    group.position.copy(spawn);
    if (fallback.quaternion) group.quaternion.copy(fallback.quaternion);
    else group.rotation.y = fallback.heading;
    this.scene.add(group);

    const body = new CANNON.Body({
      mass: 7.4,
      shape: new CANNON.Box(new CANNON.Vec3(.82, .48, 1.18)),
      linearDamping: .08,
      angularDamping: .36,
      allowSleep: false,
    });
    body.position.set(spawn.x, spawn.y, spawn.z);
    if (fallback.quaternion) body.quaternion.set(fallback.quaternion.x, fallback.quaternion.y, fallback.quaternion.z, fallback.quaternion.w);
    else body.quaternion.setFromEuler(0, fallback.heading, 0);
    body.angularFactor.set(.82, 1, .82);
    body.userData = { kind: 'car' };
    this.world.addBody(body);

    this.body = body;
    this.group = group;
    this.wheels = wheels;
    this.destroyed = false;
    this.steering = 0;
    this.throttle = 0;
    this.groundedWheels = 0;
    this.chaseReady = false;
    this.updateVisuals(0);
  }

  dispose(markDestroyed = false) {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((child) => { if (child.isMesh) child.geometry.dispose(); });
    }
    if (this.body) this.world.removeBody(this.body);
    this.body = null;
    this.group = null;
    this.wheels = [];
    this.destroyed = markDestroyed;
  }

  worldVector(local) {
    return this.body.vectorToWorldFrame(local, new CANNON.Vec3());
  }

  applyForce(force, point) {
    this.body.applyForce(
      new CANNON.Vec3(force.x, force.y, force.z),
      new CANNON.Vec3(point.x - this.body.position.x, point.y - this.body.position.y, point.z - this.body.position.z),
    );
  }

  findSuspensionContact(anchor, down) {
    const pointAt = (length) => new THREE.Vector3(
      anchor.x + down.x * length,
      anchor.y + down.y * length,
      anchor.z + down.z * length,
    );
    const clearanceAt = (length) => {
      const point = pointAt(length);
      return point.y - this.terrain.surfaceY(point.x, point.z) - config.wheelRadius;
    };

    const minLength = config.suspensionMin;
    if (clearanceAt(config.suspensionMax) > 0) {
      return {
        contact: false,
        length: config.suspensionMax,
        center: pointAt(config.suspensionMax),
        normal: new THREE.Vector3(0, 1, 0),
      };
    }
    if (clearanceAt(minLength) <= 0) {
      const center = pointAt(minLength);
      const normal = this.groundNormalAt(center);
      return { contact: true, length: minLength, center, normal };
    }

    let low = minLength;
    let high = config.suspensionMax;
    for (let i = 0; i < 7; i++) {
      const mid = (low + high) * .5;
      if (clearanceAt(mid) <= 0) high = mid;
      else low = mid;
    }
    const center = pointAt(high);
    const normal = this.groundNormalAt(center);
    return { contact: true, length: high, center, normal };
  }

  groundNormalAt(point) {
    return this.terrain.estimateNormal(new THREE.Vector3(point.x, this.terrain.surfaceY(point.x, point.z), point.z));
  }

  updatePhysics(delta, now, driving) {
    if (!this.alive) return;
    const accelerate = this.keys.has('ArrowUp') || this.keys.has('KeyW');
    const reverse = this.keys.has('ArrowDown') || this.keys.has('KeyS');
    const steerLeft = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const steerRight = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const throttleTarget = driving ? (accelerate ? 1 : reverse ? -.55 : 0) : 0;
    const handbrake = driving && this.keys.has('Space');
    const steerTarget = driving ? (steerLeft ? config.maxSteer : steerRight ? -config.maxSteer : 0) : 0;
    this.throttle = THREE.MathUtils.lerp(this.throttle, throttleTarget, 1 - Math.exp(-delta * 8));
    this.steering = THREE.MathUtils.lerp(this.steering, steerTarget, 1 - Math.exp(-delta * 9));
    this.groundedWheels = 0;

    const bodyForward = cannonToThree(this.worldVector(new CANNON.Vec3(0, 0, -1))).normalize();
    const bodyRight = cannonToThree(this.worldVector(new CANNON.Vec3(1, 0, 0))).normalize();
    const suspensionDown = cannonToThree(this.worldVector(new CANNON.Vec3(0, -1, 0))).normalize();

    for (const wheel of this.wheels) {
      const anchor = this.body.pointToWorldFrame(wheel.localAnchor, new CANNON.Vec3());
      const contact = this.findSuspensionContact(anchor, suspensionDown);
      wheel.currentLength = THREE.MathUtils.clamp(contact.length, config.suspensionMin, config.suspensionMax);
      wheel.compression = THREE.MathUtils.clamp(config.suspensionRest - contact.length, 0, config.suspensionRest);
      wheel.contact = contact.contact;
      if (!wheel.contact) continue;

      this.groundedWheels++;
      const normal = contact.normal;
      const contactPoint = contact.center.clone().addScaledVector(normal, -config.wheelRadius);
      wheel.contactPoint.copy(contactPoint);
      const contactCannon = new CANNON.Vec3(contactPoint.x, contactPoint.y, contactPoint.z);
      const velocity = velocityAtPoint(this.body, contactCannon);
      const normalSpeed = velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
      const springForce = Math.max(0, wheel.compression * config.spring - normalSpeed * config.damper);
      this.applyForce(normal.clone().multiplyScalar(springForce), contactPoint);

      const steer = wheel.front ? -this.steering : 0;
      const steerSin = Math.sin(steer);
      const steerCos = Math.cos(steer);
      const rawWheelForward = new THREE.Vector3(
        bodyForward.x * steerCos + bodyRight.x * steerSin,
        bodyForward.y * steerCos + bodyRight.y * steerSin,
        bodyForward.z * steerCos + bodyRight.z * steerSin,
      );
      const rawWheelRight = new THREE.Vector3(
        bodyRight.x * steerCos - bodyForward.x * steerSin,
        bodyRight.y * steerCos - bodyForward.y * steerSin,
        bodyRight.z * steerCos - bodyForward.z * steerSin,
      );
      const wheelForward = projectOnPlane(rawWheelForward, normal) ?? new THREE.Vector3(0, 0, -1);
      const wheelRight = new THREE.Vector3().crossVectors(wheelForward, normal).normalize();
      if (wheelRight.dot(rawWheelRight) < 0) wheelRight.multiplyScalar(-1);

      const longSpeed = velocity.x * wheelForward.x + velocity.y * wheelForward.y + velocity.z * wheelForward.z;
      const sideSpeed = velocity.x * wheelRight.x + velocity.y * wheelRight.y + velocity.z * wheelRight.z;
      const rearWheel = wheel.powered > .8;
      const axleGrip = wheel.front ? config.frontGripBias : config.rearGripBias;
      const grip = THREE.MathUtils.clamp(.58 + normal.y * .54 - Math.abs(sideSpeed) * .018, .36, 1.08) * axleGrip * (handbrake && rearWheel ? .34 : 1);
      const tractionLimit = springForce * grip;
      const speedFade = THREE.MathUtils.clamp(1 - Math.abs(longSpeed) / 42, .28, 1);
      const driveForce = handbrake && rearWheel ? 0 : this.throttle * config.engineForce * wheel.powered * speedFade;
      const rollingDrag = -longSpeed * (handbrake && rearWheel ? config.handbrakeForce : driving ? config.activeRollingDrag : config.passiveRollingDrag);
      const forwardForce = THREE.MathUtils.clamp(driveForce + rollingDrag, -tractionLimit, tractionLimit);
      const sideForce = THREE.MathUtils.clamp(-sideSpeed * config.cornerStiffness, -tractionLimit, tractionLimit);
      this.applyForce(wheelForward.clone().multiplyScalar(forwardForce), contact.center);
      this.applyForce(wheelRight.clone().multiplyScalar(sideForce), contactPoint);

      const enginePowering = Math.abs(this.throttle) > .12 && wheel.powered > .8;
      if (enginePowering && now - wheel.lastSprayAt > 48) {
        const sprayDirection = wheelForward.clone().multiplyScalar(this.throttle > 0 ? -1 : 1).add(normal.clone().multiplyScalar(.28)).normalize();
        this.spawnWheelSand(contactPoint, sprayDirection, THREE.MathUtils.clamp(Math.abs(this.throttle) + Math.abs(longSpeed) * .035, .35, 1.25));
        wheel.lastSprayAt = now;
      }
    }

    if (handbrake && this.groundedWheels >= 2 && this.body.velocity.lengthSquared() < .18 && this.body.angularVelocity.lengthSquared() < .18) {
      this.body.velocity.set(0, 0, 0);
      this.body.angularVelocity.set(0, 0, 0);
    }
  }

  applyChassisTerrainContact() {
    if (!this.alive) return;
    const surfaceY = this.terrain.surfaceY(this.body.position.x, this.body.position.z);
    const clearance = this.body.position.y - surfaceY;
    if (clearance >= config.chassisRadius) return;
    const normal = this.groundNormalAt(this.body.position);
    const penetration = config.chassisRadius - clearance;
    this.body.position.x += normal.x * penetration * .75;
    this.body.position.y += normal.y * penetration * .75;
    this.body.position.z += normal.z * penetration * .75;
    const normalSpeed = this.body.velocity.x * normal.x + this.body.velocity.y * normal.y + this.body.velocity.z * normal.z;
    if (normalSpeed < 0) {
      this.body.velocity.x -= normal.x * normalSpeed * 1.08;
      this.body.velocity.y -= normal.y * normalSpeed * 1.08;
      this.body.velocity.z -= normal.z * normalSpeed * 1.08;
    }
  }

  afterPhysicsStep(delta) {
    this.applyChassisTerrainContact();
    this.updateVisuals(delta);
  }

  updateVisuals(delta) {
    if (!this.group || !this.body) return;
    this.group.position.copy(this.body.position);
    this.group.quaternion.copy(this.body.quaternion);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
    const speed = new THREE.Vector3(this.body.velocity.x, this.body.velocity.y, this.body.velocity.z).dot(forward);
    for (const wheel of this.wheels) {
      const wheelLocal = wheel.localVisualAnchor.clone();
      wheelLocal.y -= wheel.currentLength;
      wheel.pivot.position.copy(wheelLocal);
      wheel.pivot.rotation.y = wheel.front ? this.steering : 0;
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
  }

  spawnWheelSand(center, direction, strength) {
    this.createParticleBurst(center, {
      count: Math.round(8 + strength * 9),
      color: '#d2b36f',
      size: .28 + strength * .12,
      lifetime: .58,
      speed: [2.8 + strength * 2.2, 6.5 + strength * 4.8],
      gravity: 10,
      drag: .955,
      opacity: .68,
      spread: .24,
      upLift: .18,
      sizeGrowth: .55,
      fadePower: 1.35,
      renderOrder: 4,
      directionBias: direction,
      biasStrength: .78,
    });
  }

  updateChaseCamera(delta, snap = false, enabled = true) {
    if (!enabled || !this.alive) return;
    const position = new THREE.Vector3().copy(this.body.position);
    const quaternion = new THREE.Quaternion().copy(this.body.quaternion);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).lerp(new THREE.Vector3(0, 1, 0), .65).normalize();
    const target = position.clone().add(up.clone().multiplyScalar(1.05)).add(forward.clone().multiplyScalar(2.4));
    const desired = position.clone().add(forward.clone().multiplyScalar(-8.7)).add(up.clone().multiplyScalar(3.65));
    desired.y = Math.max(desired.y, this.terrain.surfaceY(desired.x, desired.z) + 1.5);
    const blend = snap || !this.chaseReady ? 1 : 1 - Math.exp(-delta * 6);
    this.camera.position.lerp(desired, blend);
    this.controls.target.lerp(target, blend);
    this.camera.lookAt(this.controls.target);
    this.chaseReady = true;
  }

  damageFromExplosion(center, radius) {
    if (!this.alive) return;
    const position = new THREE.Vector3().copy(this.body.position);
    if (position.distanceTo(center) > radius + 2.1) return;
    const shardSources = [];
    this.group.traverse((child) => { if (child.isMesh) shardSources.push(child); });
    for (let i = 0; i < Math.min(18, shardSources.length); i++) {
      const source = shardSources[i % shardSources.length];
      const shardPosition = new THREE.Vector3();
      source.getWorldPosition(shardPosition);
      shardPosition.add(new THREE.Vector3((Math.random() - .5) * .7, Math.random() * .55, (Math.random() - .5) * .7));
      this.spawnShard(shardPosition, center, Array.isArray(source.material) ? source.material[0] : source.material, .9);
    }
    this.dispose(true);
    this.triggerScreenShake(.38, .32);
    this.onDestroyed();
  }
}
