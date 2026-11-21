import assert from "node:assert/strict";
import { SpatialGrid } from "../public/spatial.js";
import { createQuality, frameSteps } from "../public/quality.js";
import { Game } from "../public/simulation.js";
import { performance } from "node:perf_hooks";
// Broad-phase candidates must include every intersecting bound, even at negative
// cell boundaries, after movement, and when an item spans multiple cells.
const grid = new SpatialGrid(24),
  items = [];
for (let i = 0; i < 100; i++) {
  const item = {
    x: (i % 10) * 19 - 95,
    z: Math.floor(i / 10) * 17 - 85,
    hx: i % 11,
    hz: i % 7,
  };
  items.push(item);
  grid.insert(item, item.hx, item.hz);
}
for (let x = -120; x <= 120; x += 7)
  for (let z = -120; z <= 120; z += 9) {
    const found = new Set(grid.query({ x, z }, 8));
    for (const item of items)
      if (
        Math.abs(item.x - x) <= item.hx + 8 &&
        Math.abs(item.z - z) <= item.hz + 8
      )
        assert(found.has(item));
  }
const moving = { x: -0.1, z: -0.1 };
grid.insert(moving);
moving.x = 100;
grid.insert(moving);
assert(!grid.query({ x: 0, z: 0 }, 1).includes(moving));
assert(grid.query(moving).includes(moving));
grid.remove(moving);
assert(!grid.query(moving).includes(moving));
const q = createQuality("auto", true);
assert(q.low);
assert.equal(q.interval, 1 / 30);
for (let i = 0; i < 1500; i++) q.sample(0.08);
assert(q.ratio >= 0.65 && q.ratio < 1);
q.setMode("high");
assert(!q.low);
assert.equal(q.ratio, 1.6);
assert.equal(q.interval, 1 / 60);
for (let i = 0; i < 100; i++) q.sample(0.08);
assert.equal(q.ratio, 1.6);
q.setMode("low");
assert.equal(q.ratio, 1);
const desktopAuto = createQuality("auto", false);
for (let i = 0; i < 900; i++) desktopAuto.sample(0.08);
assert(desktopAuto.low, "sustained load can select the lower frame target");
assert.equal(createQuality("invalid").mode, "auto");
for (const elapsed of [0, 1 / 120, 1 / 60, 1 / 30, 1, 10])
  assert(frameSteps(0, elapsed).steps <= 4);
let ticks = 0,
  remainder = 0;
for (let i = 0; i < 120; i++) {
  const next = frameSteps(remainder, 1 / 120);
  ticks += next.steps;
  remainder = next.remainder;
}
assert.equal(ticks, 60, "normal scheduling preserves 60 Hz physics");
const g = new Game();
for (let i = 0; i < 480; i++) {
  const before = g.vehicles.map((v) => ({
    x: v.x,
    z: v.z,
    heading: v.heading,
  }));
  g.update(1 / 60);
  for (const v of g.vehicles)
    if (!v.stolen && !v.physicsUntil && !v.crashRecovering) {
      const old = before[v.id];
      assert(
        Math.hypot(v.x - old.x, v.z - old.z) <= v.speed / 60 + 0.002,
        "traffic tiers do not teleport",
      );
      assert(
        Math.abs(
          Math.atan2(
            Math.sin(v.heading - old.heading),
            Math.cos(v.heading - old.heading),
          ),
        ) <=
          1.8 / 60 + 0.002,
      );
    }
}
assert(g.vehicles.some((v) => v.distantTraffic));
assert(g.vehicles.some((v) => !v.stolen && !v.distantTraffic));
const car = g.vehicles.find((v) => v.distantTraffic);
Object.assign(g.player, { x: car.x, z: car.z + 50 });
const before = { ...car };
g.update(1 / 60);
assert(!car.distantTraffic);
assert.equal(car.distantPlan, null);
assert(
  Math.hypot(car.x - before.x, car.z - before.z) <= car.speed / 60 + 0.002,
  "promotion preserves position",
);
console.log(
  "PASS: spatial broad phase completeness, movement/removal, quality limits, bounded catch-up, 60 Hz normal scheduling, continuous distant traffic and seamless promotion.",
);
if (process.argv.includes("--benchmark")) {
  for (const [name, heists] of [
    ["town", 0],
    ["lateTown", 14],
  ]) {
    const game = new Game({
      version: 1,
      phase: "heist",
      delivered: 12,
      heists,
    });
    Object.assign(game.player, { x: 0, z: 0 });
    for (let i = 0; i < 60; i++) game.update(1 / 60);
    const times = [];
    for (let i = 0; i < 600; i++) {
      let t = performance.now();
      game.update(1 / 60);
      times.push(performance.now() - t);
    }
    const average = times.reduce((a, b) => a + b) / times.length;
    times.sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        name,
        averageMs: average,
        p95Ms: times[570],
        ticks: 600,
      }),
    );
  }
}
