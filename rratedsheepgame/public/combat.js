import { dist, solidPathClear } from "./region.js?v=performance-1";
export const BULLET_SPEED = 90,
  AIM_SECONDS = 0.28,
  SHOT_RECOVERY = 0.16;
export function friendlyInLine(game, shooter, target) {
  const distance = dist(shooter, target);
  if (distance < 0.1) return false;
  const fx = (target.x - shooter.x) / distance,
    fz = (target.z - shooter.z) / distance;
  return [...game.guards, ...game.police].some((other) => {
    if (
      other === shooter ||
      other.down > 0 ||
      other.ragdoll ||
      other.inVehicle !== undefined
    )
      return false;
    const dx = other.x - shooter.x,
      dz = other.z - shooter.z,
      along = dx * fx + dz * fz;
    return along > 0 && along < distance && Math.abs(dx * fz - dz * fx) < 1.3;
  });
}
export function startAim(game, actor, weapon, target, owner) {
  if (actor.aim) return;
  actor.aim = {
    started: game.time,
    fireAt: game.time + AIM_SECONDS,
    weapon,
    target,
    owner,
  };
  actor.attack = {
    started: game.time,
    kind: "aim",
    weapon: weapon.id,
    duration: AIM_SECONDS,
  };
  if (target)
    actor.heading = Math.atan2(target.z - actor.z, target.x - actor.x);
}
export function stepAim(game, actor) {
  const aim = actor.aim;
  if (!aim) return false;
  if (
    actor.ragdoll ||
    actor.exitRoll ||
    actor.down > 0 ||
    actor.stun > 0 ||
    (aim.owner === "player" && (game.vehicle !== null || game.jail)) ||
    (aim.owner === "enemy" &&
      (game.atHome || (actor.farm === undefined && Math.ceil(game.wanted) < 2)))
  ) {
    actor.aim = null;
    return false;
  }
  const target = aim.target;
  if (target)
    actor.heading = Math.atan2(target.z - actor.z, target.x - actor.x);
  if (game.time + 1e-8 < aim.fireAt) return true;
  actor.aim = null;
  if (
    target &&
    (!solidPathClear(actor, target) ||
      (aim.owner === "enemy" && friendlyInLine(game, actor, target)))
  ) {
    actor.attack = null;
    actor.cooldown = Math.max(actor.cooldown || 0, 0.2);
    return false;
  }
  const angle = actor.heading,
    w = aim.weapon;
  actor.attack = {
    started: game.time,
    weapon: w.id,
    kind: "shoot",
    duration: 0.32,
  };
  actor.shotUntil = game.time + SHOT_RECOVERY;
  game.shots.push({
    x: actor.x,
    z: actor.z,
    y: (actor.y || 0) + 1.3,
    vx: Math.cos(angle) * BULLET_SPEED,
    vz: Math.sin(angle) * BULLET_SPEED,
    life: w.range / BULLET_SPEED,
    owner: aim.owner,
    shooterId: aim.owner === "player" ? "player" : actor.id,
    power: w.power,
  });
  if (aim.owner === "player") game.crime(0.35);
  return true;
}
