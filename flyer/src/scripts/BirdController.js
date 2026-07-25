import * as THREE from 'three';
import { FlightComponent, MeshComponent } from '../entity.js';
import { clamp } from '../procedural.js';

export class BirdController {
  constructor({ input, world }) {
    this.input = input;
    this.world = world;
    this.flapPhase = 0;
    this.passiveFlapPhase = 0;
    this.manualHeadPitch = 0;
    this.leftWing = null;
    this.rightWing = null;
    this.state = 'flying';
    this.launchTimer = 0;
    this.crashVelocity = new THREE.Vector3();
    this.crashAngularVelocity = new THREE.Vector3();
  }

  onStart() {
    const mesh = this.entity.getComponent(MeshComponent.type).mesh;
    this.leftWing = mesh.getObjectByName('leftWing');
    this.rightWing = mesh.getObjectByName('rightWing');
  }

  update(dt) {
    const mesh = this.entity.getComponent(MeshComponent.type).mesh;
    const flight = this.entity.getComponent(FlightComponent.type);
    const input = this.input ?? {};

    if (this.state === 'crashed') {
      this.updateCrash(dt, mesh, flight);
    } else if (this.state === 'landed') {
      this.updateLanded(dt, mesh, flight, input);
    } else {
      this.updateFlying(dt, mesh, flight, input);
    }

    this.world.flightState = this.state;
    this.world.lastBiome = this.world.getBiomeLabelAt(mesh.position.x, mesh.position.z);
  }

  reset() {
    const mesh = this.entity.getComponent(MeshComponent.type).mesh;
    const flight = this.entity.getComponent(FlightComponent.type);
    this.state = 'flying';
    this.launchTimer = 0;
    this.manualHeadPitch = 0;
    this.flapPhase = 0;
    this.passiveFlapPhase = 0;
    this.crashVelocity.set(0, 0, 0);
    this.crashAngularVelocity.set(0, 0, 0);
    mesh.position.set(0, 34, 18);
    mesh.rotation.set(0, Math.PI, 0);
    flight.speed = 14;
    flight.velocity.set(0, 0, -13);
    this.setWingPose(0.14, -0.14);
    this.world.flightState = this.state;
  }

  updateFlying(dt, mesh, flight, input) {
    const leftFlap = input.leftWingFlap ? 1 : 0;
    const rightFlap = input.rightWingFlap ? 1 : 0;
    const totalFlap = leftFlap + rightFlap;
    const imbalance = rightFlap - leftFlap;

    this.manualHeadPitch = clamp(this.manualHeadPitch + (input.headInput ?? 0) * dt * 1.25, -0.62, 0.48);
    const headDown = clamp(-this.manualHeadPitch / 0.62, 0, 1);
    const headUp = clamp(this.manualHeadPitch / 0.48, 0, 1);
    const stall = clamp((flight.stallSpeed - flight.speed) / Math.max(0.001, flight.stallSpeed), 0, 1);
    const flapSpeedBoost = totalFlap * 2.4;

    flight.speed += (headDown * 5.2 - headUp * 4.8 + flapSpeedBoost - 1.65 - stall * 2.1) * dt;
    flight.speed = clamp(flight.speed, flight.minSpeed, flight.maxSpeed);

    const current = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
    current.x = THREE.MathUtils.lerp(current.x, this.manualHeadPitch + stall * 0.32, clamp(dt * 4, 0, 1));
    current.z += imbalance * 1.35 * dt;
    current.z *= 1 - clamp(dt * (totalFlap ? 0.18 : 2.8), 0, 1);
    mesh.quaternion.setFromEuler(current);

    const bankedTwoWingTurn = totalFlap === 2 ? current.z * 0.58 : 0;
    mesh.rotateY((imbalance * 0.42 + bankedTwoWingTurn) * dt);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(mesh.quaternion).normalize();
    const wingForceDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion).normalize();
    const groundY = this.world.getHeight(mesh.position.x, mesh.position.z);
    const altitude = mesh.position.y - groundY;
    const thermal = this.world.noise.signedFbm(mesh.position.x * 0.006, mesh.position.z * 0.006, 3) * 0.75;
    const lowLift = clamp((18 - altitude) / 18, 0, 1) * 2.4;
    const glideLift = clamp(flight.speed / Math.max(0.001, flight.maxSpeed), 0, 1) * (2.8 - headUp * 1.6);
    const wingLift = totalFlap * 4.2 + Math.abs(imbalance) * 1.3;
    const gravity = 3.6 + stall * 5.8 + headUp * 1.5;

    flight.velocity.copy(forward).multiplyScalar(flight.speed);
    flight.velocity.addScaledVector(wingForceDirection, wingLift);
    flight.velocity.y += glideLift + thermal + lowLift - gravity;
    const impactVelocityY = flight.velocity.y;
    mesh.position.addScaledVector(flight.velocity, dt);

