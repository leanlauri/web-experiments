import * as T from "./vendor/three.module.js";
const geo = new T.BoxGeometry(1, 1, 1),
  ball = new T.IcosahedronGeometry(1, 1),
  rod = new T.CylinderGeometry(1, 1, 1, 8);
const mats = new Map();
const mat = (c) => {
  if (!mats.has(c)) mats.set(c, new T.MeshLambertMaterial({ color: c }));
  return mats.get(c);
};
function part(g, c, x, y, z, sx, sy, sz, geometry = geo) {
  const m = new T.Mesh(geometry, mat(c));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  g.add(m);
  return m;
}
export function equipmentIcon(id) {
  const content =
    id === "revive"
      ? '<rect x="16" y="14" width="32" height="40" rx="6" fill="#8cbd7b"/><path d="M32 23v22M21 34h22" stroke="#fff5de" stroke-width="7"/>'
      : id < 2
        ? `<path d="M22 53L37 24" stroke="#b98e60" stroke-width="8" stroke-linecap="round"/><path d="M33 32L43 12" stroke="${id === 0 ? "#f3c66a" : "#a9d1dc"}" stroke-width="18" stroke-linecap="round"/>`
        : id === 2
          ? '<path d="M25 55l12-33" stroke="#ac8bcb" stroke-width="7"/><circle cx="40" cy="17" r="12" fill="none" stroke="#b7e9ee" stroke-width="5"/><circle cx="20" cy="15" r="5" fill="#b7e9ee"/>'
          : `<path d="M23 29l-5 22h12l5-20" fill="#f0b969"/><rect x="12" y="17" width="${id === 4 ? 44 : 38}" height="17" rx="5" fill="${id === 4 ? "#b8a3d7" : "#82c5d6"}"/><rect x="45" y="20" width="8" height="11" rx="2" fill="#f2ae6a"/>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${content}</svg>`;
}
export function createEquipment(player, scene, onlyWeapon = null) {
  let aimingNow = false;
  const supportArm = player.userData.leftArm;
  const arm = player.userData.rightArm,
    joint = new T.Group();
  joint.position.set(0.43, 1.3, 0);
  player.remove(arm);
  arm.position.set(0, -0.3, 0);
  joint.add(arm);
  player.add(joint);
  const grip = new T.Group();
  grip.position.set(0, -0.65, 0.1);
  joint.add(grip);
  player.userData.equipmentGrip = grip;
  const models = [];
  for (let id = 0; id < 6; id++) {
    if (onlyWeapon !== null && id !== onlyWeapon) continue;
    const g = new T.Group();
    grip.add(g);
    models[id] = g;
    if (id < 2) {
      part(g, 0x9a7950, 0, 0.3, 0, 0.1, 0.7, 0.1, rod);
      part(
        g,
        id === 0 ? 0xf1ca79 : 0x8fc2d2,
        0,
        0.95,
        0,
        id === 0 ? 0.24 : 0.17,
        0.75,
        0.24,
        rod,
      );
      part(g, 0xffedb7, 0, 1.3, 0, 0.22, 0.12, 0.23);
    } else if (id === 2) {
      g.rotation.x = Math.PI / 2;
      part(g, 0xa48ac3, 0, 0.4, 0, 0.1, 0.9, 0.1, rod);
      const ring = new T.Mesh(
        new T.TorusGeometry(0.27, 0.07, 8, 16),
        mat(0xb9e5eb),
      );
      ring.position.y = 0.95;
      g.add(ring);
    } else {
      part(g, 0xf2b968, 0, 0.03, 0, 0.23, 0.48, 0.25);
      part(
        g,
        id === 4 ? 0xa892c9 : 0x71b8cc,
        0,
        0.25,
        0.32,
        id === 4 ? 0.48 : 0.3,
        0.3,
        id === 5 ? 0.65 : 1,
      );
      part(g, 0xf1a35e, 0, 0.25, id === 5 ? 0.67 : 0.88, 0.34, 0.34, 0.16);
      part(g, 0xf5e5b6, 0, 0.45, 0.25, 0.08, 0.1, 0.2);
    }
  }
  const snacks = new T.Group();
  grip.add(snacks);
  part(snacks, 0x7eae6c, 0, 0.1, 0.1, 0.55, 0.65, 0.3);
  part(snacks, 0xfff0cf, 0, 0.1, 0.26, 0.12, 0.38, 0.04);
  part(snacks, 0xfff0cf, 0, 0.1, 0.27, 0.36, 0.12, 0.04);
  const flash = part(grip, 0xffe293, 0, 0.25, 0.99, 0.55, 0.55, 0.55, ball);
  flash.material = new T.MeshBasicMaterial({
    color: 0xfff0a1,
    depthWrite: false,
  });
  flash.visible = false;
  const slash = new T.Mesh(
    new T.RingGeometry(1.5, 1.7, 32, 1, 0, Math.PI * 0.8),
    new T.MeshBasicMaterial({
      color: 0xffedb4,
      transparent: true,
      opacity: 0.7,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  slash.rotation.x = -Math.PI / 2;
  scene.add(slash);
  slash.visible = false;
  return {
    update(game) {
      const selected = game.item === "revive" ? "revive" : game.weapon;
      models.forEach((g, i) => (g.visible = selected === i));
      snacks.visible = selected === "revive";
      const usable =
        game.vehicle === null &&
        !game.player.ragdoll &&
        !(game.player.down > 0) &&
        !game.player.exitRoll &&
        !game.jail;
      grip.visible = usable;
      const attack = game.player.attack,
        age = attack ? game.time - attack.started : 10,
        active = !!attack && age >= 0 && age < attack.duration && usable;
      const progress = active ? age / attack.duration : 0;
      const aiming = !!game.player.aim;
      aimingNow = aiming;
      if (supportArm)
        supportArm.rotation.x =
          aiming || (active && attack.kind === "shoot") ? -1.1 : 0;
      joint.rotation.set(0, 0, 0);
      grip.rotation.set(0, 0, 0);
      grip.position.z = 0.1;
      if (usable) {
        if (selected === "revive") {
          joint.rotation.x = -0.6;
          grip.rotation.x = 0.6;
        } else if (selected < 2) {
          joint.rotation.z = -0.2;
          if (active) {
            joint.rotation.z = -0.2 - Math.sin(progress * Math.PI) * 1.5;
            joint.rotation.x = -0.8 + Math.sin(progress * Math.PI) * 1.4;
          }
        } else {
          const raised = aiming || (active && attack.kind === "shoot");
          joint.rotation.x = raised
            ? -1.35 +
              (active && attack.kind === "shoot"
                ? Math.sin(progress * Math.PI) * 0.22
                : 0)
            : -0.5;
          grip.rotation.x = -joint.rotation.x;
          grip.position.z =
            0.1 -
            (active && attack.kind === "shoot"
              ? Math.sin(progress * Math.PI) * 0.24
              : 0);
        }
      }
      flash.visible = active && attack.kind === "shoot" && age < 0.13;
      flash.position.z = selected === 5 ? 0.8 : 1.05;
      slash.visible =
        active && attack.kind === "melee" && progress > 0.1 && progress < 0.9;
      slash.position.set(game.player.x, 1.15, game.player.z);
      slash.rotation.z = -game.player.heading + progress * 2;
    },
    dispose() {
      scene.remove(slash);
      slash.geometry.dispose();
      slash.material.dispose();
    },
    stats() {
      return {
        visible: grip.visible,
        weapon: snacks.visible ? "revive" : models.findIndex((g) => g?.visible),
        muzzle: flash.visible,
        aiming: aimingNow,
        armAngle: joint.rotation.x,
        swing: slash.visible,
      };
    },
  };
}
