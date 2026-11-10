import { blocked } from "./region.js";
export const vehicleSize = (v) => ({
  halfLength: v.kind === "bus" ? 3 : v.kind === "van" ? 2.25 : 1.6,
  halfWidth: 1.15,
  mass:
    v.kind === "bus" ? 5 : v.kind === "van" ? 3 : v.kind === "buggy" ? 1 : 1.6,
});
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
        blocked(
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
  };
};
export function vehiclePersonContact(v, from, to, r = 0.5) {
  for (let i = 0; i <= 10; i++) {
    const t = i / 10,
      p = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
    if ((from.y || 0) + ((to.y || 0) - (from.y || 0)) * t > 2.2) continue;
    if (circleVehicle(p, poseAt(v, t), r)) return true;
  }
  return false;
}
export function resolveVehicleCollisions(vehicles, time, level = 0) {
  let contacts = 0;
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < vehicles.length; i++)
      for (let j = i + 1; j < vehicles.length; j++) {
        const a = vehicles[i],
          b = vehicles[j];
        if (Math.hypot(a.x - b.x, a.z - b.z) > 12) continue;
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
          } else if (v.previous) {
            v.x = v.previous.x;
            v.z = v.previous.z;
            v.heading = v.previous.heading ?? v.heading;
          }
        };
        push(a, (-(hit.depth + 0.02) * mb) / total);
        push(b, ((hit.depth + 0.02) * ma) / total);
        const av = { x: a.vx || 0, z: a.vz || 0 },
          bv = { x: b.vx || 0, z: b.vz || 0 };
        const closing = (av.x - bv.x) * hit.x + (av.z - bv.z) * hit.z;
        if (closing > 0) {
          const impulse = (1.12 * closing) / (1 / ma + 1 / mb);
          a.vx = av.x - (impulse / ma) * hit.x;
          a.vz = av.z - (impulse / ma) * hit.z;
          b.vx = bv.x + (impulse / mb) * hit.x;
          b.vz = bv.z + (impulse / mb) * hit.z;
        }
        for (const v of [a, b]) {
          v.driveSpeed = Math.hypot(v.vx || 0, v.vz || 0);
          v.currentSpeed = v.driveSpeed;
          v.skidding = false;
          v.skidAnchor = null;
          if (time >= (v.collisionUntil || 0)) {
            v.collisionUntil = time + 1;
            v.disabled = Math.max(v.disabled || 0, 0.8);
            if (!v.stolen) v.dir *= -1;
          }
        }
      }
  return contacts;
}
