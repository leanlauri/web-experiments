import { VEHICLES, vehicleProfile } from "./vehicles.js?v=performance-1";
import { FARMS, HOME, FARM_ROADS } from "./region.js?v=performance-1";
import {
  vehicleBlocked,
  vehicleOverlap,
  vehicleSize,
} from "./vehicle-collisions.js?v=performance-1";
export const TRAFFIC_COUNT = 48;
const LANE = 3,
  samples = [];
const grid = [
  [-92, -80],
  [0, -80],
  [0, -40],
  [-46, -40],
  [-46, 0],
  [46, 0],
  [46, 40],
  [0, 40],
  [0, 80],
  [92, 80],
  [92, -80],
  [46, -80],
  [46, -40],
  [0, -40],
  [0, 0],
  [-46, 0],
  [-46, 40],
  [-46, 80],
  [-92, 80],
  [-92, -40],
];
const attachments = FARM_ROADS.map((r, i) => ({
  segment: [9, 8, 17, 18, 0, 10][i],
  ...r.points[0],
  via: r.points.slice(1, -1),
}));
// Reserve each country-road junction before vehicles turn across opposing lanes.
// The holding line must clear the whole turn, including the tail of a bus.
const forkZones = attachments.map((a) => ({ x: a.x, z: a.z, radius: 12 }));
const points = [];
const append = (p) => {
  if (
    !points.length ||
    Math.hypot(points.at(-1).x - p.x, points.at(-1).z - p.z) > 0.001
  )
    points.push(p);
};
for (let i = 0; i < grid.length; i++) {
  append({ x: grid[i][0], z: grid[i][1] });
  attachments.forEach((a, farm) => {
    if (a.segment === i) {
      append({ x: a.x, z: a.z });
      a.via.forEach(append);
      const last = a.via.at(-1) || a,
        destination = FARMS[farm],
        length = Math.hypot(destination.x - last.x, destination.z - last.z),
        t = Math.max(0, 1 - 55 / length);
      append({
        x: last.x + (destination.x - last.x) * t,
        z: last.z + (destination.z - last.z) * t,
      });
      [...a.via].reverse().forEach(append);
      append({ x: a.x, z: a.z });
    }
  });
}
const unit = (x, z) => {
  const d = Math.hypot(x, z) || 1;
  return { x: x / d, z: z / d };
};
function add(p, heading, limit) {
  const last = samples.at(-1);
  samples.push({
    ...p,
    heading,
    limit,
    distance: last ? last.distance + Math.hypot(p.x - last.x, p.z - last.z) : 0,
  });
}
// Collinear grid nodes do not need their own turns.
for (let i = points.length - 1; i >= 0; i--) {
  const a = points[(i + points.length - 1) % points.length],
    p = points[i],
    b = points[(i + 1) % points.length];
  const f = unit(p.x - a.x, p.z - a.z),
    g = unit(b.x - p.x, b.z - p.z);
  if (f.x * g.x + f.z * g.z > 0.99999) points.splice(i, 1);
}
const geometry = points.map((p, i) => {
  const a = points[(i + points.length - 1) % points.length],
    b = points[(i + 1) % points.length],
    f = unit(p.x - a.x, p.z - a.z),
    g = unit(b.x - p.x, b.z - p.z),
    dot = f.x * g.x + f.z * g.z;
  if (dot < -0.99) {
    const n = { x: -f.z, z: f.x };
    return {
      p,
      f,
      g,
      dot,
      start: { x: p.x + n.x * LANE, z: p.z + n.z * LANE },
      end: { x: p.x - n.x * LANE, z: p.z - n.z * LANE },
    };
  }
  const scale = LANE / (1 + dot),
    m = { x: p.x + (-f.z - g.z) * scale, z: p.z + (f.x + g.x) * scale };
  return { p, f, g, dot, start: m, end: m };
});
const corners = geometry.map(({ p, f, g, dot, start, end }, i) => {
  if (dot < -0.99) {
    const n = { x: -f.z, z: f.x };
    return Array.from({ length: 65 }, (_, j) => {
      const t = (j / 64) * Math.PI;
      return {
        x: p.x + f.x * Math.sin(t) * LANE + n.x * Math.cos(t) * LANE,
        z: p.z + f.z * Math.sin(t) * LANE + n.z * Math.cos(t) * LANE,
        heading: Math.atan2(
          f.z * Math.cos(t) - n.z * Math.sin(t),
          f.x * Math.cos(t) - n.x * Math.sin(t),
        ),
        limit: 4.5,
      };
    });
  }
  const previous = geometry[(i + geometry.length - 1) % geometry.length].end,
    next = geometry[(i + 1) % geometry.length].start;
  const incoming = (start.x - previous.x) * f.x + (start.z - previous.z) * f.z,
    outgoing = (next.x - start.x) * g.x + (next.z - start.z) * g.z;
  const trim = Math.max(0.1, Math.min(10, incoming * 0.45, outgoing * 0.45)),
    turn = Math.atan2(f.x * g.z - f.z * g.x, dot),
    radius = trim / Math.abs(Math.tan(turn / 2)),
    sign = Math.sign(turn);
  const a = { x: start.x - f.x * trim, z: start.z - f.z * trim },
    center = { x: a.x - f.z * sign * radius, z: a.z + f.x * sign * radius },
    initial = Math.atan2(a.z - center.z, a.x - center.x);
  return Array.from({ length: 49 }, (_, j) => {
    const t = j / 48,
      angle = initial + turn * t;
    return {
      x: center.x + Math.cos(angle) * radius,
      z: center.z + Math.sin(angle) * radius,
      heading: Math.atan2(f.z, f.x) + turn * t,
      limit: Math.min(9, Math.max(3.5, radius * 1.4)),
    };
  });
});
for (let i = 0; i < corners.length; i++) {
  for (const p of corners[i]) add(p, p.heading, p.limit);
  const a = corners[i].at(-1),
    b = corners[(i + 1) % corners.length][0];
  // The last sample of each straight also starts the next smooth corner.
  add(
    b,
    Math.atan2(b.z - a.z, b.x - a.x),
    Math.hypot(b.x, b.z) > 125 ? 18 : 15,
  );
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
      4 * angleDiff(v.heading || 0, heading) ** 2;
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
      trafficSpeed: Math.min(13 + (id % 3), pose.limit),
      speed: 13 + (id % 3),
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
  for (let i = 0; i < forkZones.length; i++) {
    const zone = forkZones[i],
      distance = Math.hypot(v.x - zone.x, v.z - zone.z),
      release = zone.radius + 10;
    if (v.forkToken === i && distance > release) v.forkToken = null;
    if (distance > zone.radius + 18) continue;
    const future = trafficPose(v.trafficDistance + 3),
      approaching = Math.hypot(future.x - zone.x, future.z - zone.z) < distance;
    if (!approaching && v.forkToken !== i) continue;
    let owner = vehicles.find(
      (o) =>
        !o.stolen &&
        o.forkToken === i &&
        Math.hypot(o.x - zone.x, o.z - zone.z) <= release,
    );
    if (!owner) {
      owner = vehicles
        .filter(
          (o) =>
            !o.stolen &&
            Math.hypot(o.x - zone.x, o.z - zone.z) < zone.radius + 18,
        )
        .filter((o) => {
          const p = trafficPose((o.trafficDistance || 0) + 3);
          return (
            Math.hypot(p.x - zone.x, p.z - zone.z) <
            Math.hypot(o.x - zone.x, o.z - zone.z)
          );
        })
        .sort(
          (a, b) =>
            Math.hypot(a.x - zone.x, a.z - zone.z) -
              Math.hypot(b.x - zone.x, b.z - zone.z) || a.id - b.id,
        )[0];
      if (owner) owner.forkToken = i;
    }
    if (owner && owner !== v)
      target = Math.min(
        target,
        Math.max(0, (distance - zone.radius - 4) / 1.2),
      );
  }
  // Yield before perpendicular lane crossings. Arrival time breaks ties;
  // a stable vehicle ID decides simultaneous arrivals without a central queue.
  const forward = { x: Math.cos(pose.heading), z: Math.sin(pose.heading) };
  for (const other of vehicles) {
    if (
      v.forkToken != null ||
      other === v ||
      other.stolen ||
      Math.hypot(other.x - v.x, other.z - v.z) > 30
    )
      continue;
    const direction = {
        x: Math.cos(other.heading),
        z: Math.sin(other.heading),
      },
      cross = forward.x * direction.z - forward.z * direction.x;
    if (Math.abs(cross) < 0.45) continue;
    const dx = other.x - v.x,
      dz = other.z - v.z,
      a = (dx * direction.z - dz * direction.x) / cross,
      b = (dx * forward.z - dz * forward.x) / cross;
    if (a < 0 || b < 0 || a > 24 || b > 24) continue;
    const eta = a / Math.max(2, speed),
      theirEta = b / Math.max(2, other.trafficSpeed || 0);
    if (
      Math.abs(eta - theirEta) < 3 &&
      (theirEta < eta - 0.6 ||
        (Math.abs(eta - theirEta) <= 0.6 && other.id < v.id))
    )
      target = Math.min(
        target,
        Math.max(
          0,
          (a - vehicleSize(v).halfLength - vehicleSize(other).halfWidth - 2) /
            1.2,
        ),
      );
  }

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
    if (v.mergeWait > 2.5 && v.id % 2 === 0) {
      v.mergeBackup = 6;
      v.mergeWait = 0;
    }
  }
}

