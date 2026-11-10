import assert from "node:assert/strict";
import { Game } from "../public/simulation.js";
import {
  vehicleOverlap,
  resolveVehicleCollisions,
  vehiclePersonContact,
  circleVehicle,
  vehicleSize,
} from "../public/vehicle-collisions.js";
import { startTumble, stepTumble } from "../public/tumbles.js";
import { FARMS, HOME, dist } from "../public/region.js";
const make = (id, x, z, heading = 0, kind = "car") => ({
  id,
  x,
  z,
  heading,
  kind,
  vx: 0,
  vz: 0,
  dir: 1,
  disabled: 0,
  stolen: true,
  previous: { x, z, heading },
});
{
  const g = new Game();
  for (let i = 0; i < g.vehicles.length; i++)
    for (let j = i + 1; j < g.vehicles.length; j++)
      assert(
        !vehicleOverlap(g.vehicles[i], g.vehicles[j]),
        "initial traffic must not overlap",
      );
  const a = make(0, 180, 0),
    b = make(1, 182.7, 0);
  a.vx = 20;
  resolveVehicleCollisions([a, b], 1);
  assert(!vehicleOverlap(a, b), "cars separate on impact");
  assert(a.driveSpeed < 20);
  assert(b.driveSpeed > 0, "impact transfers momentum");
  const small = make(0, 180, 0, 0, "buggy"),
    large = make(1, 183.9, 0, 0, "bus");
  small.vx = 20;
  resolveVehicleCollisions([small, large], 1);
  assert(20 - small.vx > large.vx, "heavier vehicle changes velocity less");
  const sideA = make(0, 180, 0),
    sideB = make(1, 180, 2.1, Math.PI / 2);
  resolveVehicleCollisions([sideA, sideB], 1);
  assert(
    !vehicleOverlap(sideA, sideB),
    "side collision uses oriented rectangles",
  );
  const c = make(0, 184, 0),
    d = make(1, 180, 0);
  c.previous.x = 180;
  d.previous.x = 184;
  c.vx = 40;
  d.vx = -40;
  assert(!vehicleOverlap(c, d));
  assert(
    resolveVehicleCollisions([c, d], 1) > 0,
    "swept head-on crossing is caught",
  );
  assert(c.x < d.x, "cars cannot exchange sides by tunneling");
  const laneA = make(0, 180, -2),
    laneB = make(1, 180, 2, Math.PI);
  assert(!vehicleOverlap(laneA, laneB));
  assert.equal(
    resolveVehicleCollisions([laneA, laneB], 1),
    0,
    "opposing lanes remain separate",
  );
  const bus = make(0, 180, 0, Math.PI / 2, "bus");
  assert(circleVehicle({ x: 180, z: 3.2 }, bus, 0.5));
  assert(!circleVehicle({ x: 183, z: 0 }, bus, 0.5));
  assert(vehicleSize(bus).halfLength > vehicleSize(laneA).halfLength);
}
{
  const v = make(0, 185, 0);
  v.previous.x = 175;
  assert(
    vehiclePersonContact(v, { x: 180, z: 0 }, { x: 180, z: 0 }),
    "sweep catches people between endpoints",
  );
  assert(!vehiclePersonContact(v, { x: 180, z: 3 }, { x: 180, z: 3 }));
  assert(
    !vehiclePersonContact(v, { x: 180, z: 0, y: 4 }, { x: 180, z: 0, y: 4 }),
    "vertical miss",
  );
  const b = { x: 180, z: 0, heading: 0 };
  assert(startTumble(b, { x: 20, z: 0 }, 0));
  assert(!startTumble(b, { x: 20, z: 0 }, 0.1));
  let airborne = false,
    recovering = false,
    time = 0;
  for (let i = 0; i < 500 && b.ragdoll; i++) {
    time += 1 / 60;
    stepTumble(b, 1 / 60, time);
    airborne ||= b.y > 0.5;
    recovering ||= b.ragdoll?.phase === "recovering";
  }
  assert(airborne && recovering && !b.ragdoll);
  assert(b.starsUntil > time);
  assert(!startTumble(b, { x: 20, z: 0 }, time), "recovery immunity");
  assert(startTumble(b, { x: 20, z: 0 }, time + 2.1));
}
function trafficScenario(kind) {
  const g = new Game(),
    f = FARMS[0],
    t = 0.6;
  g.phase = "heist";
  g.animals = [];
  g.guards = [];
  g.police = [];
  const v = {
    ...make(
      0,
      f.x * t - Math.sin(f.angle) * 3,
      f.z * t + Math.cos(f.angle) * 3,
      f.angle,
    ),
    route: 0,
    t,
    dir: 1,
    speed: 24,
    stolen: false,
  };
  g.vehicles = [v];
  const target = {
    x: v.x + Math.cos(f.angle) * 2.8,
    z: v.z + Math.sin(f.angle) * 2.8,
    heading: 0,
    y: 0,
  };
  if (kind === "player") Object.assign(g.player, target);
  else {
    g.player.x = v.x - Math.sin(f.angle) * 8;
    g.player.z = v.z + Math.cos(f.angle) * 8;
    if (kind === "animal")
      g.animals = [
        {
          ...target,
          id: 0,
          type: "sheep",
          farm: 0,
          origin: { ...target },
          following: true,
          down: false,
          boarded: null,
          delivered: false,
          phase: 0,
        },
      ];
    else
      g.guards = [
        {
          ...target,
          id: "g0-0",
          farm: 0,
          down: 0,
          hp: 1,
          armor: 1,
          cooldown: 10,
        },
      ];
  }
  g.updateOpponents = () => {};
  return {
    g,
    body:
      kind === "player"
        ? g.player
        : kind === "animal"
          ? g.animals[0]
          : g.guards[0],
  };
}
for (const kind of ["player", "animal", "guard"]) {
  const { g, body } = trafficScenario(kind);
  g.update(0.05);
  assert(body.ragdoll, `${kind} is launched by traffic`);
  if (kind === "player") assert.equal(body.hp, 2, "one heart per impact");
  const wasFollowing = body.following;
  let sawAir = false;
  for (let i = 0; i < 420 && body.ragdoll; i++) {
    g.update(1 / 60, { x: 1 });
    sawAir ||= body.y > 0.5;
  }
  assert(sawAir);
  assert(!body.ragdoll, `${kind} eventually gets up`);
  assert(body.starsUntil > g.time);
  if (kind === "animal") {
    assert(!body.down);
    assert.equal(body.following, wasFollowing);
  }
}
{
  const { g, body } = trafficScenario("animal");
  g.update(0.05);
  g.player.x = body.x;
  g.player.z = body.z;
  g.revive();
  assert(!body.ragdoll && !body.down, "snack revives a tumbling animal");
  const h = trafficScenario("animal");
  h.g.update(0.05);
  h.g.player.x = HOME.x;
  h.g.player.z = HOME.z;
  h.g.arrive();
  assert(!h.body.ragdoll);
  assert.equal(h.body.y, 0, "farm reset clears airborne state");
  const j = trafficScenario("player");
  j.body.hp = 1;
  j.g.update(0.05);
  assert(j.g.jail > 0);
  assert(!j.body.ragdoll, "jail takes precedence over tumble");
}
{
  const g = new Game();
  g.phase = "heist";
  g.animals = [];
  g.guards = [];
  g.police = [];
  g.updateOpponents = () => {};
  g.vehicles = [make(0, 180, 0)];
  Object.assign(g.player, { x: 176, z: 0 });
  for (let i = 0; i < 120; i++) g.update(1 / 60, { x: 1 });
  assert(g.player.x < 178.01, "parked vehicle blocks walking through its body");
  assert(!g.player.ragdoll, "stationary car contact does not launch people");
  g.vehicles = [make(0, 180, 0), make(1, 185, 0)];
  g.vehicle = 0;
  Object.assign(g.player, { x: 180, z: 0 });
  g.vehicles[0].driveSpeed = 15;
  let crashed = false;
  for (let i = 0; i < 60; i++) {
    g.update(1 / 60, { x: 1 });
    crashed ||= g.vehicleContacts > 0;
    assert(!vehicleOverlap(...g.vehicles), "full game separates vehicles");
  }
  assert(crashed, "player car collides with parked cars");
}
console.log(
  "PASS: oriented solid cars, mass response, swept contacts, near misses, bus shape, airborne tumbles, recovery/stars/immunity, player hearts, guards, animals, snacks, farm reset and jail.",
);
