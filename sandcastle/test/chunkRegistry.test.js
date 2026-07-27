import { describe, expect, it } from 'vitest';
import { ChunkRegistry } from '../src/chunkRegistry.js';

function createWorld() {
  return {
    bodies: [],
    addBody(body) { if (!this.bodies.includes(body)) this.bodies.push(body); },
    removeBody(body) { this.bodies = this.bodies.filter((candidate) => candidate !== body); },
  };
}

describe('ChunkRegistry', () => {
  it('removes inactive chunk bodies and restores them when the anchor returns', () => {
    const world = createWorld();
    const body = { position: { x: 75, z: 0 } };
    const visual = { visible: true };
    world.addBody(body);
    const registry = new ChunkRegistry({ world, chunkSize: 15, activeRadius: 2, releaseRadius: 3 });
    const entry = registry.register({ body, visual });

    registry.update({ x: 0, z: 0 });
    expect(entry.active).toBe(false);
    expect(visual.visible).toBe(false);
    expect(world.bodies).toEqual([]);

    registry.update({ x: 75, z: 0 });
    expect(entry.active).toBe(true);
    expect(visual.visible).toBe(true);
    expect(world.bodies).toEqual([body]);
  });

  it('uses a wider release radius to avoid boundary thrashing', () => {
    const world = createWorld();
    const body = { position: { x: 45, z: 0 } };
    world.addBody(body);
    const registry = new ChunkRegistry({ world, chunkSize: 15, activeRadius: 2, releaseRadius: 3 });
    const entry = registry.register({ body });

    registry.update({ x: 0, z: 0 });
    expect(entry.active).toBe(true);
    registry.update({ x: -15, z: 0 });
    expect(entry.active).toBe(false);
  });

  it('keeps always-active objects in the physics world', () => {
    const world = createWorld();
    const body = { position: { x: 600, z: 600 } };
    world.addBody(body);
    const registry = new ChunkRegistry({ world, chunkSize: 15 });
    const entry = registry.register({ body, alwaysActive: true });

    registry.update({ x: 0, z: 0 });
    expect(entry.active).toBe(true);
    expect(world.bodies).toEqual([body]);
  });
});