// Plan distant ordinary traffic at 10 Hz, but interpolate route position every
// physics tick. Promotion is continuous; nearby interactions use full physics.
export function stepDistantTraffic(v, dt, vehicles, level = 0) {
  let plan = v.distantPlan;
  if (!plan || plan.age >= 0.1) {
    const before = {
      x: v.x,
      z: v.z,
      heading: v.heading,
      trafficDistance: v.trafficDistance ?? nearestTrafficDistance(v),
    };
    v.trafficDistance = before.trafficDistance;
    stepTraffic(v, 0.1, vehicles, level);
    plan = {
      from: before,
      to: {
        x: v.x,
        z: v.z,
        heading: v.heading,
        trafficDistance: v.trafficDistance,
      },
      age: 0,
    };
    Object.assign(v, before);
    v.distantPlan = plan;
  }
  plan.age = Math.min(0.1, plan.age + dt);
  const t = plan.age / 0.1;
  v.x = plan.from.x + (plan.to.x - plan.from.x) * t;
  v.z = plan.from.z + (plan.to.z - plan.from.z) * t;
  v.heading =
    plan.from.heading + angleDiff(plan.to.heading, plan.from.heading) * t;
  const distance =
    wrap(
      plan.to.trafficDistance - plan.from.trafficDistance + TRAFFIC_LENGTH / 2,
    ) -
    TRAFFIC_LENGTH / 2;
  v.trafficDistance = wrap(plan.from.trafficDistance + distance * t);
}
