import './style.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CELL_SIZE, terrainColor, VoxelTerrain } from './terrain.js';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15; renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene(); scene.background = new THREE.Color('#b8d8dc'); scene.fog = new THREE.Fog('#b8d8dc', 50, 125);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 220); camera.position.set(34, 34, 46);
const controls = new OrbitControls(camera, canvas); controls.target.set(0, 12, 0); controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * .48; controls.minDistance = 11; controls.maxDistance = 80;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

scene.add(new THREE.HemisphereLight('#eafcff', '#73583c', 2.4));
const sun = new THREE.DirectionalLight('#fff5d2', 3.5); sun.position.set(-24, 38, 20); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = sun.shadow.camera.bottom = -55; sun.shadow.camera.right = sun.shadow.camera.top = 55; scene.add(sun);
const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: 0 });
let seed = Math.random() * 100; let terrain = new VoxelTerrain(scene, terrainMaterial, seed);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) }); world.allowSleep = true;
world.defaultContactMaterial.friction = .78; world.defaultContactMaterial.restitution = .1;
const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() }); floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(floorBody);
const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const projectiles = []; const debris = []; const props = []; const effects = [];
const MAX_DEBRIS_BODIES = 110;
const MAX_MERGEABLE_DEBRIS_PER_BLAST = 36;
const MAX_VISUAL_CHIPS = 30;
const MIN_FRAGMENT_CELLS = 2;
const BOULDER_ROLLING_RESISTANCE = .88;
const CHIP_ROLLING_RESISTANCE = .42;
const BOULDER_STATIC_FRICTION_SPEED = .68;
const BOULDER_STATIC_FRICTION_MIN_NORMAL_Y = .52;
const keys = new Set();
const screenShake = { age: 0, duration: 0, intensity: 0 };
const particleTexture = createSoftParticleTexture();
const bombGeometry = new THREE.IcosahedronGeometry(.42, 1); const bombMaterial = new THREE.MeshStandardMaterial({ color: '#202828', roughness: .3, metalness: .75 });
const sillyDebrisMaterials = ['#e84855', '#ff9f1c', '#ffe66d', '#2ec4b6', '#4876ff', '#8f4ad6', '#f06292'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: .72, flatShading: true }));
const rainbowDebrisMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .74, flatShading: true });
const propMaterials = {
  rainbow: ['#e84855', '#ff9f1c', '#ffe66d', '#2ec4b6', '#4876ff', '#8f4ad6'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: .7, metalness: 0 })),
  palmTrunk: new THREE.MeshStandardMaterial({ color: '#9b7143', roughness: .92, flatShading: true }),
  palmLeaf: new THREE.MeshStandardMaterial({ color: '#2f8f5b', roughness: .86, flatShading: true }),
  car: ['#e84a5f', '#2f80ed', '#f2994a', '#27ae60'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: .72, flatShading: true })),
  wheel: new THREE.MeshStandardMaterial({ color: '#1b1c1c', roughness: .8, flatShading: true }),
  camel: new THREE.MeshStandardMaterial({ color: '#b78646', roughness: .95, flatShading: true }),
  person: new THREE.MeshStandardMaterial({ color: '#f1d79c', roughness: .88, flatShading: true }),
  personCloth: ['#305cde', '#f06292', '#2fbf71', '#f2c94c'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: .82, flatShading: true })),
};
let sillyMode = false;
const soundButton = document.querySelector('#sound');
const soundState = {
  enabled: localStorage.getItem('sandcastle-sound') !== 'off',
  context: null,
  master: null,
  compressor: null,
  noiseBuffer: null,
  lastImpactAt: 0,
};

updateSoundButton();

function createSoftParticleTexture() {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 64;
  textureCanvas.height = 64;
  const context = textureCanvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.45, 'rgba(255,255,255,.72)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(textureCanvas);
}

function updateSoundButton() {
  soundButton.setAttribute('aria-pressed', String(soundState.enabled));
  soundButton.firstChild.textContent = soundState.enabled ? 'SOUND ON ' : 'SOUND OFF ';
  soundButton.querySelector('span').textContent = soundState.enabled ? '●' : '○';
}

function ensureAudio() {
  if (!soundState.enabled) return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!soundState.context) {
    const context = new AudioContext();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = .004;
    compressor.release.value = .22;
    const master = context.createGain();
    master.gain.value = .85;
    compressor.connect(master).connect(context.destination);
    soundState.context = context;
    soundState.compressor = compressor;
    soundState.master = master;
    soundState.noiseBuffer = createNoiseBuffer(context, 2.2);
  }
  soundState.master.gain.cancelScheduledValues(soundState.context.currentTime);
  soundState.master.gain.setTargetAtTime(.85, soundState.context.currentTime, .025);
  if (soundState.context.state === 'suspended') soundState.context.resume();
  return soundState.context;
}

function createNoiseBuffer(context, duration) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function envelopeParam(param, start, peak, end, duration, now, curve = 'linear') {
  param.cancelScheduledValues(now);
  param.setValueAtTime(start, now);
  if (curve === 'exponential') {
    param.exponentialRampToValueAtTime(Math.max(.0001, peak), now + duration * .12);
    param.exponentialRampToValueAtTime(Math.max(.0001, end), now + duration);
  } else {
    param.linearRampToValueAtTime(peak, now + duration * .08);
    param.linearRampToValueAtTime(end, now + duration);
  }
}

function soundDistanceGain(position, base = 1, reach = 62) {
  const soundPosition = new THREE.Vector3(position.x, position.y, position.z);
  const distance = camera.position.distanceTo(soundPosition);
  return base * THREE.MathUtils.clamp(1 - distance / reach, .18, 1);
}

function connectSpatialGain(context, position, volume) {
  const gain = context.createGain();
  gain.gain.value = volume;
  if (context.createStereoPanner) {
    const panner = context.createStereoPanner();
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const soundPosition = new THREE.Vector3(position.x, position.y, position.z);
    const pan = THREE.MathUtils.clamp(soundPosition.sub(camera.position).normalize().dot(cameraRight), -1, 1);
    panner.pan.value = pan * .72;
    gain.connect(panner).connect(soundState.compressor);
  } else {
    gain.connect(soundState.compressor);
  }
  return gain;
}

