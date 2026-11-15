import { VEHICLES, vehicleProfile } from "./vehicles.js?v=home-police-1";
import { FARMS, HOME } from "./region.js?v=home-police-1";
import {
  vehicleBlocked,
  vehicleOverlap,
  vehicleSize,
} from "./vehicle-collisions.js?v=home-police-1";
export const TRAFFIC_COUNT = 48;
const LANE = 3,
  INNER = 38,
  OUTER = 275,
  CIRCLE = 22;
const samples = [];
const local = (farm, x, z) => ({
  x: Math.cos(farm.angle) * x - Math.sin(farm.angle) * z,
  z: Math.sin(farm.angle) * x + Math.cos(farm.angle) * z,
});
function add(p, heading, limit) {
  const last = samples.at(-1);
  samples.push({
    ...p,
    heading,
    limit,
    distance: last ? last.distance + Math.hypot(p.x - last.x, p.z - last.z) : 0,
  });
}
function line(f, x0, z0, x1, z1, limit = 14) {
  const a = local(f, x0, z0),
    b = local(f, x1, z1);
  add(a, Math.atan2(b.z - a.z, b.x - a.x), limit);
  add(b, Math.atan2(b.z - a.z, b.x - a.x), limit);
}
function bezier(f, points, limit = 7) {
  for (let i = 0; i <= 40; i++) {
    const t = i / 40,
      u = 1 - t;
    const p = {
      x:
        u * u * u * points[0][0] +
        3 * u * u * t * points[1][0] +
        3 * u * t * t * points[2][0] +
        t * t * t * points[3][0],
      z:
        u * u * u * points[0][1] +
        3 * u * u * t * points[1][1] +
        3 * u * t * t * points[2][1] +
        t * t * t * points[3][1],
    };
    const dx =
        3 * u * u * (points[1][0] - points[0][0]) +
        6 * u * t * (points[2][0] - points[1][0]) +
        3 * t * t * (points[3][0] - points[2][0]),
      dz =
        3 * u * u * (points[1][1] - points[0][1]) +
        6 * u * t * (points[2][1] - points[1][1]) +
        3 * t * t * (points[3][1] - points[2][1]);
    add(local(f, p.x, p.z), f.angle + Math.atan2(dz, dx), limit);
  }
}
for (let i = 0; i < FARMS.length; i++) {
  const f = FARMS[i],
    next = FARMS[(i + 1) % FARMS.length];
  line(f, INNER, LANE, OUTER - 12, LANE);
  line(f, OUTER - 12, LANE, OUTER, LANE, 4);
  for (let k = 0; k <= 64; k++) {
    const a = Math.PI / 2 - (k / 64) * Math.PI;
    add(
      local(f, OUTER + Math.cos(a) * LANE, Math.sin(a) * LANE),
      f.angle + a - Math.PI / 2,
      3.8,
    );
  }
  line(f, OUTER, -LANE, INNER + 12, -LANE);
  line(f, INNER + 12, -LANE, INNER, -LANE, 7);
  const delta = Math.PI / 10,
    ex = CIRCLE * Math.cos(delta),
    ez = CIRCLE * Math.sin(delta);
  bezier(f, [
    [INNER, -LANE],
    [INNER - 10, -LANE],
    [ex + Math.sin(delta) * 6, -ez + Math.cos(delta) * 6],
    [ex, -ez],
  ]);
  const start = f.angle - delta,
    arc = 2 * Math.PI - (Math.PI / 3 + 2 * delta);
  for (let k = 0; k <= 128; k++) {
    const a = start - (k / 128) * arc;
    add(
      { x: Math.cos(a) * CIRCLE, z: Math.sin(a) * CIRCLE },
      a - Math.PI / 2,
      8,
    );
  }
  bezier(next, [
    [ex, ez],
    [ex + Math.sin(delta) * 6, ez - Math.cos(delta) * 6],
    [INNER - 10, LANE],
    [INNER, LANE],
  ]);
}
export const TRAFFIC_LENGTH = samples.at(-1).distance;
const wrap = (d) => ((d % TRAFFIC_LENGTH) + TRAFFIC_LENGTH) % TRAFFIC_LENGTH;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function trafficPose(distance) {
  const d = wrap(distance);
  let lo = 0,
    hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].distance <= d) lo = mid;
    else hi = mid;
  }
  const a = samples[lo],
    b = samples[hi],
    t = (d - a.distance) / (b.distance - a.distance || 1);
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    heading: a.heading + angleDiff(b.heading, a.heading) * t,
    limit: Math.min(a.limit, b.limit),
  };
}
export function nearestTrafficDistance(v) {
  let best = Infinity,
    result = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i],
      dx = b.x - a.x,
      dz = b.z - a.z,
      len = dx * dx + dz * dz;
    if (!len) continue;
    const t = Math.max(
      0,
      Math.min(1, ((v.x - a.x) * dx + (v.z - a.z) * dz) / len),
    );
    const heading = a.heading + angleDiff(b.heading, a.heading) * t;
    const score =
      (v.x - a.x - dx * t) ** 2 +
      (v.z - a.z - dz * t) ** 2 +
      4 * angleDiff(v.heading, heading) ** 2;
    if (score < best) {
      best = score;
      result = a.distance + Math.sqrt(len) * t;
    }
  }
  return result;
}
export function createTraffic() {
  const vehicles = [];
  for (let id = 0; id <= TRAFFIC_COUNT; id++) {
    if (id === 24) {
      vehicles.push({
        id,
        x: -9,
        z: HOME.z + 7,
        heading: 0,
        route: 0,
        t: 0,
        dir: 1,
        speed: 0,
        seats: 7,
        kind: "van",
        stolen: true,
        occupied: false,
        disabled: 0,
        previous: null,
      });
      continue;
    }
    const kind = Object.keys(VEHICLES)[id % Object.keys(VEHICLES).length];
    const index = id < 24 ? id : id - 1,
      distance = (TRAFFIC_LENGTH * index) / TRAFFIC_COUNT,
      pose = trafficPose(distance);
    vehicles.push({
      id,
      ...pose,
      trafficDistance: distance,
      trafficSpeed: Math.min(10 + (id % 3), pose.limit),
      speed: 10 + (id % 3),
      seats: vehicleProfile(kind).seats,
      kind,
      stolen: false,
      occupied: true,
      disabled: 0,
      previous: null,
      dir: 1,
    });
  }
  return vehicles;
}
const approach = (a, b, amount) =>
  a < b ? Math.min(b, a + amount) : Math.max(b, a - amount);
