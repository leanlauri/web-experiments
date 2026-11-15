import { moveVehicle } from "./vehicle-motion.js?v=scenery-colliders-1";
import { vehicleProfile } from "./vehicles.js?v=scenery-colliders-1";
import { road } from "./region.js?v=scenery-colliders-1";
import { vehicleBlocked } from "./vehicle-collisions.js?v=scenery-colliders-1";

const approach = (value, target, amount) =>
  value < target
    ? Math.min(target, value + amount)
    : Math.max(target, value - amount);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Directional input aims the car. Velocity stays independent of its nose, so
// turning requires tire grip to redirect momentum rather than rotating it instantly.
export function drive(v, dt, input = {}, level = 0) {
  if (dt <= 0) return;
  const profile = vehicleProfile(v);
  if (v.destroyed) return;
  let dx = Number(input.x) || 0,
    dz = Number(input.z) || 0;
  const length = Math.hypot(dx, dz),
    strength = Math.min(1, length);
  if (length > 1) {
    dx /= length;
    dz /= length;
  }
  let vx = v.vx ?? Math.cos(v.heading) * (v.driveSpeed || 0);
  let vz = v.vz ?? Math.sin(v.heading) * (v.driveSpeed || 0);
  const start = { x: v.x, z: v.z };
  v.skidding = false;
  const steps = Math.max(1, Math.ceil(dt * 120));
  for (let i = 0; i < steps; i++) {
    const step = dt / steps,
      speed = Math.hypot(vx, vz),
      paved = road(v);
    const top =
      profile.top *
      (paved ? 1 : 0.55) *
      (v.burnStarted !== undefined ? 0.65 : 1);
    const error =
      strength > 0.05 ? angleDifference(Math.atan2(dz, dx), v.heading) : 0;
    const yaw =
      (Math.max(-1, Math.min(1, error * 2)) * profile.turn) /
      (1 + speed * 0.025);
    const oldHeading = v.heading;
    v.heading = angleDifference(v.heading + yaw * step, 0);
    if (vehicleBlocked(v, v, level)) v.heading = oldHeading;
    v.steerAngle = approach(
      v.steerAngle || 0,
      Math.max(-0.6, Math.min(0.6, error)),
      step * 2.4,
    );
    const fx = Math.cos(v.heading),
      fz = Math.sin(v.heading);
    let forward = vx * fx + vz * fz,
      lateral = -vx * fz + vz * fx;
    const grip = profile.grip * (paved ? 1 : 0.6) * (input.brake ? 0.45 : 1);
    if (speed > 6 && (input.brake || Math.abs(lateral) > 2.5))
      v.skidding = true;
    // Grip is a capped lateral force, not an instantaneous velocity rotation.
    lateral = approach(lateral, 0, grip * step);
    if (!input.brake && strength > 0.05)
      forward = approach(forward, top * strength, profile.acceleration * step);
    vx = fx * forward - fz * lateral;
    vz = fz * forward + fx * lateral;
    const magnitude = Math.hypot(vx, vz);
    const drag = input.brake
      ? 27
      : 1.3 + magnitude * 0.065 + (magnitude > top ? 9 : 0);
    const remaining = Math.max(0, magnitude - drag * step);
    if (magnitude) {
      vx *= remaining / magnitude;
      vz *= remaining / magnitude;
    }
    v.vx = vx;
    v.vz = vz;
    moveVehicle(v, step, level);
    vx = v.vx;
    vz = v.vz;
  }
  v.vx = vx;
  v.vz = vz;
  v.driveSpeed = Math.hypot(vx, vz);
  v.currentSpeed = Math.hypot(v.x - start.x, v.z - start.z) / dt;
}
