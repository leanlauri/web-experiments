import { createEquipment } from "./equipment.js?v=console-menu-1";
import { vehicleProfile } from "./vehicles.js?v=console-menu-1";
import * as T from "./vendor/three.module.js";
import { MAX_SKID_SEGMENTS, skidOpacity } from "./skidmarks.js?v=console-menu-1";
import {
  SIZE,
  HOME,
  HOUSE,
  SPACEPORT,
  FARMS,
  OBSTACLES,
  TOWN_STREETS,
  RIVER_START,
  inTown,
  road,
  water,
  dist,
} from "./region.js?v=console-menu-1";
const materials = new Map();
const material = (c) => {
  if (!materials.has(c))
    materials.set(
      c,
      new T.MeshLambertMaterial({ color: c, depthWrite: c !== 0x69766b }),
    );
  return materials.get(c);
};
const shadowMaterial = new T.MeshBasicMaterial({
  color: 0x263a2a,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
});
const shadowGeo = new T.CircleGeometry(1, 16);
const cube = new T.BoxGeometry(1, 1, 1),
  sphere = new T.IcosahedronGeometry(1, 1),
  cylinder = new T.CylinderGeometry(1, 1, 1, 8);
const roadPlane = new T.PlaneGeometry(1, 1);
roadPlane.rotateX(-Math.PI / 2);
function shape(parent, color, x, y, z, sx, sy, sz, geo = cube) {
  if (color === 0x69766b && sy <= 0.13) {
    const m = new T.Mesh(roadPlane, material(color));
    m.renderOrder = 1;
    m.position.set(x, y + sy / 2, z);
    m.scale.set(sx, 1, sz);
    parent.add(m);
    return m;
  }
  const m = new T.Mesh(geo, material(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
function label(parent, text, x, y, z, color = "#fff6d9", scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 80;
  const c = canvas.getContext("2d");
  c.fillStyle = "#20392ee8";
  c.beginPath();
  c.roundRect(0, 0, 512, 80, 20);
  c.fill();
  c.fillStyle = color;
  c.font = "bold 26px system-ui";
  c.textAlign = "center";
  c.fillText(text, 256, 49);
  const texture = new T.CanvasTexture(canvas);
  const sprite = new T.Sprite(
    new T.SpriteMaterial({ map: texture, depthTest: false }),
  );
  sprite.scale.set(20 * scale, 3.1 * scale, 1);
  sprite.position.set(x, y, z);
  parent.add(sprite);
  return sprite;
}
function animalModel(type) {
  const g = new T.Group(),
    colors = {
      sheep: 0xfff4dc,
      pig: 0xe6a4aa,
      cow: 0xf6ebd6,
      rabbit: 0xc6b5a3,
      goat: 0xc5ad8d,
      alpaca: 0xe6c79f,
    };
  g.userData.limbs = [];
  g.userData.head = new T.Vector3(
    0,
    type === "alpaca" ? 2 : 1.1,
    type === "alpaca" ? 0.65 : 0.95,
  );
  const c = colors[type],
    size = type === "cow" ? 1.3 : type === "rabbit" ? 0.65 : 1;
  shape(g, c, 0, 0.9, 0, 0.65, 0.58, 1, sphere);
  shape(
    g,
    type === "sheep" ? 0x60564b : c,
    0,
    1.1,
    0.95,
    0.36,
    0.38,
    0.4,
    sphere,
  );
  for (const x of [-0.4, 0.4])
    for (const z of [-0.55, 0.55])
      g.userData.limbs.push(shape(g, 0x665b4c, x, 0.35, z, 0.17, 0.65, 0.18));
  for (const x of [-0.23, 0.23]) {
    shape(g, 0xffffff, x, 1.22, 1.27, 0.1, 0.1, 0.06, sphere);
    shape(g, 0x293935, x, 1.22, 1.32, 0.045, 0.055, 0.03, sphere);
    shape(
      g,
      c,
      x * 1.8,
      type === "rabbit" ? 1.7 : 1.3,
      0.9,
      0.13,
      type === "rabbit" ? 0.6 : 0.1,
      0.2,
      sphere,
    );
  }
  if (type === "cow")
    for (let i = 0; i < 3; i++)
      shape(
        g,
        0x59544e,
        0.4 * Math.cos(i * 2),
        1.25,
        0.4 * Math.sin(i * 2),
        0.3,
        0.2,
        0.35,
        sphere,
      );
  if (type === "goat")
    for (const x of [-0.2, 0.2])
      shape(g, 0xede1b9, x, 1.6, 0.85, 0.08, 0.45, 0.09);
  if (type === "alpaca") {
    shape(g, c, 0, 1.55, 0.55, 0.3, 0.65, 0.3, sphere);
    shape(g, c, 0, 2, 0.65, 0.35, 0.35, 0.35, sphere);
  }
  g.scale.setScalar(size);
  g.userData.base = size;
  return g;
}
function person(color = 0x52878c, police = false) {
  const g = new T.Group();
  g.userData.limbs = [];
  g.userData.head = new T.Vector3(0, 1.7, 0);
  shape(g, color, 0, 1, 0, 0.65, 0.9, 0.45);
  shape(g, 0xecc49d, 0, 1.7, 0, 0.29, 0.32, 0.28, sphere);
  shape(g, police ? 0x203e65 : 0xdcc491, 0, 1.97, 0, 0.43, 0.09, 0.4, cylinder);
  shape(
    g,
    police ? 0x203e65 : 0xdcc491,
    0,
    2.08,
    0,
    0.28,
    0.22,
    0.28,
    cylinder,
  );
  for (const x of [-0.2, 0.2])
    g.userData.limbs.push(shape(g, 0x454c45, x, 0.35, 0, 0.22, 0.7, 0.26));
  for (const x of [-0.43, 0.43]) {
    const arm = shape(g, color, x, 1, 0, 0.18, 0.65, 0.23);
    g.userData.limbs.push(arm);
    if (x > 0) g.userData.rightArm = arm;
  }
  if (police) shape(g, 0xf5d779, -0.2, 1.2, 0.24, 0.13, 0.18, 0.04);
  return g;
}
function carModel(v) {
  const g = new T.Group(),
    p = vehicleProfile(v),
    length = p.length,
    width = p.width,
    color = p.color;
  shape(g, color, 0, 0.7, 0, width, 0.8, length);
  if (v.kind === "pickup" || v.kind === "truck") {
    shape(g, color, 0, 1.5, length * 0.27, width * 0.93, 1.3, length * 0.35);
    shape(g, 0xb8e1df, 0, 1.65, length * 0.45, width * 0.8, 0.7, 0.06);
    shape(
      g,
      0x635e4c,
      0,
      1.08,
      -length * 0.22,
      width * 0.75,
      0.12,
      length * 0.45,
    );
    for (const side of [-1, 1]) {
      shape(
        g,
        color,
        side * width * 0.44,
        1.5,
        -length * 0.22,
        0.18,
        0.7,
        length * 0.5,
      );
      if (v.kind === "truck")
        for (let j = 0; j < 4; j++)
          shape(
            g,
            0xd8c297,
            side * width * 0.44,
            2.05,
            -length * 0.42 + j * length * 0.13,
            0.12,
            1.6,
            0.12,
          );
    }
  } else if (v.kind === "buggy") {
    for (const side of [-1, 1]) {
      shape(g, 0x4c5c55, side * 0.85, 1.5, 0, 0.12, 1.2, 0.12);
      shape(g, 0x4c5c55, 0, 2.1, 0, 1.8, 0.12, 0.12);
    }
    shape(g, 0x6b7666, 0, 1.2, -0.35, 1.35, 0.6, 0.8);
  } else {
    const h = v.kind === "sport" ? 0.65 : v.kind === "bus" ? 1.5 : 1;
    shape(
      g,
      color,
      0,
      1.2 + h / 2,
      -0.15,
      width * 0.9,
      h,
      length * (v.kind === "sport" ? 0.42 : 0.68),
    );
    shape(
      g,
      0xb8e1df,
      0,
      1.2 + h * 0.6,
      length * 0.3,
      width * 0.78,
      h * 0.65,
      0.06,
    );
    if (v.kind === "bus" || v.kind === "van")
      for (const side of [-1, 1])
        for (let j = 0; j < (v.kind === "bus" ? 5 : 3); j++)
          shape(
            g,
            0xb0d7d4,
            side * width * 0.46,
            1.8,
            -length * 0.3 + j * length * 0.13,
            0.06,
            0.7,
            length * 0.1,
          );
    if (v.kind === "sport") {
      shape(g, 0xf4dba4, 0, 1.15, 0.95, 0.22, 0.08, 1.4);
      shape(g, 0x44564e, 0, 1.3, -length * 0.43, width, 0.15, 0.35);
    }
    if (v.kind === "electric")
      shape(g, 0xb8f1db, 0, 0.7, length * 0.5 + 0.04, width * 0.7, 0.15, 0.08);
  }
  g.userData.isVehicle = true;
  g.userData.frontWheels = [];
  for (const side of [-1, 1])
    for (const z of [-length * 0.32, length * 0.32]) {
      const wheel = shape(
        g,
        0x37433c,
        side * width * 0.51,
        0.45,
        z,
        0.43,
        0.27,
        0.43,
        cylinder,
      );
      wheel.rotation.z = Math.PI / 2;
      if (z > 0) g.userData.frontWheels.push(wheel);
    }
  for (const x of [-width * 0.32, width * 0.32])
    shape(g, 0xffeab2, x, 0.8, length * 0.5 + 0.04, 0.3, 0.2, 0.08);
  if (v.isPolice) {
    shape(g, 0xf2efdf, 0, 0.95, 0, width * 1.01, 0.45, length * 0.65);
    const roof = new T.Group();
    roof.position.set(0, 2.05, 0);
    g.add(roof);
    for (const side of [-1, 1]) {
      const light = shape(
        roof,
        side < 0 ? 0xd66c64 : 0x6a9cdc,
        side * 0.42,
        0,
        0,
        0.65,
        0.22,
        0.3,
      );
      light.material = new T.MeshBasicMaterial({
        color: side < 0 ? 0xe4756a : 0x6a9fe4,
      });
    }
    g.userData.policeLights = roof;
  }
  g.userData.intact = [...g.children];
  return g;
}
export function createWorld(canvas) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor(0xbdd3b4);
  const scene = new T.Scene();
  const daytimeFog = new T.Fog(0xbdd3b4, 120, 240);
  scene.fog = daytimeFog;
  const camera = new T.PerspectiveCamera(48, 1, 0.1, 1500);
  scene.add(new T.HemisphereLight(0xfff7db, 0x6c8765, 2.5));
  const sun = new T.DirectionalLight(0xffefd1, 2);
  sun.position.set(-40, 80, 20);
  scene.add(sun);
  const ground = shape(scene, 0x91b578, 0, -0.3, 0, SIZE * 2, 0.5, SIZE * 2);
  const world = new T.Group();
  scene.add(world);
  for (const f of FARMS) {
    const length = SIZE * 1.44 - RIVER_START,
      a = f.angle + Math.PI / 6;
    const river = shape(
      world,
      0x72b6bd,
      Math.cos(a) * (RIVER_START + length / 2),
      -0.01,
      Math.sin(a) * (RIVER_START + length / 2),
      10,
      0.12,
      length,
    );
    river.rotation.y = Math.PI / 2 - a;
  }
  const roadMat = material(0x69766b);
  for (const f of [...FARMS, HOME]) {
    const r = Math.hypot(f.x, f.z),
      strip = shape(
        world,
        0x69766b,
        ((f.x / r) * (r + 27)) / 2,
        0.08,
        ((f.z / r) * (r + 27)) / 2,
        11,
        0.12,
        r - 27,
      );
    strip.rotation.y = Math.atan2(f.x, f.z);
    for (let d = 36; d < r; d += 10) {
      const line = shape(
        world,
        0xd6d1af,
        (f.x / r) * d,
        0.16,
        (f.z / r) * d,
        0.18,
        0.03,
        3,
      );
      line.rotation.y = strip.rotation.y;
    }
  }
  for (const street of TOWN_STREETS) {
    const vertical = street.a.x === street.b.x,
      central = vertical ? street.a.x === 0 : street.a.z === 0;
    const ranges = central
      ? [
          [-(vertical ? 102 : 114), -29],
          [29, vertical ? 102 : 114],
        ]
      : [[-(vertical ? 102 : 114), vertical ? 102 : 114]];
    for (const [from, to] of ranges) {
      const mid = (from + to) / 2,
        x = vertical ? street.a.x : mid,
        z = vertical ? mid : street.a.z,
        length = to - from;
      shape(
        world,
        0xc7c5ad,
        x,
        0.015,
        z,
        vertical ? 15 : length,
        0.08,
        vertical ? length : 15,
      );
      shape(
        world,
        0x69766b,
        x,
        0.08,
        z,
        vertical ? 11 : length,
        0.12,
        vertical ? length : 11,
      );
    }
  }
  const townJunction = new T.Mesh(
    new T.RingGeometry(15, 29, 64),
    material(0x69766b),
  );
  townJunction.renderOrder = 1;
  townJunction.rotation.x = -Math.PI / 2;
  townJunction.position.y = 0.155;
  world.add(townJunction);
  const townIsland = new T.Mesh(
    new T.CircleGeometry(15, 48),
    material(0x91b578),
  );
  townIsland.rotation.x = -Math.PI / 2;
  townIsland.position.y = 0.155;
  world.add(townIsland);
  const ring = new T.Mesh(new T.RingGeometry(94, 106, 96), roadMat);
  ring.renderOrder = 1;
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.14;
  world.add(ring);
  for (const f of FARMS) {
    shape(world, 0xc2bc81, f.x, -0.02, f.z, 66, 0.15, 66);
    label(world, f.name, f.x, 13, f.z, `#${f.color.toString(16)}`, 1.2);
    for (let j = 0; j < 7; j++) {
      shape(world, 0x99855e, f.x - 23 + j * 2.2, 0.12, f.z - 19, 1.1, 0.2, 17);
      for (let k = 0; k < 6; k++)
        shape(
          world,
          f.id % 2 ? 0xa7b974 : 0x759b59,
          f.x - 23 + j * 2.2,
          0.5,
          f.z - 26 + k * 2.6,
          0.8,
          0.7,
          0.8,
          sphere,
        );
    }
    shape(world, 0x806b4e, f.x + 26, 4, f.z + 21, 0.2, 8, 0.2);
    shape(world, f.color, f.x + 27.7, 7, f.z + 21, 3.2, 1.8, 0.12);
  }
  function sign(text, x, y, z, width = 7) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#f8e8bd";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#324f45";
    ctx.font = "bold 40px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 63);
    const panel = new T.Mesh(
      new T.PlaneGeometry(width, 1.25),
      new T.MeshBasicMaterial({ map: new T.CanvasTexture(c) }),
    );
    panel.position.set(x, y, z);
    world.add(panel);
  }
  const houseWalls = [],
    houseDetails = [];
  let houseRoof;
  function buildHome() {
    shape(world, 0xddcda6, HOUSE.x, 0.06, HOUSE.z, 10, 0.12, 10);
    const wall = (x, z, w, d) => {
      const m = shape(world, 0xe4c59a, x, 3, z, w, 6, d);
      houseWalls.push(m);
    };
    wall(HOUSE.x - 5, HOUSE.z, 0.35, 10);
    wall(HOUSE.x + 5, HOUSE.z, 0.35, 10);
    wall(HOUSE.x, HOUSE.z - 5, 10, 0.35);
    const width = 5 - HOUSE.doorHalf;
    for (const side of [-1, 1])
      wall(
        HOUSE.x + side * (HOUSE.doorHalf + width / 2),
        HOUSE.z + 5,
        width,
        0.35,
      );
    houseDetails.push(
      shape(
        world,
        0xe4c59a,
        HOUSE.x,
        4.7,
        HOUSE.z + 5,
        HOUSE.doorHalf * 2,
        2.6,
        0.35,
      ),
    );
    for (const side of [-1, 1])
      houseDetails.push(
        shape(
          world,
          0x6b8069,
          HOUSE.x + side * HOUSE.doorHalf,
          1.7,
          HOUSE.z + 5.15,
          0.16,
          3.4,
          0.2,
        ),
      );
    houseRoof = new T.Mesh(new T.ConeGeometry(1, 1, 4), material(0x986f5a));
    houseRoof.position.set(HOUSE.x, 7, HOUSE.z);
    houseRoof.scale.set(8.2, 3.2, 8.2);
    houseRoof.rotation.y = Math.PI / 4;
    world.add(houseRoof);
    shape(world, 0x657c69, HOUSE.x, 1, HOUSE.z - 3.3, 6, 2, 1.1);
    shape(world, 0xe7c690, HOUSE.x, 2.1, HOUSE.z - 3.3, 6.4, 0.2, 1.3);
    for (let i = 0; i < 5; i++)
      shape(
        world,
        [0x7fb4c5, 0xdca066, 0x96b678][i % 3],
        HOUSE.x - 2 + i,
        2.5,
        HOUSE.z - 4.3,
        0.6,
        0.6,
        0.5,
      );
    sign("WORKSHOP · WALK IN", HOUSE.x, 4, HOUSE.z + 5.3, 8);
  }
  buildHome();
  for (const b of OBSTACLES) {
    if (b.type === "home") continue;
    const gas = b.kind === "gas",
      height = gas ? b.h * 0.65 : b.h;
    shape(
      world,
      b.color,
      b.x,
      height / 2,
      b.z - (gas ? 1.5 : 0),
      b.hx * 2,
      height,
      gas ? b.hz : b.hz * 2,
    );
    if (b.kind === "house") {
      const roof = new T.Mesh(new T.ConeGeometry(1, 1, 4), material(0x926f60));
      roof.position.set(b.x, b.h + 1, b.z);
      roof.scale.set(b.hx * 1.65, 2.8, b.hz * 1.65);
      roof.rotation.y = Math.PI / 4;
      world.add(roof);
      shape(world, 0x8b7760, b.x + b.hx * 0.55, b.h + 1, b.z - 1, 0.7, 2, 0.8);
    } else {
      shape(
        world,
        gas ? 0xe8c361 : b.kind === "warehouse" ? 0x6c7f80 : 0x6f8981,
        b.x,
        b.h + 0.3,
        b.z,
        b.hx * 2 + 0.7,
        0.6,
        b.hz * 2 + 0.7,
      );
    }
    for (const side of [-1, 1])
      shape(
        world,
        0xb8d7d8,
        b.x + side * b.hx * 0.55,
        b.h * 0.58,
        b.z + b.hz + 0.04,
        1.6,
        1.6,
        0.08,
      );
    shape(world, 0x536e60, b.x, 0.9, b.z + b.hz + 0.07, 1.25, 1.8, 0.12);
    if (b.kind === "shop") {
      shape(
        world,
        0xa3cdd2,
        b.x,
        1.7,
        b.z + b.hz + 0.09,
        b.hx * 1.65,
        2.2,
        0.12,
      );
      shape(world, 0xd79a73, b.x, 3.2, b.z + b.hz + 0.55, b.hx * 2, 0.25, 1.2);
      sign(b.name, b.x, 4.25, b.z + b.hz + 0.2, b.hx * 1.9);
    }
    if (gas) {
      for (const side of [-1, 1]) {
        shape(
          world,
          0xe6d9ab,
          b.x + side * b.hx * 0.8,
          2.6,
          b.z + 2,
          0.2,
          5.2,
          0.2,
        );
        shape(
          world,
          0xd77761,
          b.x + side * 1.7,
          0.8,
          b.z + 1.7,
          0.65,
          1.6,
          0.7,
        );
        shape(
          world,
          0x415b55,
          b.x + side * 1.7,
          1.1,
          b.z + 2.08,
          0.45,
          0.4,
          0.05,
        );
      }
      sign("ORBIT FUEL", b.x, b.h + 0.3, b.z + b.hz + 0.4, b.hx * 1.8);
    }
    if (b.kind === "warehouse") {
      shape(world, 0x869a9a, b.x, 2, b.z + b.hz + 0.1, b.hx * 1.6, 4, 0.15);
      for (let i = 0; i < 6; i++)
        shape(
          world,
          0xafb9ae,
          b.x,
          0.4 + i * 0.6,
          b.z + b.hz + 0.2,
          b.hx * 1.6,
          0.08,
          0.05,
        );
      sign("COUNTY FREIGHT", b.x, b.h - 0.6, b.z + b.hz + 0.2, b.hx * 1.8);
    }
  }
  shape(world, 0xd9ce9e, HOME.x, 0.03, HOME.z, 43, 0.12, 43);
  const homeRing = new T.Mesh(
    new T.RingGeometry(HOME.r - 0.5, HOME.r, 80),
    material(0xf5df8c),
  );
  homeRing.rotation.x = -Math.PI / 2;
  homeRing.position.set(HOME.x, 0.17, HOME.z);
  world.add(homeRing);
  label(
    world,
    "YOUR FARM · BACKYARD SPACEPORT",
    HOME.x,
    11,
    HOME.z,
    "#ffe9a5",
    1.2,
  );
  label(world, "CLOVER MEADOW", -18, 4, -143, "#fff6dc", 0.65);
  label(world, "RIVER CROSSING · TOWN", 0, 15, 0, "#fff6dc", 1.1);
  const launchPad = new T.Group();
  world.add(launchPad);
  launchPad.position.set(SPACEPORT.x, 0, SPACEPORT.z);
  shape(launchPad, 0x778a82, 0, 0.12, 0, 7, 0.24, 7, cylinder);
  for (let i = 0; i < 12; i++) {
    const stripe = new T.Mesh(
      new T.RingGeometry(
        5.8,
        6.6,
        8,
        1,
        (i * Math.PI) / 6,
        (Math.PI / 6) * 0.85,
      ),
      material(i % 2 ? 0x414e46 : 0xe5bc63),
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.y = 0.26;
    launchPad.add(stripe);
  }
  shape(launchPad, 0xbec5af, 0, 0.28, 0, 5.5, 0.2, 5.5);
  for (const x of [-6, -4.5])
    shape(launchPad, 0x6c8790, x, 4.5, -1, 0.22, 9, 0.22);
  for (let y = 1; y < 9; y += 0.65)
    shape(launchPad, 0xc0d0c4, -5.25, y, -1, 1.5, 0.1, 0.16);
  shape(launchPad, 0x6c8790, -3, 8, -1, 6, 0.25, 0.3);
  shape(launchPad, 0xe7c57b, -0.2, 6.8, -1, 0.1, 2.4, 0.1);
  for (let i = 0; i < 3; i++)
    shape(launchPad, 0xb1ac8b, -4 + i, 0.6, 4.6, 0.8, 1.2, 0.8);
  sign("MOON PAD 01", SPACEPORT.x, 1.7, SPACEPORT.z + 7.2, 7);
  const rocket = new T.Group();
  world.add(rocket);
  rocket.position.set(SPACEPORT.x, 0, SPACEPORT.z);
  const rocketParts = Array.from({ length: 5 }, () => {
    const group = new T.Group();
    rocket.add(group);
    return group;
  });
  shape(rocketParts[0], 0xdfdbc5, 0, 3, 0, 1.7, 5, 1.7, cylinder);
  for (const x of [-1, 1])
    shape(rocketParts[0], 0xd29b6a, x * 1.6, 1, 0, 0.2, 1.8, 1.1);
  const engine = new T.Mesh(
    new T.CylinderGeometry(0.75, 1.3, 1.2, 12),
    material(0x637b88),
  );
  engine.position.y = 0.75;
  rocketParts[1].add(engine);
  for (const x of [-1, 1])
    shape(rocketParts[2], 0xcb8b62, x * 2, 3, 0, 0.65, 4, 0.65, cylinder);
  shape(rocketParts[3], 0x477f96, 0, 4.9, 1.64, 1.15, 1, 0.16);
  shape(rocketParts[3], 0xbadfe2, 0, 5, 1.75, 0.85, 0.65, 0.08);
  shape(rocketParts[3], 0xf0d184, 0.5, 5.65, 0, 0.1, 0.5, 0.1);
  const nose = new T.Mesh(new T.ConeGeometry(1.7, 3, 16), material(0xdd795c));
  nose.position.y = 7;
  rocketParts[4].add(nose);
  const blueprint = new T.Group();
  world.add(blueprint);
  blueprint.position.copy(rocket.position);
  const ghostMaterial = new T.MeshBasicMaterial({
    color: 0xa9e4e3,
    wireframe: true,
    transparent: true,
    opacity: 0.4,
  });
  const ghostParts = rocketParts.map((source) => {
    const group = new T.Group();
    blueprint.add(group);
    source.traverse((part) => {
      if (part.isMesh) {
        const ghost = new T.Mesh(part.geometry, ghostMaterial);
        ghost.position.copy(part.position);
        ghost.scale.copy(part.scale);
        ghost.rotation.copy(part.rotation);
        group.add(ghost);
      }
    });
    return group;
  });
  const flame = shape(rocket, 0xffc46c, 0, -1, 0, 1, 3, 1, sphere);
  flame.visible = false;
  const chunks = new Map();
  let chunkOrigin = "";
  function chunk(cx, cz) {
    const group = new T.Group();
    world.add(group);
    let seed = ((cx + 50) * 127 + (cz + 50) * 719) >>> 0;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions = [];
    for (let i = 0; i < 22; i++) {
      const x = cx * 64 + rand() * 64,
        z = cz * 64 + rand() * 64,
        p = { x, z };
      if (
        Math.abs(x) > SIZE ||
        Math.abs(z) > SIZE ||
        road(p) ||
        water(p) ||
        inTown(p) ||
        Math.hypot(x, z) < 72 ||
        dist(p, HOME) < 36 ||
        dist(p, { x: 0, z: -135 }) < 24 ||
        FARMS.some((f) => dist(p, f) < 49)
      )
        continue;
      positions.push({ x, z, h: 3 + rand() * 4 });
    }
    const trunks = new T.InstancedMesh(
        cylinder,
        material(0x8c7957),
        positions.length,
      ),
      tops = new T.InstancedMesh(
        sphere,
        material((cx + cz) % 2 ? 0x5f9463 : 0x739e64),
        positions.length,
      ),
      dummy = new T.Object3D();
    positions.forEach((p, i) => {
      dummy.position.set(p.x, p.h * 0.4, p.z);
      dummy.scale.set(0.3, p.h * 0.8, 0.3);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = p.h;
      dummy.scale.set(2.1, 2.8, 2.1);
      dummy.updateMatrix();
      tops.setMatrixAt(i, dummy.matrix);
    });
    group.add(trunks, tops);
    chunks.set(`${cx},${cz}`, { group, cx, cz });
  }
  function updateChunks(p) {
    const cx = Math.floor(p.x / 64),
      cz = Math.floor(p.z / 64),
      key = `${cx},${cz}`;
    if (key === chunkOrigin) return;
    chunkOrigin = key;
    for (const [key, c] of chunks) {
      if (Math.abs(c.cx - cx) > 3 || Math.abs(c.cz - cz) > 3) {
        world.remove(c.group);
        for (const m of c.group.children) m.dispose();
        chunks.delete(key);
      }
    }
    for (let x = cx - 3; x <= cx + 3; x++)
      for (let z = cz - 3; z <= cz + 3; z++)
        if (!chunks.has(`${x},${z}`)) chunk(x, z);
  }
  const actors = new Map(),
    actorRoot = new T.Group();
  scene.add(actorRoot);
  const player = person();
  const equipment = createEquipment(player, actorRoot);
  actorRoot.add(player);
  const fenceGroup = new T.Group();
  world.add(fenceGroup);
  let fenceLevel = -1;
  function fences(level) {
    if (level === fenceLevel) return;
    fenceLevel = level;
    fenceGroup.clear();
    for (const f of FARMS)
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2,
          dx = Math.cos(a) * 35,
          dz = Math.sin(a) * 35,
          toward = -(dx * Math.cos(f.angle) + dz * Math.sin(f.angle)),
          side = Math.abs(-dx * Math.sin(f.angle) + dz * Math.cos(f.angle));
        if (toward > 0 && side < (level > 2 ? 5 : 8)) continue;
        shape(fenceGroup, f.color, f.x + dx, 1, f.z + dz, 0.35, 2, 0.35);
        const rail = shape(
          fenceGroup,
          0xd8c49a,
          f.x + dx,
          0.9,
          f.z + dz,
          3.2,
          0.2,
          0.15,
        );
        rail.rotation.y = -a - Math.PI / 2;
        if (level > 1) {
          const rail2 = shape(
            fenceGroup,
            f.color,
            f.x + dx,
            1.7,
            f.z + dz,
            3.2,
            0.2,
            0.15,
          );
          rail2.rotation.y = rail.rotation.y;
        }
      }
  }
  const starCanvas = document.createElement("canvas");
  starCanvas.width = starCanvas.height = 64;
  const starContext = starCanvas.getContext("2d");
  starContext.fillStyle = "#ffe36d";
  starContext.strokeStyle = "#b58121";
  starContext.lineWidth = 2;
  starContext.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2,
      r = i % 2 ? 13 : 29;
    const x = 32 + Math.cos(a) * r,
      y = 32 + Math.sin(a) * r;
    i ? starContext.lineTo(x, y) : starContext.moveTo(x, y);
  }
  starContext.closePath();
  starContext.fill();
  starContext.stroke();
  const starMaterial = new T.SpriteMaterial({
    map: new T.CanvasTexture(starCanvas),
    depthTest: false,
  });
  const headPosition = new T.Vector3();
  function poseBody(g, p, down = false) {
    if (!g.userData.head) return;
    if (!g.userData.pivot) {
      const pivot = new T.Group();
      pivot.position.y = 0.9;
      for (const child of [...g.children]) {
        child.position.y -= 0.9;
        pivot.add(child);
      }
      g.add(pivot);
      g.userData.pivot = pivot;
      const stars = new T.Group();
      for (let i = 0; i < 4; i++) {
        const sprite = new T.Sprite(starMaterial);
        sprite.scale.set(0.48, 0.48, 1);
        stars.add(sprite);
      }
      g.add(stars);
      g.userData.stars = stars;
      g.userData.bounds = new T.Box3();
    }
    const pivot = g.userData.pivot,
      r = p.ragdoll,
      roll = p.exitRoll,
      alpha = r?.phase === "recovering" ? r.recovery : 0;
    pivot.rotation.set(
      roll ? (roll.age / roll.duration) * Math.PI * 2 : r ? r.rx : 0,
      0,
      r ? r.rz : down ? Math.PI / 2 : 0,
    );
    pivot.position.y =
      0.9 - ((r && (p.y || 0) < 0.1) || down ? 0.45 : 0) * (1 - alpha);
    for (let i = 0; i < g.userData.limbs.length; i++)
      g.userData.limbs[i].rotation.x = r
        ? Math.sin(r.age * 11 + i * 1.8) * 1.1 * (1 - alpha)
        : 0;
    if (r || down || roll) {
      g.updateMatrixWorld(true);
      const ignored = g.userData.equipmentGrip,
        parent = ignored?.parent;
      if (parent) parent.remove(ignored);
      g.userData.bounds.setFromObject(pivot);
      if (parent) parent.add(ignored);
      pivot.position.y += Math.max(0, -g.userData.bounds.min.y);
    }
    if (!r && !down && p.hitAt !== undefined && currentTime - p.hitAt < 0.25)
      pivot.rotation.z =
        Math.sin(((currentTime - p.hitAt) / 0.25) * Math.PI) * 0.3;
    const stars = g.userData.stars;
    stars.visible = !roll && (!!r || down || (p.starsUntil || 0) > currentTime);
    if (stars.visible) {
      pivot.updateMatrix();
      headPosition.copy(g.userData.head);
      headPosition.y -= 0.9;
      headPosition.applyMatrix4(pivot.matrix);
      stars.position.copy(headPosition);
      stars.position.y += 0.45;
      stars.children.forEach((star, i) => {
        const a = currentTime * 3 + (i * Math.PI) / 2;
        star.position.set(
          Math.cos(a) * 0.6,
          Math.sin(a * 2) * 0.08,
          Math.sin(a) * 0.6,
        );
      });
    }
  }
  let currentTime = 0;
  function vehicleEffects(g, p) {
    for (const piece of g.userData.intact || []) piece.visible = !p.destroyed;
    if (g.userData.policeLights && !p.destroyed)
      g.userData.policeLights.children.forEach(
        (light, i) =>
          (light.scale.y =
            0.6 + (Math.sin(currentTime * 12 + i * Math.PI) > 0 ? 0.8 : 0)),
      );
    const burning = p.burnStarted !== undefined && !p.destroyed,
      smoking = p.destroyed && currentTime - (p.explodedAt || 0) < 8;
    if (!g.userData.fire && !(burning || p.destroyed)) return;
    if (!g.userData.fire) {
      const fire = new T.Group(),
        smoke = new T.Group();
      g.add(fire, smoke);
      g.userData.fire = fire;
      g.userData.smoke = smoke;
      for (let i = 0; i < 6; i++) {
        const f = new T.Mesh(
          new T.ConeGeometry(0.45, 1.8, 7),
          new T.MeshBasicMaterial({ color: i % 2 ? 0xffcc63 : 0xed8244 }),
        );
        f.position.set(
          Math.cos(i * 2.4) * 0.55,
          1.6,
          Math.sin(i * 2.4) * 0.5 + vehicleProfile(p).length * 0.25,
        );
        fire.add(f);
      }
      for (let i = 0; i < 4; i++) {
        const puff = new T.Mesh(
          sphere,
          new T.MeshBasicMaterial({
            color: 0x5e665e,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
          }),
        );
        smoke.add(puff);
      }
      const wreck = new T.Group();
      g.add(wreck);
      g.userData.wreck = wreck;
      const psize = vehicleProfile(p);
      shape(wreck, 0x252925, 0, 0.45, 0, psize.width, 0.7, psize.length);
      const cabin = shape(
        wreck,
        0x30352f,
        0.15,
        0.95,
        -0.2,
        psize.width * 0.8,
        0.65,
        psize.length * 0.45,
      );
      cabin.rotation.z = 0.14;
      const hood = shape(
        wreck,
        0x1b211d,
        0,
        0.85,
        psize.length * 0.34,
        psize.width * 0.9,
        0.12,
        psize.length * 0.3,
      );
      hood.rotation.x = -0.35;
      for (const side of [-1, 1])
        shape(
          wreck,
          0x3c4239,
          side * psize.width * 0.4,
          0.28,
          -psize.length * 0.25,
          0.15,
          0.45,
          psize.length * 0.35,
        );
    }
    g.userData.fire.visible = burning;
    g.userData.smoke.visible = burning || smoking;
    g.userData.wreck.visible = !!p.destroyed;
    g.userData.fire.children.forEach((f, i) => {
      f.scale.set(1, 1 + Math.sin(currentTime * 19 + i * 2) * 0.25, 1);
    });
    g.userData.smoke.children.forEach((puff, i) => {
      const phase = (currentTime * 0.65 + i * 0.25) % 1;
      const size = 0.5 + phase * 1.3;
      puff.scale.setScalar(size);
      puff.position.set(
        Math.sin(currentTime + i) * phase * 0.6,
        2 + phase * 4,
        vehicleProfile(p).length * 0.25,
      );
    });
  }
  function actor(id, create, p, down = false, hidden = false) {
    let g = actors.get(id);
    if (hidden || dist(p, gamePlayer) > 150) {
      if (g) {
        g.visible = false;
        if (g.userData.shadow) g.userData.shadow.visible = false;
      }
      return;
    }
    if (!g) {
      g = create();
      actors.set(id, g);
      actorRoot.add(g);
      const shadow = new T.Mesh(shadowGeo, shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.set(
        id.startsWith("v") ? 1.7 : 0.9,
        id.startsWith("v") ? 2.5 : 0.65,
        1,
      );
      actorRoot.add(shadow);
      g.userData.shadow = shadow;
    }
    g.visible = true;
    for (const wheel of g.userData.frontWheels || [])
      wheel.rotation.y = -(p.steerAngle || 0);
    g.userData.shadow.visible = true;
    g.userData.shadow.position.set(p.x, 0.22, p.z);
    g.position.set(p.x, p.y || 0, p.z);
    g.rotation.set(
      g.userData.isVehicle ? p.pitch || 0 : 0,
      Math.PI / 2 - p.heading,
      g.userData.isVehicle ? p.roll || 0 : 0,
    );
    if (g.userData.isVehicle) vehicleEffects(g, p);
    poseBody(g, p, down);
    if (!down && !p.ragdoll)
      g.position.y +=
        Math.sin(performance.now() * 0.006 + (p.phase || 0)) * 0.04;
  }
  let gamePlayer = { x: 0, z: 0 };
  let zoom = 1;
  const space = new T.Group();
  scene.add(space);
  space.visible = false;
  const moon = shape(
    space,
    0xd2d7ce,
    0,
    0,
    0,
    22,
    22,
    22,
    new T.SphereGeometry(1, 40, 24),
  );
  for (let i = 0; i < 24; i++) {
    const a = i * 2.4,
      b = i * 0.87,
      normal = new T.Vector3(Math.cos(a), Math.sin(b), Math.sin(a)).normalize();
    const crater = shape(
      moon,
      0xa9b1a5,
      normal.x * 0.993,
      normal.y * 0.993,
      normal.z * 0.993,
      0.06 + (i % 3) * 0.025,
      0.012,
      0.06 + (i % 3) * 0.025,
      sphere,
    );
    crater.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), normal);
  }
  const starGeo = new T.BufferGeometry(),
    stars = [];
  for (let i = 0; i < 650; i++) {
    const a = i * 2.399,
      r = 100 + (i % 80);
    stars.push(Math.cos(a) * r, Math.sin(i * 0.79) * r, Math.sin(a) * r);
  }
  starGeo.setAttribute("position", new T.Float32BufferAttribute(stars, 3));
  space.add(
    new T.Points(starGeo, new T.PointsMaterial({ color: 0xfff7db, size: 0.5 })),
  );
  const spaceRocket = new T.Group();
  space.add(spaceRocket);
  shape(spaceRocket, 0xf3ebd4, 0, 0, 0, 1, 3, 1, cylinder);
  shape(spaceRocket, 0xea9d72, 0, -2, 0, 0.6, 1.5, 0.6, sphere);
  const tip = new T.Mesh(new T.ConeGeometry(1, 1.5, 8), material(0xdb8269));
  tip.position.y = 2;
  spaceRocket.add(tip);
  // All tire segments share one draw call and fade through an instance attribute.
  const skidGeometry = new T.PlaneGeometry(0.22, 1);
  skidGeometry.rotateX(-Math.PI / 2);
  const skidAlpha = new T.InstancedBufferAttribute(
    new Float32Array(MAX_SKID_SEGMENTS),
    1,
  );
  skidGeometry.setAttribute("instanceOpacity", skidAlpha);
  const skidMaterial = new T.MeshBasicMaterial({
    color: 0x273028,
    transparent: true,
    depthWrite: false,
  });
  skidMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float instanceOpacity; varying float tireAlpha;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntireAlpha = instanceOpacity;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float tireAlpha;",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.a *= tireAlpha;",
      );
  };
  const skidMesh = new T.InstancedMesh(
    skidGeometry,
    skidMaterial,
    MAX_SKID_SEGMENTS,
  );
  skidMesh.count = 0;
  skidMesh.frustumCulled = false;
  skidMesh.renderOrder = 1;
  world.add(skidMesh);
  const skidTransform = new T.Object3D();
  function updateSkids(game) {
    skidMesh.count = game.skidmarks.length;
    game.skidmarks.forEach((mark, i) => {
      const dx = mark.x2 - mark.x1,
        dz = mark.z2 - mark.z1;
      skidTransform.position.set(
        (mark.x1 + mark.x2) / 2,
        0.205,
        (mark.z1 + mark.z2) / 2,
      );
      skidTransform.rotation.y = Math.atan2(dx, dz);
      skidTransform.scale.set(1, 1, Math.hypot(dx, dz) + 0.04);
      skidTransform.updateMatrix();
      skidMesh.setMatrixAt(i, skidTransform.matrix);
      skidAlpha.setX(i, skidOpacity(mark, game.time));
    });
    skidMesh.instanceMatrix.needsUpdate = true;
    skidAlpha.needsUpdate = true;
  }
  const blastVisuals = new Map();
  function renderExplosions(game) {
    const visible = new Set();
    for (const e of game.explosions
      .filter((e) => dist(e, game.player) < 140)
      .slice(-16)) {
      visible.add(e.id);
      let fx = blastVisuals.get(e.id);
      if (!fx) {
        const group = new T.Group();
        actorRoot.add(group);
        const material = new T.MeshBasicMaterial({
          color: 0xffcc69,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        });
        const bubble = new T.Mesh(sphere, material);
        group.add(bubble);
        const ring = new T.Mesh(
          new T.RingGeometry(0.9, 1, 48),
          new T.MeshBasicMaterial({
            color: 0xffe7a1,
            transparent: true,
            opacity: 0.7,
            side: T.DoubleSide,
            depthWrite: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);
        const debris = [];
        for (let i = 0; i < 8; i++)
          debris.push(
            shape(group, i % 2 ? 0x7b7767 : 0xb89361, 0, 0, 0, 0.3, 0.3, 0.3),
          );
        fx = { group, bubble, ring, material, debris };
        blastVisuals.set(e.id, fx);
      }
      const age = game.time - e.started;
      fx.group.position.set(e.x, e.y || 0, e.z);
      fx.bubble.scale.setScalar(0.3 + Math.min(age, 0.55) * 12);
      fx.bubble.position.y = 1.4;
      fx.material.opacity = Math.max(0, 0.65 - age * 0.9);
      fx.ring.position.y = 0.25;
      fx.ring.scale.setScalar(Math.min(1, age / 0.65) * e.radius);
      fx.ring.material.opacity = Math.max(0, 0.7 - age * 0.65);
      fx.debris.forEach((piece, i) => {
        const a = (i * Math.PI) / 4;
        piece.position.set(
          Math.cos(a) * age * 7,
          Math.max(0.2, 1 + age * (6 + (i % 3)) - age * age * 6),
          Math.sin(a) * age * 7,
        );
        piece.rotation.set(age * (i + 1), age * 3, age * 2);
      });
    }
    for (const [id, fx] of blastVisuals)
      if (!visible.has(id)) {
        actorRoot.remove(fx.group);
        fx.material.dispose();
        fx.ring.material.dispose();
        fx.ring.geometry.dispose();
        blastVisuals.delete(id);
      }
  }
  let shotMeshes = [];
  const compactLabels = matchMedia("(max-width: 750px), (pointer: coarse)");
  const placeLabels = [];
  world.traverse((node) => {
    if (node.isSprite) placeLabels.push(node);
  });
  function render(game) {
    currentTime = game.time;
    renderExplosions(game);
    updateSkids(game);
    for (const sprite of placeLabels) sprite.visible = !compactLabels.matches;
    gamePlayer = game.player;
    const flight = game.phase === "launch" || game.phase === "credits";
    if (game.phase === "credits") {
      world.visible = false;
      ground.visible = false;
      actorRoot.visible = false;
      space.visible = true;
      scene.fog = null;
      renderer.setClearColor(0x0b1427);
      const a = (game.launchTime - 9) * 0.2;
      spaceRocket.position.set(
        Math.cos(a) * 34,
        Math.sin(a) * 8,
        Math.sin(a) * 34,
      );
      spaceRocket.rotation.z = a - Math.PI / 2;
      camera.position.set(65, 30, 70);
      camera.lookAt(0, 0, 0);
    } else {
      world.visible = true;
      ground.visible = true;
      actorRoot.visible = true;
      space.visible = false;
      scene.fog = daytimeFog;
      renderer.setClearColor(0xbdd3b4);
      updateChunks(game.player);
      fences(game.level);
      player.visible = game.vehicle === null;
      player.position.set(game.player.x, game.player.y, game.player.z);
      player.rotation.set(0, Math.PI / 2 - game.player.heading, 0);
      poseBody(
        player,
        game.player,
        game.player.stun > 0 && !game.player.ragdoll,
      );
      player.visible =
        player.visible &&
        (!!game.player.ragdoll ||
          !!game.player.exitRoll ||
          !(game.player.invulnerable > 0 && Math.floor(game.time * 12) % 2));
      equipment.update(game);
      const live = new Set();
      for (const a of game.animals) {
        const id = `a${a.id}`;
        live.add(id);
        actor(
          id,
          () => animalModel(a.type),
          a,
          a.down,
          a.delivered || a.boarded !== null,
        );
      }
      for (const v of game.vehicles) {
        const id = `v${v.id}`;
        live.add(id);
        actor(id, () => carModel(v), v);
      }
      for (const g of [...game.guards, ...game.police]) {
        live.add(g.id);
        actor(
          g.id,
          () =>
            person(
              g.farm === undefined ? 0x3e6190 : FARMS[g.farm].color,
              g.farm === undefined,
            ),
          g,
          g.down > 0,
          g.inVehicle !== undefined,
        );
      }
      for (const [id, m] of actors)
        if (!live.has(id)) {
          actorRoot.remove(m);
          actorRoot.remove(m.userData.shadow);
          actors.delete(id);
        }
      for (const m of shotMeshes) actorRoot.remove(m);
      shotMeshes = game.shots
        .filter((s) => dist(s, game.player) < 100 && s.owner !== "swing")
        .flatMap((s) => {
          const m = shape(
            actorRoot,
            s.owner === "enemy" ? 0xea9388 : 0xb2e4f2,
            s.x,
            1.3,
            s.z,
            0.25,
            0.25,
            0.65,
            sphere,
          );
          m.rotation.y = Math.atan2(s.vx, s.vz);
          const trail = shape(
            actorRoot,
            s.owner === "enemy" ? 0xefc4a5 : 0xe2fbff,
            s.x - s.vx * 0.018,
            1.3,
            s.z - s.vz * 0.018,
            0.08,
            0.08,
            1.1,
          );
          trail.rotation.y = m.rotation.y;
          return [m, trail];
        });
      houseRoof.visible = !game.houseInside;
      houseWalls.forEach((w) => {
        w.scale.y = game.houseInside ? 1.2 : 6;
        w.position.y = game.houseInside ? 0.6 : 3;
      });
      houseDetails.forEach((w) => (w.visible = !game.houseInside));
      rocketParts.forEach((m, i) => (m.visible = i < game.parts));
      ghostParts.forEach((m, i) => (m.visible = i >= game.parts && !flight));
      flame.visible = flight;
      rocket.position.y = flight
        ? Math.max(0, game.launchTime - 1) ** 2 * 2
        : 0;
      flame.scale.y = 2 + Math.sin(game.time * 40) * 0.6;
      const target = flight
        ? new T.Vector3(
            rocket.position.x,
            rocket.position.y + 4,
            rocket.position.z,
          )
        : new T.Vector3(game.player.x, 0, game.player.z);
      camera.position
        .copy(target)
        .add(new T.Vector3(30 * zoom, 43 * zoom, 36 * zoom));
      camera.lookAt(target);
    }
    renderer.render(scene, camera);
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  resize();
  return {
    render,
    zoom(delta) {
      zoom = Math.max(0.65, Math.min(1.65, zoom + delta));
    },
    stats() {
      return {
        rocket: {
          built: rocketParts.filter((g) => g.visible).length,
          blueprints: ghostParts.filter((g) => g.visible).length,
          padY: launchPad.position.y,
        },
        houseOpen: !houseRoof.visible,
        playerStars: !!player.userData.stars?.visible,
        policeCars: [...actors.values()].filter(
          (g) => g.visible && g.userData.policeLights?.visible,
        ).length,
        wrecks: [...actors.values()].filter(
          (g) => g.visible && g.userData.wreck?.visible,
        ).length,
        wreckIntactPieces: [...actors.values()]
          .filter((g) => g.userData.wreck?.visible)
          .reduce(
            (n, g) =>
              n + (g.userData.intact || []).filter((p) => p.visible).length,
            0,
          ),
        burningVehicles: [...actors.values()].filter(
          (g) => g.visible && g.userData.fire?.visible,
        ).length,
        blastEffects: blastVisuals.size,
        airborneVehicles: [...actors.values()].filter(
          (g) => g.visible && g.userData.isVehicle && g.position.y > 0.1,
        ).length,
        equipment: equipment.stats(),
        townBuildings: OBSTACLES.filter((b) => b.type === "town").length,
        recoveringActors: [player, ...actors.values()].filter(
          (g) => g.visible && g.userData.stars?.visible,
        ).length,
        skidmarks: skidMesh.count,
        cameraHeight: camera.position.y,
        chunks: chunks.size,
        actors: actors.size,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    },
  };
}
