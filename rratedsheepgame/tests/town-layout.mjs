import assert from "node:assert/strict";
import {
  FARM_ROADS,
  COUNTRY_ROADS,
  OBSTACLES,
  TOWN_LOTS,
  road,
} from "../public/region.js";
assert.equal(FARM_ROADS.length, 6);
assert.equal(TOWN_LOTS.length, 16);
for (const r of COUNTRY_ROADS) {
  const p = r.points[0];
  assert(
    Math.abs(p.x) === 92 || Math.abs(p.z) === 80,
    "country road joins an outer street",
  );
  const approach = r.points[1];
  assert(
    Math.abs(p.x) === 92 ? approach.z === p.z : approach.x === p.x,
    "country approach meets its outer street at a right angle",
  );
  for (let i = 1; i < r.points.length; i++) {
    const a = r.points[i - 1],
      b = r.points[i];
    for (let t = 0; t <= 1; t += 0.02) {
      const q = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      assert(
        !(Math.abs(q.x) < 91.9 && Math.abs(q.z) < 79.9),
        "no country approach crosses the inner town",
      );
      assert(road(q));
    }
  }
}
assert(!road({ x: 20, z: 20 }), "old diagonal road is gone");
const buildings = OBSTACLES.filter((b) => b.type === "town");
assert.equal(buildings.length, 48);
for (const b of buildings) {
  assert([1, -1].includes(b.front));
  assert(b.hx >= 5 && b.hz >= 4);
  for (const dx of [-b.hx, b.hx])
    for (const dz of [-b.hz, b.hz])
      assert(
        !road({ x: b.x + dx, z: b.z + dz }),
        "building footprint stays off the streets",
      );
}
for (let i = 0; i < buildings.length; i++)
  for (let j = i + 1; j < buildings.length; j++) {
    const a = buildings[i],
      b = buildings[j];
    assert(
      Math.abs(a.x - b.x) >= a.hx + b.hx || Math.abs(a.z - b.z) >= a.hz + b.hz,
      "lots do not overlap",
    );
  }
for (const kind of ["house", "shop", "warehouse", "gas"])
  assert(buildings.some((b) => b.kind === kind));
console.log(
  "PASS: six perimeter connections, no diagonal country roads through town, sixteen coherent blocks, 48 non-overlapping street-facing buildings and mixed residential/commercial/service districts.",
);
