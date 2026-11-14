import assert from "node:assert/strict";
import {
  createTraffic,
  trafficPose,
  stepTraffic,
  TRAFFIC_LENGTH,
  TRAFFIC_COUNT,
} from "../public/traffic.js";
import {
  vehicleBlocked,
  vehicleOverlap,
  resolveVehicleCollisions,
  vehicleSize,
} from "../public/vehicle-collisions.js";
const angle = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
assert.equal(TRAFFIC_COUNT, 48);
const traffic = createTraffic();
assert.equal(traffic.length, 49);
assert.equal(traffic[24].id, 24);
assert(traffic[24].stolen);
for (let i = 0; i < traffic.length; i++)
  for (let j = i + 1; j < traffic.length; j++)
    assert(!vehicleOverlap(traffic[i], traffic[j]), "spawns cannot overlap");
// Check the entire closed path, including the town junction, farm turns and seam.
for (let d = 0; d < TRAFFIC_LENGTH; d += 0.25) {
  const p = trafficPose(d),
    q = trafficPose(d + 0.1);
  assert(
    Math.hypot(q.x - p.x, q.z - p.z) < 0.101,
    "path has no position discontinuities",
  );
  assert(
    Math.abs(angle(q.heading, p.heading)) < 0.045,
    "path has no heading discontinuities",
  );
  assert(
    !vehicleBlocked({ ...p, kind: "bus" }),
    "even a bus must clear scenery along the route",
  );
}
const counts = traffic.map(() => 0),
  lateTravel = traffic.map(() => 0),
  townCars = new Set();
let contacts = 0;
for (let frame = 0; frame < 3600; frame++) {
  for (const v of traffic) {
    if (v.stolen) continue;
    v.previous = { x: v.x, z: v.z, heading: v.heading };
    stepTraffic(v, 1 / 30, traffic);
    v.vx = (v.x - v.previous.x) * 30;
    v.vz = (v.z - v.previous.z) * 30;
    const d = Math.hypot(v.x - v.previous.x, v.z - v.previous.z);
    assert(
      d <= v.speed / 30 + 0.001,
      "frame motion stays within actual driving speed",
    );
    assert(
      Math.abs(angle(v.heading, v.previous.heading)) <= 1.8 / 30 + 0.001,
      "no instantaneous U-turn",
    );
    counts[v.id] += d;
    if (frame >= 2700) lateTravel[v.id] += d;
    if (Math.hypot(v.x, v.z) < 30) townCars.add(v.id);
  }
  // Ordinary traffic should negotiate merging and following without collisions.
  contacts += resolveVehicleCollisions(traffic, frame / 30);
}
console.log({
  minTravel: Math.min(...counts.filter((_, i) => i !== 24)),
  townCars: townCars.size,
  contacts,
});
assert(
  Math.min(...counts.filter((_, i) => i !== 24)) > 50,
  "cars must keep progressing instead of gridlocking",
);
assert(
  traffic
    .filter((v) => !v.stolen)
    .every((v) => lateTravel[v.id] > vehicleSize(v).halfLength * 2),
  "even queued heavy vehicles must advance at least their body length late in the run",
);
assert(
  townCars.size > 6,
  "town should receive continuous traffic from several farms",
);
assert.equal(contacts, 0, "routine traffic yields before impact");
// A stationary hijacked car becomes a genuine queue obstacle rather than a warp trigger.
const lead = { ...trafficPose(150), kind: "bus", stolen: true, id: 90 };
const follower = {
  ...trafficPose(130),
  trafficDistance: 130,
  speed: 12,
  trafficSpeed: 12,
  kind: "car",
  id: 91,
  disabled: 0,
};
for (let i = 0; i < 600; i++) {
  const old = { ...follower };
  stepTraffic(follower, 1 / 60, [lead, follower]);
  assert(!vehicleOverlap(follower, lead));
  assert(Math.hypot(follower.x - old.x, follower.z - old.z) < 0.201);
}
assert(follower.trafficSpeed < 0.1);
lead.x += 30;
for (let i = 0; i < 120; i++) stepTraffic(follower, 1 / 60, [lead, follower]);
assert(follower.trafficSpeed > 1, "queue resumes when the obstruction leaves");
console.log(
  "PASS: 48 cars, scenery clearance, continuous paths and heading, smooth town/farm turns, yielding, no natural collisions or gridlock, and queue restart.",
);
