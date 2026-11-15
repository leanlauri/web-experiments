import assert from "node:assert/strict";
import { Game } from "../public/simulation.js";
import {
  damageVehicle,
  initVehicleHealth,
  FIRE_SECONDS,
} from "../public/vehicle-damage.js";
import {
  resolveVehicleCollisions,
  vehicleSize,
  vehiclePersonContact,
  vehicleOverlap,
} from "../public/vehicle-collisions.js";
import { freeVehicle, vehicleInertia } from "../public/vehicle-motion.js";
const car = (id, x, z = 0, kind = "car") =>
  initVehicleHealth({
    id,
    x,
    z,
    heading: 0,
    kind,
    stolen: true,
    disabled: 0,
    vx: 0,
    vz: 0,
    speed: 0,
    previous: { x, z, heading: 0 },
  });
const momentum = (cars) =>
  cars.reduce(
    (p, v) => ({
      x: p.x + (v.vx || 0) * vehicleSize(v).mass,
      z: p.z + (v.vz || 0) * vehicleSize(v).mass,
    }),
    { x: 0, z: 0 },
  );
const energy = (cars) =>
  cars.reduce(
    (p, v) =>
      p +
      0.5 * vehicleSize(v).mass * ((v.vx || 0) ** 2 + (v.vz || 0) ** 2) +
      0.5 * vehicleInertia(v) * (v.omega || 0) ** 2,
    0,
  );
