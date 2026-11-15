import assert from "node:assert/strict";
import { Game } from "../public/simulation.js";
import {
  HOME,
  HOME_BARN,
  FARMS,
  road,
  blocked,
  dist,
  BASE_HEARTS,
} from "../public/region.js";
import { AIM_SECONDS, BULLET_SPEED, stepAim } from "../public/combat.js";
import { dispatchRoadblock, patrolStep } from "../public/police.js";
import { startFarmerChase } from "../public/farmers.js";
import { initVehicleHealth } from "../public/vehicle-damage.js";
import { VEHICLES } from "../public/vehicles.js";
const tick = (g, seconds, input = {}) => {
  for (let i = 0; i < seconds * 60; i++) g.update(1 / 60, input);
};
const isolated = () => {
  const g = new Game();
  g.phase = "heist";
  g.animals = [];
  g.vehicles = [];
  g.guards = [];
  g.police = [];
  g.civilians = [];
  g.updateOpponents = () => {};
  Object.assign(g.player, { x: 0, z: 0 });
  return g;
};
assert.equal(new Game().player.hp, 5);
assert.equal(
  new Game({ version: 1, phase: "heist", delivered: 0, maxHp: 3 }).player.maxHp,
  5,
  "old saves migrate to five hearts",
);
assert(VEHICLES.car.top > 32 && VEHICLES.sport.top > 43);
assert(VEHICLES.tractor);
assert(
  !road({ x: Math.SQRT1_2 * 100, z: Math.SQRT1_2 * 100 }),
  "outer ring removed",
);
assert(!road({ x: 20, z: -11 }), "inner ring removed");
assert(road({ x: 0, z: 0 }), "grid intersection is drivable");
{
  const g = new Game(),
    car = g.vehicles[0];
  Object.assign(g.player, { x: car.x, z: car.z });
  g.interact();
  assert.equal(g.vehicle, car.id);
  assert.equal(g.civilians.length, 1);
  assert(g.civilians[0].ragdoll, "moving car theft ejects its driver");
  assert(!car.occupied);
  g.vehicles = [car];
  g.guards = [];
  g.animals = [];
  g.police = [];
  g.updateOpponents = () => {};
  tick(g, 6);
  assert(!g.civilians[0].ragdoll, "driver recovers nonlethally");
}
{
  const g = isolated();
  g.weapon = 5;
  g.guards = [{ id: "target", x: 0, z: 18, down: 0, hp: 2, armor: 2 }];
  g.attack();
  assert(g.player.aim);
  assert.equal(g.shots.length, 0);
  const p = { ...g.player };
  tick(g, 0.25, { x: 1 });
  assert.equal(dist(g.player, p), 0, "stop to aim");
  assert.equal(g.shots.length, 0);
  tick(g, 0.04, { x: 1 });
  assert(!g.player.aim);
  assert.equal(g.player.attack.kind, "shoot");
  assert.equal(dist(g.player, p), 0, "recoil plants feet");
  assert(
    Math.abs(Math.hypot(g.shots[0].vx, g.shots[0].vz) - BULLET_SPEED) < 0.01,
  );
}
{
  const g = isolated(),
    f = FARMS[1];
  Object.assign(g.player, { x: f.x + 10, z: f.z });
  g.wanted = 1;
  const shooter = {
      id: "g1-0",
      farm: 1,
      weapon: 2,
      x: f.x - 5,
      z: f.z,
      hp: 2,
      armor: 2,
      down: 0,
      cooldown: 0,
      heading: 0,
    },
    friend = {
      id: "g1-1",
      farm: 1,
      weapon: 2,
      x: f.x + 2,
      z: f.z,
      hp: 2,
      armor: 2,
      down: 0,
      cooldown: 100,
      heading: 0,
    };
  g.guards = [shooter, friend];
  g.updateOpponents = Game.prototype.updateOpponents;
  g.updateOpponents(0.01);
  assert(!shooter.aim, "enemy holds fire behind a teammate");
  friend.z += 6;
  shooter.cooldown = 0;
  g.updateOpponents(0.01);
  assert(shooter.aim);
  g.time += AIM_SECONDS;
  stepAim(g, shooter);
  assert(g.shots.length);
  friend.x = f.x + 2;
  friend.z = f.z;
  g.updateShots(0.12);
  assert.equal(friend.hp, 1, "an ally entering the shot takes normal damage");
  assert.equal(shooter.hp, 2, "shooter ignores own projectile");
}
{
  const g = isolated();
  g.updateOpponents = Game.prototype.updateOpponents;
  g.wanted = 4;
  g.vehicles = [
    initVehicleHealth({
      id: 0,
      x: 0,
      z: -40,
      kind: "car",
      heading: 0,
      stolen: true,
      disabled: 0,
      vx: 12,
      vz: 0,
    }),
  ];
  g.vehicle = 0;
  Object.assign(g.player, { x: 0, z: -40 });
  g.updateOpponents(0.01);
  assert(
    g.vehicles.filter((v) => v.policeDriving && v.policeMode === "pursuit")
      .length >= 2,
    "high wanted sends car units",
  );
  assert(dispatchRoadblock(g));
  const block = g.vehicles.filter((v) => v.blockTarget);
  assert.equal(block.length, 2);
  const old = block.map((v) => ({ ...v }));
  for (let i = 0; i < 1800; i++) {
    g.time += 1 / 60;
    for (const car of block) if (car.policeDriving) patrolStep(g, car, 1 / 60);
  }
  assert(
    block.some(
      (v) => v.policeMode === "roadblock" && !v.policeDriving && v.policeActive,
    ),
    "roadblock is physically driven into position",
  );
  assert(
    block.every((v, i) => dist(v, old[i]) > 5),
    "no instant roadblock teleport",
  );
  Object.assign(g.player, HOME);
  g.vehicle = null;
  g.updateOpponents(0.01);
  assert.equal(g.wanted, 0);
  assert.equal(g.police.length, 0);
  assert(!g.vehicles.some((v) => v.policeActive));
}
{
  const g = isolated();
  const f = FARMS[1];
  Object.assign(g.player, { x: f.x - 10, z: f.z });
  startFarmerChase(g, 1);
  assert(g.vehicles.some((v) => v.kind === "tractor" && v.farmerDriving));
  assert(g.vehicles.some((v) => v.kind === "truck" && v.farmerDriving));
  const old = g.vehicles.map((v) => ({ ...v }));
  tick(g, 1);
  assert(
    g.vehicles.some((v, i) => dist(v, old[i]) > 2),
    "farmers drive after the stolen herd",
  );
  g.wanted = 0;
  Object.assign(g.player, HOME);
  tick(g, 0.05);
  assert(
    !g.vehicles.some((v) => v.farmerDriving),
    "farmer pursuit ends at home",
  );
}
{
  const g = isolated();
  Object.assign(g.player, HOME);
  for (let i = 0; i < 12; i++) {
    g.addAnimal(
      "sheep",
      0,
      ((i % 3) - 1) * 2,
      HOME.z + 3 + Math.floor(i / 3) * 2,
    );
    g.animals[i].following = true;
  }
  const animals = [...g.animals],
    crossed = new Set();
  tick(g, 1.1);
  assert(g.delivery);
  assert.equal(g.delivered, 0, "arrival alone earns no credit");
  for (let i = 0; i < 1500 && !g.delivered; i++) {
    g.update(1 / 60);
    for (const a of animals) if (a.barnGateCrossed) crossed.add(a.id);
  }
  assert.equal(g.delivered, 12);
  assert.equal(crossed.size, 12, "every animal physically passed the gate");
  assert.equal(g.money, 96);
  assert(
    !blocked({ x: HOME_BARN.x, z: HOME_BARN.z + HOME_BARN.hz }, 0.5),
    "barn gate is open",
  );
  assert(
    blocked({ x: HOME_BARN.x + 5, z: HOME_BARN.z + HOME_BARN.hz }, 0.5),
    "barn front wall is solid",
  );
}
{
  const g = isolated();
  g.wanted = 4;
  g.hurt = () => {};
  g.vehicles = [
    {
      id: 0,
      x: 0,
      z: 0,
      kind: "car",
      heading: 0,
      stolen: true,
      vx: 10,
      vz: 0,
      disabled: 0,
    },
    {
      id: 1,
      x: -5,
      z: 3,
      kind: "car",
      isPolice: true,
      heading: 0,
      policeDriving: true,
      policeMode: "pursuit",
      stolen: false,
      vx: 14,
      vz: 0,
      disabled: 0,
    },
  ].map((v) => initVehicleHealth({ ...v, health: 10000, maxHealth: 10000 }));
  g.vehicle = 0;
  let contacts = 0,
    ram = false,
    lateral = 0;
  for (let i = 0; i < 360; i++) {
    g.update(1 / 60, { x: 1 });
    contacts += g.vehicleContacts;
    ram ||= !!g.vehicles[1].ramming;
    lateral = Math.max(lateral, Math.abs(g.vehicles[0].z));
  }
  assert(ram, "pursuit changes from flanking to a shunt");
  assert(contacts > 0, "ram reaches real solid-body contact");
  assert(lateral > 0.05, "physical contact deflects the player car sideways");
}
{
  const g = isolated();
  g.vehicles = [
    initVehicleHealth({
      id: 0,
      x: 0,
      z: HOME.z + 8,
      kind: "bus",
      heading: 0,
      stolen: true,
      vx: 0,
      vz: 0,
      seats: 13,
      disabled: 0,
    }),
  ];
  g.vehicle = 0;
  Object.assign(g.player, { x: 0, z: HOME.z + 8 });
  for (let i = 0; i < 12; i++) {
    g.addAnimal("cow", 0, 0, 0);
    Object.assign(g.animals[i], {
      following: true,
      boarded: 0,
      origin: { x: 300, z: 100 },
    });
  }
  tick(g, 8);
  assert(
    g.animals.every((a) => a.boarded === null),
    "animals unload from a parked vehicle",
  );
  assert.equal(g.delivered, 0);
  tick(g, 28);
  assert.equal(
    g.delivered,
    12,
    "unloaded animals walk around the vehicle and through the barn gate",
  );
}
{
  const g = isolated();
  g.vehicles = [
    initVehicleHealth({
      id: 0,
      x: 0,
      z: 0,
      kind: "car",
      isPolice: true,
      policeActive: true,
      policeDriving: true,
      occupied: true,
      heading: 0,
      vx: 12,
      vz: 0,
      disabled: 0,
      seats: 4,
    }),
  ];
  g.police = [
    { id: "driver", x: 0, z: 0, down: 0, hp: 2, armor: 2, inVehicle: 0 },
  ];
  g.interact();
  assert.equal(g.vehicle, 0);
  assert(
    g.police[0].ragdoll,
    "moving patrol theft tumbles its officer out too",
  );
  assert(!g.vehicles[0].policeActive);
}
{
  const g = isolated();
  g.addAnimal("sheep", 0, 200, 0);
  Object.assign(g.animals[0], {
    delivering: true,
    following: true,
    barnStage: 1,
    barnWaypoints: [{ x: 0, z: 0 }],
  });
  g.delivery = { ids: [0], started: 0 };
  g.player.hp = 1;
  g.hurt();
  assert(g.jail);
  assert(!g.delivery);
  assert(!g.animals[0].delivering);
  assert.equal(g.animals[0].barnWaypoints.length, 0);
}
{
  const g = isolated(),
    f = FARMS[1];
  Object.assign(g.player, { x: f.x, z: f.z });
  startFarmerChase(g, 1);
  const cars = [...g.vehicles];
  Object.assign(g.player, HOME);
  tick(g, 0.05);
  Object.assign(g.player, { x: f.x, z: f.z });
  startFarmerChase(g, 1);
  assert.equal(
    g.vehicles.length,
    cars.length,
    "repeat raids reuse farmer vehicles without moving them",
  );
}
console.log(
  "PASS: grid roads, faster cars, theft tumbling/recovery, stationary aiming/recoil/fast shots, enemy fire discipline and accidental friendly fire, driven roadblocks, car patrols, home wanted reset, farmer tractors/trucks, barn gate deliveries and five hearts/save migration.",
);
