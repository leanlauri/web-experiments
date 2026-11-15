import assert from "node:assert/strict";
import { Game } from "../public/simulation.js";
import {
  HOME,
  FARMS,
  WEAPONS,
  PARTS,
  road,
  water,
  blocked,
  dist,
  farmGate,
  COUNTRY_ROADS,
  routeTarget,
} from "../public/region.js";
const tick = (g, seconds, input = {}) => {
  for (let i = 0; i < seconds * 60; i++) g.update(1 / 60, input);
};
const unlock = (g) => {
  g.phase = "heist";
  g.introDelivered = 12;
  g.animals.filter((a) => a.farm === -1).forEach((a) => (a.delivered = true));
};
const at = (g, p) => Object.assign(g.player, { x: p.x, z: p.z });
const recruit = (g, f, n = 5) => {
  unlock(g);
  const animals = g.animals.filter((a) => a.farm === f).slice(0, n);
  animals.forEach((a) => (a.following = true));
  return animals;
};
const home = (g, animals) => {
  at(g, HOME);
  animals.forEach((a, i) => {
    a.x = HOME.x + i * 0.5;
    a.z = HOME.z + 3;
  });
  g.homeInside = false;
  g.homeTimer = 0;
  tick(g, 25);
};
assert.equal(FARMS.length, 6);
for (const f of FARMS) {
  assert(road(f));
  assert(!water(f));
  assert(!blocked(farmGate(f)));
  const angle = f.angle + Math.PI / 6;
  assert(water({ x: Math.cos(angle) * 200, z: Math.sin(angle) * 200 }));
  assert(!water({ x: Math.cos(angle) * 100, z: Math.sin(angle) * 100 }));
}
for (const road of COUNTRY_ROADS)
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1],
      b = road.points[i],
      length = dist(a, b);
    for (
      let d = 0;
      d < length - (i === road.points.length - 1 ? 45 : 0);
      d += 2
    )
      assert(
        !blocked({
          x: a.x + ((b.x - a.x) * d) / length,
          z: a.z + ((b.z - a.z) * d) / length,
        }),
        "country approach stays clear",
      );
  }
{
  const g = new Game();
  assert.equal(g.animals.filter((a) => a.farm === -1).length, 12);
  for (const a of g.animals.filter((a) => a.farm === -1)) {
    at(g, a);
    g.update(1 / 60);
  }
  assert.equal(g.herd.length, 12);
  at(g, { x: 0, z: -165 });
  tick(g, 10);
  at(g, { x: 0, z: -185 });
  tick(g, 25);
  assert.equal(g.phase, "heist");
  assert.equal(g.introDelivered, 12);
  assert.equal(g.money, 60);
  assert(g.shop);
}
{
  const g = new Game();
  unlock(g);
  const a = g.animals.find((a) => a.farm === 0);
  at(g, a);
  g.update(1 / 60);
  assert(g.wanted > 0);
  assert(g.herd.length > 0);
  const b = g.animals.find((a) => a.farm === 1);
  at(g, b);
  g.update(1 / 60);
  assert(!b.following, "only one species");
}
{
  const g = new Game();
  const animals = recruit(g, 1, 9);
  at(g, { x: 0, z: 130 });
  animals.forEach((a, i) => {
    a.x = i * 0.3;
    a.z = 132;
  });
  const v = g.vehicles[2];
  Object.assign(v, { x: 1, z: 130, seats: 7 });
  g.interact();
  assert.equal(g.vehicle, v.id);
  assert.equal(g.herd.filter((a) => a.boarded === v.id).length, 6);
  assert(g.wanted >= 1);
  g.interact();
  assert.equal(g.vehicle, null);
  assert(g.herd.every((a) => a.boarded === null));
}
{
  const g = new Game();
  const animals = recruit(g, 2, 7);
  animals[0].down = true;
  g.player.x = animals[0].x;
  g.player.z = animals[0].z;
  g.revive();
  assert(!animals[0].down);
  assert.equal(g.revives, 2);
  animals[0].down = true;
  home(g, animals);
  assert.equal(g.delivered, 6);
  assert.equal(g.money, 48);
  assert.equal(g.heists, 1);
  assert.equal(g.herd.length, 0);
  assert(
    g.animals.filter((a) => a.farm === 2).every((a) => !a.down && !a.following),
  );
  assert.equal(g.player.hp, g.player.maxHp);
}
{
  const g = new Game();
  unlock(g);
  g.wanted = 3;
  at(g, { x: 420, z: -420 });
  g.police = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    x: 0,
    z: 0,
    down: 100,
    hp: 2,
    armor: 2,
    cooldown: 0,
  }));
  tick(g, 37);
  assert.equal(g.wanted, 0);
  assert.equal(g.police.length, 0);
}
{
  const g = new Game();
  const animals = recruit(g, 0);
  for (let i = 0; i < g.player.maxHp; i++) {
    g.player.invulnerable = 0;
    g.hurt();
  }
  assert.equal(g.jail, 5);
  assert.equal(g.herd.length, 0);
  tick(g, 5.1);
  assert.equal(g.jail, 0);
  assert.equal(g.player.hp, g.player.maxHp);
  assert(g.atHome);
  assert(animals.every((a) => !a.down && !a.following));
}
{
  const g = new Game();
  unlock(g);
  at(g, HOME);
  g.money = 500;
  g.delivered = 56;
  for (let i = 1; i < WEAPONS.length; i++) assert(g.buy(i));
  assert(g.buy("heart"));
  assert.equal(g.player.maxHp, 6);
  assert(!g.buy("heart"), "insufficient cash");
  for (const p of PARTS) assert(g.buy("part"));
  assert.equal(g.parts, 5);
  g.launch();
  assert.equal(g.phase, "launch");
  tick(g, 10);
  assert.equal(g.phase, "credits");
  const restored = new Game(g.lastSaved);
  assert.equal(restored.parts, 5);
  assert.equal(restored.player.maxHp, 6);
  assert.equal(restored.delivered, 56);
}
{
  const g = new Game();
  unlock(g);
  g.heists = 8;
  g.refreshGuards();
  assert.equal(g.guards.length, 36);
  assert(g.guards.every((a) => a.armor === 2));
  g.player.x = 200;
  g.player.z = 0;
  const v = g.vehicles[0];
  Object.assign(v, { x: 220, z: 30, stolen: true, currentSpeed: 0 });
  const a = g.animals.find((a) => a.farm === 0);
  Object.assign(a, { x: 202, z: 0, following: true });
  g.shots.push({
    x: 201,
    z: 0,
    vx: 36,
    vz: 0,
    life: 1,
    owner: "player",
    power: 1,
  });
  g.updateShots(0.05);
  assert(a.down, "projectiles can knock out animals");
}
// Exercise complete walking routes through every real farm gate and town road.
for (const f of FARMS) {
  const g = new Game();
  unlock(g);
  g.guards.forEach((a) => (a.down = 10000));
  g.vehicles = []; // Navigation is independent of traffic, which has a dedicated simulation test.
  at(g, { x: f.x - 8, z: f.z + 8 });
  g.animals.forEach((a) => (a.delivered = a.farm !== f.id));
  g.animals
    .filter((a) => a.farm === f.id)
    .slice(0, 6)
    .forEach((a) => (a.following = true));
  // Isolate navigation from combat; all movement, collision and flock logic stay real.
  g.chasedFarms = new Set(FARMS.map((f) => f.id));
  g.updateOpponents = () => {};
  for (const target of [farmGate(f), { x: 0, z: 0 }, { x: 0, z: -185 }]) {
    let steps = 0;
    while (dist(g.player, target) > 1 && steps++ < 12000) {
      const waypoint = routeTarget(g.player, target),
        d = dist(g.player, waypoint) || 1;
      g.update(1 / 60, {
        x: (waypoint.x - g.player.x) / d,
        z: (waypoint.z - g.player.z) / d,
      });
    }
    assert(steps < 12000, `${f.name}: route must make progress`);
  }
  tick(g, 25);
  assert(
    g.delivered >= 6,
    `${f.name}: followers must reach home through its gate`,
  );
  const paid = g.money;
  tick(g, 10);
  assert.equal(g.money, paid, "no repeat payment for the same trip");
}
{
  const g = new Game();
  unlock(g);
  at(g, { x: 200, z: 0 });
  g.vehicle = 0;
  Object.assign(g.vehicles[0], {
    x: 200,
    z: 0,
    heading: 0,
    stolen: true,
    driveSpeed: 18,
  });
  const a = g.animals.find((a) => a.farm === 0);
  Object.assign(a, { x: 202, z: 0, following: true });
  g.update(0.05, { x: 1 });
  assert(a.down, "driving into an animal causes sleep");
  const h = new Game();
  h.revives = 0;
  at(h, HOME);
  h.arrive();
  assert.equal(
    h.revives,
    3,
    "opening cannot deadlock from running out of revival supplies",
  );
}
console.log(
  "PASS: six connected farms, rivers/bridges, original opening, species rule, vehicle seats, crime, revival, deliveries, reset, escape, jail, shop, defense scaling, save/load, moon ending, friendly fire.",
);