    const groundContactY = groundY + 0.42;
    if (mesh.position.y < groundContactY) {
      const uprightEnough = Math.abs(current.z) < 0.5 && current.x > -0.38 && current.x < 0.78;
      const slowEnough = impactVelocityY > -4.2 && flight.speed < 8.5;
      if (uprightEnough && slowEnough) {
        this.land(mesh, flight, groundContactY, current.y);
      } else {
        this.crash(mesh, flight, groundContactY, current, impactVelocityY);
      }
      return;
    }
    mesh.position.y = Math.min(mesh.position.y, 155);

    this.updateWingAnimation(dt, leftFlap, rightFlap);
  }

  updateLanded(dt, mesh, flight, input) {
    const groundY = this.world.getHeight(mesh.position.x, mesh.position.z);
    mesh.position.y = groundY + 0.42;
    flight.speed = 0;
    flight.velocity.set(0, 0, 0);

    const bothWings = input.leftWingFlap && input.rightWingFlap;
    if (bothWings) {
      this.launchTimer += dt;
      this.flapPhase += dt * 18;
      const flap = Math.sin(this.flapPhase) * 0.62;
      this.setWingPose(0.16 + flap, -0.16 - flap);
      if (this.launchTimer >= 0.85) {
        this.launch(mesh, flight);
      }
      return;
    }

    this.launchTimer = 0;
    this.setWingPose(
      THREE.MathUtils.lerp(this.leftWing?.rotation.z ?? 0.14, 0.14, clamp(dt * 5, 0, 1)),
      THREE.MathUtils.lerp(this.rightWing?.rotation.z ?? -0.14, -0.14, clamp(dt * 5, 0, 1)),
    );
  }

  updateCrash(dt, mesh, flight) {
    this.crashVelocity.y -= 12 * dt;
    mesh.position.addScaledVector(this.crashVelocity, dt);
    mesh.rotateX(this.crashAngularVelocity.x * dt);
    mesh.rotateY(this.crashAngularVelocity.y * dt);
    mesh.rotateZ(this.crashAngularVelocity.z * dt);

    const groundY = this.world.getHeight(mesh.position.x, mesh.position.z) + 0.35;
    if (mesh.position.y < groundY) {
      mesh.position.y = groundY;
      if (Math.abs(this.crashVelocity.y) > 1.2) {
        this.crashVelocity.y = Math.abs(this.crashVelocity.y) * 0.22;
      } else {
        this.crashVelocity.y = 0;
      }
      this.crashVelocity.x *= 0.72;
      this.crashVelocity.z *= 0.72;
      this.crashAngularVelocity.multiplyScalar(0.78);
    }

    this.crashVelocity.multiplyScalar(1 - clamp(dt * 1.5, 0, 0.18));
    this.crashAngularVelocity.multiplyScalar(1 - clamp(dt * 0.9, 0, 0.12));
    flight.speed = 0;
    flight.velocity.copy(this.crashVelocity);
    this.setWingPose(0.22, -0.22);
  }

  land(mesh, flight, groundContactY, yaw) {
    this.state = 'landed';
    this.launchTimer = 0;
    this.manualHeadPitch = 0;
    mesh.position.y = groundContactY;
    mesh.rotation.set(0, yaw, 0);
    flight.speed = 0;
    flight.velocity.set(0, 0, 0);
    this.setWingPose(0.14, -0.14);
  }

  launch(mesh, flight) {
    this.state = 'flying';
    this.launchTimer = 0;
    this.manualHeadPitch = -0.28;
    mesh.position.y += 0.55;
    mesh.rotateX(-0.25);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(mesh.quaternion).normalize();
    flight.speed = 12;
    flight.velocity.copy(forward).multiplyScalar(flight.speed);
    flight.velocity.y = 9;
  }

  crash(mesh, flight, groundContactY, current, impactVelocityY) {
    this.state = 'crashed';
    mesh.position.y = groundContactY;
    this.crashVelocity.copy(flight.velocity);
    this.crashVelocity.y = Math.max(1.8, Math.abs(impactVelocityY) * 0.26);
    this.crashVelocity.multiplyScalar(0.45);
    this.crashAngularVelocity.set(
      2.5 + Math.abs(current.x) * 3.4,
      (Math.random() - 0.5) * 3.2,
      3.2 + Math.abs(current.z) * 4.4,
    );
    flight.speed = 0;
    flight.velocity.copy(this.crashVelocity);
  }

  updateWingAnimation(dt, leftFlap, rightFlap) {
    const totalFlap = leftFlap + rightFlap;
    this.flapPhase += dt * (totalFlap ? 18 : 2.2);
    this.passiveFlapPhase += dt * 18 * 0.2;

    const active = Math.sin(this.flapPhase) * 0.72;
    const passive = Math.sin(this.passiveFlapPhase) * 0.32;
    const leftVisual = leftFlap ? active + 0.18 : (rightFlap ? passive : -0.02);
    const rightVisual = rightFlap ? active - 0.18 : (leftFlap ? passive : 0.02);
    this.setWingPose(0.14 + leftVisual, -0.14 - rightVisual);
  }

  setWingPose(leftZ, rightZ) {
    if (this.leftWing) this.leftWing.rotation.z = leftZ;
    if (this.rightWing) this.rightWing.rotation.z = rightZ;
  }
}
