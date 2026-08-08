export const WORLD_GRID_COLUMNS = 10;
export const WORLD_GRID_ROWS = 10;
export const INDIVIDUALS_PER_TILE = 11;
export const STACKS_PER_TILE = 2;
export const OBJECTS_PER_STACK = 4;
export const OBJECTS_PER_TILE = INDIVIDUALS_PER_TILE + STACKS_PER_TILE * OBJECTS_PER_STACK;
export const WORLD_OBJECT_COUNT = WORLD_GRID_COLUMNS * WORLD_GRID_ROWS * OBJECTS_PER_TILE;

export function scatteredPoint(random, occupied, minimumSeparation = 2.5) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const point = { x: (random() - 0.5) * 19, z: (random() - 0.5) * 16 };
    if (occupied.every((other) => Math.hypot(point.x - other.x, point.z - other.z) > minimumSeparation)) {
      occupied.push(point);
      return point;
    }
  }

  const fallback = { x: (random() - 0.5) * 18, z: (random() - 0.5) * 15 };
  occupied.push(fallback);
  return fallback;
}

export function scatteredPoints(random, count, minimumSeparation = 2.5) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    scatteredPoint(random, points, minimumSeparation);
  }
  return points;
}
