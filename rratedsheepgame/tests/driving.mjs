import assert from "node:assert/strict";
import { drive } from "../public/driving.js";
import { Game } from "../public/simulation.js";
import { FARMS, OBSTACLES, dist } from "../public/region.js";
const angle = FARMS[0].angle;
const car = (kind = "car") => ({
  kind,
  x: Math.cos(angle) * 130,
  z: Math.sin(angle) * 130,
  heading: angle,
  driveSpeed: 0,
});
const step = (v, seconds, input, fps = 60) => {
  for (let i = 0; i < seconds * fps; i++) drive(v, 1 / fps, input);
};
const difference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
{
  const v = car(),
    start = { ...v };
  step(v, 1, { steer: 1 });
  assert.equal(v.heading, start.heading);
  assert.equal(
    dist(v, start),
    0,
    "no sideways translation or pivoting while parked",
  );
  drive(v, 1 / 60, { throttle: 1 });
  assert(v.driveSpeed > 0 && v.driveSpeed < 1, "gradual acceleration");
  step(v, 2, { throttle: 1 });
  assert(v.driveSpeed > 15 && v.driveSpeed <= 32);
  const speed = v.driveSpeed,
    position = { ...v };
  step(v, 0.5, {});
  assert(v.driveSpeed > 0 && v.driveSpeed < speed);
  assert(dist(v, position) > 3, "coasts on release");
  step(v, 2, { brake: true, throttle: 1 });
  assert.equal(v.driveSpeed, 0, "brake takes priority over throttle");
  step(v, 1, { throttle: 1 });
  step(v, 0.1, { throttle: -1 });
  assert(v.driveSpeed > 0, "opposite pedal first brakes");
  step(v, 2, { throttle: -1 });
  assert(
    v.driveSpeed < 0 && v.driveSpeed >= -9,
    "reverse has a lower speed limit",
  );
}
{
  const forward = car(),
    reverse = car();
  forward.driveSpeed = 8;
  reverse.driveSpeed = -8;
  step(forward, 0.4, { steer: 1 });
  step(reverse, 0.4, { steer: 1 });
  assert(difference(forward.heading, angle) > 0);
  assert(
    difference(reverse.heading, angle) < 0,
    "reverse steering reverses yaw",
  );
  const heavy = car("bus"),
    light = car("buggy");
  step(heavy, 2, { throttle: 1 });
  step(light, 2, { throttle: 1 });
  assert(
    light.driveSpeed > heavy.driveSpeed,
    "heavier vehicle accelerates slower",
  );
  const bus = car("bus"),
    buggy = car("buggy");
  bus.driveSpeed = buggy.driveSpeed = 8;
  step(bus, 0.4, { steer: 1 });
  step(buggy, 0.4, { steer: 1 });
  assert(
    difference(buggy.heading, angle) > difference(bus.heading, angle),
    "bus has a wider turning radius",
  );
  const grass = car();
  Object.assign(grass, { x: 180, z: 0, heading: 0 });
  step(grass, 4, { throttle: 1 });
  assert(
    grass.driveSpeed <= 32 * 0.55 + 0.01,
    "grass has a lower cruising speed",
  );
}
{
  const b = OBSTACLES[0],
    v = car();
  Object.assign(v, { x: b.x - b.hx - 4, z: b.z, heading: 0, driveSpeed: 25 });
  step(v, 1, { throttle: 1, steer: 0 });
  assert.equal(v.driveSpeed, 0);
  assert(v.x < b.x - b.hx - 1.3, "cannot pass through buildings");
  assert.equal(v.z, b.z, "no sideways wall sliding");
  const a = car(),
    c = car();
  step(a, 2, { throttle: 1, steer: 0.3 }, 30);
  step(c, 2, { throttle: 1, steer: 0.3 }, 120);
  assert(dist(a, c) < 0.6, "stable at different frame rates");
}
{
  const g = new Game(),
    v = g.vehicles[24];
  g.player.x = v.x;
  g.player.z = v.z;
  g.player.heading = 2;
  g.interact();
  assert.equal(
    g.player.heading,
    v.heading,
    "boarding preserves vehicle heading",
  );
  const before = { ...g.player };
  g.update(1 / 60, { x: 1, z: 0, steer: 1 });
  assert.equal(
    dist(before, g.player),
    0,
    "world movement input cannot strafe the vehicle",
  );
  g.update(1 / 60, { throttle: 1 });
  assert(g.vehicles[24].driveSpeed > 0);
  g.interact();
  assert.equal(v.driveSpeed, 0, "exit sets parking brake");
  const t = g.vehicles[0];
  g.player.x = t.x;
  g.player.z = t.z;
  t.currentSpeed = 11;
  g.interact();
  assert.equal(
    g.vehicles[g.vehicle].driveSpeed,
    11,
    "hijacking retains traffic momentum",
  );
}
console.log(
  "PASS: acceleration, coasting, braking, reverse, steering arcs, vehicle sizes, grass, collisions, frame rates, boarding and parking.",
);
