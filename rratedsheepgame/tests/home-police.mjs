import assert from "node:assert/strict";
import {
  Game,
  NPC_KNOCKOUT_SECONDS,
  EXIT_ROLL_SPEED,
} from "../public/simulation.js";
import { HOUSE, HOME, inHouse, blocked, dist } from "../public/region.js";
import { HERD_SPACING } from "../public/herding.js";
import { startTumble, stepTumble } from "../public/tumbles.js";
const tick = (g, seconds, input = {}) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) g.update(1 / 60, input);
};
const isolated = () => {
  const g = new Game();
  g.phase = "heist";
  g.animals = [];
  g.guards = [];
  g.police = [];
  g.vehicles = [];
  Object.assign(g.player, { x: 180, z: 0 });
  return g;
};
{
  const g = isolated(),
    guard = { id: "g0", x: 200, z: 0, hp: 1, armor: 1, down: 0, heading: 0 };
  g.guards = [guard];
  g.updateOpponents = () => {};
  g.hitGuard(guard, 1);
  assert.equal(guard.down, 12 * 5);
  assert.equal(NPC_KNOCKOUT_SECONDS, 60);
  // Exercise the real timer separately from guard movement/combat.
  g.updateOpponents = Game.prototype.updateOpponents;
  tick(g, 59);
  assert(guard.down > 0);
  tick(g, 1.1);
  assert.equal(guard.down, 0);
}
{
  const g = isolated();
  const guard = { id: 0, x: 180, z: 0, hp: 1, armor: 1, down: 0 };
  g.hitGuard(guard, 1);
  startTumble(guard, { x: 10, z: 0 }, g.time);
  guard.down = 6;
  for (let i = 0; i < 360; i++) stepTumble(guard, 1 / 60, i / 60);
  assert(!guard.ragdoll);
  assert(
    guard.down > 50,
    "traffic recovery cannot end a weapon knockout early",
  );
}
{
  const g = isolated();
  Object.assign(g.player, { x: HOUSE.x, z: HOUSE.z + 8 });
  assert(!inHouse(g.player));
  assert(!blocked({ x: HOUSE.x, z: HOUSE.z + 5 }, 0.5), "open doorway");
  assert(
    blocked({ x: HOUSE.x + 3, z: HOUSE.z + 5 }, 0.5),
    "front wall stays solid",
  );
  tick(g, 1, { z: -1 });
  assert(g.shop, "walking into the house opens the workshop");
  assert(inHouse(g.player));
  g.shop = false;
  tick(g, 0.3);
  assert(!g.shop, "closing inside does not immediately reopen");
  tick(g, 1, { z: 1 });
  assert(!inHouse(g.player));
  tick(g, 1, { z: -1 });
  assert(g.shop, "shop opens on a later entry");
}
{
  const g = isolated();
  g.vehicles = [
    {
      id: 0,
      x: 180,
      z: 0,
      heading: 0,
      kind: "car",
      stolen: true,
      disabled: 0,
      vx: EXIT_ROLL_SPEED + 4,
      vz: 0,
      currentSpeed: EXIT_ROLL_SPEED + 4,
    },
  ];
  g.vehicle = 0;
  g.interact();
  assert(g.player.exitRoll);
  assert.equal(g.player.hp, 5);
  assert.equal(g.player.starsUntil, 0);
  assert(g.vehicles[0].vx > 0, "car keeps coasting");
  const old = { ...g.player };
  tick(g, 1);
  assert(!g.player.exitRoll);
  assert.equal(g.player.hp, 5);
  assert(!g.player.ragdoll);
  assert.equal(g.player.starsUntil, 0);
  assert(dist(old, g.player) > 1, "roll moves with exit momentum");
}
{
  const g = isolated();
  g.wanted = 1;
  g.police = [
    {
      id: "p0",
      x: 185,
      z: 0,
      down: 0,
      hp: 2,
      armor: 2,
      heading: 0,
      cooldown: 0,
    },
    {
      id: "p1",
      x: 190,
      z: 4,
      down: 0,
      hp: 2,
      armor: 2,
      heading: 0,
      cooldown: 0,
    },
  ];
  const old = { ...g.police[1] };
  tick(g, 1);
  assert.equal(g.shots.length, 0, "one-star officers never shoot");
  assert(dist(old, g.police[1]) <= 2.9, "one-star pursuit is walking pace");
  assert.equal(g.vehicles.length, 0, "one-star pursuit stays on foot");
}
{
  const g = new Game();
  g.phase = "heist";
  g.animals = [];
  g.guards = [];
  Object.assign(g.player, { x: 65, z: 15 });
  g.wanted = 2;
  g.hurt = () => {};
  g.updateOpponents(1 / 60);
  const car = g.vehicles.find((v) => v.policeDriving);
  assert(car, "higher wanted level dispatches a car");
  const riders = g.police.filter((p) => p.inVehicle === car.id);
  assert.equal(riders.length, 2);
  const old = { ...car };
  tick(g, 1);
  assert(dist(car, old) > 0.5, "patrol drives toward the scene");
  tick(g, 20);
  assert(
    riders.every((p) => p.inVehicle === undefined),
    "officers disembark",
  );
  g.wanted = 1;
  g.shots = [];
  tick(g, 0.5);
  assert(
    !g.vehicles.some((v) => v.policeDriving),
    "dropping to one star returns police to foot patrol",
  );
  assert.equal(g.shots.length, 0);
  assert.equal(car.seats, 4, "patrol cars have usable passenger seats");
  for (const other of g.vehicles)
    if (other !== car) Object.assign(other, { x: 440, z: 400 });
  Object.assign(g.player, { x: car.x + 3, z: car.z });
  g.addAnimal("sheep", 0, car.x + 3, car.z + 2);
  g.animals[0].following = true;
  g.interact();
  assert.equal(g.vehicle, car.id, "parked patrol car can be hijacked");
  assert.equal(
    g.animals[0].boarded,
    car.id,
    "herd can use patrol passenger seats",
  );
}
for (const type of ["sheep", "cow", "rabbit"]) {
  const g = isolated();
  Object.assign(g.player, { x: 180, z: 0, heading: 0 });
  for (let i = 0; i < 9; i++)
    g.addAnimal(type, 0, 177 + (i % 3) * 0.4, (Math.floor(i / 3) - 1) * 0.4);
  g.animals.forEach((a) => (a.following = true));
  g.updateOpponents = () => {};
  tick(g, 8);
  let closest = Infinity;
  for (let i = 0; i < g.animals.length; i++)
    for (let j = i + 1; j < g.animals.length; j++)
      closest = Math.min(closest, dist(g.animals[i], g.animals[j]));
  assert(
    closest >= HERD_SPACING[type] * 0.85,
    type + " herd must have visible spacing",
  );
}
console.log(
  "PASS: 60-second NPC knockouts, solid house/open doorway/shop re-entry, painless fast-exit roll, coasting car, walking/unarmed one-star police, patrol arrivals/disembarkation, and species-sized herd spacing.",
);
