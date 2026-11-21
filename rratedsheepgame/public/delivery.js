import {
  HOME,
  HOME_BARN,
  dist,
  move,
  clearPosition,
  routeTarget,
} from "./region.js?v=performance-1";
import {
  circleVehicle,
  vehicleSize,
} from "./vehicle-collisions.js?v=performance-1";
export const inBarn = (p) =>
  Math.abs(p.x - HOME_BARN.x) < HOME_BARN.hx - 0.8 &&
  p.z < HOME_BARN.z + HOME_BARN.hz - 1 &&
  p.z > HOME_BARN.z - HOME_BARN.hz + 0.8;
export function beginDelivery(game) {
  const active = game.delivery;
  const vehicle = game.vehicle === null ? null : game.vehicles[game.vehicle];
  if (vehicle && Math.hypot(vehicle.vx || 0, vehicle.vz || 0) > 3) {
    game.tell("Stop to unload.");
    return !!active;
  }
  const animals = game.herd.filter(
    (a) =>
      !a.delivering &&
      !a.down &&
      !a.ragdoll &&
      ((a.boarded === game.vehicle && game.vehicle !== null) ||
        (a.boarded === null && dist(a, HOME) < HOME.r + 3)),
  );
  if (!animals.length && active) return true;
  if (!animals.length) {
    if (game.phase !== "intro") game.settleDelivery([]);
    return game.phase !== "intro";
  }
  animals.forEach((a, localIndex) => {
    const i = localIndex + (active?.ids.length || 0);
    if (a.boarded !== null) a.barnUnloadAt = game.time + i * 0.55;
    if (a.boarded === null) a.barnWaypoints = [];
    a.delivering = true;
    a.barnStage = inBarn(a) ? 2 : 0;
    a.barnGateCrossed = inBarn(a);
    a.barnIndex = i;
  });
  if (active) active.ids.push(...animals.map((a) => a.id));
  else game.delivery = { ids: animals.map((a) => a.id), started: game.time };
  game.tell("Herd heading to the barn.");
  return true;
}
function unloadAnimal(game, a) {
  const vehicle = game.vehicles[a.boarded];
  if (!vehicle) return;

  const spot = clearPosition(
    {
      x: vehicle.x + Math.cos(vehicle.heading + Math.PI / 2) * 3,
      z: vehicle.z + Math.sin(vehicle.heading + Math.PI / 2) * 3,
    },
    0.5,
    game.level,
    (p) =>
      !game.vehicles.some((v) => dist(v, p) < 12 && circleVehicle(p, v, 0.5)),
  );
  if (spot) {
    a.x = spot.x;
    a.z = spot.z;
  }
  const size = vehicleSize(vehicle),
    f = { x: Math.cos(vehicle.heading), z: Math.sin(vehicle.heading) },
    n = { x: -Math.sin(vehicle.heading), z: Math.cos(vehicle.heading) },
    end = size.halfLength + 1.5;
  const lateral = (a.x - vehicle.x) * n.x + (a.z - vehicle.z) * n.z,
    side =
      (HOME_BARN.x - vehicle.x) * n.x + (HOME_BARN.z - vehicle.z) * n.z < 0
        ? -1
        : 1;
  a.barnWaypoints = [
    {
      x: vehicle.x + f.x * end + n.x * lateral,
      z: vehicle.z + f.z * end + n.z * lateral,
    },
    {
      x: vehicle.x + f.x * end + n.x * side * (size.halfWidth + 2),
      z: vehicle.z + f.z * end + n.z * side * (size.halfWidth + 2),
    },
  ];
  a.boarded = null;
}
export function stepBarnAnimal(game, a, dt) {
  if (a.boarded !== null) {
    if (game.time >= (a.barnUnloadAt || 0)) unloadAnimal(game, a);
    return;
  }

  const group = game.animals.filter((n) => n.delivering),
    index = a.barnIndex,
    front = group.find((n) => n.barnIndex === index - 2),
    ready = !front || front.barnStage >= 1 || front.down;
  const gate = {
    x: HOME_BARN.x + (index % 2 ? 1.5 : -1.5),
    z: HOME_BARN.z + HOME_BARN.hz,
  };
  let target;
  if (a.barnStage === 0) {
    if (!ready)
      target = { x: gate.x, z: gate.z + 3 + Math.floor(index / 2) * 2.7 };
    else target = { x: gate.x, z: gate.z - 2 };
  } else
    target = {
      x: HOME_BARN.x + [-1.5, 1.5, -4.5, 4.5][index % 4],
      z: HOME_BARN.z - HOME_BARN.hz + 1.5 + Math.floor(index / 4) * 3,
    };

  while (a.barnWaypoints?.length && dist(a, a.barnWaypoints[0]) < 0.6)
    a.barnWaypoints.shift();
  if (a.barnWaypoints?.length) target = a.barnWaypoints[0];
  target = routeTarget(a, target);
  const d = dist(a, target),
    previous = { x: a.x, z: a.z };
  if (d > 0.2) {
    move(
      a,
      ((target.x - a.x) / d) * Math.min(6, d * 3) * dt,
      ((target.z - a.z) / d) * Math.min(6, d * 3) * dt,
      0.45,
      game.level,
    );
    if (dist(a, previous) > 0.001)
      a.heading = Math.atan2(a.z - previous.z, a.x - previous.x);
  }
  if (
    a.barnStage === 0 &&
    a.z < gate.z - 0.9 &&
    Math.abs(a.x - HOME_BARN.x) < HOME_BARN.doorHalf - 0.45
  ) {
    a.barnGateCrossed = true;
    a.barnStage = 1;
  }
  if (a.barnStage === 1 && inBarn(a) && d < 0.8) {
    a.barnStage = 2;
    a.barnEnteredAt = game.time;
  }
}
export function finishDelivery(game) {
  if (!game.delivery) return;
  const animals = game.delivery.ids
    .map((id) => game.animals.find((a) => a.id === id))
    .filter(Boolean);
  if (
    animals.every((a) => a.down || a.barnStage === 2) &&
    game.time - game.delivery.started > 1
  ) {
    const arrived = animals.filter(
      (a) => !a.down && a.barnGateCrossed && inBarn(a),
    );
    game.delivery = null;
    game.settleDelivery(arrived);
  }
}
