import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { BirdController } from '../src/scripts/BirdController.js';
import { FlightComponent } from '../src/entity.js';

describe('BirdController', () => {
  function createFlightHarness() {
    const controller = new BirdController({
      input: null,
      world: {
        getHeight: () => -1000,
        noise: { signedFbm: () => 0 },
      },
    });
    const mesh = new THREE.Group();
    mesh.rotation.set(0, Math.PI, 0);
    mesh.position.set(0, 34, 18);
    const flight = new FlightComponent({
      velocity: new THREE.Vector3(),
      speed: 14,
    });

    return { controller, mesh, flight };
  }

  test('single-wing flapping can roll the bird upside down', () => {
    const { controller, mesh, flight } = createFlightHarness();

    let lowestUpDot = 1;

    for (let frame = 0; frame < 240; frame += 1) {
      controller.updateFlying(1 / 60, mesh, flight, {
        leftWingFlap: false,
        rightWingFlap: true,
        headInput: 0,
      });

      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion);
      lowestUpDot = Math.min(lowestUpDot, localUp.y);
    }

    expect(lowestUpDot).toBeLessThan(0);
  });

  test('flapping while upside down pushes downward', () => {
    const upright = createFlightHarness();
    upright.controller.updateFlying(1 / 60, upright.mesh, upright.flight, {
      leftWingFlap: true,
      rightWingFlap: true,
      headInput: 0,
    });

    const inverted = createFlightHarness();
    inverted.mesh.rotation.set(0, Math.PI, Math.PI);
    inverted.controller.updateFlying(1 / 60, inverted.mesh, inverted.flight, {
      leftWingFlap: true,
      rightWingFlap: true,
      headInput: 0,
    });

    expect(inverted.flight.velocity.y).toBeLessThan(upright.flight.velocity.y);
    expect(inverted.flight.velocity.y).toBeLessThan(0);
  });
});
