import assert from "node:assert/strict";
import { Game } from "../public/simulation.js";
import {
  OBSTACLES,
  TOWN_STREETS,
  HOME,
  WEAPONS,
  OPENING_REWARD,
  road,
  blocked,
  move,
  routeTarget,
  dist,
} from "../public/region.js";
import { VEHICLES, vehicleProfile } from "../public/vehicles.js";
import { vehicleSize } from "../public/vehicle-collisions.js";
const buildings = OBSTACLES.filter((b) => b.type === "town");
assert(buildings.length >= 40);
for (const kind of ["house", "shop", "gas", "warehouse"])
  assert(buildings.some((b) => b.kind === kind));
assert(TOWN_STREETS.length >= 10);
for (const s of TOWN_STREETS)
  for (let t = 0; t <= 1; t += 0.05) {
    const p = {
      x: s.a.x + (s.b.x - s.a.x) * t,
      z: s.a.z + (s.b.z - s.a.z) * t,
    };
    assert(road(p));
    assert(!blocked(p), "town streets must remain traversable");
  }
{
  const g = new Game();
  assert.equal(g.weapon, 0);
  assert.deepEqual(g.owned, [0]);
  g.animals
    .filter((a) => a.farm === -1)
    .forEach((a) => {
      a.following = true;
      a.x = HOME.x;
      a.z = HOME.z;
    });
  Object.assign(g.player, HOME);
  g.arrive();
  for (let i = 0; i < 1800 && g.phase !== "heist"; i++) g.update(1 / 60);
  assert.equal(g.money, OPENING_REWARD);
  const pistol = WEAPONS.findIndex((w) => w.name === "Foam pistol");
  assert(OPENING_REWARD >= WEAPONS[pistol].cost);
  assert(g.buy(pistol));
  assert(g.owned.includes(pistol));
  assert.equal(g.money, 10);
  g.shop = false;
  g.attack();
  assert.equal(g.player.attack.kind, "aim");
  assert.equal(g.shots.length, 0);
  for (let i = 0; i < 18; i++) g.update(1 / 60);
  assert.equal(g.player.attack.kind, "shoot");
  assert.equal(g.shots[0].owner, "player");
  g.cooldown = 0;
  g.weapon = 0;
  g.attack();
  assert.equal(g.player.attack.kind, "melee");
}
{
  assert(Object.keys(VEHICLES).length >= 8);
  const g = new Game();
  for (const k of Object.keys(VEHICLES)) {
    assert(g.vehicles.some((v) => v.kind === k));
    const v = g.vehicles.find((v) => v.kind === k);
    assert.equal(v.seats, vehicleProfile(v).seats);
    assert.equal(vehicleSize(v).mass, vehicleProfile(v).mass);
  }
  assert(VEHICLES.sport.top > VEHICLES.truck.top);
  assert(VEHICLES.sport.acceleration > VEHICLES.truck.acceleration);
  assert(VEHICLES.truck.mass > VEHICLES.car.mass);
  assert(VEHICLES.truck.seats > VEHICLES.sport.seats);
  assert(new Set(Object.values(VEHICLES).map((v) => v.pitch)).size >= 6);
}
// A follower must navigate around a town building rather than repeatedly push into a wall.
{
  const b = buildings.find(
    (b) =>
      b.kind === "house" &&
      !blocked({ x: b.x - b.hx - 3, z: b.z }) &&
      !blocked({ x: b.x + b.hx + 3, z: b.z }),
  );
  const p = { x: b.x - b.hx - 3, z: b.z },
    target = { x: b.x + b.hx + 3, z: b.z };
  let steps = 0;
  while (dist(p, target) > 3 && steps++ < 2000) {
    const q = routeTarget(p, target),
      d = dist(p, q);
    if (d) move(p, ((q.x - p.x) / d) * 0.12, ((q.z - p.z) / d) * 0.12, 0.45);
  }
  assert(steps < 2000, "town pathfinding routes a follower around buildings");
}
console.log(
  "PASS: 48-building town, rectangular connected streets, opening club/pistol purchase, attack state, nine vehicle profiles/capacities/masses/tones and town follower routing.",
);
