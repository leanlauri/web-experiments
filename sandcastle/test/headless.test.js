import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { COMPONENTS } from '../src/ecs/components.js';
import { createHeadlessSimulation } from '../src/headless.js';

describe('headless simulation', () => {
  it('runs buggy physics without creating a visual component', () => {
    const simulation = createHeadlessSimulation();
    const physics = simulation.buggy.require(COMPONENTS.physics);
    physics.spawn(new THREE.Vector3(0, 2.4, 0), 0);
    const startY = physics.body.position.y;

    for (let frame = 0; frame < 10; frame++) simulation.step(1 / 60, frame * 16.67);

    expect(simulation.buggy.has(COMPONENTS.physics)).toBe(true);
    expect(simulation.buggy.has(COMPONENTS.visual)).toBe(false);
    expect(physics.body.position.y).toBeLessThan(startY);
    simulation.dispose();
  });
});
