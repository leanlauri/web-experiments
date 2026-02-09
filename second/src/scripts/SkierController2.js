import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MeshComponent, PhysicsComponent } from '../entity.js';

export class SkierController2 {
  constructor(world, {
    steerTorque = 18.0,
    autoDownhillTorque = 1.5,
    yawDamping = 2.0,
    forwardForce = 10.0,
    linearDrag = 0.4,
    lateralDrag = 6.0,
    turnDrag = 8.0,
    speedSteerDrop = 0.15,
    boostSpeed = 3.0,
    jumpSpeed = 3.0,
    groundProbe = 0.20,
    smoothNormals = false,
  } = {}) {
    this.world = world;
    this.steerTorque = steerTorque;
    this.autoDownhillTorque = autoDownhillTorque;
    this.yawDamping = yawDamping;
    this.forwardForce = forwardForce;
    this.linearDrag = linearDrag;
    this.lateralDrag = lateralDrag;
    this.turnDrag = turnDrag;
    this.speedSteerDrop = speedSteerDrop;
    this.boostSpeed = boostSpeed;
    this.jumpSpeed = jumpSpeed;
    this.groundProbe = groundProbe;
    this.smoothNormals = smoothNormals;

    this.keys = new Set();
    this.boostRequested = false;
    this.onKeyDown = (e) => this.keys.add(e.code);
    this.onKeyUp = (e) => this.keys.delete(e.code);
  }

  onStart() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  onDestroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  update(dt) {
    const body = this.entity.getComponent(PhysicsComponent.type).body;
    const mesh = this.entity.getComponent(MeshComponent.type).mesh;

    // a) Check ground contact
    const footOffset = body.userData?.footOffset ?? 0.95;
    const probeRadius = 0.2;
    const probeCount = 6;
    const normals = [];
    const hitPoints = [];

    for (let i = 0; i < probeCount; i++) {
      const angle = (i / probeCount) * Math.PI * 2;
      const ox = Math.cos(angle) * probeRadius;
      const oz = Math.sin(angle) * probeRadius;
      const from = new CANNON.Vec3(body.position.x + ox, body.position.y + footOffset, body.position.z + oz);
      const to = new CANNON.Vec3(body.position.x + ox, body.position.y - (footOffset + this.groundProbe), body.position.z + oz);
      const result = new CANNON.RaycastResult();
      const hasHit = this.world.physicsWorld.raycastClosest(from, to, {
        collisionFilterGroup: 2,
        collisionFilterMask: 1,
        skipBackfaces: true,
      }, result);
      if (hasHit && result.hasHit) {
        normals.push(new THREE.Vector3(result.hitNormalWorld.x, result.hitNormalWorld.y, result.hitNormalWorld.z).normalize());
        hitPoints.push(new THREE.Vector3(result.hitPointWorld.x, result.hitPointWorld.y, result.hitPointWorld.z));
      }
    }

    let grounded = normals.length > 0;
    let normal = new THREE.Vector3(0, 1, 0);
    let hitPoint = null;
    if (grounded) {
      const avg = normals.reduce((acc, n) => acc.add(n), new THREE.Vector3()).normalize();
      const filtered = normals.filter((n) => n.dot(avg) > 0.7);
      const use = filtered.length > 0 ? filtered : normals;
      normal = use.reduce((acc, n) => acc.add(n), new THREE.Vector3()).normalize();
      hitPoint = hitPoints[0];
    }
    if (grounded && this.smoothNormals) {
      if (!this.smoothedNormal) {
        this.smoothedNormal = normal.clone();
      } else {
        const t = THREE.MathUtils.clamp(10.0 * dt, 0, 1);
        this.smoothedNormal.lerp(normal, t).normalize();
      }
      normal = this.smoothedNormal.clone();
    }

    // b) Gather inputs
    const touchSteer = this.world?.input?.steer ?? 0;
    const keySteer =
      (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0)
      + (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? -1 : 0);
    const steer = Math.max(-1, Math.min(1, keySteer + touchSteer));

    const wantsJump = this.keys.has('Space') || this.world?.input?.jump;
    if (this.world?.input?.boost) {
      this.boostRequested = true;
      this.world.input.boost = false;
    }
    const wantsBoost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.boostRequested;

    // c) Compute vectors on surface
    const currentQuat = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentQuat).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(currentQuat).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(currentQuat).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const alignNormal = grounded ? normal : worldUp;

