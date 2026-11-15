import { startTumble } from "./tumbles.js?v=town-blocks-1";
import {
  dist,
  blocked,
  routeTarget,
  HOME,
  road,
} from "./region.js?v=town-blocks-1";
import {
  trafficPose,
  nearestTrafficDistance,
} from "./traffic.js?v=town-blocks-1";
import {
  vehicleBlocked,
  vehicleOverlap,
} from "./vehicle-collisions.js?v=town-blocks-1";
import { initVehicleHealth } from "./vehicle-damage.js?v=town-blocks-1";
import { drive } from "./driving.js?v=town-blocks-1";
import { POLICE_VEHICLE } from "./vehicles.js?v=town-blocks-1";
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
    weapon: 5,
    inVehicle: vehicle,
  };
}
export function disembarkPatrol(game, car, parked = false, tumble = false) {
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
    if (tumble && Math.hypot(car.vx || 0, car.vz || 0) > 2) {
      const side = car.heading + Math.PI / 2 + (i % 2 ? Math.PI : 0);
      startTumble(
        officer,
        {
          x: (car.vx || 0) + Math.cos(side) * 5,
          z: (car.vz || 0) + Math.sin(side) * 5,
        },
        game.time,
      );
      officer.down = 6;
    }
  });
  car.policeDriving = false;
  car.stolen = true;
  car.occupied = false;
  car.policeActive = parked;
  car.policeMode = parked ? "roadblock" : null;
  if (parked) {
    car.vx = car.vz = car.driveSpeed = car.currentSpeed = 0;
  }
}
export function spawnPatrol(game, count, options = {}) {
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
  if (!car && game.vehicles.filter((v) => v.isPolice).length >= 10)
    return false;
  if (!car) {
    const nearest = nearestTrafficDistance(game.player);
    let pose;
    const clearSpawn = (p) => {
      const v = { ...p, kind: "car", isPolice: true };
      return (
        dist(p, game.player) >= 65 &&
        dist(p, game.player) <= 140 &&
        !vehicleBlocked(v) &&
        !game.vehicles.some((other) => vehicleOverlap(v, other))
      );
    };
    // Stage roadblocks along their own street, rather than across occupied lots.
    // Units still drive into place and turn across the lane before parking.
    if (options.mode === "roadblock" && options.target) {
      const target = options.target,
        along = target.heading - Math.PI / 2;
      for (const distance of [18, 26, 34, 42, 50]) {
        for (const side of [-1, 1]) {
          const p = {
            x: target.x + Math.cos(along) * side * distance,
            z: target.z + Math.sin(along) * side * distance,
            heading: along + (side > 0 ? Math.PI : 0),
          };
          if (!clearSpawn(p)) continue;
          let clear = true;
          for (let d = 0; d <= distance; d += 2) {
            const q = {
              x: target.x + Math.cos(along) * side * d,
              z: target.z + Math.sin(along) * side * d,
              heading: p.heading,
            };
            if (
              !road(q) ||
              vehicleBlocked({ ...q, kind: "car", isPolice: true })
            ) {
              clear = false;
              break;
            }
          }
          if (clear) {
            pose = p;
            break;
          }
        }
        if (pose) break;
      }
    }
    for (let i = 0; !pose && i < 24; i++) {
      const p = trafficPose(
        nearest + (i % 2 ? 1 : -1) * (70 + Math.floor(i / 2) * 30),
      );
      if (clearSpawn(p)) pose = p;
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
  car.policeMode =
    options.mode ||
    (Math.ceil(game.wanted) >= 3 && game.vehicle !== null
      ? "pursuit"
      : "arrival");
  car.blockTarget = options.target || null;
  car.policeDriving = true;
  car.stolen = false;
  car.policeActive = true;
  car.occupied = true;
  car.arrivalAge = 0;
  car.arrivalStall = 0;
  for (let i = 0; i < count; i++)
    game.police.push(createOfficer(game, car, car.id));
  return car;
}
export function patrolStep(game, car, dt) {
  car.arrivalAge = (car.arrivalAge || 0) + dt;
  if (game.wanted <= 1 || game.atHome || car.burnStarted !== undefined) {
    disembarkPatrol(game, car);
    return;
  }
  const victim = game.vehicle === null ? null : game.vehicles[game.vehicle];
  let goal = game.player,
    strength = 0.8,
    brake = false;
  if (car.policeMode === "roadblock" && car.blockTarget) {
    const target = car.blockTarget,
      d = dist(car, target);
    if (d < 3.2) {
      goal = {
        x: car.x + Math.cos(target.heading) * 5,
        z: car.z + Math.sin(target.heading) * 5,
      };
      strength = 0.15;
      brake = true;
      const angle = Math.abs(
        Math.atan2(
          Math.sin(car.heading - target.heading),
          Math.cos(car.heading - target.heading),
        ),
      );
      if (angle < 0.15 && car.currentSpeed < 0.6) {
        disembarkPatrol(game, car, true);
        return;
      }
    } else {
      goal = routeTarget(car, target);
      strength = d < 10 ? 0.35 : 0.9;
    }
    if (car.arrivalAge > 30) {
      disembarkPatrol(game, car);
      return;
    }
  } else if (car.policeMode === "pursuit" && victim && game.wanted >= 3) {
    const speed = Math.hypot(victim.vx || 0, victim.vz || 0),
      heading = speed > 2 ? Math.atan2(victim.vz, victim.vx) : victim.heading;
    const f = { x: Math.cos(heading), z: Math.sin(heading) },
      n = { x: -Math.sin(heading), z: Math.cos(heading) },
      side =
        Math.sign((car.x - victim.x) * n.x + (car.z - victim.z) * n.z) ||
        (car.id % 2 ? -1 : 1);
    const distance = dist(car, victim),
      along = (car.x - victim.x) * f.x + (car.z - victim.z) * f.z;
    const ram = distance < 18 && along > -3 && along < 7;
    const target = {
      x:
        victim.x +
        f.x * (ram ? along + 2 : Math.min(18, speed * 0.7 + 5)) +
        n.x * side * (ram ? -2 : 3.6),
      z:
        victim.z +
        f.z * (ram ? along + 2 : Math.min(18, speed * 0.7 + 5)) +
        n.z * side * (ram ? -2 : 3.6),
    };
    goal = distance < 25 ? target : routeTarget(car, target);
    strength = 1;
    car.ramming = ram;
  } else {
    car.ramming = false;
    if (dist(car, game.player) < 18 || car.arrivalAge > 18) {
      disembarkPatrol(game, car);
      return;
    }
    goal = routeTarget(car, game.player);
  }
  const d = dist(car, goal),
    old = { x: car.x, z: car.z };
  drive(
    car,
    dt,
    {
      x: d ? ((goal.x - car.x) / d) * strength : 0,
      z: d ? ((goal.z - car.z) / d) * strength : 0,
      brake,
    },
    game.level,
  );
  car.arrivalStall = dist(old, car) < 0.025 ? (car.arrivalStall || 0) + dt : 0;
  if (car.arrivalStall > 4) disembarkPatrol(game, car);
}
export function dispatchRoadblock(game) {
  if (game.vehicle === null || game.atHome) return false;
  const victim = game.vehicles[game.vehicle],
    speed = Math.hypot(victim.vx || 0, victim.vz || 0),
    heading = speed > 2 ? Math.atan2(victim.vz, victim.vx) : victim.heading;
  const ahead = {
    x: victim.x + Math.cos(heading) * 85,
    z: victim.z + Math.sin(heading) * 85,
    heading,
  };
  const pose = road(ahead) ? ahead : trafficPose(nearestTrafficDistance(ahead)),
    n = { x: -Math.sin(pose.heading), z: Math.cos(pose.heading) };
  const center = road(ahead)
    ? ahead
    : { x: pose.x - n.x * 3, z: pose.z - n.z * 3 };
  if (
    dist(center, game.player) < 45 ||
    dist(center, HOME) < 55 ||
    (center.x - game.player.x) * Math.cos(heading) +
      (center.z - game.player.z) * Math.sin(heading) <
      35
  )
    return false;
  let spawned = 0;
  for (const side of [-1, 1]) {
    const target = {
      x: center.x + n.x * side * 2.1,
      z: center.z + n.z * side * 2.1,
      heading: pose.heading + Math.PI / 2,
    };
    if (vehicleBlocked({ kind: "car", isPolice: true, ...target })) continue;
    if (spawnPatrol(game, 1, { mode: "roadblock", target })) spawned++;
  }
  if (spawned) {
    game.roadblocks = (game.roadblocks || 0) + 1;
    game.tell("Police roadblock ahead.");
  }
  return spawned > 0;
}
export function updatePoliceDispatch(game) {
  if (game.wanted < 3 || game.atHome) return;
  if (
    game.vehicle !== null &&
    !game.vehicles.some((v) => v.policeDriving && v.policeMode === "pursuit") &&
    game.police.length < 12 &&
    game.time >= (game.nextPursuit || 0)
  ) {
    if (spawnPatrol(game, 2, { mode: "pursuit" }))
      game.nextPursuit = game.time + 12;
  }
  if (game.wanted >= 4 && game.vehicle !== null) {
    game.nextRoadblock ??= game.time + 10;
    if (game.time >= game.nextRoadblock) {
      if (game.police.length < 16) dispatchRoadblock(game);
      game.nextRoadblock = game.time + 24 + game.random() * 10;
    }
  }
}
