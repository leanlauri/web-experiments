import { describe, expect, it } from 'vitest';
import { World } from '../src/world.js';

function makeEngine() {
  return {
    scene: { add() {} },
    camera: { position: { x: 0, z: 0 } },
    addPostUpdate() {},
    addEntity(entity) {
      this.world.addEntity(entity);
    },
    removeEntity(entity) {
      this.world.removeEntity(entity);
    },
  };
}

describe('World terrain generation', () => {
  it('returns deterministic heights for the same seed', () => {
    const engineA = makeEngine();
    const engineB = makeEngine();
    const worldA = new World(engineA, { seed: 123 });
    const worldB = new World(engineB, { seed: 123 });
    engineA.world = worldA;
    engineB.world = worldB;

    expect(worldA.getHeight(42.5, -17.25)).toBeCloseTo(worldB.getHeight(42.5, -17.25), 8);
    expect(worldA.getBiomeLabelAt(91, 133)).toBe(worldB.getBiomeLabelAt(91, 133));
  });

  it('selects a square of high and low terrain chunks around focus', () => {
    const engine = makeEngine();
    const world = new World(engine);
    engine.world = world;

    const desired = world.getDesiredChunkLods(0, 0);
    expect(desired.size).toBe(49);
    expect(desired.get('0,0')).toBe('high');
    expect(desired.get('2,2')).toBe('high');
    expect(desired.get('3,0')).toBe('low');
    expect(desired.has('4,0')).toBe(false);
  });
});
