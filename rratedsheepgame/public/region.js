import { createScenery } from "./scenery.js?v=town-blocks-1";
export const SIZE = 460,
  HOME = { x: 0, z: -190, r: 28 },
  START = { x: 0, z: -135 };
export const HOUSE = {
  x: HOME.x + 13,
  z: HOME.z - 7,
  hx: 5,
  hz: 5,
  doorHalf: 1.1,
};
export const BASE_HEARTS = 5;
export const HOME_BARN = {
  x: HOME.x,
  z: HOME.z - 22,
  hx: 7,
  hz: 9,
  doorHalf: 3.1,
};
export const SPACEPORT = { x: HOME.x - 11, z: HOME.z - 8 };
export const inHouse = (p) =>
  Math.abs(p.x - HOUSE.x) < HOUSE.hx - 0.6 &&
  p.z < HOUSE.z + HOUSE.hz - 0.6 &&
  p.z > HOUSE.z - HOUSE.hz + 0.6;
function houseBlocked(p, r, house = HOUSE) {
  const dx = Math.abs(p.x - house.x),
    dz = Math.abs(p.z - house.z);
  if (dx >= house.hx + r || dz >= house.hz + r) return false;
  return (
    dx > house.hx - 0.35 - r ||
    p.z < house.z - house.hz + 0.35 + r ||
    (p.z > house.z + house.hz - 0.35 - r && dx > house.doorHalf - r)
  );
}
export const FARMS = [
  ["Sunflower Union", "sheep", 0xe9b344, "Foam bat", 1],
  ["Rosewood Riders", "pig", 0xcf7797, "Bubble wand", 1.15],
  ["Bluebell Dairy", "cow", 0x649cbf, "Foam blaster", 0.9],
  ["Copper Carrot Co.", "rabbit", 0xd78c48, "Pillow launcher", 1.25],
  ["Mint Meadow", "goat", 0x68ad93, "Bubble wand", 1.05],
  ["Violet Valley", "alpaca", 0x9a83be, "Foam blaster", 1.4],
].map(([name, animal, color, weapon, aggression], i) => {
  const angle = ((i * 60 + 15) * Math.PI) / 180;
  return {
    id: i,
    name,
    animal,
    color,
    weapon,
    aggression,
    angle,
    x: Math.cos(angle) * 330,
    z: Math.sin(angle) * 330,
  };
});
export const WEAPONS = [
  { name: "Cushion club", cost: 0, range: 4, cooldown: 0.7, power: 1 },
  { name: "Foam bat", cost: 35, range: 5.5, cooldown: 0.5, power: 2 },
  { name: "Bubble wand", cost: 65, range: 22, cooldown: 0.8, power: 1 },
  { name: "Foam blaster", cost: 110, range: 34, cooldown: 0.38, power: 1 },
  { name: "Pillow launcher", cost: 160, range: 28, cooldown: 1.1, power: 3 },
  { name: "Foam pistol", cost: 50, range: 26, cooldown: 0.55, power: 1 },
];
export const OPENING_REWARD = 60;
export const TOWN = { west: -118, east: 118, north: -106, south: 106 };
export const RIVER_START = 160;
export const TOWN_STREETS = [];
for (const x of [-92, -46, 0, 46, 92])
  TOWN_STREETS.push({ a: { x, z: -102 }, b: { x, z: 102 }, width: 11 });
for (const z of [-80, -40, 0, 40, 80])
  TOWN_STREETS.push({ a: { x: -114, z }, b: { x: 114, z }, width: 11 });
// Country roads meet outer intersections with short approaches perpendicular to town.
// Bends stay outside the grid, leaving the building blocks uninterrupted.
export const FARM_ROADS = FARMS.map((farm, i) => ({
  farm: i,
  width: 12,
  points: [
    [
      { x: 92, z: 40 },
      { x: 46, z: 80 },
      { x: -46, z: 80 },
      { x: -92, z: -40 },
      { x: -46, z: -80 },
      { x: 46, z: -80 },
    ][i],
    [
      { x: 150, z: 40 },
      { x: 46, z: 140 },
      { x: -46, z: 140 },
      { x: -150, z: -40 },
      { x: -46, z: -140 },
      { x: 46, z: -140 },
    ][i],
    { x: farm.x, z: farm.z },
  ],
}));
export const COUNTRY_ROADS = [
  ...FARM_ROADS,
  { farm: -1, width: 12, points: [{ x: 0, z: -80 }, { ...HOME }] },
];
export const inTown = (p) =>
  p.x > TOWN.west && p.x < TOWN.east && p.z > TOWN.north && p.z < TOWN.south;
