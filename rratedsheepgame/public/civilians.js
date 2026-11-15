import { clearPosition, dist, move } from "./region.js?v=city-action-2";
import { startTumble } from "./tumbles.js?v=city-action-2";
import { circleVehicle } from "./vehicle-collisions.js?v=city-action-2";
export function ejectDriver(game, car) {
  if (!car.occupied || car.isPolice || car.isFarmer) return;
  const side = car.heading + Math.PI / 2,
    origin = {
      x: car.x + Math.cos(side) * 2.8,
      z: car.z + Math.sin(side) * 2.8,
      y: car.y || 0,
    };
  const spot =
    clearPosition(
      origin,
      0.5,
      game.level,
      (p) =>
        !game.vehicles.some((v) => dist(v, p) < 10 && circleVehicle(p, v, 0.5)),
    ) || origin;
  const person = {
    ...spot,
    id: "c" + ++game.civilianSequence,
    hp: 1,
    armor: 1,
    down: 0,
    heading: car.heading,
    born: game.time,
    escaped: false,
  };
  const velocity = {
    x: (car.vx || 0) + Math.cos(side) * 5,
    z: (car.vz || 0) + Math.sin(side) * 5,
  };
  if (Math.hypot(car.vx || 0, car.vz || 0) > 2 || car.currentSpeed > 2) {
    startTumble(person, velocity, game.time);
    person.down = 6;
  }
  game.civilians.push(person);
  car.occupied = false;
}
export function stepCivilians(game, dt, recovering) {
  for (const person of game.civilians) {
    person.down = Math.max(
      0,
      (person.down || 0) - dt,
      (person.knockoutUntil || 0) - game.time,
    );
    if (recovering.has(person) || person.ragdoll || person.down > 0) continue;
    const d = dist(person, game.player);
    if (d < 18 && d > 0.1) {
      const dx = (person.x - game.player.x) / d,
        dz = (person.z - game.player.z) / d;
      move(person, dx * 3 * dt, dz * 3 * dt, 0.5, game.level);
      person.heading = Math.atan2(dz, dx);
    }
  }
  game.civilians = game.civilians
    .filter(
      (p) =>
        p.ragdoll ||
        p.down > 0 ||
        game.time - p.born < 35 ||
        dist(p, game.player) < 55,
    )
    .slice(-32);
}