function playExplosionSound(position) {
  const context = ensureAudio();
  if (!context) return;
  const now = context.currentTime;
  const volume = soundDistanceGain(position, .95, 86);
  const boom = context.createOscillator();
  const boomGain = connectSpatialGain(context, position, volume);
  boom.type = 'sine';
  boom.frequency.setValueAtTime(86, now);
  boom.frequency.exponentialRampToValueAtTime(29, now + .92);
  envelopeParam(boomGain.gain, .0001, volume, .0001, 1.25, now, 'exponential');
  boom.connect(boomGain);
  boom.start(now);
  boom.stop(now + 1.35);

  const crack = context.createBufferSource();
  const crackFilter = context.createBiquadFilter();
  const crackGain = connectSpatialGain(context, position, volume * .72);
  crack.buffer = soundState.noiseBuffer;
  crackFilter.type = 'bandpass';
  crackFilter.frequency.setValueAtTime(1180, now);
  crackFilter.Q.value = .85;
  envelopeParam(crackGain.gain, .0001, volume * .72, .0001, .22, now, 'exponential');
  crack.connect(crackFilter).connect(crackGain);
  crack.start(now, Math.random() * .4, .24);

  const rumble = context.createBufferSource();
  const rumbleFilter = context.createBiquadFilter();
  const rumbleGain = connectSpatialGain(context, position, volume * .46);
  rumble.buffer = soundState.noiseBuffer;
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.setValueAtTime(165, now);
  rumbleFilter.frequency.exponentialRampToValueAtTime(52, now + 1.4);
  envelopeParam(rumbleGain.gain, .0001, volume * .46, .0001, 1.55, now, 'exponential');
  rumble.connect(rumbleFilter).connect(rumbleGain);
  rumble.start(now + .035, Math.random() * .6, 1.55);
}

function playImpactSound(item, speed, position, nowMs) {
  const context = ensureAudio();
  if (!context) return;
  if (nowMs - soundState.lastImpactAt < 42 || nowMs - (item.lastImpactAt ?? 0) < 170) return;
  const radius = item.mesh.userData.radius ?? .45;
  const strength = THREE.MathUtils.clamp((speed - 1.4) / 9, .12, 1);
  const volume = soundDistanceGain(position, (.08 + radius * .08) * strength, 48);
  const now = context.currentTime;
  const noise = context.createBufferSource();
  const noiseFilter = context.createBiquadFilter();
  const noiseGain = connectSpatialGain(context, position, volume);
  noise.buffer = soundState.noiseBuffer;
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = THREE.MathUtils.clamp(780 / Math.max(radius, .18), 160, 1450);
  noiseFilter.Q.value = .8 + strength * 1.3;
  envelopeParam(noiseGain.gain, .0001, volume, .0001, .105 + strength * .08, now, 'exponential');
  noise.connect(noiseFilter).connect(noiseGain);
  noise.start(now, Math.random() * .8, .18);

  const knock = context.createOscillator();
  const knockGain = connectSpatialGain(context, position, volume * .45);
  knock.type = 'triangle';
  knock.frequency.setValueAtTime(THREE.MathUtils.clamp(130 / Math.max(radius, .3), 48, 210), now);
  knock.frequency.exponentialRampToValueAtTime(36, now + .18);
  envelopeParam(knockGain.gain, .0001, volume * .45, .0001, .18, now, 'exponential');
  knock.connect(knockGain);
  knock.start(now);
  knock.stop(now + .2);
  soundState.lastImpactAt = nowMs;
  item.lastImpactAt = nowMs;
}

function throwBomb(clientX, clientY) {
  ensureAudio();
  pointer.set(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1); raycaster.setFromCamera(pointer, camera);
  const mesh = new THREE.Mesh(bombGeometry, bombMaterial); mesh.castShadow = true; mesh.position.copy(camera.position).add(raycaster.ray.direction.clone().multiplyScalar(1.6)); scene.add(mesh);
  const body = new CANNON.Body({ mass: 1.3, shape: new CANNON.Sphere(.42), linearDamping: .015 });
  body.position.copy(mesh.position); const velocity = raycaster.ray.direction.clone().multiplyScalar(34); velocity.y += 7;
  body.velocity.set(velocity.x, velocity.y, velocity.z); body.addEventListener('collide', () => { projectile.pendingExplosion = true; }); world.addBody(body);
  const projectile = { mesh, body, born: performance.now(), exploded: false, pendingExplosion: false }; projectiles.push(projectile);
}

function explode(projectile) {
  if (projectile.exploded) return; projectile.exploded = true;
  const center = new THREE.Vector3().copy(projectile.body.position); removePhysics(projectile);
  playExplosionSound(center);
  explodeDebris(center, 5.2);
  const removed = terrain.carveSphere(center, 4.2);
  for (const piece of allocateTerrainDebris(removed)) spawnDebris(piece.position, center, piece.cells, piece.color);
  spawnRockChips(center, removed);
  spawnExplosionParticles(center, removed);
  triggerScreenShake(.72, .42);
  explodeProps(center, 5.2);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.5, .72, 32), new THREE.MeshBasicMaterial({ color: '#fff0ad', transparent: true, side: THREE.DoubleSide }));
  ring.position.copy(center); ring.lookAt(camera.position); scene.add(ring); effects.push({ type: 'ring', mesh: ring, age: 0, lifetime: .42 });
}

