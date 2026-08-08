import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PhysicsDebugView } from '../src/physics-debug.js';

describe('PhysicsDebugView', () => {
  it('tracks live collider transforms, dimensions, and removal', () => {
    const scene = new THREE.Scene();
    const world = new CANNON.World();
    const body = new CANNON.Body({ mass: 1 });
    const shape = new CANNON.Box(new CANNON.Vec3(1, 2, 3));
    body.addShape(shape, new CANNON.Vec3(0.5, 0, 0));
    body.position.set(4, 5, 6);
    world.addBody(body);

    const debugView = new PhysicsDebugView(scene, world, () => '#ffffff');
    expect(debugView.root.visible).toBe(false);

    debugView.setEnabled(true);
    let [mesh] = debugView.meshes.get(body);
    expect(mesh.position.toArray()).toEqual([4.5, 5, 6]);
    expect(mesh.geometry.parameters.width).toBe(2);
    expect(mesh.geometry.parameters.height).toBe(4);
    expect(mesh.geometry.parameters.depth).toBe(6);

    shape.halfExtents.x = 1.5;
    debugView.update();
    [mesh] = debugView.meshes.get(body);
    expect(mesh.geometry.parameters.width).toBe(3);

    world.removeBody(body);
    debugView.update();
    expect(debugView.meshes.has(body)).toBe(false);
    expect(debugView.root.children).toHaveLength(0);
  });
});
