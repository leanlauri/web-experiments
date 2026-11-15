// Rendering and collision share these deterministic placements. Queries never
// depend on which scenery chunks the camera currently has loaded.
export const SCENERY_CHUNK_SIZE = 64,
  TREE_RADIUS = 0.3;
export function createScenery({
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
}) {
  const props = [],
    treeCache = new Map(),
    propCells = new Map(),
    detours = new WeakMap();
  const rocketColliders = [
    { x: SPACEPORT.x, z: SPACEPORT.z, radius: 1.7, minY: 1.6, h: 5, stage: 1 },
    {
      x: SPACEPORT.x,
      z: SPACEPORT.z,
      radius: 1.3,
      minY: 1.25,
      h: 1.2,
      stage: 2,
    },
    ...[-1, 1].map((side) => ({
      x: SPACEPORT.x + side * 2,
      z: SPACEPORT.z,
      radius: 0.65,
      minY: 2.1,
      h: 4,
      stage: 3,
    })),
    {
      x: SPACEPORT.x,
      z: SPACEPORT.z + 1.64,
      hx: 0.575,
      hz: 0.16,
      minY: 5.5,
      h: 1,
      stage: 4,
    },
    { x: SPACEPORT.x, z: SPACEPORT.z, radius: 1.7, minY: 6.6, h: 3, stage: 5 },
  ];
  const box = (type, x, z, hx, hz, h, color, minY = 0) =>
    props.push({ type, x, z, hx, hz, h, color, minY });
  const pole = (type, x, z, radius, h, color) =>
    props.push({ type, x, z, radius, h, color, minY: 0 });
  if (HOME_BARN)
    for (const side of [-1, 1])
      box(
        "barn-gate",
        HOME_BARN.x + side * HOME_BARN.doorHalf,
        HOME_BARN.z + HOME_BARN.hz + 1.5,
        0.09,
        1.5,
        1.8,
        0xc8b38b,
      );
  box("counter", HOUSE.x, HOUSE.z - 3.3, 3.2, 0.65, 2.2, 0x657c69);
  box(
    "rocket-stand",
    SPACEPORT.x,
    SPACEPORT.z,
    2.75,
    2.75,
    0.9,
    0xbec5af,
    0.24,
  );
  for (const x of [-6, -4.5])
    box(
      "gantry-leg",
      SPACEPORT.x + x,
      SPACEPORT.z - 1,
      0.11,
      0.11,
      9,
      0x6c8790,
    );
  for (let y = 1; y < 9; y += 0.65)
    box(
      "ladder-rung",
      SPACEPORT.x - 5.25,
      SPACEPORT.z - 1,
      0.75,
      0.08,
      0.1,
      0xc0d0c4,
      y - 0.05,
    );
  box(
    "gantry-arm",
    SPACEPORT.x - 3,
    SPACEPORT.z - 1,
    3,
    0.15,
    0.25,
    0x6c8790,
    7.875,
  );
  for (let i = 0; i < 3; i++)
    box(
      "crate",
      SPACEPORT.x - 4 + i,
      SPACEPORT.z + 4.6,
      0.4,
      0.4,
      1.2,
      0xb1ac8b,
    );
  for (const f of FARMS) pole("flagpole", f.x + 26, f.z + 21, 0.1, 8, 0x806b4e);
  for (const b of OBSTACLES.filter((b) => b.kind === "gas")) {
    for (const side of [-1, 1]) {
      pole("canopy-post", b.x + side * b.hx * 0.8, b.z + 2, 0.1, 5.2, 0xe6d9ab);
      box("fuel-pump", b.x + side * 1.7, b.z + 1.7, 0.325, 0.35, 1.6, 0xd77761);
    }
    box("canopy", b.x, b.z, b.hx + 0.35, b.hz + 0.35, 0.6, 0xe8c361, b.h);
  }
  for (const prop of props) {
    const r = prop.radius || 0;
    for (
      let x = Math.floor((prop.x - (prop.hx || r)) / 16);
      x <= Math.floor((prop.x + (prop.hx || r)) / 16);
      x++
    )
      for (
        let z = Math.floor((prop.z - (prop.hz || r)) / 16);
        z <= Math.floor((prop.z + (prop.hz || r)) / 16);
        z++
      ) {
        const key = x + "," + z;
        if (!propCells.has(key)) propCells.set(key, []);
        propCells.get(key).push(prop);
      }
  }
  function treesInChunk(cx, cz) {
    const key = cx + "," + cz;
    if (treeCache.has(key)) return treeCache.get(key);
    if (
      Math.abs(cx) > Math.ceil(SIZE / SCENERY_CHUNK_SIZE) ||
      Math.abs(cz) > Math.ceil(SIZE / SCENERY_CHUNK_SIZE)
    )
      return [];
    let seed = ((cx + 50) * 127 + (cz + 50) * 719) >>> 0;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const trees = [];
    for (let i = 0; i < 22; i++) {
      const x = cx * SCENERY_CHUNK_SIZE + rand() * SCENERY_CHUNK_SIZE,
        z = cz * SCENERY_CHUNK_SIZE + rand() * SCENERY_CHUNK_SIZE,
        p = { x, z };
      if (
        Math.abs(x) > SIZE ||
        Math.abs(z) > SIZE ||
        water(p) ||
        inTown(p) ||
        Math.hypot(x, z) < 72 ||
        Math.hypot(x - HOME.x, z - HOME.z) < 36 ||
        Math.hypot(x - START.x, z - START.z) < 24 ||
        FARMS.some((f) => Math.hypot(x - f.x, z - f.z) < 49) ||
        [
          [0, 0],
          [-3, 0],
          [3, 0],
          [0, -3],
          [0, 3],
        ].some(([dx, dz]) => road({ x: x + dx, z: z + dz }))
      )
        continue;
      const crownY = 3 + rand() * 4;
      trees.push({
        type: "tree",
        x,
        z,
        crownY,
        h: crownY * 0.8,
        radius: TREE_RADIUS,
        minY: 0,
      });
    }
    treeCache.set(key, trees);
    return trees;
  }
  function nearby(p, r = 0) {
    const found = new Set();
    if (
      p.rocketParts &&
      Math.hypot(p.x - SPACEPORT.x, p.z - SPACEPORT.z) < r + 4
    )
      for (const c of rocketColliders)
        if (c.stage <= p.rocketParts) found.add(c);
    for (
      let x = Math.floor((p.x - r) / 16);
      x <= Math.floor((p.x + r) / 16);
      x++
    )
      for (
        let z = Math.floor((p.z - r) / 16);
        z <= Math.floor((p.z + r) / 16);
        z++
      )
        for (const prop of propCells.get(x + "," + z) || []) found.add(prop);
    for (
      let x = Math.floor((p.x - r - TREE_RADIUS) / SCENERY_CHUNK_SIZE);
      x <= Math.floor((p.x + r + TREE_RADIUS) / SCENERY_CHUNK_SIZE);
      x++
    )
      for (
        let z = Math.floor((p.z - r - TREE_RADIUS) / SCENERY_CHUNK_SIZE);
        z <= Math.floor((p.z + r + TREE_RADIUS) / SCENERY_CHUNK_SIZE);
        z++
      )
        for (const t of treesInChunk(x, z))
          if (
            Math.abs(t.x - p.x) < r + t.radius &&
            Math.abs(t.z - p.z) < r + t.radius
          )
            found.add(t);
    return [...found];
  }
  function overlaps(c, p, r) {
    const dx = Math.abs(p.x - c.x),
      dz = Math.abs(p.z - c.z);
    if (c.radius) return Math.hypot(dx, dz) < r + c.radius;
    if (dx < c.hx && dz < c.hz) return true;
    return Math.hypot(Math.max(0, dx - c.hx), Math.max(0, dz - c.hz)) < r;
  }
  function blocks(p, r = 0.65, height = 1.8) {
    return nearby(p, r).some(
      (c) =>
        (p.y || 0) < c.minY + c.h &&
        (p.y || 0) + height > c.minY &&
        overlaps(c, p, r),
    );
  }
  // Sparse local detours keep followers from pressing against newly solid trunks.
  function waypoint(p, target) {
    const distance = Math.hypot(target.x - p.x, target.z - p.z);
    if (distance < 0.01) return target;
    const fx = (target.x - p.x) / distance,
      fz = (target.z - p.z) / distance,
      length = Math.min(distance, 12);
    const obstruction = nearby(
      { x: p.x + (fx * length) / 2, z: p.z + (fz * length) / 2 },
      length / 2 + 1,
    )
      .filter((c) => c.minY < 1.8)
      .map((c) => {
        const along = (c.x - p.x) * fx + (c.z - p.z) * fz,
          radius = (c.radius || Math.hypot(c.hx, c.hz)) + 0.9;
        return { c, along, radius };
      })
      .filter(
        ({ c, along, radius }) =>
          along > 0 &&
          along < length + radius &&
          Math.abs((c.x - p.x) * fz - (c.z - p.z) * fx) < radius,
      )
      .sort((a, b) => a.along - a.along)[0];
    if (!obstruction) {
      detours.delete(p);
      return target;
    }
    const cached = detours.get(p);
    if (
      cached &&
      Math.hypot(cached.x - p.x, cached.z - p.z) > 0.8 &&
      !blocks(cached, 0.6)
    )
      return cached;
    const { c, radius } = obstruction;
    const options = [-1, 1]
      .map((side) => ({
        x: c.x - fz * (radius + 1) * side,
        z: c.z + fx * (radius + 1) * side,
      }))
      .filter((q) => !water(q) && !blocks(q, 0.7));
    options.sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) +
        Math.hypot(target.x - a.x, target.z - a.z) -
        (Math.hypot(b.x - p.x, b.z - p.z) +
          Math.hypot(target.x - b.x, target.z - b.z)),
    );
    if (!options.length) return target;
    detours.set(p, options[0]);
    return options[0];
  }
  return {
    props,
    treesInChunk,
    nearby,
    blocks,
    waypoint,
    stats: () => ({ cachedChunks: treeCache.size, props: props.length }),
  };
}
