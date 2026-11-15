import assert from "node:assert/strict";
import {
  SCENERY,
  treesInChunk,
  SOLID_PROPS,
  SPACEPORT,
  HOME,
  HOUSE,
  OBSTACLES,
  blocked,
  move,
  dist,
  routeTarget,
} from "../public/region.js";
import { vehicleBlocked, vehicleSize } from "../public/vehicle-collisions.js";
import { moveVehicle } from "../public/vehicle-motion.js";
import { Game } from "../public/simulation.js";
const all = [];
for (let x = -5; x <= 5; x++)
  for (let z = -5; z <= 5; z++) all.push(...treesInChunk(x, z));
const tree = all.find(
  (t) =>
    Math.abs(t.x) < 350 &&
    Math.abs(t.z) < 350 &&
    all.every((o) => o === t || dist(t, o) > 8) &&
    !vehicleBlocked({ kind: "car", heading: 0, x: t.x - 6, z: t.z }) &&
    !blocked({ x: t.x + 6, z: t.z }),
);
assert(tree, "isolated deterministic tree fixture");
const chunk = [Math.floor(tree.x / 64), Math.floor(tree.z / 64)];
assert(treesInChunk(...chunk).includes(tree));
assert(blocked(tree, 0.5), "tree trunk blocks without a renderer");
assert(
  !SCENERY.blocks({ x: tree.x + 1.5, z: tree.z }, 0.5),
  "walk below the leafy canopy beside the trunk",
);
for (const radius of [0.45, 0.5, 0.7]) {
  const p = { x: tree.x - 5, z: tree.z };
  move(p, 12, 0, radius);
  assert(
    p.x <= tree.x - tree.radius - radius + 0.01,
    "swept walking/animal movement cannot cross a trunk",
  );
}
const thin = { kind: "car", heading: 0, x: tree.x - 0.8, z: tree.z - 0.6 };
assert(
  vehicleBlocked(thin),
  "trunk inside hull is detected between the old nine sample points",
);
const size = vehicleSize(thin);
for (const x of [-size.halfLength, 0, size.halfLength])
  for (const z of [-size.halfWidth, 0, size.halfWidth])
    assert(
      !SCENERY.blocks({ x: thin.x + x, z: thin.z + z }, 0.12),
      "fixture specifically misses the old point samples",
    );
assert(
  !vehicleBlocked({ ...thin, y: 8 }),
  "airborne hull above trunk clears it",
);
const car = {
  kind: "car",
  heading: 0,
  x: tree.x - 6,
  z: tree.z,
  vx: 24,
  vz: 0,
};
moveVehicle(car, 0.5);
assert(car.x < tree.x - 1.8);
assert(car.wallDamage > 0, "hard tree impact damages hull");
assert(car.vx <= 0, "normal momentum rebounds on impact");
for (const type of [
  "crate",
  "counter",
  "rocket-stand",
  "gantry-leg",
  "flagpole",
  "fuel-pump",
  "canopy-post",
]) {
  const prop = SOLID_PROPS.find((p) => p.type === type);
  assert(prop, type + " exists");
  assert(SCENERY.blocks(prop, 0.4), type + " is solid");
}
const crate = SOLID_PROPS.find((p) => p.type === "crate");
assert(!SCENERY.blocks({ ...crate, y: 3 }, 0.4), "height clears a low crate");
const gas = OBSTACLES.find((b) => b.kind === "gas"),
  under = {
    kind: "car",
    heading: Math.PI / 2,
    x: gas.x,
    z: gas.z + (gas.front || 1) * 3,
  };
assert(!vehicleBlocked(under), "open gas forecourt is usable");
assert(
  vehicleBlocked({ ...under, y: 4.1 }),
  "overhead canopy collides at its own height",
);
assert(
  !SCENERY.blocks({ ...SPACEPORT, y: 4 }, 0.2, 0.2),
  "unbuilt wireframe is not solid",
);
assert(
  SCENERY.blocks({ ...SPACEPORT, y: 4, rocketParts: 1 }, 0.2, 0.2),
  "installed hull is solid above its stand",
);
assert(!SCENERY.blocks({ ...SPACEPORT, y: 8, rocketParts: 1 }, 0.2, 0.2));
assert(
  SCENERY.blocks({ ...SPACEPORT, y: 8, rocketParts: 5 }, 0.2, 0.2),
  "built capsule is solid",
);
{
  const g = new Game();
  g.phase = "heist";
  g.animals = [];
  g.vehicles = [];
  g.guards = [{ id: "g0", x: tree.x + 2, z: tree.z, hp: 2, armor: 2, down: 0 }];
  g.police = [];
  g.shots = [
    {
      x: tree.x - 2,
      z: tree.z,
      vx: 36,
      vz: 0,
      life: 1,
      owner: "player",
      power: 1,
    },
  ];
  g.updateShots(0.05);
  g.updateShots(0.05);
  assert.equal(g.guards[0].hp, 2, "tree protects an NPC from a projectile");
  assert.equal(g.shots.length, 0);
  Object.assign(g.player, { x: tree.x - 1.5, z: tree.z });
  g.guards[0].x = tree.x + 1.5;
  g.weapon = 0;
  g.cooldown = 0;
  g.attack();
  assert.equal(g.guards[0].hp, 2, "cannot swing through a trunk");
}
{
  const p = { x: tree.x - 5, z: tree.z },
    target = { x: tree.x + 5, z: tree.z };
  let reached = false;
  for (let i = 0; i < 1000; i++) {
    const q = routeTarget(p, target),
      d = dist(p, q);
    if (d) move(p, ((q.x - p.x) / d) * 0.08, ((q.z - p.z) / d) * 0.08, 0.5);
    if (dist(p, target) < 0.8) {
      reached = true;
      break;
    }
  }
  assert(reached, "followers route around a solid tree");
}
{
  const g = new Game();
  g.phase = "heist";
  g.animals = [];
  g.vehicles = [
    {
      id: 0,
      kind: "car",
      x: tree.x,
      z: tree.z - 3,
      heading: 0,
      disabled: 0,
      stolen: true,
      vx: 0,
      vz: 0,
    },
  ];
  g.vehicle = 0;
  g.addAnimal("sheep", 0, tree.x, tree.z);
  g.animals[0].following = true;
  g.animals[0].boarded = 0;
  g.interact();
  assert.equal(g.vehicle, null);
  assert(
    !blocked(g.player, 0.5),
    "exit avoids the trunk at the preferred door",
  );
  assert(!blocked(g.animals[0], 0.5), "unloaded animal avoids solid scenery");
}
assert(
  !blocked({ x: HOUSE.x, z: HOUSE.z + 5 }, 0.5),
  "house doorway stays clear",
);
assert(
  !vehicleBlocked({ x: -9, z: HOME.z + 7, heading: 0, kind: "van" }),
  "home van remains usable",
);
for (let x = -100; x <= 100; x++) treesInChunk(x, x);
assert(
  SCENERY.stats().cachedChunks <= 289,
  "tree collision cache is bounded by map area",
);
console.log(
  "PASS: deterministic offscreen trunks, swept people/animal and exact car collisions, impact damage, bullets, solid props, height clearance, built rocket parts, tree detours, doorway/van clearance and bounded cache.",
);
