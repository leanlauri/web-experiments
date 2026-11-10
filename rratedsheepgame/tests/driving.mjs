import assert from "node:assert/strict";
import { drive } from "../public/driving.js";
import { Game } from "../public/simulation.js";
import {
  recordSkidmarks,
  skidOpacity,
  SKID_LIFETIME,
  MAX_SKID_SEGMENTS,
} from "../public/skidmarks.js";
import { FARMS, OBSTACLES, dist } from "../public/region.js";
const angle = FARMS[0].angle;
const car = (kind = "car") => ({
  kind,
  x: Math.cos(angle) * 130,
  z: Math.sin(angle) * 130,
  heading: angle,
  driveSpeed: 0,
});
const ahead = { x: Math.cos(angle), z: Math.sin(angle) };
const step = (v, seconds, input = {}, fps = 60) => {
  for (let i = 0; i < seconds * fps; i++) drive(v, 1 / fps, input);
};
const difference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
{
  const v = car(),
    start = { ...v };
  step(v, 1);
  assert.equal(dist(v, start), 0);
  drive(v, 1 / 60, ahead);
  assert(v.driveSpeed > 0 && v.driveSpeed < 1);
  step(v, 2, ahead);
  assert(v.driveSpeed > 10 && v.driveSpeed <= 32);
  const speed = v.driveSpeed,
    position = { ...v };
  step(v, 0.5);
  assert(v.driveSpeed > 0 && v.driveSpeed < speed);
  assert(dist(v, position) > 3, "release coasts");
  step(v, 2, { ...ahead, brake: true });
  assert.equal(v.driveSpeed, 0, "brake overrides directional acceleration");
  const heavy = car("bus"),
    light = car("buggy");
  step(heavy, 2, ahead);
  step(light, 2, ahead);
  assert(light.driveSpeed > heavy.driveSpeed);
  const grass = car();
  Object.assign(grass, { x: 180, z: 0, heading: 0 });
  step(grass, 4, { x: 1 });
  assert(grass.driveSpeed <= 32 * 0.55 + 0.01);
}
{
  const v = car();
  v.driveSpeed = 25;
  drive(v, 1 / 60, { x: -Math.sin(angle), z: Math.cos(angle) });
  assert(
    v.vx * ahead.x + v.vz * ahead.z > 23,
    "sharp turn retains previous-direction momentum",
  );
  assert(
    Math.abs(difference(v.heading, angle)) < 0.1,
    "body does not snap to requested direction",
  );
  step(v, 0.3, { x: -Math.sin(angle), z: Math.cos(angle) });
  assert(
    Math.abs(difference(Math.atan2(v.vz, v.vx), v.heading)) > 0.25,
    "velocity and nose diverge during traction loss",
  );
  assert(v.skidding, "sharp turn breaks traction");
  const straight = car();
  straight.driveSpeed = 20;
  step(straight, 0.2, ahead);
  assert(!straight.skidding, "ordinary straight driving leaves no marks");
  drive(straight, 1 / 60, { brake: true });
  assert(straight.skidding, "hard braking breaks traction");
  const slow = car();
  slow.driveSpeed = 3;
  drive(slow, 1 / 60, { brake: true });
  assert(!slow.skidding, "slow stops leave no marks");
  const a = car(),
    b = car();
  step(a, 2, { x: 1, z: 0.7 }, 30);
  step(b, 2, { x: 1, z: 0.7 }, 120);
  assert(dist(a, b) < 0.2, "physics stable across frame rates");
}
{
  const b = OBSTACLES[0],
    v = car();
  Object.assign(v, { x: b.x - b.hx - 4, z: b.z, heading: 0, driveSpeed: 25 });
  step(v, 1, { x: 1 });
  assert.equal(v.driveSpeed, 0);
  assert(v.x < b.x - b.hx - 1.3);
  assert.equal(v.z, b.z);
  const g = new Game(),
    v2 = g.vehicles[24];
  g.player.x = v2.x;
  g.player.z = v2.z;
  g.interact();
  const before = { ...g.player };
  g.update(1 / 60, { x: 1 });
  assert(
    dist(before, g.player) > 0,
    "directional movement accelerates the car",
  );
  assert(v2.driveSpeed < 1, "no instant full-speed strafe");
  g.interact();
  assert.equal(v2.vx, 0);
  assert.equal(v2.vz, 0);
  const t = g.vehicles[0];
  g.player.x = t.x;
  g.player.z = t.z;
  t.currentSpeed = 11;
  g.interact();
  assert.equal(g.vehicles[g.vehicle].driveSpeed, 11);
}
{
  const marks = [],
    v = car();
  v.driveSpeed = 25;
  let time = 0;
  for (let i = 0; i < 50; i++) {
    time += 1 / 60;
    drive(v, 1 / 60, { brake: true });
    recordSkidmarks(marks, v, time);
  }
  assert(
    marks.length >= 2 && marks.length % 2 === 0,
    "skidding produces paired tire trails",
  );
  assert(
    Math.hypot(marks[0].x1 - marks[1].x1, marks[0].z1 - marks[1].z1) > 1,
    "marks follow separate rear tires",
  );
  const mark = marks[0];
  assert(skidOpacity(mark, mark.born) > skidOpacity(mark, mark.born + 7));
  assert.equal(skidOpacity(mark, mark.born + SKID_LIFETIME), 0);
  const g = new Game();
  g.skidmarks = marks;
  for (let i = 0; i < 600; i++) g.update(1 / 60);
  assert.equal(g.skidmarks.length, 0, "expired marks are removed");
  g.skidmarks = marks;
  g.reset();
  assert.equal(g.skidmarks.length, 0, "reset clears trails");
  v.skidding = true;
  for (let i = 0; i < 3000; i++) {
    v.x += 0.5;
    recordSkidmarks(marks, v, i / 60);
  }
  assert(marks.length <= MAX_SKID_SEGMENTS, "mark storage stays bounded");
}
console.log(
  "PASS: directional input, acceleration, persistent momentum, limited traction, hard-brake and turn skids, paired fading trails, bounded storage, collisions, frame rates and boarding.",
);
