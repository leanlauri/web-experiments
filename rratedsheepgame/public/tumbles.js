import { move } from "./region.js?v=town-equipment-1";
export function startTumble(body, velocity, time) {
  if (body.ragdoll || time < (body.impactImmuneUntil || 0)) return false;
  const speed = Math.hypot(velocity.x, velocity.z),
    scale = Math.min(13, speed * 0.6 + 3) / (speed || 1),
    side = (body.id || 0) % 2 ? -1 : 1;
  body.ragdoll = {
    age: 0,
    phase: "flying",
    vx: velocity.x * scale,
    vz: velocity.z * scale,
    vy: 6 + Math.min(3, speed * 0.12),
    height: body.y || 0,
    rx: 0,
    rz: 0,
    spinX: 6,
    spinZ: side * 7,
    still: 0,
    recovery: 0,
  };
  body.impactImmuneUntil = time + 8;
  body.starsUntil = time + 8;
  return true;
}
export function stepTumble(body, dt, time, level = 0) {
  const r = body.ragdoll;
  if (!r) return false;
  r.age += dt;
  if (r.phase === "recovering") {
    r.recovery = Math.min(1, r.recovery + dt / 0.8);
    const smooth = r.recovery * r.recovery * (3 - 2 * r.recovery);
    r.rx = r.restX * (1 - smooth);
    r.rz = r.restZ * (1 - smooth);
    if (r.recovery >= 1) {
      body.ragdoll = null;
      body.y = 0;
      body.vy = 0;
      body.down = typeof body.down === "number" ? 0 : false;
      body.starsUntil = time + 2;
      body.impactImmuneUntil = time + 2;
    }
    return true;
  }
  const old = { x: body.x, z: body.z };
  move(body, r.vx * dt, r.vz * dt, 0.5, level);
  if (Math.abs(body.x - old.x) < Math.abs(r.vx * dt) * 0.2) r.vx *= -0.2;
  if (Math.abs(body.z - old.z) < Math.abs(r.vz * dt) * 0.2) r.vz *= -0.2;
  r.vy -= 20 * dt;
  r.height += r.vy * dt;
  if (r.height <= 0) {
    r.height = 0;
    if (r.vy < -3) r.vy *= -0.23;
    else r.vy = 0;
  }
  const grounded = r.height === 0,
    drag = Math.exp(-dt * (grounded ? 5 : 0.35));
  r.vx *= drag;
  r.vz *= drag;
  r.spinX *= Math.exp(-dt * (grounded ? 5 : 0.25));
  r.spinZ *= Math.exp(-dt * (grounded ? 5 : 0.25));
  r.rx += r.spinX * dt;
  r.rz += r.spinZ * dt;
  body.y = r.height;
  r.still = grounded && Math.hypot(r.vx, r.vz) < 0.25 ? r.still + dt : 0;
  if (r.still > 0.4 || r.age > 5) {
    r.phase = "recovering";
    r.restX = Math.atan2(Math.sin(r.rx), Math.cos(r.rx));
    r.restZ = Math.atan2(Math.sin(r.rz), Math.cos(r.rz));
    r.rx = r.restX;
    r.rz = r.restZ;
    r.height = body.y = 0;
  }
  return true;
}
export function clearTumble(body) {
  body.ragdoll = null;
  body.y = body.vy = 0;
  body.starsUntil = 0;
  body.impactImmuneUntil = 0;
}