export function stepTraffic(v, dt, vehicles, level = 0) {
  if (dt <= 0) return;
  if (v.trafficDistance === undefined)
    v.trafficDistance = nearestTrafficDistance(v);
  if (v.mergeBackup > 0) {
    const amount = Math.min(v.mergeBackup, 1.8 * dt),
      distance = wrap(v.trafficDistance - amount),
      pose = trafficPose(distance);
    const heading =
      v.heading +
      Math.max(
        -1.8 * dt,
        Math.min(1.8 * dt, angleDiff(pose.heading, v.heading)),
      );
    const next = { ...v, ...pose, heading };
    if (
      !vehicleBlocked(v, next, level) &&
      !vehicles.some(
        (other) =>
          other !== v &&
          Math.hypot(other.x - v.x, other.z - v.z) < 12 &&
          vehicleOverlap(next, other),
      )
    ) {
      v.x = pose.x;
      v.z = pose.z;
      v.heading = heading;
      v.trafficDistance = distance;
      v.mergeBackup -= amount;
    } else v.mergeBackup = 0;
    v.trafficSpeed = 0;
    v.enteringJunction = false;
    return;
  }
  const pose = trafficPose(v.trafficDistance);
  let target = Math.min(
    v.speed,
    pose.limit,
    trafficPose(v.trafficDistance + 14).limit,
  );
  const speed = v.trafficSpeed ?? v.currentSpeed ?? v.speed;
  const radius = Math.hypot(v.x, v.z),
    inward =
      pose.x * Math.cos(pose.heading) + pose.z * Math.sin(pose.heading) < -1;
  if (radius < 23) v.enteringJunction = false;
  if (!v.enteringJunction && inward && radius > 27 && radius < 60) {
    const farm = FARMS.reduce(
      (best, f) =>
        Math.abs(angleDiff(Math.atan2(v.z, v.x), f.angle)) <
        Math.abs(angleDiff(Math.atan2(v.z, v.x), best.angle))
          ? f
          : best,
      FARMS[0],
    );
    const entry = farm.angle - Math.PI / 10;
    const blockedMerge = vehicles.some((other) => {
      if (other === v || Math.hypot(other.x, other.z) > 26) return false;
      const upstream =
        ((((Math.atan2(other.z, other.x) - entry) % (2 * Math.PI)) +
          2 * Math.PI) %
          (2 * Math.PI)) *
        CIRCLE;
      return (
        upstream <
          Math.max(
            20,
            (other.trafficSpeed || other.currentSpeed || 0) * 3.5 + 10,
          ) || 2 * Math.PI * CIRCLE - upstream < 10
      );
    });
    if (blockedMerge)
      target = Math.min(target, Math.max(0, (radius - (INNER - 1)) / 1.2));
    else if (radius < INNER + 4) v.enteringJunction = true;
  }

  // Look ahead along the actual lane, including merges into the town circle.
  const look = Math.max(9, speed * 1.2 + vehicleSize(v).halfLength);
  const nearby = vehicles.filter(
    (other) =>
      other !== v && Math.hypot(other.x - v.x, other.z - v.z) < look + 8,
  );
  for (let d = 1; d <= look; d += 1.5) {
    const future = trafficPose(v.trafficDistance + d);
    if (nearby.some((other) => vehicleOverlap({ ...v, ...future }, other))) {
      target = Math.min(target, Math.max(0, (d - 2) / 1.2));
      break;
    }
  }
  if (v.disabled > 0) target = 0;
  v.trafficSpeed = approach(speed, target, (target < speed ? 12 : 3) * dt);
  const offLane = Math.hypot(v.x - pose.x, v.z - pose.z) > 1.2;
  const nextDistance = offLane
    ? v.trafficDistance
    : wrap(v.trafficDistance + v.trafficSpeed * dt);
  const nextPose = trafficPose(nextDistance),
    dx = nextPose.x - v.x,
    dz = nextPose.z - v.z,
    d = Math.hypot(dx, dz),
    amount = Math.min(1, (v.trafficSpeed * dt) / (d || 1));
  const next = {
    x: v.x + dx * amount,
    z: v.z + dz * amount,
    heading:
      v.heading +
      Math.max(
        -1.8 * dt,
        Math.min(1.8 * dt, angleDiff(nextPose.heading, v.heading)),
      ),
  };
  if (
    !vehicleBlocked(v, next, level) &&
    !nearby.some((other) => vehicleOverlap({ ...v, ...next }, other))
  ) {
    v.x = next.x;
    v.z = next.z;
    v.heading = next.heading;
    v.trafficDistance = nextDistance;
    v.mergeWait = 0;
  } else {
    v.trafficSpeed = 0;
    v.mergeWait = (v.mergeWait || 0) + dt;
    // A long vehicle can block an imperfect merge with its rear corner. Back up
    // along the same lane, without a position or heading reset, to let it clear.
    if (v.mergeWait > 1.5 && radius > 22.15 && radius < 32) {
      v.mergeBackup = 6;
      v.mergeWait = 0;
    }
  }
}