const empty = () => {
  const g = new Game();
  g.phase = "heist";
  g.animals = [];
  g.guards = [];
  g.police = [];
  g.updateOpponents = () => {};
  Object.assign(g.player, { x: 230, z: 0 });
  return g;
};
const tick = (g, seconds) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) g.update(1 / 60);
};
{
  const a = car(0, 180),
    b = car(1, 182.8);
  a.vx = 20;
  const before = momentum([a, b]),
    e = energy([a, b]);
  resolveVehicleCollisions([a, b], 0);
  const after = momentum([a, b]);
  assert(Math.abs(after.x - before.x) < 1e-6);
  assert(Math.abs(after.z - before.z) < 1e-6);
  assert(energy([a, b]) <= e + 0.001);
  assert(!vehicleOverlap(a, b));
  const x = b.x;
  freeVehicle(b, 1 / 60, 1 / 60);
  assert(b.x > x, "struck parked car continues moving on the next frame");
  const c = car(0, 180),
    d = car(1, 182.9, 1);
  c.vx = 20;
  resolveVehicleCollisions([c, d], 0);
  assert(
    Math.abs(c.omega || 0) + Math.abs(d.omega || 0) > 0.1,
    "off-centre collisions create angular momentum",
  );
}
{
  const g = empty();
  g.vehicles = [car(0, 180), car(1, 184)];
  g.vehicles[0].vx = 20;
  g.vehicle = 0;
  Object.assign(g.player, { x: 180, z: 0 });
  let crashed = false;
  for (let i = 0; i < 30; i++) {
    g.update(1 / 60);
    crashed ||= g.vehicleContacts > 0;
  }
  assert(crashed);
  assert(
    g.vehicles[1].x > 184.5,
    "full simulation preserves parked car momentum",
  );
  assert(
    g.vehicles[1].health < g.vehicles[1].maxHealth,
    "crashes damage hulls",
  );
}
{
  const g = empty();
  const v = car(0, 180);
  g.vehicles = [v];
  g.vehicle = 0;
  Object.assign(g.player, { x: 180, z: 0 });
  g.animals = [
    {
      id: 0,
      type: "sheep",
      farm: 0,
      x: 180,
      z: 0,
      hp: 3,
      following: true,
      boarded: 0,
      down: false,
      origin: { x: 330, z: 0 },
    },
  ];
  g.shots = [
    { x: 177, z: 0, vx: 36, vz: 0, owner: "enemy", power: 1, life: 1 },
  ];
  for (let i = 0; i < 10; i++) g.updateShots(1 / 60);
  assert(v.health < v.maxHealth);
  assert.equal(g.player.hp, 3);
  assert(!g.animals[0].down);
  assert.equal(g.animals[0].hp, 3, "vehicle protects passengers from bullets");
}
{
  const g = empty(),
    v = car(0, 180);
  g.vehicles = [v, car(1, 185), car(2, 220)];
  g.vehicle = 0;
  Object.assign(g.player, { x: 180, z: 0 });
  const sheep = {
    id: 0,
    type: "sheep",
    farm: 0,
    x: 180,
    z: 0,
    hp: 3,
    following: true,
    boarded: 0,
    down: false,
    origin: { x: 330, z: 0 },
  };
  g.animals = [sheep];
  const guard = {
    id: "g0-0",
    x: 185,
    z: 2,
    hp: 3,
    armor: 3,
    down: 0,
    heading: 0,
  };
  g.guards = [guard];
  const farHealth = g.vehicles[2].health;
  g.damageCar(v, v.maxHealth);
  assert(v.burnStarted !== undefined);
  assert(!v.destroyed);
  tick(g, 4.9);
  assert(!v.destroyed, "zero-health car still burns for the full countdown");
  assert.equal(g.player.hp, 3, "fire does not directly shoot the player");
  tick(g, 0.12);
  assert(v.destroyed);
  assert.equal(g.explosions.length, 1);
  assert.equal(g.vehicle, null);
  assert.equal(g.player.hp, 1);
  assert(g.player.ragdoll);
  assert.equal(sheep.boarded, null);
  assert(sheep.ragdoll && sheep.hp < 3);
  assert(guard.ragdoll && guard.hp < 3);
  assert(g.vehicles[1].health < g.vehicles[1].maxHealth);
  assert((g.vehicles[1].vy || 0) > 0 || (g.vehicles[1].y || 0) > 0);
  assert.equal(g.vehicles[2].health, farHealth);
  assert.equal(v.health, 0);
  assert((v.y || 0) > 0, "exploding wreck gets thrown into the air");
}
{
  const g = empty();
  g.vehicles = [car(0, 180), car(1, 185)];
  damageVehicle(g.vehicles[1], g.vehicles[1].maxHealth * 0.65, 0);
  g.damageCar(g.vehicles[0], 999);
  tick(g, FIRE_SECONDS + 0.02);
  assert(g.vehicles[0].destroyed);
  assert(!g.vehicles[1].destroyed);
  assert(g.vehicles[1].burnStarted !== undefined);
  tick(g, 4.8);
  assert(!g.vehicles[1].destroyed);
  tick(g, 0.25);
  assert(
    g.vehicles[1].destroyed,
    "chain reaction gets a separate five-second fuse",
  );
}
{
  const g = empty(),
    v = car(0, 180);
  v.stolen = false;
  v.vx = 6;
  v.vz = 4;
  v.omega = 1;
  v.physicsUntil = 2;
  v.crashRecovering = true;
  g.vehicles = [v];
  const heading = v.heading;
  for (let i = 0; i < 5; i++) g.update(1 / 60);
  assert(
    v.x > 180 && v.z > 0,
    "traffic retains a collision impulse across frames",
  );
  assert(v.vz > 3, "traffic AI cannot erase sideways velocity");
  assert(v.heading > heading, "traffic retains angular momentum");
}
{
  const flying = car(0, 180);
  flying.y = 5;
  flying.previous = { x: 178, z: 0, y: 5, heading: 0 };
  assert(
    !vehiclePersonContact(
      flying,
      { x: 180, z: 0, y: 0 },
      { x: 180, z: 0, y: 0 },
    ),
    "airborne car cannot hit people below its hull",
  );
}
console.log(
  "PASS: momentum/energy and off-centre spin, persistent motion, impact damage, bullet armor/passengers, five-second fire, blast falloff/ejection/health/flight, wrecks and chain-reaction fuses.",
);
