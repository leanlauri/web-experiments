import { blocked, road } from "./region.js";

const PROFILES = {
  buggy: { top: 34, acceleration: 11, wheelbase: 2, steering: 0.62 },
  car: { top: 32, acceleration: 9, wheelbase: 2.5, steering: 0.58 },
  van: { top: 28, acceleration: 7, wheelbase: 3.1, steering: 0.52 },
  bus: { top: 24, acceleration: 5, wheelbase: 4.5, steering: 0.48 },
};
const approach = (value, target, amount) =>
  value < target
    ? Math.min(target, value + amount)
    : Math.max(target, value - amount);
const clamp = (value) => Math.max(-1, Math.min(1, Number(value) || 0));

// Signed speed follows the vehicle's nose; steering alone can never translate it.
export function drive(vehicle, dt, input = {}, level = 0) {
  if (dt <= 0) return;
  const profile = PROFILES[vehicle.kind] || PROFILES.car;
  const throttle = clamp(input.throttle),
    steer = clamp(input.steer);
  let speed = vehicle.driveSpeed || 0;
  const top = profile.top * (road(vehicle) ? 1 : 0.55);
  const reversing =
    throttle &&
    Math.sign(throttle) !== Math.sign(speed) &&
    Math.abs(speed) > 0.1;
  if (input.brake || reversing) {
    speed = approach(
      speed,
      0,
      23 * dt * (input.brake ? 1.35 : Math.abs(throttle)),
    );
  } else if (Math.abs(throttle) > 0.03) {
    const target = throttle * (throttle < 0 ? Math.min(9, top * 0.35) : top);
    speed = approach(speed, target, profile.acceleration * dt);
  } else {
    speed = approach(speed, 0, (1.3 + Math.abs(speed) * 0.065) * dt);
  }
  // Grass gradually slows the car rather than cutting its speed instantly.
  if (Math.abs(speed) > top)
    speed = approach(speed, Math.sign(speed) * top, 9 * dt);
  vehicle.steerAngle = approach(
    vehicle.steerAngle || 0,
    steer * profile.steering,
    2.4 * dt,
  );
  const start = { x: vehicle.x, z: vehicle.z };
  const steps = Math.max(1, Math.ceil((Math.abs(speed) * dt) / 0.4));
  for (let i = 0; i < steps; i++) {
    const step = dt / steps;
    // Reduce steering lock at speed. Reverse naturally changes the turning direction.
    const yawRate =
      ((speed / profile.wheelbase) * Math.tan(vehicle.steerAngle)) /
      (1 + Math.abs(speed) * 0.09);
    const heading = vehicle.heading + yawRate * step;
    const next = {
      x: vehicle.x + Math.cos((vehicle.heading + heading) / 2) * speed * step,
      z: vehicle.z + Math.sin((vehicle.heading + heading) / 2) * speed * step,
    };
    if (blocked(next, 1.4, level)) {
      speed = 0;
      break;
    }
    vehicle.x = next.x;
    vehicle.z = next.z;
    vehicle.heading = Math.atan2(Math.sin(heading), Math.cos(heading));
  }
  vehicle.driveSpeed = speed;
  vehicle.currentSpeed =
    Math.hypot(vehicle.x - start.x, vehicle.z - start.z) / dt;
}
