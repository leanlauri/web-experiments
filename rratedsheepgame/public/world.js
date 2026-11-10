import * as T from "./vendor/three.module.js";
import { SIZE, HOME, FARMS, OBSTACLES, road, water, dist } from "./region.js";
const materials = new Map();
const material = (c) => {
  if (!materials.has(c))
    materials.set(c, new T.MeshLambertMaterial({ color: c }));
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
function shape(parent, color, x, y, z, sx, sy, sz, geo = cube) {
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
      shape(g, 0x665b4c, x, 0.35, z, 0.17, 0.65, 0.18);
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
  for (const x of [-0.2, 0.2]) shape(g, 0x454c45, x, 0.35, 0, 0.22, 0.7, 0.26);
  for (const x of [-0.43, 0.43]) shape(g, color, x, 1, 0, 0.18, 0.65, 0.23);
  if (police) shape(g, 0xf5d779, -0.2, 1.2, 0.24, 0.13, 0.18, 0.04);
  return g;
}
function carModel(v) {
  const g = new T.Group(),
    length = v.kind === "bus" ? 6 : v.kind === "van" ? 4.5 : 3.2;
  const color = [0xd3a45c, 0x9d687d, 0x639c9e, 0x6f89b0][v.id % 4];
  shape(g, color, 0, 0.8, 0, 2.2, 1, length);
  shape(g, color, 0, 1.7, -0.2, 2, 1, length * 0.65);
  shape(g, 0xb8e1df, 0, 1.8, length * 0.33, 1.75, 0.65, 0.05);
  g.userData.frontWheels = [];
  for (const x of [-1.15, 1.15])
    for (const z of [-length * 0.32, length * 0.32]) {
      const w = shape(g, 0x37433c, x, 0.5, z, 0.43, 0.26, 0.43, cylinder);
      w.rotation.z = Math.PI / 2;
      if (z > 0) g.userData.frontWheels.push(w);
    }
  for (const x of [-0.7, 0.7])
    shape(g, 0xffeab2, x, 0.85, length / 2 + 0.02, 0.35, 0.22, 0.08);
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
    const length = SIZE * 1.44 - 68,
      a = f.angle + Math.PI / 6;
    const river = shape(
      world,
      0x72b6bd,
      Math.cos(a) * (68 + length / 2),
      -0.01,
      Math.sin(a) * (68 + length / 2),
      10,
      0.12,
      length,
    );
    river.rotation.y = Math.PI / 2 - a;
  }
  const roadMat = material(0x69766b);
  for (const f of [...FARMS, HOME]) {
    const r = Math.hypot(f.x, f.z),
      strip = shape(world, 0x69766b, f.x / 2, 0.08, f.z / 2, 11, 0.12, r + 6);
    strip.rotation.y = Math.atan2(f.x, f.z);
    for (let d = 12; d < r; d += 10) {
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
  const ring = new T.Mesh(new T.RingGeometry(94, 106, 96), roadMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.14;
  world.add(ring);
  for (const f of FARMS) {
    const a = f.angle + Math.PI / 6;
    for (const side of [-1, 1]) {
      const rail = shape(
        world,
        0xe6d7b5,
        Math.cos(a) * (100 + side * 6),
        1,
        Math.sin(a) * (100 + side * 6),
        0.4,
        1,
        15,
      );
      rail.rotation.y = -a;
    }
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
  for (const b of OBSTACLES) {
    shape(world, b.color, b.x, b.h / 2, b.z, b.hx * 2, b.h, b.hz * 2);
    const roof = shape(
      world,
      b.type === "town" ? 0x596c64 : 0x815e52,
      b.x,
      b.h + 0.4,
      b.z,
      b.hx * 2 + 1,
      0.8,
      b.hz * 2 + 1,
    );
    for (const x of [-1, 1])
      shape(
        world,
        0xe7e9c8,
        b.x + x * b.hx * 0.55,
        b.h * 0.6,
        b.z + b.hz + 0.03,
        1.5,
        1.8,
        0.05,
      );
    shape(world, 0x4f6450, b.x, 1.6, b.z + b.hz + 0.06, 2, 3.2, 0.1);
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
  const rocket = new T.Group();
  world.add(rocket);
  rocket.position.set(HOME.x - 11, 0, HOME.z - 8);
  shape(rocket, 0x616e63, 0, 0.35, 0, 6, 0.6, 6);
  const rocketParts = [];
  rocketParts.push(shape(rocket, 0xdfdbc5, 0, 3, 0, 1.7, 5, 1.7, cylinder));
  rocketParts.push(shape(rocket, 0x647b8c, 0, 1, 0, 2, 1.4, 2, cylinder));
  rocketParts.push(shape(rocket, 0xcf9062, -2, 3, 0, 0.65, 4, 0.65, cylinder));
  rocketParts.push(shape(rocket, 0xcf9062, 2, 3, 0, 0.65, 4, 0.65, cylinder));
  const nose = new T.Mesh(new T.ConeGeometry(1.7, 3, 12), material(0xdd795c));
  nose.position.y = 7;
  rocket.add(nose);
  rocketParts.push(nose);
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
    g.position.set(p.x, down ? 0.5 : 0, p.z);
    g.rotation.set(0, Math.PI / 2 - p.heading, down ? Math.PI / 2 : 0);
    if (!down)
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
  let shotMeshes = [];
  const compactLabels = matchMedia("(max-width: 750px), (pointer: coarse)");
  const placeLabels = [];
  world.traverse((node) => {
    if (node.isSprite) placeLabels.push(node);
  });
  function render(game) {
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
      player.position.set(
        game.player.x,
        game.player.y + (game.player.stun ? 0.6 : 0),
        game.player.z,
      );
      player.rotation.set(
        0,
        Math.PI / 2 - game.player.heading,
        game.player.stun ? Math.PI / 2 : 0,
      );
      player.visible =
        player.visible &&
        !(game.player.invulnerable > 0 && Math.floor(game.time * 12) % 2);
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
        .filter((s) => dist(s, game.player) < 100)
        .map((s) =>
          shape(
            actorRoot,
            s.owner === "enemy" ? 0xea9388 : 0xb2e4f2,
            s.x,
            1.2,
            s.z,
            0.3,
            0.3,
            0.3,
            sphere,
          ),
        );
      rocketParts.forEach((m, i) => (m.visible = i < game.parts));
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
        : new T.Vector3(game.player.x, game.player.y, game.player.z);
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
        chunks: chunks.size,
        actors: actors.size,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    },
  };
}