    let forwardOnPlane = forward.clone().sub(alignNormal.clone().multiplyScalar(forward.dot(alignNormal)));
    if (forwardOnPlane.lengthSq() > 1e-6) forwardOnPlane.normalize();
    if (this.smoothedForwardOnPlane) {
      if (forwardOnPlane.dot(this.smoothedForwardOnPlane) < 0) {
        forwardOnPlane.multiplyScalar(-1);
      }
      const t = THREE.MathUtils.clamp(8.0 * dt, 0, 1);
      this.smoothedForwardOnPlane.lerp(forwardOnPlane, t).normalize();
      forwardOnPlane = this.smoothedForwardOnPlane.clone();
    } else {
      this.smoothedForwardOnPlane = forwardOnPlane.clone();
    }

    const v = new THREE.Vector3(body.velocity.x, body.velocity.y, body.velocity.z);
    const vPlane = v.clone().sub(alignNormal.clone().multiplyScalar(v.dot(alignNormal)));
    const surfaceSpeed = vPlane.length();
    const lateralVec = forwardOnPlane.lengthSq() > 1e-6
      ? vPlane.clone().sub(forwardOnPlane.clone().multiplyScalar(vPlane.dot(forwardOnPlane)))
      : new THREE.Vector3();

    if (!this.world.debug) this.world.debug = {};

    const debugForce = new THREE.Vector3();
    const debugTorque = new THREE.Vector3();

    // Debug: expose ground normal + forward velocity direction for physics debug view
    if (this.world.debug) {
      const arrowPos = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
      // this.world.debug.groundNormal = { position: arrowPos, direction: normal.clone().normalize() };
      this.world.debug.groundNormal = { position: arrowPos, direction: alignNormal.clone().normalize() };

      const speed = v.length();
      const debugForwardScale = 0.25;
      const debugForwardMax = 6.0;
      const forwardLen = THREE.MathUtils.clamp(speed * debugForwardScale, 0, debugForwardMax);
      this.world.debug.forwardVelocity = {
        position: arrowPos,
        direction: forward.clone().normalize().multiplyScalar(forwardLen),
      };
      this.world.debug.yawAngularVelocity = body.angularVelocity.y;
    }

    // d) Steering torque (air + ground)
    if (steer !== 0) {
      const steerScale = 1 / (1 + surfaceSpeed * this.speedSteerDrop);
      // const axis = new CANNON.Vec3(alignNormal.x, alignNormal.y, alignNormal.z);
      const axis = new CANNON.Vec3(0, 1, 0);
      const torque = axis.scale(this.steerTorque * steer * steerScale * body.mass);
      body.applyTorque(torque);
      debugTorque.add(new THREE.Vector3(torque.x, torque.y, torque.z));
    } else if (grounded && surfaceSpeed > 0.2) {
      const downhill = new THREE.Vector3(0, -1, 0).projectOnPlane(alignNormal).normalize();
      if (downhill.lengthSq() > 1e-6 && forwardOnPlane.lengthSq() > 1e-6) {
        const crossY = new THREE.Vector3().crossVectors(forwardOnPlane, downhill).y;
        const align = THREE.MathUtils.clamp(forwardOnPlane.dot(downhill), -1, 1);
        const angle = Math.acos(align);
        const minAngle = THREE.MathUtils.degToRad(5);
        const maxAngle = THREE.MathUtils.degToRad(80);
        if (angle >= minAngle && angle <= maxAngle) {
          const maxTurn = THREE.MathUtils.degToRad(10) * dt;
          const turn = Math.sign(crossY) * Math.min(angle, maxTurn);
          const torque = new CANNON.Vec3(0, 1, 0).scale(this.autoDownhillTorque * turn * body.mass);
          // body.applyTorque(torque);
        }
      }
    }

