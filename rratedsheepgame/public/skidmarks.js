export const SKID_LIFETIME = 8;
export const MAX_SKID_SEGMENTS = 1200;
export function recordSkidmarks(marks, vehicle, time) {
  if (!vehicle.skidding) {
    vehicle.skidAnchor = null;
    return;
  }
  const old = vehicle.skidAnchor;
  const pose = { x: vehicle.x, z: vehicle.z, heading: vehicle.heading };
  if (!old) {
    vehicle.skidAnchor = pose;
    return;
  }
  if (Math.hypot(pose.x - old.x, pose.z - old.z) < 0.28) return;
  const rear =
    vehicle.kind === "bus" ? 1.9 : vehicle.kind === "van" ? 1.44 : 1.02;
  const tire = (p, side) => ({
    x: p.x - Math.cos(p.heading) * rear - Math.sin(p.heading) * side,
    z: p.z - Math.sin(p.heading) * rear + Math.cos(p.heading) * side,
  });
  for (const side of [-0.92, 0.92]) {
    const a = tire(old, side),
      b = tire(pose, side);
    marks.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z, born: time });
  }
  if (marks.length > MAX_SKID_SEGMENTS)
    marks.splice(0, marks.length - MAX_SKID_SEGMENTS);
  vehicle.skidAnchor = pose;
}
export function skidOpacity(mark, time) {
  return (
    0.36 * Math.max(0, Math.min(1, (SKID_LIFETIME - (time - mark.born)) / 4))
  );
}
