import { describe, expect, it, vi } from 'vitest';
import { EngineCore } from '../src/engine-core.js';
import { Entity } from '../src/entity.js';

function makeWorld() {
  return {
    entities: [],
    addEntity(entity) {
      this.entities.push(entity);
    },
    removeEntity(entity) {
      const index = this.entities.indexOf(entity);
      if (index !== -1) this.entities.splice(index, 1);
    },
  };
}

describe('EngineCore lifecycle', () => {
  it('runs script start, update, and destroy hooks', () => {
    const engine = new EngineCore();
    engine.setWorld(makeWorld());
    const script = {
      onStart: vi.fn(),
      update: vi.fn(),
      onDestroy: vi.fn(),
    };
    const entity = new Entity('test').addScript(script);

    engine.addEntity(entity);
    engine.start();
    engine.update(0.016);
    engine.removeEntity(entity);

    expect(script.onStart).toHaveBeenCalledTimes(1);
    expect(script.update).toHaveBeenCalledWith(0.016);
    expect(script.onDestroy).toHaveBeenCalledTimes(1);
  });
});