function allocateTerrainDebris(removed) {
  if (!removed.length) return [];
  const reusableCells = Math.max(1, Math.floor(removed.length * .88));
  const availableSlots = Math.max(0, MAX_DEBRIS_BODIES - debris.length);
  const count = Math.min(availableSlots, MAX_MERGEABLE_DEBRIS_PER_BLAST, Math.max(14, Math.round(Math.sqrt(reusableCells) * 1.95)));
  const pieces = [];
  let remaining = reusableCells;
  for (let i = 0; i < count && remaining >= MIN_FRAGMENT_CELLS; i++) {
    const slots = count - i;
    const average = remaining / slots;
    const wobble = .55 + Math.random() * .95;
    const minRemaining = (slots - 1) * MIN_FRAGMENT_CELLS;
    const cells = i === count - 1 ? remaining : Math.max(MIN_FRAGMENT_CELLS, Math.min(remaining - minRemaining, Math.round(average * wobble)));
    const sample = removed[Math.floor(Math.random() * removed.length)];
    pieces.push({ position: sample.position, cells, color: terrainColor(sample.x, sample.z, sample.position.y, terrain.seed) });
    remaining -= cells;
  }
  return pieces;
}

function particleDirection(upLift = .8) {
  return new THREE.Vector3(
    (Math.random() - .5) * 1.8,
    Math.random() * upLift + .12,
    (Math.random() - .5) * 1.8,
  ).normalize();
}

function createParticleBurst(center, {
  count, color, size, lifetime, speed, gravity = 9, drag = .985, opacity = .9, spread = 1, upLift = .8, sizeGrowth = 1, fadePower = 2, renderOrder = 2,
}) {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const index = i * 3;
    const direction = particleDirection(upLift);
    const burstSpeed = speed[0] + Math.random() * (speed[1] - speed[0]);
    positions[index] = center.x + (Math.random() - .5) * spread;
    positions[index + 1] = center.y + Math.random() * spread * .6;
    positions[index + 2] = center.z + (Math.random() - .5) * spread;
    velocities[index] = direction.x * burstSpeed;
    velocities[index + 1] = direction.y * burstSpeed;
    velocities[index + 2] = direction.z * burstSpeed;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.PointsMaterial({
    color,
    map: particleTexture,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    alphaTest: .02,
    depthWrite: false,
  });
  const mesh = new THREE.Points(geometry, material);
  mesh.renderOrder = renderOrder;
  scene.add(mesh);
  effects.push({ type: 'particles', mesh, age: 0, lifetime, velocities, gravity, drag, startOpacity: opacity, startSize: size, endSize: size * sizeGrowth, fadePower });
}

function spawnExplosionParticles(center, removed) {
  spawnSandSpray(center, removed);
  spawnSmokePuffs(center);
}

function spawnSandSpray(center, removed) {
  const sample = removed[Math.floor(Math.random() * removed.length)];
  const sandColor = sample ? terrainColor(sample.x, sample.z, sample.position.y, terrain.seed) : new THREE.Color('#bda96d');
  sandColor.lerp(new THREE.Color('#ffe08a'), .52);
  createParticleBurst(center, {
    count: 310,
    color: sandColor,
    size: 1.05,
    lifetime: 2.2,
    speed: [12, 28],
    gravity: 14,
    drag: .983,
    opacity: .95,
    spread: 1.15,
    upLift: .95,
    sizeGrowth: .72,
    fadePower: 1.1,
    renderOrder: 5,
  });
}

function spawnSmokePuffs(center) {
  const smokeCenter = center.clone();
  smokeCenter.y += .75;
  createParticleBurst(smokeCenter, {
    count: 28,
    color: '#565d59',
    size: 3.35,
    lifetime: 2.85,
    speed: [2.2, 7.6],
    gravity: -2.5,
    drag: .94,
    opacity: .36,
    spread: 3.2,
    upLift: 2.15,
    sizeGrowth: 5.1,
    renderOrder: 2,
  });
}

function triggerScreenShake(intensity, duration) {
  screenShake.age = 0;
  screenShake.duration = Math.max(screenShake.duration, duration);
  screenShake.intensity = Math.max(screenShake.intensity, intensity);
}

