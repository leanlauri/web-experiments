import {
  vehicleBlocked,
  vehicleSize,
} from "./vehicle-collisions.js?v=city-action-2";
export function moveVehicle(
  v,
  dt,
  level = 0,
  { drag = 0, angularDrag = 1.8 } = {},
) {
  if (dt <= 0) return;
  v.vx ??= 0;
  v.vz ??= 0;
  v.omega ??= 0;
  v.y ??= 0;
  v.vy ??= 0;
  const steps = Math.max(
    1,
    Math.ceil((Math.hypot(v.vx, v.vz) * dt) / 0.35),
    Math.ceil(dt * 120),
  );
  for (let i = 0; i < steps; i++) {
    const step = dt / steps,
      oldHeading = v.heading;
    v.heading += v.omega * step;
    if (v.y < 0.1 && vehicleBlocked(v, v, level)) {
      v.heading = oldHeading;
      v.omega *= -0.2;
    }
    const dx = v.vx * step,
      dz = v.vz * step,
      next = { x: v.x + dx, z: v.z + dz };
    if (!vehicleBlocked(v, next, level)) {
      v.x = next.x;
      v.z = next.z;
    } else {
      const blockX = vehicleBlocked(v, { x: v.x + dx, z: v.z }, level),
        blockZ = vehicleBlocked(v, { x: v.x, z: v.z + dz }, level);
      // Reflect only the blocked normal component; retain tangential momentum.
      const impact =
        Math.hypot(blockX ? v.vx : 0, blockZ ? v.vz : 0) ||
        Math.hypot(v.vx, v.vz);
      if (blockX || (!blockX && !blockZ)) v.vx *= -0.18;
      else v.x += dx;
      if (blockZ || (!blockX && !blockZ)) v.vz *= -0.18;
      else v.z += dz;
      if (impact > 4) {
        v.wallDamage = (v.wallDamage || 0) + impact * impact * 0.12;
        v.physicsUntil = Math.max(
          v.physicsUntil || 0,
          (v.motionTime || 0) + 0.35,
        );
      }
    }
    if (v.y > 0 || v.vy > 0) {
      v.vy -= 20 * step;
      v.y += v.vy * step;
      if (v.y < 0) {
        v.y = 0;
        v.vy = Math.abs(v.vy) > 3 ? -v.vy * 0.18 : 0;
      }
    }
    const friction = Math.exp(-drag * step);
    v.vx *= friction;
    v.vz *= friction;
    v.omega *= Math.exp(-angularDrag * step);
    if (v.y > 0) {
      v.roll = (v.roll || 0) + (v.rollVelocity || 0) * step;
      v.pitch = (v.pitch || 0) + (v.pitchVelocity || 0) * step;
    } else {
      v.roll = (v.roll || 0) * Math.exp(-step * 5);
      v.pitch = (v.pitch || 0) * Math.exp(-step * 5);
      v.rollVelocity = (v.rollVelocity || 0) * Math.exp(-step * 4);
      v.pitchVelocity = (v.pitchVelocity || 0) * Math.exp(-step * 4);
    }
  }
  v.driveSpeed = v.currentSpeed = Math.hypot(v.vx, v.vz);
}
export function freeVehicle(v, dt, time, level = 0) {
  v.motionTime = time;
  if (
    Math.hypot(v.vx || 0, v.vz || 0) < 0.001 &&
    Math.abs(v.vy || 0) < 0.001 &&
    (v.y || 0) === 0 &&
    Math.abs(v.omega || 0) < 0.001 &&
    Math.abs(v.roll || 0) < 0.001 &&
    Math.abs(v.pitch || 0) < 0.001
  ) {
    v.vx = v.vz = v.driveSpeed = v.currentSpeed = 0;
    return;
  }
  moveVehicle(v, dt, level, {
    drag: v.y > 0 ? 0.15 : 1.15,
    angularDrag: v.y > 0 ? 0.18 : 1.8,
  });
  if (v.driveSpeed < 0.02) {
    v.vx = v.vz = 0;
    v.driveSpeed = v.currentSpeed = 0;
  }
}
export function vehicleInertia(v) {
  const p = vehicleSize(v);
  return (p.mass * ((p.halfLength * 2) ** 2 + (p.halfWidth * 2) ** 2)) / 12;
}
