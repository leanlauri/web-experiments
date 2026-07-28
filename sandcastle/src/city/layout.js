const TAU = Math.PI * 2;

export const CITY_SIZE_PRESETS = {
  small: { boroughs: 2, neighborhoodsPerBorough: 2, agentsPerNeighborhood: 5 },
  medium: { boroughs: 4, neighborhoodsPerBorough: 3, agentsPerNeighborhood: 6 },
  large: { boroughs: 8, neighborhoodsPerBorough: 4, agentsPerNeighborhood: 7 },
};

export const BUILDING_TYPES = [
  'residence',
  'apartment',
  'office',
  'police-station',
  'fire-department',
  'hospital',
  'taxi-station',
  'pizzeria',
  'supermarket',
  'school',
  'library',
  'cafe',
  'warehouse',
];

export function seededRandom(seed) {
  let value = (Math.floor(seed * 1e6) ^ 0xA53C9E17) >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function gridPosition(index, count, spacing) {
  const columns = Math.ceil(Math.sqrt(count));
  const row = Math.floor(index / columns);
  const column = index % columns;
  return {
    x: (column - (columns - 1) * .5) * spacing,
    z: (row - (Math.ceil(count / columns) - 1) * .5) * spacing,
  };
}

function addRoad(roads, start, end, kind = 'local') {
  if (Math.hypot(start.x - end.x, start.z - end.z) < .01) return;
  roads.push({ start: { ...start }, end: { ...end }, kind });
}

function routeFromRoads(roads, count, rng) {
  const points = [];
  const start = roads[Math.floor(rng() * roads.length)] ?? { start: { x: 0, z: 0 }, end: { x: 0, z: 0 } };
  points.push({ ...start.start }, { ...start.end });
  for (let i = 0; i < count; i++) {
    const road = roads[Math.floor(rng() * roads.length)] ?? start;
    const point = rng() < .5 ? road.start : road.end;
    points.push({ ...point });
  }
  return points;
}

function buildingTypeFor(index, neighborhoodIndex, rng) {
  const services = ['police-station', 'fire-department', 'hospital', 'taxi-station', 'pizzeria', 'supermarket'];
  if (index === 0) return services[neighborhoodIndex % services.length];
  const weights = ['residence', 'residence', 'apartment', 'office', 'cafe', 'school', 'library', 'warehouse', 'pizzeria', 'supermarket'];
  return weights[Math.floor(rng() * weights.length)];
}

function createNeighborhood({ id, boroughId, center, index, rng }) {
  const half = 32 + rng() * 8;
  const inset = 12;
  const roads = [];
  const west = { x: center.x - half, z: center.z };
  const east = { x: center.x + half, z: center.z };
  const north = { x: center.x, z: center.z - half };
  const south = { x: center.x, z: center.z + half };
  addRoad(roads, west, east);
  addRoad(roads, north, south);
  addRoad(roads, { x: center.x - half, z: center.z - half }, { x: center.x + half, z: center.z - half });
  addRoad(roads, { x: center.x - half, z: center.z + half }, { x: center.x + half, z: center.z + half });
  // Complete the perimeter so every local block joins the central crossroads,
  // and borough connectors can reach every lot without a dead-end street.
  addRoad(roads, { x: center.x - half, z: center.z - half }, { x: center.x - half, z: center.z + half });
  addRoad(roads, { x: center.x + half, z: center.z - half }, { x: center.x + half, z: center.z + half });

  const lots = [
    [-half + inset, -half + inset], [0, -half + inset], [half - inset, -half + inset],
    [-half + inset, half - inset], [0, half - inset], [half - inset, half - inset],
    [-half + inset, 0], [half - inset, 0],
  ];
  const buildings = lots.map(([x, z], lotIndex) => {
    const type = buildingTypeFor(lotIndex, index, rng);
    const edge = Math.abs(x) > Math.abs(z) ? 'x' : 'z';
    return {
      id: `${id}:building:${lotIndex}`,
      type,
      x: center.x + x + (rng() - .5) * 2,
      z: center.z + z + (rng() - .5) * 2,
      rotation: edge === 'x' ? (x < 0 ? Math.PI / 2 : -Math.PI / 2) : (z < 0 ? 0 : Math.PI),
      width: 8 + rng() * 7,
      depth: 7 + rng() * 6,
      stories: type === 'hospital' ? 3 : type === 'office' ? 3 + Math.floor(rng() * 2) : type === 'apartment' ? 2 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2),
    };
  });
  return { id, boroughId, center, roads, buildings };
}