export const PARTS = [
  { name: "Rocket frame", animals: 12, cost: 0 },
  { name: "Moon engine", animals: 20, cost: 0 },
  { name: "Fuel tanks", animals: 30, cost: 0 },
  { name: "Flight computer", animals: 42, cost: 0 },
  { name: "Lunar capsule", animals: 56, cost: 0 },
];
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function segmentDistance(p, a, b) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)),
    );
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
export function road(p) {
  if (TOWN_STREETS.some((s) => segmentDistance(p, s.a, s.b) < s.width / 2))
    return true;
  return COUNTRY_ROADS.some((r) =>
    r.points
      .slice(1)
      .some((b, i) => segmentDistance(p, r.points[i], b) < r.width / 2),
  );
}
export function water(p) {
  const r = Math.hypot(p.x, p.z);
  if (r < RIVER_START) return false;
  return FARMS.some((f) => {
    const a = f.angle + Math.PI / 6,
      along = p.x * Math.cos(a) + p.z * Math.sin(a),
      side = Math.abs(-p.x * Math.sin(a) + p.z * Math.cos(a));
    return along > 68 && side < 5;
  });
}
// These same obstacles drive rendering and movement; farm gates face the town.
export const OBSTACLES = [];
export const TOWN_LOTS = [];
let lot = 0;
const addBuilding = (x, z, hx, hz, kind, front, index) =>
  OBSTACLES.push({
    x,
    z,
    hx,
    hz,
    kind,
    front,
    type: "town",
    h:
      kind === "warehouse"
        ? 8 + (index % 2) * 2
        : kind === "shop"
          ? 5 + (index % 2) * 2
          : kind === "gas"
            ? 4
            : 5 + (index % 3),
    color: (kind === "house"
      ? [0xe1c7a4, 0xe4d5b3, 0xc5cbb6, 0xd8bca5]
      : kind === "shop"
        ? [0xd6b0a1, 0xbccac3, 0xd9c898, 0xb5c5ca]
        : [0xb6c6c4, 0xc2bb9e])[
      index % (kind === "house" || kind === "shop" ? 4 : 2)
    ],
    name:
      kind === "shop"
        ? ["Clover Market", "Foam & Fun", "Moon Bakery", "County Supplies"][
            index % 4
          ]
        : kind === "gas"
          ? "Orbit Fuel"
          : kind === "warehouse"
            ? "County Freight"
            : "Home",
  });
for (let ix = 0; ix < 4; ix++)
  for (let iz = 0; iz < 4; iz++) {
    const x = -69 + ix * 46,
      z = -60 + iz * 40,
      index = lot++,
      central = ix > 0 && ix < 3 && iz > 0 && iz < 3,
      industrial = ix === 3 && (iz === 0 || iz === 3),
      gas = ix === 0 && (iz === 0 || iz === 3);
    TOWN_LOTS.push({
      x,
      z,
      hx: 15.5,
      hz: 12.5,
      kind: industrial
        ? "industrial"
        : gas
          ? "service"
          : central
            ? "commercial"
            : "residential",
    });
    if (central || industrial) {
      for (const side of [-1, 1])
        addBuilding(
          x,
          z + side * 7.2,
          industrial ? 12 : 13,
          4.8,
          industrial ? "warehouse" : "shop",
          side,
          index + (side > 0 ? 1 : 0),
        );
    } else if (gas) {
      addBuilding(x - 7, z - 5, 6, 5, "gas", -1, index);
      addBuilding(x + 9, z + 7.5, 5.2, 4.5, "shop", 1, index + 1);
    } else
      for (const dx of [-10, 10])
        for (const side of [-1, 1])
          addBuilding(
            x + dx,
            z + side * 7.5,
            5.2,
            4.5,
            "house",
            side,
            index + (dx > 0 ? 1 : 0) + (side > 0 ? 2 : 0),
          );
  }
