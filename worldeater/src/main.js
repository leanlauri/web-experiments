import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import './style.css';
import { canCancelSinking, canSwallow, compareStackLevels, grownHoleRadius, holeOpeningRadius, shaftContainment, shouldConsumeAtDepth, shouldReleaseIntoVoid, stackActivationRadius } from './game-rules.js';
import { INDIVIDUALS_PER_TILE, OBJECTS_PER_STACK, scatteredPoint, scatteredPoints, STACKS_PER_TILE, WORLD_GRID_COLUMNS, WORLD_GRID_ROWS } from './world-layout.js';
import { cameraRelativeMovement, moveTowardsTarget } from './camera-input.js';
import { PhysicsDebugView } from './physics-debug.js';
import { layoutStackLevels } from './stack-layout.js';

const canvas = document.querySelector('#game');
const scoreEl = document.querySelector('#score');
const apertureEl = document.querySelector('#aperture');
const endCard = document.querySelector('#end-card');
const restartButton = document.querySelector('#restart');
const physicsDebugToggle = document.querySelector('#physics-debug');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#cbd9e3');
scene.fog = new THREE.Fog('#cbd9e3', 52, 115);

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
const INITIAL_HOLE_RADIUS = 1.35;
const WALL_HALF_THICKNESS = 0.16;
const RIM_SEGMENTS = 32;
const RIM_DEPTH = 0.42;
const CONSUME_DEPTH = -10;
const MAX_STREAMING_ACTIVATIONS = 12;
const STACK_GROUND_MARGIN = 0.04;
const STACK_LEVEL_MARGIN = 0;

const ground = new CANNON.Body({ mass: 0, material: new CANNON.Material('ground') });
ground.addShape(new CANNON.Plane());
ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
ground.collisionFilterGroup = GROUP_GROUND;
ground.collisionFilterMask = GROUP_OBJECT;
world.addBody(ground);

const groundMaterial = new THREE.MeshStandardMaterial({ color: '#718c83', roughness: 0.94, metalness: 0 });
const holeMask = { center: new THREE.Vector2(), radius: { value: 1 } };
groundMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.holeCenter = { value: holeMask.center };
  shader.uniforms.holeRadius = holeMask.radius;
  shader.vertexShader = `varying vec3 vMaskWorldPosition;\n${shader.vertexShader}`
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vMaskWorldPosition = worldPosition.xyz;');
  shader.fragmentShader = `varying vec3 vMaskWorldPosition;\nuniform vec2 holeCenter;\nuniform float holeRadius;\n${shader.fragmentShader}`
    .replace('#include <dithering_fragment>', 'if (distance(vMaskWorldPosition.xz, holeCenter) < holeRadius) discard;\n#include <dithering_fragment>');
};
groundMaterial.customProgramCacheKey = () => 'world-eater-ground-hole-mask';
const groundMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 280),
  groundMaterial,
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const hole = new THREE.Group();
scene.add(hole);
const shadowRing = new THREE.Mesh(
  new THREE.RingGeometry(holeOpeningRadius(INITIAL_HOLE_RADIUS), 1.48, 64),
  new THREE.MeshBasicMaterial({ color: '#708681', side: THREE.DoubleSide }),
);
shadowRing.rotation.x = -Math.PI / 2;
shadowRing.position.y = 0.024;
hole.add(shadowRing);
const voidDisk = new THREE.Mesh(
  new THREE.CircleGeometry(holeOpeningRadius(INITIAL_HOLE_RADIUS) + 0.002, 64),
  new THREE.MeshBasicMaterial({ color: '#070b13', side: THREE.DoubleSide, depthTest: false, depthWrite: false }),
);
voidDisk.rotation.x = -Math.PI / 2;
voidDisk.position.y = 0.015;
voidDisk.renderOrder = -2;
hole.add(voidDisk);

const holePosition = new THREE.Vector3(0, 0, 0);
const moveTarget = new THREE.Vector3(0, 0, 0);
let holeRadius = INITIAL_HOLE_RADIUS;
let lastTime = performance.now();
let score = 0;
let total = 0;
let won = false;

