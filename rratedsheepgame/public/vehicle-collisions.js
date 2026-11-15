import { vehicleProfile } from "./vehicles.js?v=home-police-1";
import { blocked, OBSTACLES, SIZE } from "./region.js?v=home-police-1";
export const vehicleSize = (v) => {
  const p = vehicleProfile(v);
  return {
    halfLength: p.length / 2,
    halfWidth: p.width / 2 + 0.025,
    mass: p.mass,
  };
};
const axes = (v) => [
  { x: Math.cos(v.heading), z: Math.sin(v.heading) },
  { x: -Math.sin(v.heading), z: Math.cos(v.heading) },
];
export function vehicleOverlap(a, b) {
  const aa = axes(a),
    bb = axes(b),
    sa = vehicleSize(a),
    sb = vehicleSize(b),
    dx = b.x - a.x,
    dz = b.z - a.z;
  let depth = Infinity,
    normal;
  for (const axis of [...aa, ...bb]) {
    const radius = (basis, size) =>
      Math.abs(axis.x * basis[0].x + axis.z * basis[0].z) * size.halfLength +
      Math.abs(axis.x * basis[1].x + axis.z * basis[1].z) * size.halfWidth;
    const projection = dx * axis.x + dz * axis.z,
      overlap = radius(aa, sa) + radius(bb, sb) - Math.abs(projection);
    if (overlap <= 0) return null;
    if (overlap < depth) {
      depth = overlap;
      const sign = projection < 0 ? -1 : 1;
      normal = { x: axis.x * sign, z: axis.z * sign };
    }
  }
  return { ...normal, depth };
}
export function vehicleBlocked(v, p = v, level = 0) {
  const size = vehicleSize(v),
    f = axes({ ...v, ...p })[0],
    n = { x: -f.z, z: f.x };
  for (const length of [-size.halfLength, 0, size.halfLength])
    for (const width of [-size.halfWidth, 0, size.halfWidth])
      if (
        (p.y ?? v.y ?? 0) > 2.5
          ? ((q) =>
              Math.abs(q.x) > SIZE - 4 ||
              Math.abs(q.z) > SIZE - 4 ||
              OBSTACLES.some(
                (b) =>
                  b.h > (p.y ?? v.y ?? 0) &&
                  Math.abs(q.x - b.x) < b.hx + 0.12 &&
                  Math.abs(q.z - b.z) < b.hz + 0.12,
              ))({
              x: p.x + f.x * length + n.x * width,
              z: p.z + f.z * length + n.z * width,
            })
          : blocked(
              {
                x: p.x + f.x * length + n.x * width,
                z: p.z + f.z * length + n.z * width,
              },
              0.12,
              level,
            )
      )
        return true;
  return false;
}
export function circleVehicle(p, v, r = 0.5) {
  const [f, n] = axes(v),
    s = vehicleSize(v),
    dx = p.x - v.x,
    dz = p.z - v.z;
  const x = dx * f.x + dz * f.z,
    z = dx * n.x + dz * n.z;
  const qx = Math.max(-s.halfLength, Math.min(s.halfLength, x)),
    qz = Math.max(-s.halfWidth, Math.min(s.halfWidth, z));
  const ex = x - qx,
    ez = z - qz,
    d = Math.hypot(ex, ez);
  if (d >= r) return null;
  if (d > 1e-8)
    return {
      x: (f.x * ex + n.x * ez) / d,
      z: (f.z * ex + n.z * ez) / d,
      depth: r - d,
    };
  const dl = s.halfLength - Math.abs(x),
    dw = s.halfWidth - Math.abs(z),
    axis = dl < dw ? f : n,
    sign = (dl < dw ? x : z) < 0 ? -1 : 1;
  return { x: axis.x * sign, z: axis.z * sign, depth: r + Math.min(dl, dw) };
}
const poseAt = (v, t) => {
  const p = v.previous || v;
  const dh = Math.atan2(
    Math.sin(v.heading - (p.heading ?? v.heading)),
    Math.cos(v.heading - (p.heading ?? v.heading)),
  );
  return {
    ...v,
    x: p.x + (v.x - p.x) * t,
    z: p.z + (v.z - p.z) * t,
    heading: (p.heading ?? v.heading) + dh * t,
    y: (p.y ?? v.y ?? 0) + ((v.y || 0) - (p.y ?? v.y ?? 0)) * t,
  };
};
export function vehiclePersonContact(v, from, to, r = 0.5, height = 2.1) {
  for (let i = 0; i <= 10; i++) {
    const t = i / 10,
      p = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
    const car = poseAt(v, t),
      foot = (from.y || 0) + ((to.y || 0) - (from.y || 0)) * t;
    if (foot > car.y + 2.2 || foot + height < car.y) continue;
    if (circleVehicle(p, car, r)) return true;
  }
  return false;
}
export function resolveVehicleCollisions(
  vehicles,
  time,
  level = 0,
  onImpact = () => {},
) {
  let contacts = 0;
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < vehicles.length; i++)
      for (let j = i + 1; j < vehicles.length; j++) {
        const a = vehicles[i],
          b = vehicles[j];
        if (
          Math.hypot(a.x - b.x, a.z - b.z) > 12 ||
          Math.abs((a.y || 0) - (b.y || 0)) > 2.2
        )
          continue;
        let hit = vehicleOverlap(a, b);
        if (!hit && pass === 0) {
          for (let k = 1; k < 10; k++) {
            const pa = poseAt(a, k / 10),
              pb = poseAt(b, k / 10),
              swept = vehicleOverlap(pa, pb);
            if (swept) {
              a.x = pa.x;
              a.z = pa.z;
              a.heading = pa.heading;
              b.x = pb.x;
              b.z = pb.z;
              b.heading = pb.heading;
              hit = swept;
              break;
            }
          }
        }
        if (!hit) continue;
        contacts++;
        const ma = vehicleSize(a).mass,
          mb = vehicleSize(b).mass,
          total = ma + mb;
        const push = (v, amount) => {
          const p = { x: v.x + hit.x * amount, z: v.z + hit.z * amount };
          if (!vehicleBlocked(v, p, level)) {
            v.x = p.x;
            v.z = p.z;
            return true;
          }
          return false;
        };
        const movedA = push(a, (-(hit.depth + 0.02) * mb) / total);
        const movedB = push(b, ((hit.depth + 0.02) * ma) / total);
        if (!movedA && movedB) push(b, ((hit.depth + 0.02) * mb) / total);
        if (!movedB && movedA) push(a, (-(hit.depth + 0.02) * ma) / total);
        const n = { x: hit.x, z: hit.z },
          t = { x: -hit.z, z: hit.x };
        const extent = (v, axis) => {
          const basis = axes(v),
            size = vehicleSize(v);
          return (
            Math.abs(axis.x * basis[0].x + axis.z * basis[0].z) *
              size.halfLength +
            Math.abs(axis.x * basis[1].x + axis.z * basis[1].z) * size.halfWidth
          );
        };
        const dot = (v, axis) => v.x * axis.x + v.z * axis.z;
        const normal =
          (dot(a, n) + extent(a, n) + dot(b, n) - extent(b, n)) / 2;
        const low = Math.max(
            dot(a, t) - extent(a, t),
            dot(b, t) - extent(b, t),
          ),
          high = Math.min(dot(a, t) + extent(a, t), dot(b, t) + extent(b, t));
        const tangent = (low + high) / 2,
          point = {
            x: n.x * normal + t.x * tangent,
            z: n.z * normal + t.z * tangent,
          };
        const ra = { x: point.x - a.x, z: point.z - a.z },
          rb = { x: point.x - b.x, z: point.z - b.z };
        const ia =
            (ma *
              ((vehicleSize(a).halfLength * 2) ** 2 +
                (vehicleSize(a).halfWidth * 2) ** 2)) /
            12,
          ib =
            (mb *
              ((vehicleSize(b).halfLength * 2) ** 2 +
                (vehicleSize(b).halfWidth * 2) ** 2)) /
            12;
        const cross = (r, d) => r.x * d.z - r.z * d.x;
        const relative = () => ({
          x:
            (b.vx || 0) -
            (b.omega || 0) * rb.z -
            (a.vx || 0) +
            (a.omega || 0) * ra.z,
          z:
            (b.vz || 0) +
            (b.omega || 0) * rb.x -
            (a.vz || 0) -
            (a.omega || 0) * ra.x,
        });
        const velocity = relative(),
          closing = -(velocity.x * n.x + velocity.z * n.z);
        const impulse = (amount, d) => {
          a.vx = (a.vx || 0) - (amount * d.x) / ma;
          a.vz = (a.vz || 0) - (amount * d.z) / ma;
          b.vx = (b.vx || 0) + (amount * d.x) / mb;
          b.vz = (b.vz || 0) + (amount * d.z) / mb;
          a.omega = (a.omega || 0) - (cross(ra, d) * amount) / ia;
          b.omega = (b.omega || 0) + (cross(rb, d) * amount) / ib;
        };
        if (closing > 0) {
          const j =
            (1.12 * closing) /
            (1 / ma + 1 / mb + cross(ra, n) ** 2 / ia + cross(rb, n) ** 2 / ib);
          impulse(j, n);
          const after = relative(),
            slip = after.x * t.x + after.z * t.z;
          const jt =
            -slip /
            (1 / ma + 1 / mb + cross(ra, t) ** 2 / ia + cross(rb, t) ** 2 / ib);
          impulse(Math.max(-j * 0.35, Math.min(j * 0.35, jt)), t);
          if (closing > 3) {
            const energy = 0.5 * ((ma * mb) / total) * closing * closing;
            onImpact(a, (energy * 0.3) / Math.sqrt(ma));
            onImpact(b, (energy * 0.3) / Math.sqrt(mb));
          }
        }
        for (const v of [a, b]) {
          v.driveSpeed = Math.hypot(v.vx || 0, v.vz || 0);
          v.currentSpeed = v.driveSpeed;
          v.skidding = false;
          v.skidAnchor = null;
          if (closing > 0.2 && time >= (v.collisionUntil || 0)) {
            v.collisionUntil = time + 1;
            v.disabled = Math.max(v.disabled || 0, 0.8);
            v.physicsUntil = Math.max(
              v.physicsUntil || 0,
              time + Math.min(1.5, 0.2 + closing * 0.06),
            );
            v.crashRecovering = true;
            v.rejoinDistance = undefined;
            // Traffic keeps its route after a crash; never flip its lane or heading.
          }
        }
      }
  return contacts;
}