function createDebrisGeometry(radius) {
  const geometry = new THREE.IcosahedronGeometry(radius, 1);
  const vertices = geometry.attributes.position;
  const offsets = new Map();
  for (let i = 0; i < vertices.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(vertices, i);
    const id = `${vertex.x.toFixed(3)},${vertex.y.toFixed(3)},${vertex.z.toFixed(3)}`;
    if (!offsets.has(id)) offsets.set(id, .78 + Math.random() * .38);
    vertex.multiplyScalar(offsets.get(id));
    vertices.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  geometry.scale(.85 + Math.random() * .35, .62 + Math.random() * .38, .85 + Math.random() * .35);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometry.computeBoundingBox();
  return geometry;
}

function createRainbowDebrisGeometry(radius) {
  const geometry = new THREE.TorusGeometry(radius * .78, Math.max(.05, radius * .09), 6, 28, Math.PI);
  geometry.rotateZ(Math.PI);
  geometry.scale(1, .7, .45);
  const colors = ['#e84855', '#ff9f1c', '#ffe66d', '#2ec4b6', '#4876ff', '#8f4ad6'].map((color) => new THREE.Color(color));
  const position = geometry.attributes.position;
  const colorValues = [];
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const band = THREE.MathUtils.clamp(Math.floor((y / Math.max(radius, .001) + .55) * colors.length), 0, colors.length - 1);
    colorValues.push(colors[band].r, colors[band].g, colors[band].b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorValues, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometry.computeBoundingBox();
  return geometry;
}

function createSillyDebrisGeometry(radius) {
  const type = Math.floor(Math.random() * 5);
  let geometry;
  if (type === 0) geometry = createRainbowDebrisGeometry(radius);
  else if (type === 1) geometry = new THREE.ConeGeometry(radius * .58, radius * 1.55, 7);
  else if (type === 2) geometry = new THREE.BoxGeometry(radius * 1.45, radius * .72, radius * 1.05);
  else if (type === 3) geometry = new THREE.TorusGeometry(radius * .55, radius * .14, 6, 16);
  else geometry = new THREE.CapsuleGeometry(radius * .32, radius * .85, 3, 7);
  if (type !== 0) {
    geometry.rotateX(Math.random() * Math.PI);
    geometry.rotateY(Math.random() * Math.PI);
    geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometry.computeBoundingBox();
  }
  return { geometry, material: type === 0 ? rainbowDebrisMaterial : sillyDebrisMaterials[Math.floor(Math.random() * sillyDebrisMaterials.length)] };
}

function radiusForCells(cells) {
  return CELL_SIZE * Math.cbrt((3 * Math.max(1, cells)) / (4 * Math.PI)) * .95;
}

function spawnDebris(position, center, voxelCells = 1, color = null) {
  if (debris.length >= MAX_DEBRIS_BODIES) return;
  const radius = radiusForCells(voxelCells) * (.68 + Math.random() * .18);
  const visual = sillyMode
    ? createSillyDebrisGeometry(radius)
    : { geometry: createDebrisGeometry(radius), material: new THREE.MeshStandardMaterial({ color: color ?? '#c5b777', roughness: .96, flatShading: true }), disposableMaterial: true };
  const geometry = visual.geometry;
  const bottomOffset = Math.max(.12, -(geometry.boundingBox?.min.y ?? -radius));
  const collisionRadius = Math.max(radius * .62, geometry.boundingSphere?.radius ?? radius);
  const mesh = new THREE.Mesh(geometry, visual.material); mesh.position.copy(position); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.radius = collisionRadius; mesh.userData.bottomOffset = bottomOffset; mesh.userData.disposableMaterial = visual.disposableMaterial; scene.add(mesh);
  const body = new CANNON.Body({ mass: Math.max(.7, voxelCells * .18), shape: new CANNON.Sphere(collisionRadius), linearDamping: .12, angularDamping: .52, allowSleep: true, sleepSpeedLimit: .45, sleepTimeLimit: .55 });
  body.position.copy(position); const out = position.clone().sub(center).normalize().add(new THREE.Vector3((Math.random()-.5)*.5, .55 + Math.random()*.55, (Math.random()-.5)*.5)).normalize();
  const impulse = 7 + Math.random() * 8;
  body.velocity.set(out.x * impulse, out.y * impulse, out.z * impulse);
  body.angularVelocity.set(Math.random()*7, Math.random()*7, Math.random()*7); world.addBody(body); debris.push({ mesh, body, stillSince: null, mergeToTerrain: true, voxelCells, lastImpactAt: 0, rollingResistance: BOULDER_ROLLING_RESISTANCE });
}

function spawnRockChips(center, removed) {
  if (sillyMode || !removed.length) return;
  const visualChipCount = debris.reduce((total, item) => total + (item.mergeToTerrain ? 0 : 1), 0);
  const availableSlots = Math.max(0, Math.min(MAX_VISUAL_CHIPS - visualChipCount, MAX_DEBRIS_BODIES - debris.length));
  const count = Math.min(availableSlots, Math.max(8, Math.round(Math.sqrt(removed.length) * 1.35)));
  for (let i = 0; i < count; i++) {
    const sample = removed[Math.floor(Math.random() * removed.length)];
    const radius = .13 + Math.random() * .23;
    const geometry = createDebrisGeometry(radius);
    const material = new THREE.MeshStandardMaterial({
      color: terrainColor(sample.x, sample.z, sample.position.y, terrain.seed),
      roughness: .96,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(sample.position).add(new THREE.Vector3((Math.random() - .5) * .8, Math.random() * .5, (Math.random() - .5) * .8));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.radius = radius;
    mesh.userData.bottomOffset = Math.max(.08, -(geometry.boundingBox?.min.y ?? -radius));
    mesh.userData.disposableMaterial = true;
    scene.add(mesh);
    const body = new CANNON.Body({ mass: .16 + radius * .7, shape: new CANNON.Sphere(radius), linearDamping: .1, angularDamping: .1, allowSleep: true, sleepSpeedLimit: .2, sleepTimeLimit: .7 });
    body.position.copy(mesh.position);
    const out = mesh.position.clone().sub(center).normalize().add(new THREE.Vector3((Math.random() - .5) * .7, .75 + Math.random() * .75, (Math.random() - .5) * .7)).normalize();
    body.velocity.set(out.x * (8 + Math.random() * 12), out.y * (7 + Math.random() * 11), out.z * (8 + Math.random() * 12));
    body.angularVelocity.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    world.addBody(body);
    debris.push({ mesh, body, stillSince: null, mergeToTerrain: false, lastImpactAt: 0, rollingResistance: CHIP_ROLLING_RESISTANCE });
  }
}

function explodeDebris(center, radius) {
  const targets = [];
  for (let i = debris.length - 1; i >= 0; i--) {
    const item = debris[i];
    const itemRadius = item.mesh.userData.radius ?? item.mesh.geometry.boundingSphere?.radius ?? .4;
    const distance = item.body.position.distanceTo(center);
    if (distance <= radius + itemRadius) targets.push({ item, index: i, distance, itemRadius });
  }

  for (const { item, index, distance, itemRadius } of targets) {
    if (debris[index] !== item) continue;
    const position = new THREE.Vector3().copy(item.body.position);
    const color = item.mesh.material?.color?.clone?.() ?? terrainColor(terrain.worldToGrid(position.x), terrain.worldToGrid(position.z), position.y, terrain.seed);
    const voxelCells = Math.max(1, Math.round(item.voxelCells ?? 0));
    removePhysics(item);
    disposeDebrisMesh(item);
    debris.splice(index, 1);

    if (!item.mergeToTerrain || voxelCells < MIN_FRAGMENT_CELLS * 2) {
      spawnBlastChips(position, center, color, Math.max(2, Math.min(5, Math.round(itemRadius * 3.5))));
      continue;
    }

    const blastStrength = THREE.MathUtils.clamp(1 - distance / Math.max(radius, 0.001), .25, 1);
    const availableSlots = Math.max(0, MAX_DEBRIS_BODIES - debris.length);
    const pieceCount = Math.min(availableSlots, Math.floor(voxelCells / MIN_FRAGMENT_CELLS), Math.max(2, Math.min(8, Math.round(Math.sqrt(voxelCells) * (.95 + blastStrength * .55)))));
    if (pieceCount <= 0) continue;
    let remaining = voxelCells;
    for (let i = 0; i < pieceCount && remaining >= MIN_FRAGMENT_CELLS; i++) {
      const slots = pieceCount - i;
      const average = remaining / slots;
      const minRemaining = (slots - 1) * MIN_FRAGMENT_CELLS;
      const cells = i === pieceCount - 1 ? remaining : Math.max(MIN_FRAGMENT_CELLS, Math.min(remaining - minRemaining, Math.round(average * (.7 + Math.random() * .55))));
      const offset = particleDirection(1).multiplyScalar(itemRadius * (.25 + Math.random() * .55));
      spawnDebris(position.clone().add(offset), center, cells, color);
      remaining -= cells;
    }
  }
}

function spawnBlastChips(position, center, color, count = 4) {
  if (sillyMode) return;
  const visualChipCount = debris.reduce((total, item) => total + (item.mergeToTerrain ? 0 : 1), 0);
  count = Math.min(count, Math.max(0, MAX_VISUAL_CHIPS - visualChipCount), Math.max(0, MAX_DEBRIS_BODIES - debris.length));
  for (let i = 0; i < count; i++) {
    const radius = .14 + Math.random() * .18;
    const geometry = createDebrisGeometry(radius);
    const material = new THREE.MeshStandardMaterial({ color, roughness: .96, flatShading: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position).add(new THREE.Vector3((Math.random() - .5) * .7, Math.random() * .5, (Math.random() - .5) * .7));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.radius = radius;
    mesh.userData.bottomOffset = Math.max(.08, -(geometry.boundingBox?.min.y ?? -radius));
    mesh.userData.disposableMaterial = true;
    scene.add(mesh);
    const body = new CANNON.Body({ mass: .12 + radius * .55, shape: new CANNON.Sphere(radius), linearDamping: .14, angularDamping: .22, allowSleep: true, sleepSpeedLimit: .24, sleepTimeLimit: .8 });
    body.position.copy(mesh.position);
    const out = mesh.position.clone().sub(center).normalize().add(new THREE.Vector3((Math.random() - .5) * .7, .6 + Math.random() * .75, (Math.random() - .5) * .7)).normalize();
    body.velocity.set(out.x * (7 + Math.random() * 9), out.y * (6 + Math.random() * 9), out.z * (7 + Math.random() * 9));
    body.angularVelocity.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
    world.addBody(body);
    debris.push({ mesh, body, stillSince: null, mergeToTerrain: false, lastImpactAt: 0, rollingResistance: CHIP_ROLLING_RESISTANCE });
  }
}

function removePhysics(item) { scene.remove(item.mesh); world.removeBody(item.body); }
function disposeDebrisMesh(item) {
  item.mesh.geometry.dispose();
  if (item.mesh.userData.disposableMaterial) item.mesh.material.dispose();
}
function mergeDebrisIntoTerrain(item) {
  item.mesh.position.copy(item.body.position);
  item.mesh.quaternion.copy(item.body.quaternion);
  const radius = item.mesh.userData.radius ?? CELL_SIZE;
  const changed = terrain.addMeshShape(item.mesh, Math.max(CELL_SIZE * .8, radius), item.voxelCells ?? 1);
  removePhysics(item);
  disposeDebrisMesh(item);
  return changed;
}

function applyTerrainContact(item, collision, now) {
  const normal = collision.normal;
  item.body.position.x += normal.x * collision.penetration;
  item.body.position.y += normal.y * collision.penetration;
  item.body.position.z += normal.z * collision.penetration;

  const normalSpeed = item.body.velocity.x * normal.x + item.body.velocity.y * normal.y + item.body.velocity.z * normal.z;
  if (normalSpeed < 0) {
    const impactSpeed = -normalSpeed + Math.hypot(item.body.velocity.x, item.body.velocity.z) * .18;
    if (impactSpeed > 1.7) playImpactSound(item, impactSpeed, item.body.position, now);
    item.body.velocity.x -= normal.x * normalSpeed * 1.18;
    item.body.velocity.y -= normal.y * normalSpeed * 1.18;
    item.body.velocity.z -= normal.z * normalSpeed * 1.18;
  }

  const grounded = normal.y > .45;
  const roughness = item.rollingResistance ?? (item.mergeToTerrain ? BOULDER_ROLLING_RESISTANCE : CHIP_ROLLING_RESISTANCE);
  const normalVelocity = item.body.velocity.x * normal.x + item.body.velocity.y * normal.y + item.body.velocity.z * normal.z;
  const tangentX = item.body.velocity.x - normal.x * normalVelocity;
  const tangentY = item.body.velocity.y - normal.y * normalVelocity;
  const tangentZ = item.body.velocity.z - normal.z * normalVelocity;
  const tangentDamping = grounded ? THREE.MathUtils.lerp(.82, .38, roughness) : .86;
  item.body.velocity.x = normal.x * normalVelocity + tangentX * tangentDamping;
  item.body.velocity.y = normal.y * normalVelocity + tangentY * tangentDamping;
  item.body.velocity.z = normal.z * normalVelocity + tangentZ * tangentDamping;

  if (grounded && Math.abs(normalVelocity) < .35) {
    item.body.velocity.x -= normal.x * normalVelocity;
    item.body.velocity.y -= normal.y * normalVelocity;
    item.body.velocity.z -= normal.z * normalVelocity;
  }

  const postNormalVelocity = item.body.velocity.x * normal.x + item.body.velocity.y * normal.y + item.body.velocity.z * normal.z;
  const postTangentX = item.body.velocity.x - normal.x * postNormalVelocity;
  const postTangentY = item.body.velocity.y - normal.y * postNormalVelocity;
  const postTangentZ = item.body.velocity.z - normal.z * postNormalVelocity;
  const postTangentSpeedSq = postTangentX * postTangentX + postTangentY * postTangentY + postTangentZ * postTangentZ;
  if (
    grounded
    && item.mergeToTerrain
    && normal.y > BOULDER_STATIC_FRICTION_MIN_NORMAL_Y
    && postTangentSpeedSq < BOULDER_STATIC_FRICTION_SPEED * BOULDER_STATIC_FRICTION_SPEED
  ) {
    item.body.velocity.x -= postTangentX;
    item.body.velocity.y -= postTangentY;
    item.body.velocity.z -= postTangentZ;
  }

  const spinDamping = grounded ? THREE.MathUtils.lerp(.82, .34, roughness) : .78;
  item.body.angularVelocity.scale(spinDamping, item.body.angularVelocity);
  const spinSq = item.body.angularVelocity.lengthSquared();
  if (grounded && item.mergeToTerrain && postTangentSpeedSq < .16 && spinSq > .025) {
    item.body.angularVelocity.scale(.18, item.body.angularVelocity);
  }
  if (grounded && item.body.velocity.lengthSquared() < .025 && item.body.angularVelocity.lengthSquared() < .025) {
    item.body.velocity.set(0, 0, 0);
    item.body.angularVelocity.set(0, 0, 0);
  }
}

function addPart(group, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createProp(type, x, z, rotation = 0, variant = 0) {
  const group = new THREE.Group();
  group.position.set(x, terrain.surfaceY(x, z), z);
  group.rotation.y = rotation;
  let halfExtents = new CANNON.Vec3(1.2, 1.2, 1.2);
  let bodyOffsetY = halfExtents.y;
  let blastRadius = 2;
  if (type === 'rainbow') {
    const colors = propMaterials.rainbow;
    for (let i = 0; i < colors.length; i++) {
      addPart(group, new THREE.TorusGeometry(2.15 - i * .22, .09, 6, 28, Math.PI), colors[i], [0, .16, 0], [1, 1, .55], [0, 0, 0]);
    }
    halfExtents = new CANNON.Vec3(2.4, 1.7, .45); bodyOffsetY = 1.35; blastRadius = 3.1;
  } else if (type === 'palm') {
    addPart(group, new THREE.CylinderGeometry(.18, .28, 3.2, 7), propMaterials.palmTrunk, [0, 1.55, 0], [1, 1, 1], [0, 0, .16]);
    for (let i = 0; i < 6; i++) {
      addPart(group, new THREE.ConeGeometry(.28, 2.4, 5), propMaterials.palmLeaf, [0, 3.18, 0], [1, .22, 1], [Math.PI / 2, i * Math.PI / 3, .15]);
    }
    halfExtents = new CANNON.Vec3(.7, 1.9, .7); bodyOffsetY = 1.8; blastRadius = 2.5;
  } else if (type === 'car') {
    const material = propMaterials.car[variant % propMaterials.car.length];
    addPart(group, new THREE.BoxGeometry(2.2, .55, 1.1), material, [0, .48, 0]);
    addPart(group, new THREE.BoxGeometry(1.05, .55, .88), material, [.1, .94, 0]);
    for (const wheel of [[-.72, .25, -.62], [.72, .25, -.62], [-.72, .25, .62], [.72, .25, .62]]) {
      addPart(group, new THREE.CylinderGeometry(.22, .22, .18, 8), propMaterials.wheel, wheel, [1, 1, 1], [Math.PI / 2, 0, 0]);
    }
    halfExtents = new CANNON.Vec3(1.25, .65, .7); bodyOffsetY = .65; blastRadius = 2.2;
  } else if (type === 'camel') {
    addPart(group, new THREE.SphereGeometry(.62, 9, 6), propMaterials.camel, [0, 1.05, 0], [1.55, .7, .58]);
    addPart(group, new THREE.SphereGeometry(.38, 8, 5), propMaterials.camel, [-.28, 1.58, 0], [.8, .95, .7]);
    addPart(group, new THREE.SphereGeometry(.34, 8, 5), propMaterials.camel, [.42, 1.54, 0], [.78, .9, .7]);
    addPart(group, new THREE.CylinderGeometry(.12, .16, .95, 6), propMaterials.camel, [1.04, 1.48, 0], [1, 1, 1], [0, 0, -.48]);
    addPart(group, new THREE.SphereGeometry(.27, 8, 5), propMaterials.camel, [1.38, 1.84, 0], [1.15, .78, .72]);
    for (const leg of [[-.78, .45, -.3], [-.25, .45, -.3], [.38, .45, -.3], [.78, .45, -.3], [-.78, .45, .3], [-.25, .45, .3], [.38, .45, .3], [.78, .45, .3]]) {
      addPart(group, new THREE.CylinderGeometry(.08, .1, .9, 5), propMaterials.camel, leg);
    }
    halfExtents = new CANNON.Vec3(1.45, 1.05, .65); bodyOffsetY = .95; blastRadius = 2.2;
  } else {
    const cloth = propMaterials.personCloth[variant % propMaterials.personCloth.length];
    addPart(group, new THREE.SphereGeometry(.18, 8, 6), propMaterials.person, [0, 1.38, 0]);
    addPart(group, new THREE.BoxGeometry(.34, .62, .2), cloth, [0, .91, 0]);
    addPart(group, new THREE.CylinderGeometry(.045, .055, .55, 5), propMaterials.person, [-.1, .33, 0]);
    addPart(group, new THREE.CylinderGeometry(.045, .055, .55, 5), propMaterials.person, [.1, .33, 0]);
    addPart(group, new THREE.CylinderGeometry(.04, .045, .46, 5), propMaterials.person, [-.28, .95, 0], [1, 1, 1], [0, 0, -.35]);
    addPart(group, new THREE.CylinderGeometry(.04, .045, .46, 5), propMaterials.person, [.28, .95, 0], [1, 1, 1], [0, 0, .35]);
    halfExtents = new CANNON.Vec3(.35, .8, .3); bodyOffsetY = .78; blastRadius = 1.2;
  }
  scene.add(group);
  const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(halfExtents) });
  body.position.set(x, group.position.y + bodyOffsetY, z);
  body.quaternion.setFromEuler(0, rotation, 0);
  world.addBody(body);
  props.push({ type, group, body, blastRadius });
}

function populateProps() {
  const placements = [
    ['rainbow', -15, -18, .15], ['rainbow', 16, 14, -.4], ['rainbow', -24, 15, .75],
    ['palm', -21, -9, .2], ['palm', -17, -5, -.5], ['palm', 23, -13, .3], ['palm', 26, -10, -.2], ['palm', 10, 24, .6], ['palm', -7, 21, -.4],
    ['car', -5, -18, .35], ['car', 20, -2, -1.1], ['car', 4, 18, .7], ['car', -24, 4, 1.3],
    ['camel', -11, 7, .2], ['camel', 8, -10, -.6], ['camel', 18, 9, .9], ['camel', -25, -19, .3], ['camel', 0, 26, -1.2],
    ['person', -2, -7, 0], ['person', 2, -8, .3], ['person', 6, -5, -.4], ['person', 13, 4, .8], ['person', -14, 10, -.7], ['person', 22, 17, .2],
    ['person', -23, -3, 1.2], ['person', 25, -20, -.5],
  ];
  placements.forEach(([type, x, z, rotation], index) => createProp(type, x, z, rotation, index));
}

function spawnPropShard(position, center, material, scale = 1) {
  const radius = (.18 + Math.random() * .28) * scale;
  const geometry = createDebrisGeometry(radius);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.radius = radius;
  mesh.userData.bottomOffset = Math.max(.08, -(geometry.boundingBox?.min.y ?? -radius));
  scene.add(mesh);
  const body = new CANNON.Body({ mass: radius * 1.2, shape: new CANNON.Sphere(radius), linearDamping: .12, angularDamping: .16, allowSleep: true, sleepSpeedLimit: .2, sleepTimeLimit: 1 });
  body.position.copy(position);
  const out = position.clone().sub(center).normalize().add(new THREE.Vector3((Math.random()-.5)*.6, .6 + Math.random()*.6, (Math.random()-.5)*.6)).normalize();
  body.velocity.set(out.x * (5 + Math.random()*7), out.y * (5 + Math.random()*8), out.z * (5 + Math.random()*7));
  body.angularVelocity.set(Math.random()*8, Math.random()*8, Math.random()*8);
  world.addBody(body);
  debris.push({ mesh, body, stillSince: null, mergeToTerrain: false, lastImpactAt: 0, rollingResistance: CHIP_ROLLING_RESISTANCE });
}

function explodeProp(prop, center) {
  const shardSources = [];
  prop.group.traverse((child) => { if (child.isMesh) shardSources.push(child); });
  for (let i = 0; i < Math.min(12, shardSources.length * 2); i++) {
    const source = shardSources[i % shardSources.length];
    const position = new THREE.Vector3();
    source.getWorldPosition(position);
    position.add(new THREE.Vector3((Math.random() - .5) * .9, Math.random() * .7, (Math.random() - .5) * .9));
    const material = Array.isArray(source.material) ? source.material[0] : source.material;
    spawnPropShard(position, center, material, prop.type === 'rainbow' || prop.type === 'palm' ? .85 : 1);
  }
  scene.remove(prop.group);
  prop.group.traverse((child) => { if (child.isMesh) child.geometry.dispose(); });
  world.removeBody(prop.body);
}

function explodeProps(center, radius) {
  for (let i = props.length - 1; i >= 0; i--) {
    const prop = props[i];
    const distance = prop.group.position.distanceTo(center);
    if (distance <= radius + prop.blastRadius) {
      explodeProp(prop, center);
      props.splice(i, 1);
    }
  }
}

function updatePhysics(delta, now) {
  world.step(1 / 60, delta, 3);
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const item = projectiles[i]; if (item.exploded) { projectiles.splice(i, 1); continue; }
    item.mesh.position.copy(item.body.position); item.mesh.quaternion.copy(item.body.quaternion);
    // Voxel terrain collision is sampled locally; Cannon handles debris/floor dynamics.
    const gx = terrain.worldToGrid(item.body.position.x), gy = terrain.worldToGrid(item.body.position.y), gz = terrain.worldToGrid(item.body.position.z);
    if (item.pendingExplosion || terrain.has(gx, gy, gz) || terrain.sphereCollision(item.body.position, .42) || now - item.born > 6500) explode(item);
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const item = debris[i]; item.mesh.position.copy(item.body.position); item.mesh.quaternion.copy(item.body.quaternion);
    const radius = item.mesh.userData.radius ?? item.mesh.geometry.boundingSphere?.radius ?? .5;
    const collision = terrain.sphereCollision(item.body.position, radius);
    if (collision) applyTerrainContact(item, collision, now);
    item.mesh.position.copy(item.body.position); item.mesh.quaternion.copy(item.body.quaternion);
    const grounded = !!collision && collision.normal.y > .45;
    if (!grounded && item.body.sleepState === CANNON.Body.SLEEPING) item.body.wakeUp();
    const slow = grounded && item.body.velocity.lengthSquared() < .15 && item.body.angularVelocity.lengthSquared() < .3;
    if (slow) item.stillSince ??= now; else item.stillSince = null;
    if (item.body.position.y < -4) item.stillSince = now - 6000;
    if (item.stillSince && now - item.stillSince > 5000) {
      if (item.mergeToTerrain && item.body.position.y >= 0 && grounded) {
        mergeDebrisIntoTerrain(item); debris.splice(i, 1);
      } else if (!item.mergeToTerrain && (grounded || now - item.stillSince > 7500)) {
        removePhysics(item); disposeDebrisMesh(item); debris.splice(i, 1);
      } else if (item.body.position.y < -4 || now - item.stillSince > 12000) {
        removePhysics(item); disposeDebrisMesh(item); debris.splice(i, 1);
      } else {
        item.stillSince = now - 4200;
      }
    }
  }
}

function rotateAroundTarget(yaw, pitch) {
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta += yaw;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi + pitch, .12, controls.maxPolarAngle);
  offset.setFromSpherical(spherical);
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
}

function updateKeyboard(delta) {
  const move = 16 * delta;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const pan = new THREE.Vector3();
  if (keys.has('KeyW')) pan.add(forward);
  if (keys.has('KeyS')) pan.sub(forward);
  if (keys.has('KeyA')) pan.sub(right);
  if (keys.has('KeyD')) pan.add(right);
  if (pan.lengthSq() > 0) {
    pan.normalize().multiplyScalar(move);
    camera.position.add(pan); controls.target.add(pan);
  }
  if (keys.has('ArrowLeft')) rotateAroundTarget(-1.7 * delta, 0);
  if (keys.has('ArrowRight')) rotateAroundTarget(1.7 * delta, 0);
  if (keys.has('ArrowUp')) rotateAroundTarget(0, -1.2 * delta);
  if (keys.has('ArrowDown')) rotateAroundTarget(0, 1.2 * delta);
  if (keys.has('KeyQ') || keys.has('Minus')) camera.position.lerp(controls.target, -1.5 * delta);
  if (keys.has('KeyE') || keys.has('Equal')) camera.position.lerp(controls.target, 1.5 * delta);
}

function disposeEffect(effect) {
  scene.remove(effect.mesh);
  effect.mesh.geometry.dispose();
  effect.mesh.material.dispose();
}

function updateEffects(delta) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    effect.age += delta;
    const progress = THREE.MathUtils.clamp(effect.age / effect.lifetime, 0, 1);
    if (effect.type === 'ring') {
      effect.mesh.scale.setScalar(1 + progress * 5.8);
      effect.mesh.material.opacity = 1 - progress;
      effect.mesh.lookAt(camera.position);
    } else if (effect.type === 'particles') {
      const positions = effect.mesh.geometry.attributes.position;
      const damping = Math.pow(effect.drag, delta * 60);
      for (let p = 0; p < positions.count; p++) {
        const index = p * 3;
        effect.velocities[index] *= damping;
        effect.velocities[index + 1] = (effect.velocities[index + 1] - effect.gravity * delta) * damping;
        effect.velocities[index + 2] *= damping;
        positions.array[index] += effect.velocities[index] * delta;
        positions.array[index + 1] += effect.velocities[index + 1] * delta;
        positions.array[index + 2] += effect.velocities[index + 2] * delta;
      }
      positions.needsUpdate = true;
      effect.mesh.material.opacity = effect.startOpacity * ((1 - progress) ** effect.fadePower);
      effect.mesh.material.size = THREE.MathUtils.lerp(effect.startSize, effect.endSize, progress);
    }
    if (progress >= 1) {
      disposeEffect(effect);
      effects.splice(i, 1);
    }
  }
}

