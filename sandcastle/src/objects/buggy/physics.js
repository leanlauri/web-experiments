import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BUGGY_CONFIG as config, WHEEL_SPECS } from './config.js';
import { cannonToThree, projectOnPlane, velocityAtPoint } from './math.js';

function createWheel(name, localAnchor, front, powered) {
  return {
    name,
    localAnchor: new CANNON.Vec3(
      localAnchor[0] - config.centerOfMass[0],
      localAnchor[1] - config.centerOfMass[1],
      localAnchor[2] - config.centerOfMass[2],
    ),
    localVisualAnchor: new THREE.Vector3(...localAnchor),
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

export function createBuggyPhysicsComponent(state) {
  const alive = () => !!state.body && !state.destroyed;
  const worldVector = (local) => state.body.vectorToWorldFrame(local, new CANNON.Vec3());
  const bodyLocalFromVisual = (position) => new CANNON.Vec3(
    position[0] - config.centerOfMass[0],
    position[1] - config.centerOfMass[1],
    position[2] - config.centerOfMass[2],
  );
  const applyForce = (force, point) => {
    state.body.applyForce(
      new CANNON.Vec3(force.x, force.y, force.z),
      new CANNON.Vec3(point.x - state.body.position.x, point.y - state.body.position.y, point.z - state.body.position.z),
    );
  };
  const groundNormalAt = (point) => state.terrain.estimateNormal(
    new THREE.Vector3(point.x, state.terrain.surfaceY(point.x, point.z), point.z),
  );

  function createSpawnTransform(x, z, heading) {
    const surfaceY = state.terrain.surfaceY(x, z);
    const normal = state.terrain.estimateNormal(new THREE.Vector3(x, surfaceY, z));
    const yawForward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    const forward = projectOnPlane(yawForward, normal) ?? yawForward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, normal).normalize();
    const matrix = new THREE.Matrix4().makeBasis(right, normal, forward.clone().negate());
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);
    const desiredRest = config.suspensionRest * .86;
    let totalY = 0;
    let minimumY = -Infinity;
    for (const [, localAnchor] of WHEEL_SPECS) {
      const offset = new THREE.Vector3(...localAnchor).applyQuaternion(quaternion);
      const wheelSurfaceY = state.terrain.surfaceY(x + offset.x, z + offset.z);
      totalY += wheelSurfaceY + config.wheelRadius + desiredRest - offset.y;
      minimumY = Math.max(minimumY, wheelSurfaceY + config.wheelRadius + .28 - offset.y);
    }
    const bodyY = Math.max(totalY / WHEEL_SPECS.length, minimumY);
    return { position: new THREE.Vector3(x, bodyY, z), heading, quaternion };
  }

  function spawnRoughness(x, z, heading) {
    const transform = createSpawnTransform(x, z, heading);
    const surfaces = WHEEL_SPECS.map(([, localAnchor]) => {
      const offset = new THREE.Vector3(...localAnchor).applyQuaternion(transform.quaternion);
      return state.terrain.surfaceY(x + offset.x, z + offset.z);
    });
    return Math.max(...surfaces) - Math.min(...surfaces);
  }

  function openSpawnPenalty(x, z) {
    const { buildingBlueprints = [], props = [] } = state.getSpawnObstacles();
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

  function findOpenSpawn() {
    let best = { score: Infinity, x: -8, z: -12, heading: 0 };
    const headings = [0, Math.PI * .5, Math.PI, Math.PI * 1.5];
    for (let z = -54; z <= 54; z += 9) {
      for (let x = -54; x <= 54; x += 9) {
        const openness = openSpawnPenalty(x, z);
        if (openness > 120) continue;
        for (const heading of headings) {
          const roughness = spawnRoughness(x, z, heading);
          const centerBias = Math.abs(Math.hypot(x, z) - 42) * .035;
          const score = roughness * 18 + openness + centerBias;
          if (score < best.score) best = { score, x, z, heading };
        }
      }
    }
    return createSpawnTransform(best.x, best.z, best.heading);
  }

  function defaultSpawn() {
    const pose = state.terrain.track?.startPose?.();
    if (!pose) return findOpenSpawn();
    return createSpawnTransform(pose.x, pose.z, pose.heading);
  }

  function findSuspensionContact(anchor, down) {
    const pointAt = (length) => new THREE.Vector3(
      anchor.x + down.x * length,
      anchor.y + down.y * length,
      anchor.z + down.z * length,
    );
    const clearanceAt = (length) => {
      const point = pointAt(length);
      return point.y - state.terrain.surfaceY(point.x, point.z) - config.wheelRadius;
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
      return { contact: true, length: minLength, center, normal: groundNormalAt(center) };
    }

    let low = minLength;
    let high = config.suspensionMax;
    for (let index = 0; index < 7; index++) {
      const mid = (low + high) * .5;
      if (clearanceAt(mid) <= 0) high = mid;
      else low = mid;
    }
    const center = pointAt(high);
    return { contact: true, length: high, center, normal: groundNormalAt(center) };
  }

  function getRoofTerrainContact() {
    const center = cannonToThree(state.body.pointToWorldFrame(
      bodyLocalFromVisual(config.rollCageOffset),
      new CANNON.Vec3(),
    ));
    const distance = state.terrain.sampleSignedDistance(center);
    if (distance > config.rollCageRadius + .035) return null;
    return { center, normal: state.terrain.estimateNormal(center) };
  }

  function hopFromRoof(contact) {
    const tireDirection = cannonToThree(worldVector(new CANNON.Vec3(0, -1, 0))).normalize();
    const hopDirection = tireDirection.addScaledVector(contact.normal, .65).normalize();
    const impulse = hopDirection.multiplyScalar(state.body.mass * config.roofHopSpeed);
    state.body.applyImpulse(
      new CANNON.Vec3(impulse.x, impulse.y, impulse.z),
      new CANNON.Vec3(contact.center.x - state.body.position.x, contact.center.y - state.body.position.y, contact.center.z - state.body.position.z),
    );

    const bodyUp = cannonToThree(worldVector(new CANNON.Vec3(0, 1, 0))).normalize();
    const rightingAxis = new THREE.Vector3().crossVectors(bodyUp, contact.normal);
    if (rightingAxis.lengthSq() < .002 && bodyUp.dot(contact.normal) < 0) {
      rightingAxis.copy(cannonToThree(worldVector(new CANNON.Vec3(0, 0, -1))));
    }
    if (rightingAxis.lengthSq() > .0001) {
      rightingAxis.normalize().multiplyScalar(2.4);
      state.body.angularVelocity.x += rightingAxis.x;
      state.body.angularVelocity.y += rightingAxis.y;
      state.body.angularVelocity.z += rightingAxis.z;
    }
  }

  function spawnWheelSand(center, direction, strength) {
    state.createParticleBurst(center, {
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

  const component = {
    get body() {
      return state.body;
    },

    get position() {
      return state.body?.position ?? null;
    },

    get alive() {
      return alive();
    },

    get wheels() {
      return state.wheels;
    },

    spawn(position = null, heading = null) {
      component.dispose(false);
      const fallback = position ? { position, heading: heading ?? 0, quaternion: null } : defaultSpawn();
      const spawn = fallback.position;
      state.wheels = WHEEL_SPECS.map((spec) => createWheel(...spec));

      const body = new CANNON.Body({
        mass: 7.4,
        linearDamping: .08,
        angularDamping: .36,
        allowSleep: false,
      });
      const centerOfMass = new CANNON.Vec3(...config.centerOfMass);
      body.addShape(
        new CANNON.Box(new CANNON.Vec3(.82, .48, 1.18)),
        centerOfMass.scale(-1, new CANNON.Vec3()),
      );
      body.addShape(
        new CANNON.Sphere(config.rollCageRadius),
        new CANNON.Vec3(
          config.rollCageOffset[0] - config.centerOfMass[0],
          config.rollCageOffset[1] - config.centerOfMass[1],
          config.rollCageOffset[2] - config.centerOfMass[2],
        ),
      );
      if (fallback.quaternion) {
        body.quaternion.set(fallback.quaternion.x, fallback.quaternion.y, fallback.quaternion.z, fallback.quaternion.w);
      } else {
        body.quaternion.setFromEuler(0, fallback.heading, 0);
      }
      const worldCenterOfMass = body.vectorToWorldFrame(centerOfMass, new CANNON.Vec3());
      body.position.set(spawn.x + worldCenterOfMass.x, spawn.y + worldCenterOfMass.y, spawn.z + worldCenterOfMass.z);
      body.angularFactor.set(.82, 1, .82);
      body.userData = { kind: 'car' };
      state.world.addBody(body);

      state.body = body;
      state.destroyed = false;
      state.steering = 0;
      state.throttle = 0;
      state.groundedWheels = 0;
      state.chaseReady = false;
      state.lastRoofHopAt = -Infinity;
      if (state.visualEnabled) state.visual?.attach();
    },

    dispose(markDestroyed = false) {
      state.visual?.detach();
      if (state.body) state.world.removeBody(state.body);
      state.body = null;
      state.wheels = [];
      state.destroyed = markDestroyed;
    },

    update(delta, now, driving) {
      if (!alive()) return;
      const accelerate = state.keys.has('ArrowUp') || state.keys.has('KeyW');
      const reverse = state.keys.has('ArrowDown') || state.keys.has('KeyS');
      const steerLeft = state.keys.has('ArrowLeft') || state.keys.has('KeyA');
      const steerRight = state.keys.has('ArrowRight') || state.keys.has('KeyD');
      const throttleTarget = driving ? (accelerate ? 1 : reverse ? -.55 : 0) : 0;
      const applyingThrottle = accelerate || reverse;
      const handbrake = driving && state.keys.has('Space');
      const steerTarget = driving ? (steerLeft ? config.maxSteer : steerRight ? -config.maxSteer : 0) : 0;
      state.throttle = THREE.MathUtils.lerp(state.throttle, throttleTarget, 1 - Math.exp(-delta * 8));
      state.steering = THREE.MathUtils.lerp(state.steering, steerTarget, 1 - Math.exp(-delta * 9));
      state.groundedWheels = 0;
      const roofContact = getRoofTerrainContact();
      const roofHop = handbrake && roofContact && now - state.lastRoofHopAt >= config.roofHopCooldown;
      if (roofHop) {
        hopFromRoof(roofContact);
        state.lastRoofHopAt = now;
      }

      const bodyForward = cannonToThree(worldVector(new CANNON.Vec3(0, 0, -1))).normalize();
      const bodyRight = cannonToThree(worldVector(new CANNON.Vec3(1, 0, 0))).normalize();
      const suspensionDown = cannonToThree(worldVector(new CANNON.Vec3(0, -1, 0))).normalize();

      for (const wheel of state.wheels) {
        const anchor = state.body.pointToWorldFrame(wheel.localAnchor, new CANNON.Vec3());
        const contact = findSuspensionContact(anchor, suspensionDown);
        const suspensionLength = THREE.MathUtils.clamp(contact.length, config.suspensionMin, config.suspensionMax);
        const travelSpeed = suspensionLength > wheel.currentLength ? config.reboundSpeed : config.compressionSpeed;
        wheel.currentLength = THREE.MathUtils.damp(wheel.currentLength, suspensionLength, travelSpeed, delta);
        wheel.compression = THREE.MathUtils.clamp(config.suspensionRest - suspensionLength, 0, config.suspensionRest);
        wheel.contact = contact.contact;
        if (!wheel.contact) continue;

        state.groundedWheels++;
        const normal = contact.normal;
        const contactPoint = contact.center.clone().addScaledVector(normal, -config.wheelRadius);
        wheel.contactPoint.copy(contactPoint);
        const contactCannon = new CANNON.Vec3(contactPoint.x, contactPoint.y, contactPoint.z);
        const velocity = velocityAtPoint(state.body, contactCannon);
        const normalSpeed = velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
        const springForce = Math.max(0, wheel.compression * config.spring - normalSpeed * config.damper);
        applyForce(normal.clone().multiplyScalar(springForce), contactPoint);

        const steer = wheel.front ? -state.steering : 0;
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
        const rearWheel = !wheel.front;
        const axleGrip = wheel.front ? config.frontGripBias : config.rearGripBias;
        const grip = THREE.MathUtils.clamp(.58 + normal.y * .54 - Math.abs(sideSpeed) * .018, .36, 1.08) * axleGrip * (handbrake && rearWheel ? .34 : 1);
        const tractionLimit = springForce * grip;
        const speedFade = THREE.MathUtils.clamp(1 - Math.abs(longSpeed) / config.topSpeed, .28, 1);
        const driveForce = handbrake && rearWheel ? 0 : state.throttle * config.engineForce * wheel.powered * speedFade;
        const rollingDrag = -longSpeed * (
          handbrake && rearWheel
            ? config.handbrakeForce
            : driving
              ? applyingThrottle ? config.activeRollingDrag : config.coastRollingDrag
              : config.passiveRollingDrag
        );
        const forwardForce = THREE.MathUtils.clamp(driveForce + rollingDrag, -tractionLimit, tractionLimit);
        const sideForce = THREE.MathUtils.clamp(-sideSpeed * config.cornerStiffness, -tractionLimit, tractionLimit);
        applyForce(wheelForward.clone().multiplyScalar(forwardForce), contact.center);
        applyForce(wheelRight.clone().multiplyScalar(sideForce), contactPoint);

        const enginePowering = Math.abs(state.throttle) > .12 && wheel.powered > 0;
        if (enginePowering && now - wheel.lastSprayAt > 48) {
          const sprayDirection = wheelForward.clone().multiplyScalar(state.throttle > 0 ? -1 : 1).add(normal.clone().multiplyScalar(.28)).normalize();
          spawnWheelSand(contactPoint, sprayDirection, THREE.MathUtils.clamp(Math.abs(state.throttle) + Math.abs(longSpeed) * .035, .35, 1.25));
          wheel.lastSprayAt = now;
        }
      }

      if (!roofHop && handbrake && state.groundedWheels >= 2 && state.body.velocity.lengthSquared() < .18 && state.body.angularVelocity.lengthSquared() < .18) {
        state.body.velocity.set(0, 0, 0);
        state.body.angularVelocity.set(0, 0, 0);
      }
    },

    afterStep() {
      if (!alive()) return;
      const colliders = [
        { localCenter: bodyLocalFromVisual([0, 0, 0]), radius: config.chassisRadius, roof: false },
        { localCenter: bodyLocalFromVisual(config.rollCageOffset), radius: config.rollCageRadius, roof: true },
      ];
      for (const collider of colliders) {
        const center = cannonToThree(state.body.pointToWorldFrame(collider.localCenter, new CANNON.Vec3()));
        const collision = state.terrain.sphereCollision(center, collider.radius);
        if (!collision) continue;

        const { normal, penetration } = collision;
        state.body.position.x += normal.x * penetration * .75;
        state.body.position.y += normal.y * penetration * .75;
        state.body.position.z += normal.z * penetration * .75;
        const contactPoint = center.clone().addScaledVector(normal, -collider.radius);
        const velocity = velocityAtPoint(state.body, new CANNON.Vec3(contactPoint.x, contactPoint.y, contactPoint.z));
        const normalSpeed = velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
        if (normalSpeed < 0) {
          const impulse = normal.clone().multiplyScalar(-normalSpeed * state.body.mass * (collider.roof ? .82 : 1.05));
          state.body.applyImpulse(
            new CANNON.Vec3(impulse.x, impulse.y, impulse.z),
            new CANNON.Vec3(contactPoint.x - state.body.position.x, contactPoint.y - state.body.position.y, contactPoint.z - state.body.position.z),
          );
        }
      }
    },
  };

  return component;
}
