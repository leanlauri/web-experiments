import {
  HOME,
  dist,
  move,
  blocked,
  routeTarget,
} from "./region.js?v=home-police-1";
export const HERD_SPACING = {
  sheep: 2.5,
  cow: 3.2,
  pig: 2.6,
  goat: 2.7,
  alpaca: 2.9,
  rabbit: 1.7,
};
export function followAnimal(a, player, herd, home, dt, level) {
  const spacing = HERD_SPACING[a.type] || 2.5,
    index = herd.indexOf(a),
    column = (index % 3) - 1,
    row = Math.floor(index / 3) + 1;
  let goal;
  if (home)
    goal = { x: HOME.x + column * spacing, z: HOME.z + (row - 3) * spacing };
  else if (dist(a, player) > 32) goal = player;
  else {
    const f = { x: Math.cos(player.heading), z: Math.sin(player.heading) };
    goal = {
      x: player.x - f.x * row * spacing - f.z * column * spacing,
      z: player.z - f.z * row * spacing + f.x * column * spacing,
    };
    if (blocked(goal, 0.6, level)) goal = player;
  }
  const target = routeTarget(a, goal),
    d = dist(a, target);
  let vx = d ? ((target.x - a.x) / d) * Math.min(9, d * 1.8) : 0,
    vz = d ? ((target.z - a.z) / d) * Math.min(9, d * 1.8) : 0;
  for (const other of herd) {
    if (other === a || other.down || other.boarded !== null || other.ragdoll)
      continue;
    const gap = dist(a, other),
      desired = (spacing + (HERD_SPACING[other.type] || 2.5)) / 2;
    if (gap > 0 && gap < desired * 1.3) {
      const push = Math.max(0, (desired * 1.3 - gap) / (desired * 1.3)) * 7;
      vx += ((a.x - other.x) / gap) * push;
      vz += ((a.z - other.z) / gap) * push;
    }
  }
  const speed = Math.hypot(vx, vz);
  if (speed > 0.05) {
    const scale = Math.min(1, 9 / speed);
    const old = { x: a.x, z: a.z };
    move(a, vx * scale * dt, vz * scale * dt, 0.45, level);
    if (dist(a, old) > 0.005) a.heading = Math.atan2(a.z - old.z, a.x - old.x);
  }
}
export function separateHerd(herd, level) {
  const active = herd.filter(
    (a) => !a.down && !a.ragdoll && a.boarded === null,
  );
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i],
          b = active[j],
          distance = dist(a, b),
          minimum =
            ((HERD_SPACING[a.type] || 2.5) + (HERD_SPACING[b.type] || 2.5)) *
            0.45;
        if (distance >= minimum) continue;
        const nx = distance
            ? (b.x - a.x) / distance
            : Math.cos((a.id + 1) * 2.4),
          nz = distance ? (b.z - a.z) / distance : Math.sin((a.id + 1) * 2.4),
          push = (minimum - distance) * 0.5;
        move(a, -nx * push, -nz * push, 0.45, level);
        move(b, nx * push, nz * push, 0.45, level);
      }
}