for (const f of FARMS) {
  OBSTACLES.push({
    x: f.x + 15,
    z: f.z - 18,
    hx: 9,
    hz: 6,
    h: 8,
    type: "barn",
    color: f.color,
    farm: f.id,
  });
}
OBSTACLES.push({
  x: HOME.x + 13,
  z: HOME.z - 7,
  hx: 5,
  hz: 5,
  h: 6,
  type: "home",
  color: 0xe4c59a,
});
OBSTACLES.push({ ...HOME_BARN, h: 7, type: "home-barn", color: 0xc67c63 });
export function fenceBlocks(p, level = 0) {
  return FARMS.some((f) => {
    const dx = p.x - f.x,
      dz = p.z - f.z,
      r = Math.hypot(dx, dz);
    if (Math.abs(r - 35) > 1) return false;
    const toward = -(dx * Math.cos(f.angle) + dz * Math.sin(f.angle)),
      side = Math.abs(-dx * Math.sin(f.angle) + dz * Math.cos(f.angle));
    return !(toward > 0 && side < (level > 2 ? 5 : 8));
  });
}
export const SCENERY = createScenery({
  SIZE,
  HOME,
  START,
  HOUSE,
  SPACEPORT,
  HOME_BARN,
  FARMS,
  OBSTACLES,
  road,
  water,
  inTown,
});
export const treesInChunk = SCENERY.treesInChunk,
  SOLID_PROPS = SCENERY.props;
export function buildingBlocks(b, p, r = 0) {
  if (b.type === "home") return houseBlocked(p, r);
  if (b.type === "home-barn") return houseBlocked(p, r, HOME_BARN);
  const z = b.z - (b.kind === "gas" ? 1.5 * (b.front || 1) : 0),
    hz = b.kind === "gas" ? b.hz / 2 : b.hz;
  return Math.abs(p.x - b.x) < b.hx + r && Math.abs(p.z - z) < hz + r;
}
export function solidBlocked(p, r = 0.65, height = 1.8) {
  return (
    OBSTACLES.some((b) => (p.y || 0) < b.h && buildingBlocks(b, p, r)) ||
    SCENERY.blocks(p, r, height)
  );
}
export function solidPathClear(a, b) {
  const steps = Math.max(1, Math.ceil(dist(a, b) / 0.2));
  for (let i = 1; i <= steps; i++)
    if (
      solidBlocked(
        {
          x: a.x + ((b.x - a.x) * i) / steps,
          z: a.z + ((b.z - a.z) * i) / steps,
          y: (a.y || 0) + 1.3,
          rocketParts: a.rocketParts,
        },
        0.1,
        0.1,
      )
    )
      return false;
  return true;
}
export function blocked(p, r = 0.65, level = 0) {
  return (
    Math.abs(p.x) > SIZE - 4 ||
    Math.abs(p.z) > SIZE - 4 ||
    water(p) ||
    fenceBlocks(p, level) ||
    solidBlocked(p, r)
  );
}
export function move(p, dx, dz, r = 0.65, level = 0) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.6));
  for (let i = 0; i < steps; i++) {
    if (
      !blocked(
        {
          x: p.x + dx / steps,
          z: p.z,
          y: p.y || 0,
          rocketParts: p.rocketParts,
        },
        r,
        level,
      )
    )
      p.x += dx / steps;
    if (
      !blocked(
        {
          x: p.x,
          z: p.z + dz / steps,
          y: p.y || 0,
          rocketParts: p.rocketParts,
        },
        r,
        level,
      )
    )
      p.z += dz / steps;
  }
}
export function clearPosition(origin, r = 0.5, level = 0, accept = () => true) {
  for (let ring = 0; ring <= 8; ring++)
    for (let i = 0; i < (ring ? 16 : 1); i++) {
      const angle = (i * Math.PI) / 8,
        p = {
          ...origin,
          x: origin.x + Math.cos(angle) * ring,
          z: origin.z + Math.sin(angle) * ring,
        };
      if (!blocked(p, r, level) && accept(p)) return p;
    }
  return null;
}
export function farmGate(f) {
  return { x: f.x - Math.cos(f.angle) * 39, z: f.z - Math.sin(f.angle) * 39 };
}
export function routeTarget(p, target) {
  return SCENERY.waypoint(p, regionTarget(p, target));
}
function regionTarget(p, target) {
  for (const f of FARMS) {
    const a = dist(p, f) < 37,
      b = dist(target, f) < 37;
    if (a !== b) {
      const gate = farmGate(f);
      if (dist(p, gate) > 4) return gate;
    }
  }
  // Return to the town street grid before crossing river-divided counties.
  const sector = (q) =>
    Math.floor(
      (Math.atan2(q.z, q.x) - Math.PI / 4 + Math.PI * 4) / (Math.PI / 3),
    ) % 6;
  if (Math.hypot(p.x, p.z) > 110 && sector(p) !== sector(target)) {
    const r = Math.hypot(p.x, p.z);
    return { x: (p.x / r) * 99, z: (p.z / r) * 99 };
  }
  if (water({ x: (p.x + target.x) / 2, z: (p.z + target.z) / 2 })) {
    return { x: 0, z: 0 };
  }
  return townWaypoint(p, target);
}

