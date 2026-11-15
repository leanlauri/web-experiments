import { dist, blocked, routeTarget } from "./region.js?v=console-menu-1";
import {
  trafficPose,
  nearestTrafficDistance,
} from "./traffic.js?v=console-menu-1";
import {
  vehicleBlocked,
  vehicleOverlap,
} from "./vehicle-collisions.js?v=console-menu-1";
import { initVehicleHealth } from "./vehicle-damage.js?v=console-menu-1";
import { drive } from "./driving.js?v=console-menu-1";
import { POLICE_VEHICLE } from "./vehicles.js?v=console-menu-1";
export const FIRST_WANTED_WALK_SPEED = 2.8;
export function createOfficer(game, position, vehicle) {
  return {
    id: "p" + game.time + "-" + game.police.length,
    x: position.x,
    z: position.z,
    heading: position.heading || 0,
    down: 0,
    hp: 2,
    armor: 2,
    cooldown: 2,
    inVehicle: vehicle,
  };
}
export function disembarkPatrol(game, car) {
  const riders = game.police.filter((p) => p.inVehicle === car.id);
  riders.forEach((officer, i) => {
    let position = null;
    for (let j = 0; j < 12; j++) {
      const a =
        car.heading + Math.PI / 2 + (i % 2 ? Math.PI : 0) + (j * Math.PI) / 6;
      const p = {
        x: car.x + Math.cos(a) * (2.7 + Math.floor(j / 6)),
        z: car.z + Math.sin(a) * (2.7 + Math.floor(j / 6)),
      };
      if (
        !blocked(p, 0.6) &&
        !game.vehicles.some((v) => v !== car && dist(v, p) < 2)
      ) {
        position = p;
        break;
      }
    }
    position ??= { x: car.x + 3, z: car.z };
    officer.x = position.x;
    officer.z = position.z;
    officer.y = car.y || 0;
    officer.inVehicle = undefined;
  });
  car.policeDriving = false;
  car.stolen = true;
  car.occupied = false;
  car.policeActive = false;
}
export function spawnPatrol(game, count) {
  const reusable = game.vehicles.find(
    (v) =>
      v.isPolice &&
      !v.policeActive &&
      !v.destroyed &&
      v.burnStarted === undefined &&
      dist(v, game.player) > 60 &&
      (v.y || 0) < 0.1,
  );
  let car = reusable;
  if (!car && game.vehicles.filter((v) => v.isPolice).length >= 6) return false;
  if (!car) {
    const nearest = nearestTrafficDistance(game.player);
    let pose;
    for (let i = 0; i < 24; i++) {
      const p = trafficPose(
        nearest + (i % 2 ? 1 : -1) * (70 + Math.floor(i / 2) * 30),
      );
      const v = { ...p, kind: "car", isPolice: true };
      if (
        dist(p, game.player) < 65 ||
        dist(p, game.player) > 140 ||
        vehicleBlocked(v) ||
        game.vehicles.some((other) => vehicleOverlap(v, other))
      )
        continue;
      pose = p;
      break;
    }
    if (!pose) return false;
    car = initVehicleHealth({
      id: game.vehicles.length,
      ...pose,
      kind: "car",
      isPolice: true,
      seats: POLICE_VEHICLE.seats,
      speed: POLICE_VEHICLE.top,
      vx: 0,
      vz: 0,
      disabled: 0,
      stolen: true,
      occupied: true,
    });
    game.vehicles.push(car);
  }
  car.policeDriving = true;
  car.stolen = false;
  car.policeActive = true;
  car.occupied = true;
  car.arrivalAge = 0;
  car.arrivalStall = 0;
  for (let i = 0; i < count; i++)
    game.police.push(createOfficer(game, car, car.id));
  return true;
}
export function patrolStep(game, car, dt) {
  car.arrivalAge = (car.arrivalAge || 0) + dt;
  if (
    game.wanted <= 1 ||
    dist(car, game.player) < 18 ||
    car.arrivalAge > 18 ||
    car.burnStarted !== undefined
  ) {
    disembarkPatrol(game, car);
    return;
  }
  const target = routeTarget(car, game.player),
    distance = dist(car, target),
    old = { x: car.x, z: car.z };
  drive(
    car,
    dt,
    {
      x: distance ? ((target.x - car.x) / distance) * 0.65 : 0,
      z: distance ? ((target.z - car.z) / distance) * 0.65 : 0,
    },
    game.level,
  );
  car.arrivalStall = dist(old, car) < 0.025 ? (car.arrivalStall || 0) + dt : 0;
  if (car.arrivalStall > 2.5) disembarkPatrol(game, car);
}
