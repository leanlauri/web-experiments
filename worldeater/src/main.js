import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import './style.css';
import { canSwallow, grownHoleRadius } from './game-rules.js';

const canvas = document.querySelector('#game');
const scoreEl = document.querySelector('#score');
const apertureEl = document.querySelector('#aperture');
const endCard = document.querySelector('#end-card');
const restartButton = document.querySelector('#restart');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#cbd9e3');
scene.fog = new THREE.Fog('#cbd9e3', 24, 54);

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
camera.position.set(15, 19, 18);
camera.lookAt(0, 0, 0);

const hemi = new THREE.HemisphereLight('#edf7ff', '#30404e', 2.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3d8', 3.5);
sun.position.set(-14, 22, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -25;
scene.add(sun);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
world.allowSleep = true;
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.68;
world.defaultContactMaterial.restitution = 0.08;

const GROUP_GROUND = 1;
const GROUP_OBJECT = 2;
const GROUP_SINKING = 4;
const GROUP_BUCKET = 8;

const ground = new CANNON.Body({ mass: 0, material: new CANNON.Material('ground') });
ground.addShape(new CANNON.Plane());
ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
ground.collisionFilterGroup = GROUP_GROUND;
ground.collisionFilterMask = GROUP_OBJECT;
world.addBody(ground);

const groundMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(72, 72),
  new THREE.MeshStandardMaterial({ color: '#718c83', roughness: 0.94, metalness: 0 }),
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// A sparse grid makes the intact, visual ground easier to read as a surface.
const grid = new THREE.GridHelper(70, 35, '#6a827b', '#81998e');
grid.position.y = 0.006;
grid.material.opacity = 0.16;
grid.material.transparent = true;
scene.add(grid);

const hole = new THREE.Group();
scene.add(hole);
const shadowRing = new THREE.Mesh(
  new THREE.RingGeometry(0.84, 1.24, 64),
  new THREE.MeshBasicMaterial({ color: '#26323b', transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
);
shadowRing.rotation.x = -Math.PI / 2;
shadowRing.position.y = 0.024;
hole.add(shadowRing);
const rim = new THREE.Mesh(
  new THREE.RingGeometry(0.80, 0.94, 64),
  new THREE.MeshStandardMaterial({ color: '#121c28', roughness: 0.43, metalness: 0.15, side: THREE.DoubleSide }),
);
rim.rotation.x = -Math.PI / 2;
rim.position.y = 0.032;
hole.add(rim);
const voidDisk = new THREE.Mesh(
  new THREE.CircleGeometry(0.81, 64),
  new THREE.MeshBasicMaterial({ color: '#070b13', side: THREE.DoubleSide }),
);
voidDisk.rotation.x = -Math.PI / 2;
voidDisk.position.y = 0.03;
hole.add(voidDisk);
const innerGlow = new THREE.Mesh(
  new THREE.RingGeometry(0.58, 0.80, 64),
  new THREE.MeshBasicMaterial({ color: '#141f35', transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
);
innerGlow.rotation.x = -Math.PI / 2;
innerGlow.position.y = 0.037;
hole.add(innerGlow);

const holePosition = new THREE.Vector3(0, 0, 0);
const moveTarget = new THREE.Vector3(0, 0, 0);
let holeRadius = 1.35;
let lastTime = performance.now();
let score = 0;
let total = 0;
let won = false;

const bucketBodies = [];
const bucketRadius = 1;
const bucketBottom = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
bucketBottom.addShape(new CANNON.Box(new CANNON.Vec3(1, 0.14, 1)));
bucketBottom.collisionFilterGroup = GROUP_BUCKET;
bucketBottom.collisionFilterMask = GROUP_SINKING;
world.addBody(bucketBottom);
bucketBodies.push(bucketBottom);
for (let i = 0; i < 18; i += 1) {
  const angle = (i / 18) * Math.PI * 2;
  const wall = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
  wall.addShape(new CANNON.Box(new CANNON.Vec3(0.16, 1.8, 0.42)));
  wall.collisionFilterGroup = GROUP_BUCKET;
  wall.collisionFilterMask = GROUP_SINKING;
  wall.userData = { angle };
  world.addBody(wall);
  bucketBodies.push(wall);
}

function resizeBucket() {
  const scale = holeRadius / bucketRadius;
  bucketBottom.shapes[0].halfExtents.set(scale * 0.72, 0.14, scale * 0.72);
  bucketBottom.shapes[0].updateConvexPolyhedronRepresentation();
  bucketBottom.updateBoundingRadius();
}

function updateBucket() {
  bucketBottom.position.set(holePosition.x, -3.65, holePosition.z);
  for (const wall of bucketBodies.slice(1)) {
    const radius = holeRadius * 0.84;
    wall.position.set(
      holePosition.x + Math.cos(wall.userData.angle) * radius,
      -1.72,
      holePosition.z + Math.sin(wall.userData.angle) * radius,
    );
    wall.quaternion.setFromEuler(0, -wall.userData.angle, 0);
  }
}

const palette = ['#e85d4a', '#f2b544', '#2d9d94', '#497ac8', '#b85fa6', '#e77f9f', '#e8e0bf'];
const objects = [];
const geometry = {
  cube: new THREE.BoxGeometry(1, 1, 1),
  ball: new THREE.SphereGeometry(0.55, 16, 12),
  cone: new THREE.ConeGeometry(0.56, 1.15, 5),
  tower: new THREE.CylinderGeometry(0.38, 0.48, 1.6, 6),
  block: new THREE.BoxGeometry(1.45, 0.65, 0.9),
};

function addObject(type, x, z, scale = 1, color = palette[Math.floor(Math.random() * palette.length)]) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.04 });
  const mesh = new THREE.Mesh(geometry[type], material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.setScalar(scale);
  scene.add(mesh);

  let shape;
  let height;
  if (type === 'ball') { shape = new CANNON.Sphere(0.55 * scale); height = 0.55 * scale; }
  else if (type === 'tower') { shape = new CANNON.Cylinder(0.45 * scale, 0.45 * scale, 1.6 * scale, 6); height = 0.8 * scale; }
  else if (type === 'cone') { shape = new CANNON.Cylinder(0.56 * scale, 0.09 * scale, 1.15 * scale, 5); height = 0.575 * scale; }
  else if (type === 'block') { shape = new CANNON.Box(new CANNON.Vec3(0.725 * scale, 0.325 * scale, 0.45 * scale)); height = 0.325 * scale; }
  else { shape = new CANNON.Box(new CANNON.Vec3(0.5 * scale, 0.5 * scale, 0.5 * scale)); height = 0.5 * scale; }
  const body = new CANNON.Body({ mass: Math.max(0.35, scale ** 3) });
  body.addShape(shape);
  body.position.set(x, height + 0.04, z);
  body.linearDamping = 0.25;
  body.angularDamping = 0.42;
  body.allowSleep = true;
  body.sleepSpeedLimit = 0.18;
  body.collisionFilterGroup = GROUP_OBJECT;
  body.collisionFilterMask = GROUP_GROUND | GROUP_OBJECT;
  world.addBody(body);
  const entry = { mesh, body, size: scale, height, state: 'ground', sinkAge: 0 };
  objects.push(entry);
  total += 1;
}

function populate() {
  const specs = [
    ['cube', -5.2, -2.8, 0.58], ['ball', -3.1, -3.8, 0.62], ['cone', -1.4, -2.8, 0.62], ['tower', 2.2, -3.9, 0.58], ['cube', 5.2, -3.4, 0.78],
    ['ball', -5.8, 0.5, 0.73], ['block', -3.4, 0.3, 0.65], ['cone', -0.7, 0.3, 0.8], ['cube', 2.3, -0.2, 0.86], ['tower', 5.3, 0.55, 0.78],
    ['block', -5.2, 3.7, 0.86], ['ball', -2.4, 3.4, 0.95], ['tower', 0.55, 3.5, 0.92], ['cone', 3.4, 3.5, 1.06], ['cube', 5.6, 3.8, 1.16],
    ['block', -1.0, 6.0, 1.22], ['tower', 2.2, 6.1, 1.27], ['cube', 5.1, 6.0, 1.42],
  ];
  specs.forEach(([type, x, z, size], index) => addObject(type, x, z, size, palette[index % palette.length]));
  // A deliberate stack demonstrates that removing a lower item releases its neighbours.
  addObject('cube', -6.0, -0.9, 0.62, '#f2b544');
  const top = objects.at(-1);
  top.body.position.y = 1.32;
}

function syncHoleVisual() {
  hole.position.copy(holePosition);
  const visualScale = holeRadius / 1.35;
  hole.scale.setScalar(visualScale);
  apertureEl.textContent = `${holeRadius.toFixed(2)}m`;
  resizeBucket();
}

function startSinking(item) {
  item.state = 'sinking';
  item.body.collisionFilterGroup = GROUP_SINKING;
  item.body.collisionFilterMask = GROUP_OBJECT | GROUP_BUCKET;
  item.body.wakeUp();
}

function updateObjects(dt) {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const item = objects[i];
    const { body } = item;
    const dx = holePosition.x - body.position.x;
    const dz = holePosition.z - body.position.z;
    const distance = Math.hypot(dx, dz);
    if (item.state === 'ground' && canSwallow({
      size: item.size, holeRadius, distance, height: item.height, bodyY: body.position.y,
    })) startSinking(item);
    if (item.state === 'sinking') {
      item.sinkAge += dt;
      // This is the local bucket's funnel force. Body-to-body collisions stay active,
      // so a stacked object is still released by the object underneath it moving away.
      body.applyForce(new CANNON.Vec3(dx * 18, -body.mass * 7, dz * 18), body.position);
      if (body.position.y < -2.35 || item.sinkAge > 2.6) {
        world.removeBody(body);
        scene.remove(item.mesh);
        objects.splice(i, 1);
        score += 1;
        holeRadius = grownHoleRadius(holeRadius, item.size);
        syncHoleVisual();
      }
    }
    if (item.state !== 'removed') {
      item.mesh.position.copy(body.position);
      item.mesh.quaternion.copy(body.quaternion);
    }
  }
  scoreEl.textContent = `${score} / ${total}`;
  if (!won && score === total) {
    won = true;
    endCard.hidden = false;
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(groundMesh)[0];
  if (hit) moveTarget.set(THREE.MathUtils.clamp(hit.point.x, -11, 11), 0, THREE.MathUtils.clamp(hit.point.z, -9, 9));
});

const keyState = new Set();
window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); keyState.add(event.key); }
});
window.addEventListener('keyup', (event) => keyState.delete(event.key));

function updateInput(dt) {
  const speed = 10 * dt;
  if (keyState.has('ArrowLeft')) moveTarget.x -= speed;
  if (keyState.has('ArrowRight')) moveTarget.x += speed;
  if (keyState.has('ArrowUp')) moveTarget.z -= speed;
  if (keyState.has('ArrowDown')) moveTarget.z += speed;
  moveTarget.x = THREE.MathUtils.clamp(moveTarget.x, -11, 11);
  moveTarget.z = THREE.MathUtils.clamp(moveTarget.z, -9, 9);
  holePosition.lerp(moveTarget, 1 - Math.exp(-8 * dt));
}

function render(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  updateInput(dt);
  syncHoleVisual();
  updateBucket();
  world.step(1 / 60, dt, 3);
  updateObjects(dt);
  camera.position.lerp(new THREE.Vector3(holePosition.x + 15, 19, holePosition.z + 18), 1 - Math.exp(-1.8 * dt));
  camera.lookAt(holePosition.x, 0, holePosition.z - 0.3);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
restartButton.addEventListener('click', () => window.location.reload());

populate();
syncHoleVisual();
onResize();
requestAnimationFrame(render);
