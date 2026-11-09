export const SIZE = 460,
  HOME = { x: 0, z: -190, r: 22 },
  START = { x: 0, z: -135 };
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
];
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
  if (Math.abs(Math.hypot(p.x, p.z) - 100) < 6) return true;
  return [...FARMS, HOME].some(
    (f) => segmentDistance(p, { x: 0, z: 0 }, f) < 6,
  );
}
export function water(p) {
  const r = Math.hypot(p.x, p.z);
  if (r < 68 || Math.abs(r - 100) < 8) return false;
  return FARMS.some((f) => {
    const a = f.angle + Math.PI / 6,
      along = p.x * Math.cos(a) + p.z * Math.sin(a),
      side = Math.abs(-p.x * Math.sin(a) + p.z * Math.cos(a));
    return along > 68 && side < 5;
  });
}
// These same obstacles drive rendering and movement; farm gates face the town.
export const OBSTACLES = [];
for (let i = 0; i < 12; i++) {
  const a = (((i % 6) * 60 + 45) * Math.PI) / 180,
    r = i < 6 ? 43 : 73;
  OBSTACLES.push({
    x: Math.cos(a) * r,
    z: Math.sin(a) * r,
    hx: 5,
    hz: 5,
    h: 8 + (i % 3) * 2,
    type: "town",
    color: [0xe2c4a2, 0xc0cbd3, 0xd4b3a8][i % 3],
  });
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
export function blocked(p, r = 0.65, level = 0) {
  return (
    Math.abs(p.x) > SIZE - 4 ||
    Math.abs(p.z) > SIZE - 4 ||
    water(p) ||
    fenceBlocks(p, level) ||
    OBSTACLES.some(
      (b) => Math.abs(p.x - b.x) < b.hx + r && Math.abs(p.z - b.z) < b.hz + r,
    )
  );
}
export function move(p, dx, dz, r = 0.65, level = 0) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.6));
  for (let i = 0; i < steps; i++) {
    if (!blocked({ x: p.x + dx / steps, z: p.z }, r, level)) p.x += dx / steps;
    if (!blocked({ x: p.x, z: p.z + dz / steps }, r, level)) p.z += dz / steps;
  }
}
export function farmGate(f) {
  return { x: f.x - Math.cos(f.angle) * 39, z: f.z - Math.sin(f.angle) * 39 };
}
export function routeTarget(p, target) {
  for (const f of FARMS) {
    const a = dist(p, f) < 37,
      b = dist(target, f) < 37;
    if (a !== b) {
      const gate = farmGate(f);
      if (dist(p, gate) > 4) return gate;
    }
  }
  // Rivers divide sectors. Return through the bridged ring before crossing sectors.
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
  return target;
}