const bucketBodies = [];
for (let i = 0; i < RIM_SEGMENTS; i += 1) {
  const angle = (i / RIM_SEGMENTS) * Math.PI * 2;
  const wall = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
  wall.addShape(new CANNON.Box(new CANNON.Vec3(0.16, RIM_DEPTH / 2, 0.42)));
  wall.collisionFilterGroup = GROUP_BUCKET;
  wall.collisionFilterMask = GROUP_SINKING;
  wall.userData = { angle };
  world.addBody(wall);
  bucketBodies.push(wall);
}

function resizeBucket() {
  const openingRadius = holeOpeningRadius(holeRadius);
  for (const wall of bucketBodies) {
    wall.shapes[0].halfExtents.z = Math.max(0.28, openingRadius * Math.PI / RIM_SEGMENTS + 0.045);
    wall.shapes[0].updateConvexPolyhedronRepresentation();
    wall.updateBoundingRadius();
  }
}

function updateBucket() {
  for (const wall of bucketBodies) {
    const radius = holeOpeningRadius(holeRadius) + WALL_HALF_THICKNESS;
    wall.position.set(
      holePosition.x + Math.cos(wall.userData.angle) * radius,
      -RIM_DEPTH / 2,
      holePosition.z + Math.sin(wall.userData.angle) * radius,
    );
    wall.quaternion.setFromEuler(0, -wall.userData.angle, 0);
    wall.aabbNeedsUpdate = true;
    wall.updateAABB();
  }
}

const palette = ['#e85d4a', '#f2b544', '#2d9d94', '#497ac8', '#b85fa6', '#e77f9f', '#e8e0bf'];
const objects = [];
const stacks = [];
const batches = new Map();
const instanceDummy = new THREE.Object3D();
const worldBounds = { x: 121, z: 102 };
const geometry = {
  cube: new THREE.BoxGeometry(1, 1, 1),
  ball: new THREE.SphereGeometry(0.55, 16, 12),
  cone: new THREE.ConeGeometry(0.56, 1.15, 5),
  tower: new THREE.CylinderGeometry(0.38, 0.48, 1.6, 6),
  block: new THREE.BoxGeometry(1.45, 0.65, 0.9),
};

function collisionFor(type, scale) {
  let shape;
  let height;
  let footprint;
  if (type === 'ball') { shape = new CANNON.Sphere(0.55 * scale); height = 0.55 * scale; footprint = 0.55 * scale; }
  else if (type === 'tower') { shape = new CANNON.Cylinder(0.45 * scale, 0.45 * scale, 1.6 * scale, 6); height = 0.8 * scale; footprint = 0.45 * scale; }
  else if (type === 'cone') { shape = new CANNON.Cylinder(0.09 * scale, 0.56 * scale, 1.15 * scale, 5); height = 0.575 * scale; footprint = 0.56 * scale; }
  else if (type === 'block') { shape = new CANNON.Box(new CANNON.Vec3(0.725 * scale, 0.325 * scale, 0.45 * scale)); height = 0.325 * scale; footprint = Math.hypot(0.725, 0.45) * scale; }
  else { shape = new CANNON.Box(new CANNON.Vec3(0.5 * scale, 0.5 * scale, 0.5 * scale)); height = 0.5 * scale; footprint = Math.SQRT1_2 * scale; }
  return { shape, height, footprint };
}

function writeStaticTransform(item, visible) {
  instanceDummy.position.set(item.x, item.y, item.z);
  instanceDummy.quaternion.copy(item.rotation);
  instanceDummy.scale.setScalar(visible ? item.size : 0.0001);
  instanceDummy.updateMatrix();
  item.batch.setMatrixAt(item.instance, instanceDummy.matrix);
  item.batch.instanceMatrix.needsUpdate = true;
}

function activateItem(item) {
  if (item.state !== 'idle') return;
  const { shape, height } = collisionFor(item.type, item.size);
  const material = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.7, metalness: 0.04 });
  const mesh = new THREE.Mesh(geometry[item.type], material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.setScalar(item.size);
  scene.add(mesh);
  const body = new CANNON.Body({ mass: Math.max(0.35, item.size ** 3) });
  body.addShape(shape);
  body.position.set(item.x, item.y || height + 0.04, item.z);
  body.quaternion.copy(item.rotation);
  body.linearDamping = 0.25;
  body.angularDamping = 0.42;
  body.allowSleep = true;
  body.sleepSpeedLimit = 0.18;
  body.collisionFilterGroup = GROUP_OBJECT;
  body.collisionFilterMask = GROUP_GROUND | GROUP_OBJECT | GROUP_SINKING;
  world.addBody(body);
  item.mesh = mesh;
  item.body = body;
  item.height = height;
  item.state = 'ground';
  writeStaticTransform(item, false);
}

