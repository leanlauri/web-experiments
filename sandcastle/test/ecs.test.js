import { describe, expect, it, vi } from 'vitest';
import { COMPONENTS, ECSWorld, Entity } from '../src/ecs/index.js';

describe('ECS world', () => {
  it('stores object responsibilities as independently queryable components', () => {
    const ecs = new ECSWorld();
    const buggy = ecs.add(new Entity('buggy')
      .add(COMPONENTS.physics, { body: { mass: 7.4 } })
      .add(COMPONENTS.visual, { object: { name: 'buggy-mesh' } }));
    ecs.add(new Entity('headless-projectile')
      .add(COMPONENTS.physics, { body: { mass: 1 } }));

    expect(ecs.query(COMPONENTS.physics)).toHaveLength(2);
    expect(ecs.query(COMPONENTS.physics, COMPONENTS.visual)).toEqual([buggy]);
  });

  it('disposes components when an entity leaves the world', () => {
    const dispose = vi.fn();
    const ecs = new ECSWorld();
    const entity = ecs.create('temporary').add(COMPONENTS.physics, { dispose });

    ecs.remove(entity);

    expect(dispose).toHaveBeenCalledOnce();
    expect(ecs.entities.size).toBe(0);
  });
});
