import { describe, expect, it } from 'vitest';
import { createCityPlan, createCityRoadNetwork } from '../src/city/layout.js';

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

  it('exposes terrain-ready road color and height masks for city streets', () => {
    const city = createCityPlan({ seed: 13, size: 'small' });
    const roads = createCityRoadNetwork(city, { baseHeight: (x, z) => 5 + x * .02 + z * .01 });
    const sampleRoad = city.roads[0];
    const x = (sampleRoad.start.x + sampleRoad.end.x) * .5;
    const z = (sampleRoad.start.z + sampleRoad.end.z) * .5;

    expect(roads.colorAt(x, z)?.roadMask).toBe(1);
    expect(roads.heightAt(x, z, -20)).toBeGreaterThan(0);
    expect(roads.colorAt(x + 1000, z + 1000)).toBeNull();
  });
});