function addStaticCollider(item) {
  if (item.state !== 'idle') return;
  const { shape } = collisionFor(item.type, item.size);
  const body = new CANNON.Body({ mass: 0 });
  body.addShape(shape);
  body.position.set(item.x, item.y, item.z);
  body.quaternion.copy(item.rotation);
  body.collisionFilterGroup = GROUP_OBJECT;
  body.collisionFilterMask = GROUP_OBJECT | GROUP_SINKING;
  world.addBody(body);
  item.body = body;
  item.state = 'static';
}

function buildBatches() {
  const groups = new Map();
  for (const item of objects) {
    const key = `${item.type}:${item.color}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  for (const [key, items] of groups) {
    const [type, color] = key.split(':');
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.04 });
    const batch = new THREE.InstancedMesh(geometry[type], material, items.length);
    batch.castShadow = true;
    batch.receiveShadow = true;
    scene.add(batch);
    batches.set(key, batch);
    items.forEach((item, index) => {
      item.batch = batch;
      item.instance = index;
      writeStaticTransform(item, true);
    });
  }
}

function queueObject(type, x, z, size, color, y = null, stack = null) {
  const { height, footprint } = collisionFor(type, size);
  const item = { type, x, y: y ?? height + 0.04, z, size, footprint, color, rotation: new THREE.Quaternion(), body: null, mesh: null, state: 'idle', sinkAge: 0, visible: true, stack };
  objects.push(item);
  return item;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function choose(random, values) {
  return values[Math.floor(random() * values.length)];
}

function populate() {
  for (let row = 0; row < WORLD_GRID_ROWS; row += 1) {
    for (let column = 0; column < WORLD_GRID_COLUMNS; column += 1) {
      const offsetX = (column - 4.5) * 25;
      const offsetZ = (row - 4.5) * 22;
      const random = seededRandom(1009 + row * 97 + column * 7919);
      const stackCenters = scatteredPoints(random, STACKS_PER_TILE);
      const occupied = [...stackCenters];

      for (let index = 0; index < INDIVIDUALS_PER_TILE; index += 1) {
        const point = scatteredPoint(random, occupied);
        // Three small props per area keep the initial world playable; the rest are deliberately larger.
        const size = index < 3 ? 0.44 + random() * 0.36 : 1.02 + random() * 2.15;
        queueObject(choose(random, Object.keys(geometry)), point.x + offsetX, point.z + offsetZ, size, choose(random, palette));
      }

      for (let stackIndex = 0; stackIndex < STACKS_PER_TILE; stackIndex += 1) {
        const center = stackCenters[stackIndex];
        const baseSize = 1.05 + random() * 1.75;
        const stack = { items: [], activated: false, released: false, maxFootprint: 0 };
        const levels = Array.from({ length: OBJECTS_PER_STACK }, () => {
          const type = choose(random, ['cube', 'block', 'tower', 'cone']);
          const size = baseSize * (0.9 + random() * 0.16);
          const { height, footprint } = collisionFor(type, size);
          return { type, size, color: choose(random, palette), halfHeight: height, footprint };
        });
        // Cones cap stacks; the remaining levels are widest-first so every body
        // has a broad, flat support when the stack changes over to live physics.
        levels.sort(compareStackLevels);

        const placements = layoutStackLevels(levels, {
          groundMargin: STACK_GROUND_MARGIN,
          levelMargin: STACK_LEVEL_MARGIN,
        });
        for (const level of placements) {
          const item = queueObject(level.type, center.x + offsetX, center.z + offsetZ, level.size, level.color, level.y, stack);
          stack.items.push(item);
          stack.maxFootprint = Math.max(stack.maxFootprint, level.footprint);
        }
        stacks.push(stack);
      }
    }
  }
  total = objects.length;
  buildBatches();
}

function syncHoleVisual() {
  hole.position.copy(holePosition);
  const visualScale = holeRadius / INITIAL_HOLE_RADIUS;
  hole.scale.set(visualScale, 1, visualScale);
  holeMask.center.set(holePosition.x, holePosition.z);
  holeMask.radius.value = holeOpeningRadius(holeRadius);
  apertureEl.textContent = `${holeRadius.toFixed(2)}m`;
  resizeBucket();
}

function releaseStack(stack) {
  if (!stack || stack.released) return;
  stack.released = true;
  for (const item of stack.items) item.body?.wakeUp();
}

function startSinking(item) {
  releaseStack(item.stack);
  item.state = 'sinking';
  item.body.collisionFilterGroup = GROUP_SINKING;
  item.body.collisionFilterMask = GROUP_OBJECT | GROUP_SINKING | GROUP_BUCKET;
  item.body.collisionResponse = true;
  item.body.wakeUp();
}

function releaseIntoVoid(item) {
  const { body } = item;
  item.state = 'void';
  // No shaft or catch basin exists below the collar: from here the object is
  // free-falling and cannot build up, tumble, or rest on hidden geometry.
  body.collisionFilterGroup = 0;
  body.collisionFilterMask = 0;
  body.collisionResponse = false;
  body.wakeUp();
}

function cancelSinking(item) {
  const { body } = item;
  body.collisionFilterGroup = GROUP_OBJECT;
  body.collisionFilterMask = GROUP_GROUND | GROUP_OBJECT | GROUP_SINKING;
  body.collisionResponse = true;
  body.velocity.y = Math.max(0, body.velocity.y);
  body.angularVelocity.set(0, 0, 0);
  item.state = 'ground';
  item.sinkAge = 0;
  body.wakeUp();
}

function canTeeter(item, distance) {
  const openingRadius = holeOpeningRadius(holeRadius);
  return (item.type === 'cube' || item.type === 'block')
    && item.footprint > openingRadius * 0.92
    && item.footprint <= openingRadius * 1.7
    && distance < openingRadius + item.footprint * 0.25;
}

function startTeetering(item) {
  activateItem(item);
  item.state = 'teeter';
  item.body.collisionFilterGroup = GROUP_SINKING;
  item.body.collisionFilterMask = GROUP_OBJECT | GROUP_SINKING | GROUP_BUCKET;
  item.body.wakeUp();
}

function deactivateItem(item) {
  item.x = item.body.position.x;
  item.y = item.body.position.y;
  item.z = item.body.position.z;
  item.rotation.copy(item.body.quaternion);
  world.removeBody(item.body);
  scene.remove(item.mesh);
  item.body = null;
  item.mesh = null;
  item.state = 'idle';
  writeStaticTransform(item, item.visible);
}

function containSwallowedBody(item) {
  const { body } = item;
  if (body.position.y >= -0.04 || body.position.y <= -RIM_DEPTH) return;
  const correction = shaftContainment({
    offsetX: body.position.x - holePosition.x,
    offsetZ: body.position.z - holePosition.z,
    openingRadius: holeOpeningRadius(holeRadius),
    footprintRadius: item.footprint,
  });
  if (correction.x === 0 && correction.z === 0) return;
  // The shallow kinematic collar resolves rim movement before the body drops into the void.
  body.position.x += correction.x;
  body.position.z += correction.z;
  body.velocity.x += correction.x * 8;
  body.velocity.z += correction.z * 8;
  body.aabbNeedsUpdate = true;
}

function updateObjects(dt) {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const item = objects[i];
    if (item.state === 'idle' || item.state === 'static') continue;
    const { body } = item;
    const dx = holePosition.x - body.position.x;
    const dz = holePosition.z - body.position.z;
    const distance = Math.hypot(dx, dz);
    if (item.state === 'ground' && canSwallow({
      footprintRadius: item.footprint, openingRadius: holeOpeningRadius(holeRadius), distance, height: item.height, bodyY: body.position.y,
    })) startSinking(item);
    if (item.state === 'ground' && item.stack && !item.stack.released && canTeeter(item, distance)) {
      releaseStack(item.stack);
      startTeetering(item);
    }
    if (item.state === 'teeter' && canSwallow({
      footprintRadius: item.footprint, openingRadius: holeOpeningRadius(holeRadius), distance, height: item.height, bodyY: body.position.y,
    })) startSinking(item);
    if (item.state === 'teeter' && canCancelSinking({ bodyY: body.position.y, distance, cancelRadius: holeRadius * 0.82, recoverHeight: item.height * 0.6 })) {
      cancelSinking(item);
      continue;
    }
    if (item.state === 'sinking') {
      item.sinkAge += dt;
      // Once ground contact is removed, normal gravity and remaining body contacts do the work.
      if (canCancelSinking({ bodyY: body.position.y, distance, cancelRadius: holeRadius * 0.78, recoverHeight: item.height * 0.6 })) {
        cancelSinking(item);
        continue;
      }
      containSwallowedBody(item);
      if (shouldReleaseIntoVoid({ bodyY: body.position.y, rimDepth: RIM_DEPTH })) releaseIntoVoid(item);
    }
    if (item.state === 'void') {
      if (shouldConsumeAtDepth({ bodyY: body.position.y, consumeDepth: CONSUME_DEPTH })) {
        world.removeBody(body);
        scene.remove(item.mesh);
        objects.splice(i, 1);
        score += 1;
        holeRadius = grownHoleRadius(holeRadius, item.size);
        syncHoleVisual();
      }
    }
    if (item.state === 'ground' && distance > 28 && body.sleepState === CANNON.Body.SLEEPING) {
      deactivateItem(item);
      continue;
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

function updateStreaming() {
  let activations = 0;
  const openingRadius = holeOpeningRadius(holeRadius);

  // A stack stays entirely static until the hole is close enough to interact
  // with it, then all of its bodies transition together from bottom to top.
  // This avoids dynamic bodies spawning against still-static stack neighbors.
  for (const stack of stacks) {
    if (stack.activated) {
      if (!stack.released) {
        const anchor = stack.items[0];
        const distance = Math.hypot(anchor.x - holePosition.x, anchor.z - holePosition.z);
        if (distance > 18) {
          for (const item of stack.items) {
            if (item.body) deactivateItem(item);
          }
          stack.activated = false;
        }
      }
      continue;
    }
    if (stack.items.some((item) => item.state !== 'idle' && item.state !== 'static')) {
      stack.activated = true;
      continue;
    }

    const anchor = stack.items[0];
    const distance = Math.hypot(anchor.x - holePosition.x, anchor.z - holePosition.z);
    const shouldShow = distance < 48;
    for (const item of stack.items) {
      if (shouldShow !== item.visible) {
        item.visible = shouldShow;
        writeStaticTransform(item, shouldShow);
      }
    }

    if (distance > 18) {
      for (const item of stack.items) {
        if (item.state !== 'static') continue;
        world.removeBody(item.body);
        item.body = null;
        item.state = 'idle';
      }
      continue;
    }

    const activationRadius = stackActivationRadius({ openingRadius, maxFootprint: stack.maxFootprint });
    if (distance < activationRadius && activations + stack.items.length <= MAX_STREAMING_ACTIVATIONS) {
      for (const item of stack.items) {
        if (item.state === 'static') {
          world.removeBody(item.body);
          item.body = null;
          item.state = 'idle';
        }
        activateItem(item);
        activations += 1;
      }
      stack.activated = true;
      stack.released = false;
      // Bodies are ready for contact without reacting to tiny spawn-time gaps.
      // The first swallowed or teetering piece wakes the complete stack.
      for (const item of stack.items) item.body.sleep();
    } else if (shouldShow && distance < 15) {
      for (const item of stack.items) addStaticCollider(item);
    }
  }

  for (const item of objects) {
    if (item.stack && !item.stack.activated) continue;
    if (item.state === 'static') {
      const distance = Math.hypot(item.x - holePosition.x, item.z - holePosition.z);
      if (distance > 18) {
        world.removeBody(item.body);
        item.body = null;
        item.state = 'idle';
      } else if (canTeeter(item, distance) && activations < MAX_STREAMING_ACTIVATIONS) {
        world.removeBody(item.body);
        item.body = null;
        item.state = 'idle';
        startTeetering(item);
        activations += 1;
      } else if (item.footprint < holeOpeningRadius(holeRadius) * 0.92) {
        world.removeBody(item.body);
        item.body = null;
        item.state = 'idle';
        activateItem(item);
      }
      continue;
    }
    if (item.state !== 'idle') continue;
    const distance = Math.hypot(item.x - holePosition.x, item.z - holePosition.z);
    const shouldShow = distance < 48;
    if (shouldShow !== item.visible) {
      item.visible = shouldShow;
      writeStaticTransform(item, shouldShow);
    }
    // Distant props stay as culled instances. Nearby oversized pieces add only a static support collider.
    if (shouldShow && distance < 15) {
      if (item.footprint < openingRadius * 0.92 && activations < MAX_STREAMING_ACTIVATIONS) {
        activateItem(item);
        activations += 1;
      } else if (canTeeter(item, distance) && activations < MAX_STREAMING_ACTIVATIONS) {
        startTeetering(item);
        activations += 1;
      } else if (item.footprint >= openingRadius * 0.92) {
        addStaticCollider(item);
      }
    }
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pointerTarget = new THREE.Vector3();
let hasPointerTarget = false;

function updatePointerTarget(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(groundMesh)[0];
  if (!hit) return;
  pointerTarget.set(
    THREE.MathUtils.clamp(hit.point.x, -worldBounds.x, worldBounds.x),
    0,
    THREE.MathUtils.clamp(hit.point.z, -worldBounds.z, worldBounds.z),
  );
  hasPointerTarget = true;
}

let activePointerId = null;

canvas.addEventListener('pointerdown', (event) => {
  if (activePointerId !== null) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  updatePointerTarget(event);
});
canvas.addEventListener('pointermove', (event) => {
  if (event.pointerId !== activePointerId || !hasPointerTarget) return;
  event.preventDefault();
  updatePointerTarget(event);
});
function stopPointerMovement(event) {
  if (event && event.pointerId !== activePointerId) return;
  if (event) event.preventDefault();
  hasPointerTarget = false;
  if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  activePointerId = null;
}
canvas.addEventListener('pointerup', stopPointerMovement);
canvas.addEventListener('pointercancel', stopPointerMovement);
canvas.addEventListener('lostpointercapture', (event) => {
  if (event.pointerId !== activePointerId) return;
  hasPointerTarget = false;
  activePointerId = null;
});

const keyState = new Set();
const cameraForward = new THREE.Vector3();
window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); keyState.add(event.key); }
});
window.addEventListener('keyup', (event) => keyState.delete(event.key));

function updateInput(dt) {
  const speed = 10 * dt;
  camera.getWorldDirection(cameraForward);
  cameraForward.y = 0;
  cameraForward.normalize();
  const horizontal = Number(keyState.has('ArrowRight')) - Number(keyState.has('ArrowLeft'));
  const vertical = Number(keyState.has('ArrowUp')) - Number(keyState.has('ArrowDown'));
  const movement = cameraRelativeMovement({
    forwardX: cameraForward.x,
    forwardZ: cameraForward.z,
    horizontal,
    vertical,
    speed,
  });
  if (horizontal !== 0 || vertical !== 0) {
    moveTarget.x += movement.x;
    moveTarget.z += movement.z;
    hasPointerTarget = false;
  } else if (hasPointerTarget) {
    const next = moveTowardsTarget({ x: moveTarget.x, z: moveTarget.z, targetX: pointerTarget.x, targetZ: pointerTarget.z, speed });
    moveTarget.set(next.x, 0, next.z);
  }
  moveTarget.x = THREE.MathUtils.clamp(moveTarget.x, -worldBounds.x, worldBounds.x);
  moveTarget.z = THREE.MathUtils.clamp(moveTarget.z, -worldBounds.z, worldBounds.z);
  holePosition.lerp(moveTarget, 1 - Math.exp(-8 * dt));
}

const physicsDebugView = new PhysicsDebugView(scene, world, (body) => {
  if (body.collisionFilterGroup === GROUP_BUCKET) return '#ff4fd8';
  if (body.collisionFilterGroup === GROUP_SINKING) return '#ff8a3d';
  if (body.collisionFilterGroup === GROUP_OBJECT) return '#ffe45c';
  if (body.collisionFilterGroup === GROUP_GROUND) return '#39e7ff';
  return '#9aa7b4';
});
physicsDebugToggle.addEventListener('change', () => {
  physicsDebugView.setEnabled(physicsDebugToggle.checked);
});

function render(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  updateInput(dt);
  syncHoleVisual();
  updateStreaming();
  updateBucket();
  world.step(1 / 60, dt, 3);
  updateObjects(dt);
  physicsDebugView.update();
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
