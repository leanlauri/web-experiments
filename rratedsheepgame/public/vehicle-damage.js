import { vehicleProfile } from "./vehicles.js?v=home-police-1";
export const FIRE_SECONDS = 5,
  BLAST_RADIUS = 16;
export function initVehicleHealth(v) {
  v.maxHealth ??= Math.round(100 + vehicleProfile(v).mass * 20);
  v.health ??= v.maxHealth;
  return v;
}
export function damageVehicle(v, damage, time) {
  initVehicleHealth(v);
  if (v.destroyed || damage <= 0) return false;
  v.health = Math.max(0, v.health - damage);
  v.hitAt = time;
  if (v.health <= v.maxHealth * 0.2 && v.burnStarted === undefined) {
    v.burnStarted = time;
    return true;
  }
  return false;
}
