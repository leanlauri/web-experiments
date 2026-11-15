import { vehicleProfile } from "./vehicles.js?v=city-action-2";
import {
  FARMS,
  HOME,
  dist,
  routeTarget,
  clearPosition,
} from "./region.js?v=city-action-2";
import {
  vehicleBlocked,
  vehicleOverlap,
  circleVehicle,
} from "./vehicle-collisions.js?v=city-action-2";
import { initVehicleHealth } from "./vehicle-damage.js?v=city-action-2";
import { drive } from "./driving.js?v=city-action-2";
import { startTumble } from "./tumbles.js?v=city-action-2";
export function startFarmerChase(game, farmId) {
  if (game.atHome || game.chasedFarms.has(farmId)) return;
  game.chasedFarms.add(farmId);
  const farm = FARMS[farmId];
  for (let i = 0; i < 2; i++) {
    const r = 278 - i * 13,
      heading = farm.angle;
    const base = {
      x: Math.cos(farm.angle) * r - Math.sin(farm.angle) * 3,
      z: Math.sin(farm.angle) * r + Math.cos(farm.angle) * 3,
      heading,
      kind: i ? "tractor" : ["car", "truck", "pickup"][farmId % 3],
      isFarmer: true,
      farm: farmId,
      factionColor: farm.color,
    };
    let car = game.vehicles.find(
      (v) =>
        v.isFarmer &&
        v.farm === farmId &&
        v.kind === base.kind &&
        !v.farmerDriving &&
        !v.destroyed &&
        v.burnStarted === undefined &&
        v.id !== game.vehicle,
    );
    if (car) {
      Object.assign(car, {
        farmerDriving: true,
        stolen: false,
        occupied: true,
      });
    } else {
      if (
        game.vehicles.filter((v) => v.isFarmer).length >= 24 ||
        vehicleBlocked(base) ||
        game.vehicles.some((v) => vehicleOverlap(base, v))
      )
        continue;
      car = initVehicleHealth({
        ...base,
        id: game.vehicles.length,
        stolen: false,
        occupied: true,
        farmerDriving: true,
        disabled: 0,
        seats: vehicleProfile(base).seats,
        vx: Math.cos(heading) * 8,
        vz: Math.sin(heading) * 8,
      });
      game.vehicles.push(car);
    }
    game.guards.push({
      id: "farmer-" + car.id,
      farm: farmId,
      weapon: farmId % 2 ? 2 : 5,
      hp: 2,
      armor: 2,
      down: 0,
      cooldown: 1,
      chasing: true,
      chaseCarId: car.id,
      inVehicle: car.id,
      x: car.x,
      z: car.z,
      heading,
    });
  }
}
export function ejectFarmer(game, car, tumble = false) {
  for (const farmer of game.guards.filter((g) => g.inVehicle === car.id)) {
    const side = car.heading + Math.PI / 2,
      spot = clearPosition(
        { x: car.x + Math.cos(side) * 3, z: car.z + Math.sin(side) * 3 },
        0.6,
        game.level,
        (p) =>
          !game.vehicles.some(
            (v) => dist(v, p) < 12 && circleVehicle(p, v, 0.5),
          ),
      ) || { x: car.x + 3, z: car.z };
    Object.assign(farmer, spot, { inVehicle: undefined, y: car.y || 0 });
    if (tumble && Math.hypot(car.vx || 0, car.vz || 0) > 2) {
      startTumble(
        farmer,
        {
          x: (car.vx || 0) + Math.cos(side) * 5,
          z: (car.vz || 0) + Math.sin(side) * 5,
        },
        game.time,
      );
      farmer.down = 6;
    }
  }
  car.farmerDriving = false;
  car.stolen = true;
  car.occupied = false;
}
export function stepFarmer(game, car, dt) {
  if (game.atHome) {
    ejectFarmer(game, car);
    return;
  }
  const victim =
      game.vehicle === null ? game.player : game.vehicles[game.vehicle],
    d = dist(car, victim);
  if (!game.chasedFarms.has(car.farm) || car.burnStarted !== undefined) {
    ejectFarmer(game, car);
    return;
  }
  if (game.vehicle === null && d < 9) {
    car.vx = car.vz = 0;
    ejectFarmer(game, car);
    return;
  }
  const heading =
    game.vehicle === null
      ? game.player.heading
      : Math.atan2(
          victim.vz || Math.sin(victim.heading),
          victim.vx || Math.cos(victim.heading),
        );
  const target = {
    x: victim.x + Math.cos(heading) * (d < 14 ? 1 : 8),
    z: victim.z + Math.sin(heading) * (d < 14 ? 1 : 8),
  };
  const goal = d < 25 ? target : routeTarget(car, target),
    distance = dist(car, goal);
  drive(
    car,
    dt,
    {
      x: distance ? (goal.x - car.x) / distance : 0,
      z: distance ? (goal.z - car.z) / distance : 0,
    },
    game.level,
  );
}
export function endFarmerChases(game) {
  game.chasedFarms.clear();
  for (const car of game.vehicles.filter((v) => v.farmerDriving)) {
    car.farmerDriving = false;
    car.stolen = true;
    car.occupied = false;
    car.vx = car.vz = car.driveSpeed = car.currentSpeed = 0;
  }
  game.guards = game.guards.filter((g) => !g.chasing);
}
