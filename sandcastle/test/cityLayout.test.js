import { describe, expect, it } from 'vitest';
import { createCityPlan } from '../src/city/layout.js';

describe('city layout', () => {
  it('is deterministic and connects neighborhoods through borough and city roads', () => {
    const first = createCityPlan({ seed: 42.5, size: 'medium' });
    const second = createCityPlan({ seed: 42.5, size: 'medium' });

    expect(first.buildings).toEqual(second.buildings);
    expect(first.boroughs).toHaveLength(4);
    expect(first.neighborhoods).toHaveLength(12);
    expect(first.roads.some((road) => road.kind === 'borough')).toBe(true);
    expect(first.roads.some((road) => road.kind === 'city')).toBe(true);
    expect(first.neighborhoods.every((neighborhood) => neighborhood.roads.length === 6)).toBe(true);
  });

  it('scales borough and agent counts with the selected city size', () => {
    const small = createCityPlan({ seed: 11, size: 'small' });
    const large = createCityPlan({ seed: 11, size: 'large' });

    expect(large.boroughs.length).toBeGreaterThan(small.boroughs.length);
    expect(large.buildings.length).toBeGreaterThan(small.buildings.length);
    expect(large.agents.length).toBeGreaterThan(small.agents.length);
    expect(large.agents.every((agent) => agent.route.length > 1 && agent.route.every((point) => Number.isFinite(point.x) && Number.isFinite(point.z)))).toBe(true);
  });

  it('includes civic and commercial building types', () => {
    const city = createCityPlan({ seed: 7, size: 'large' });
    const types = new Set(city.buildings.map((building) => building.type));

    for (const type of ['police-station', 'fire-department', 'hospital', 'taxi-station', 'pizzeria', 'supermarket']) {
      expect(types.has(type)).toBe(true);
    }
  });
});