export function createCityPlan({ seed = 8, size = 'medium' } = {}) {
  const preset = CITY_SIZE_PRESETS[size] ?? CITY_SIZE_PRESETS.medium;
  const rng = seededRandom(seed);
  const boroughs = [];
  const roads = [];
  const boroughSpacing = 205;

  for (let boroughIndex = 0; boroughIndex < preset.boroughs; boroughIndex++) {
    const offset = gridPosition(boroughIndex, preset.boroughs, boroughSpacing);
    const center = {
      x: offset.x + (rng() - .5) * 24,
      z: offset.z + (rng() - .5) * 24,
    };
    const borough = { id: `borough:${boroughIndex}`, center, neighborhoods: [], roads: [] };
    for (let neighborhoodIndex = 0; neighborhoodIndex < preset.neighborhoodsPerBorough; neighborhoodIndex++) {
      const local = gridPosition(neighborhoodIndex, preset.neighborhoodsPerBorough, 92);
      const neighborhood = createNeighborhood({
        id: `${borough.id}:neighborhood:${neighborhoodIndex}`,
        boroughId: borough.id,
        center: { x: center.x + local.x, z: center.z + local.z },
        index: boroughIndex * preset.neighborhoodsPerBorough + neighborhoodIndex,
        rng,
      });
      borough.neighborhoods.push(neighborhood);
      borough.roads.push(...neighborhood.roads);
      roads.push(...neighborhood.roads);
      if (neighborhoodIndex > 0) {
        const previous = borough.neighborhoods[neighborhoodIndex - 1];
        const connector = { start: previous.center, end: neighborhood.center, kind: 'borough' };
        borough.roads.push(connector);
        roads.push(connector);
      }
    }
    boroughs.push(borough);
    if (boroughIndex > 0) {
      const previous = boroughs[boroughIndex - 1];
      addRoad(roads, previous.center, borough.center, 'city');
    }
  }

  const neighborhoods = boroughs.flatMap((borough) => borough.neighborhoods);
  const agents = neighborhoods.flatMap((neighborhood, neighborhoodIndex) => {
    const count = preset.agentsPerNeighborhood;
    return Array.from({ length: count }, (_, index) => ({
      id: `${neighborhood.id}:agent:${index}`,
      neighborhoodId: neighborhood.id,
      kind: index % 5 === 0 ? 'animal' : index % 3 === 0 ? 'vehicle' : 'person',
      route: routeFromRoads(neighborhood.roads, 4 + Math.floor(rng() * 3), rng),
      speed: index % 3 === 0 ? 6 + rng() * 4 : index % 5 === 0 ? 1 + rng() * .6 : 1.4 + rng() * .8,
      phase: rng() * TAU,
      palette: neighborhoodIndex + index,
    }));
  });

  return {
    size,
    boroughs,
    neighborhoods,
    roads,
    buildings: neighborhoods.flatMap((neighborhood) => neighborhood.buildings),
    agents,
    bounds: boroughs.reduce((bounds, borough) => ({
      minX: Math.min(bounds.minX, borough.center.x - 90),
      maxX: Math.max(bounds.maxX, borough.center.x + 90),
      minZ: Math.min(bounds.minZ, borough.center.z - 90),
      maxZ: Math.max(bounds.maxZ, borough.center.z + 90),
    }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }),
  };
}
