import * as THREE from 'three';
import { FlightComponent, MeshComponent } from '../entity.js';
import { clamp } from '../procedural.js';

export class BirdController {
  constructor({ input, world }) {
    this.input = input;
    this.world = world;
    this.flapPhase = 0;
    this.leftWing = null;
    this.rightWing = null;
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

    const bankInput = input.bank ?? 0;
    const pitchInput = input.pitch ?? 0;
    const flapBoost = input.flap ? 1 : 0;
    const dive = input.dive ? 1 : 0;

    flight.speed += (dive * 18 - pitchInput * 8 + flapBoost * 11 - 2.4) * dt;
    flight.speed = clamp(flight.speed, flight.minSpeed, flight.maxSpeed);

    mesh.rotateZ(-bankInput * flight.turnRate * dt);
    mesh.rotateX(pitchInput * 0.9 * dt);
    mesh.rotateY(-bankInput * 0.95 * dt);

    const euler = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
    euler.x = clamp(euler.x, -0.62, 0.48);
    euler.z = clamp(euler.z, -0.88, 0.88);
    mesh.quaternion.setFromEuler(euler);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(mesh.quaternion).normalize();
    const groundY = this.world.getHeight(mesh.position.x, mesh.position.z);
    const altitude = mesh.position.y - groundY;
    const thermal = this.world.noise.signedFbm(mesh.position.x * 0.006, mesh.position.z * 0.006, 3) * 1.4;
    const lowLift = clamp((24 - altitude) / 24, 0, 1) * 4.6;
    const gravity = 5.4 + clamp((flight.speed - 38) / 22, 0, 1) * 1.5;

    flight.velocity.copy(forward).multiplyScalar(flight.speed);
    flight.velocity.y += pitchInput * flight.lift + flapBoost * 13 + thermal + lowLift - gravity;
    mesh.position.addScaledVector(flight.velocity, dt);

    const minY = groundY + 5.5;
    if (mesh.position.y < minY) {
      mesh.position.y = minY;
      flight.speed = Math.max(flight.speed, 20);
    }
    mesh.position.y = Math.min(mesh.position.y, 155);

    const levelAmount = clamp(dt * (input.flap ? 0.9 : 0.36), 0, 1);
    const current = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
    current.z *= 1 - levelAmount;
    mesh.quaternion.setFromEuler(current);

    this.flapPhase += dt * (input.flap ? 18 : 7 + flight.speed * 0.12);
    const flap = Math.sin(this.flapPhase) * (input.flap ? 0.68 : 0.24);
    if (this.leftWing) this.leftWing.rotation.z = 0.15 + flap;
    if (this.rightWing) this.rightWing.rotation.z = -0.15 - flap;

    this.world.lastBiome = this.world.getBiomeLabelAt(mesh.position.x, mesh.position.z);
  }
}