const townPaths = new WeakMap(),
  townWalkable = new Map();
function townWaypoint(p, target) {
  if (!inTown(p) && !inTown(target)) return target;
  const clear = (a, b) => {
    const d = dist(a, b),
      n = Math.max(1, Math.ceil(d / 2));
    for (let i = 1; i <= n; i++)
      if (
        blocked(
          { x: a.x + ((b.x - a.x) * i) / n, z: a.z + ((b.z - a.z) * i) / n },
          0.55,
        )
      )
        return false;
    return true;
  };
  if (clear(p, target)) return target;
  const cached = townPaths.get(p);
  if (cached && dist(cached.goal, target) < 8) {
    while (cached.path.length && dist(p, cached.path[0]) < 2.8)
      cached.path.shift();
    if (cached.path.length) return cached.path[0];
  }
  const step = 4,
    key = (x, z) => x + "," + z;
  const valid = (x, z) => {
    if (Math.abs(x) > 132 || Math.abs(z) > 120) return false;
    const k = key(x, z);
    if (!townWalkable.has(k)) townWalkable.set(k, !blocked({ x, z }, 0.8));
    return townWalkable.get(k);
  };
  const nearest = (q) => {
    const x = Math.round(q.x / step) * step,
      z = Math.round(q.z / step) * step;
    let best = null;
    for (let r = 0; r <= 3 && !best; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
          if (valid(x + dx * step, z + dz * step))
            best = { x: x + dx * step, z: z + dz * step };
    return best;
  };
  const clamped = {
      x: Math.max(-128, Math.min(128, target.x)),
      z: Math.max(-116, Math.min(116, target.z)),
    },
    start = nearest(p),
    goal = nearest(clamped);
  if (!start || !goal) return target;
  const open = [{ ...start, g: 0, f: dist(start, goal), parent: null }],
    cost = new Map([[key(start.x, start.z), 0]]);
  let found = null;
  for (let iteration = 0; open.length && iteration < 4000; iteration++) {
    let best = 0;
    for (let i = 1; i < open.length; i++)
      if (open[i].f < open[best].f) best = i;
    const n = open.splice(best, 1)[0];
    if (n.x === goal.x && n.z === goal.z) {
      found = n;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const x = n.x + dx * step,
        z = n.z + dz * step;
      if (!valid(x, z) || (dx && dz && (!valid(n.x, z) || !valid(x, n.z))))
        continue;
      const g = n.g + Math.hypot(dx, dz) * step,
        k = key(x, z);
      if (g >= (cost.get(k) ?? Infinity)) continue;
      cost.set(k, g);
      open.push({ x, z, g, f: g + dist({ x, z }, goal), parent: n });
    }
  }
  if (!found) return target;
  const path = [];
  for (let n = found; n?.parent; n = n.parent) path.unshift({ x: n.x, z: n.z });
  townPaths.set(p, { goal: { ...target }, path });
  while (path.length && dist(p, path[0]) < 2.8) path.shift();
  return path[0] || target;
}