function renderScene(delta) {
  if (screenShake.age >= screenShake.duration) {
    renderer.render(scene, camera);
    return;
  }
  screenShake.age += delta;
  const falloff = (1 - THREE.MathUtils.clamp(screenShake.age / screenShake.duration, 0, 1)) ** 2;
  const amount = screenShake.intensity * falloff;
  const basePosition = camera.position.clone();
  const baseQuaternion = camera.quaternion.clone();
  camera.position.add(new THREE.Vector3(
    (Math.random() - .5) * amount,
    (Math.random() - .5) * amount * .55,
    (Math.random() - .5) * amount,
  ));
  camera.rotateZ((Math.random() - .5) * amount * .008);
  renderer.render(scene, camera);
  camera.position.copy(basePosition);
  camera.quaternion.copy(baseQuaternion);
}

function throwCenterBomb() {
  throwBomb(innerWidth / 2, innerHeight / 2);
}

let down = null;
canvas.addEventListener('pointerdown', (event) => { if (event.button === 0) down = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener('pointerup', (event) => { if (down && Math.hypot(event.clientX-down.x, event.clientY-down.y) < 7) throwBomb(event.clientX, event.clientY); down = null; });
addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) throwCenterBomb();
    return;
  }
  keys.add(event.code);
});
addEventListener('keyup', (event) => keys.delete(event.code));
document.querySelector('#silly').addEventListener('click', (event) => {
  sillyMode = !sillyMode;
  event.currentTarget.setAttribute('aria-pressed', String(sillyMode));
  event.currentTarget.querySelector('span').textContent = sillyMode ? '●' : '○';
});
soundButton.addEventListener('click', () => {
  soundState.enabled = !soundState.enabled;
  localStorage.setItem('sandcastle-sound', soundState.enabled ? 'on' : 'off');
  updateSoundButton();
  if (soundState.enabled) ensureAudio();
  else if (soundState.master) soundState.master.gain.setTargetAtTime(0, soundState.context.currentTime, .035);
});
document.querySelector('#reset').addEventListener('click', () => {
  projectiles.forEach(removePhysics);
  debris.forEach((item) => { removePhysics(item); disposeDebrisMesh(item); });
  effects.forEach(disposeEffect);
  for (const prop of props) {
    scene.remove(prop.group);
    prop.group.traverse((child) => { if (child.isMesh) child.geometry.dispose(); });
    world.removeBody(prop.body);
  }
  projectiles.length = debris.length = props.length = effects.length = 0; screenShake.age = screenShake.duration; seed = Math.random() * 100; terrain.seed = seed; terrain.generate(); populateProps();
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

let previous = performance.now();
function animate(now) {
  requestAnimationFrame(animate); const delta = Math.min((now - previous) / 1000, .05); previous = now; updatePhysics(delta, now); updateKeyboard(delta); controls.update();
  updateEffects(delta);
  document.querySelector('#chunks').textContent = terrain.chunks.size; document.querySelector('#debris').textContent = debris.length;
  renderScene(delta);
}
requestAnimationFrame(animate);
populateProps();
setTimeout(() => document.querySelector('#loading').classList.add('hidden'), 400);