    // e) Dampen yaw rotation for stability
    {
      const yaw = body.angularVelocity.y;
      if (Math.abs(yaw) > 1e-6) {
        const yawDamp = -body.angularVelocity.y * this.yawDamping * body.mass;
        body.applyTorque(new CANNON.Vec3(0, yawDamp, 0));
        debugTorque.add(new THREE.Vector3(0, yawDamp, 0));
      }
    }

    if (grounded) {
      // f) Forward drive (french fries)
      if (forwardOnPlane.lengthSq() > 1e-6) {
        const drive = forwardOnPlane.clone().multiplyScalar(this.forwardForce * body.mass);
        // body.applyForce(new CANNON.Vec3(drive.x, drive.y, drive.z), body.position);
        if (this.world.debug) {
          this.world.debug.frenchFriesForce = {
            position: new THREE.Vector3(body.position.x, body.position.y, body.position.z),
            direction: drive.clone(),
          };
        }
      }

      // g) Drag / resistance
      const drag = vPlane.clone().multiplyScalar(-this.linearDrag * body.mass);
      // body.applyForce(new CANNON.Vec3(drag.x, drag.y, drag.z), body.position);

      const lateralDrag = lateralVec.clone().multiplyScalar(-this.lateralDrag * body.mass);
      // body.applyForce(new CANNON.Vec3(lateralDrag.x, lateralDrag.y, lateralDrag.z), body.position);

      if (Math.abs(steer) > 0.5) {
        const turnDrag = vPlane.clone().multiplyScalar(-this.turnDrag * body.mass * Math.abs(steer));
        // body.applyForce(new CANNON.Vec3(turnDrag.x, turnDrag.y, turnDrag.z), body.position);
      }

      // h) Jump: set normal speed to jumpSpeed
      if (wantsJump) {
        const vNormal = Math.max(0, v.dot(alignNormal));
        const dv = Math.max(0, this.jumpSpeed - vNormal);
        if (dv > 0) {
          const impulse = alignNormal.clone().multiplyScalar(dv * body.mass);
          body.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z), body.position);
          if (dt > 1e-6) debugForce.add(impulse.clone().multiplyScalar(1 / dt));
        }
      }

      // i) Boost: set surface speed to boostSpeed
      if (wantsBoost) {
        this.boostRequested = false;
        if (forwardOnPlane.lengthSq() > 1e-6) {
          const along = Math.max(0, vPlane.dot(forwardOnPlane));
          const dv = Math.max(0, this.boostSpeed - along);
          if (dv > 0) {
            const impulse = forwardOnPlane.clone().multiplyScalar(dv * body.mass);
            body.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z), body.position);
            if (dt > 1e-6) debugForce.add(impulse.clone().multiplyScalar(1 / dt));
          }
        }
      }
    }

    if (this.world.debug) {
      const basePos = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
      const rightOffset = right.clone().multiplyScalar(0.6);
      const forcePos = basePos.clone().add(rightOffset).add(up.clone().multiplyScalar(0.2));
      const torquePos = basePos.clone().add(rightOffset).add(up.clone().multiplyScalar(-0.2));

      const forceMag = debugForce.length();
      const torqueMag = debugTorque.length();
      const forceScale = 0.05;
      const torqueScale = 0.1;
      const maxLen = 6.0;

      const forceLen = THREE.MathUtils.clamp(forceMag * forceScale, 0, maxLen);
      const torqueLen = THREE.MathUtils.clamp(torqueMag * torqueScale, 0, maxLen);
      // const torqueDir = forward.clone().multiplyScalar(5);// new THREE.Vector3(0, 0, -1);
      // const torqueLen = 5;

      const forceDir = forceMag > 1e-6
        ? debugForce.clone().multiplyScalar(forceLen / forceMag)
        : new THREE.Vector3();
      const torqueDir = torqueMag > 1e-6
        ? debugTorque.clone().multiplyScalar(torqueLen / torqueMag)
        : new THREE.Vector3();


      this.world.debug.sumForce = { position: forcePos, direction: forceDir, magnitude: forceMag };
      this.world.debug.sumTorque = { position: torquePos, direction: torqueDir, magnitude: torqueMag };
    }
    this.wantsJump = false;
    this.wantsBoost = false;

    // j) Visual sync (no direct rotation changes)
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  }
}
