import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CELL_SIZE, terrainColor } from './terrain.js';
import { createBuggyFeature, createTerrainFeature, readWorldFeatures } from './worldFeatures.js';
import { ChunkRegistry } from './chunkRegistry.js';
import { CameraCuller } from './cameraCulling.js';
import { PerformanceMonitor } from './performance.js';
import { ECSWorld } from './ecs/world.js';
import { COMPONENTS, createPhysicsComponent, createVisualComponent } from './ecs/components.js';
import { createDefaultPluginRegistry } from './plugins/defaults.js';

export function createSandcastleEngine({ plugins = createDefaultPluginRegistry() } = {}) {
const ecs = new ECSWorld();

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15; renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene(); scene.background = new THREE.Color('#b8d8dc'); scene.fog = new THREE.Fog('#b8d8dc', 80, 280);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 2_000); camera.position.set(34, 34, 46);
const controls = new OrbitControls(camera, canvas); controls.target.set(0, 12, 0); controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * .48; controls.minDistance = 11; controls.maxDistance = 150;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

scene.add(new THREE.HemisphereLight('#eafcff', '#73583c', 2.4));
const sun = new THREE.DirectionalLight('#fff5d2', 3.5); sun.position.set(-24, 38, 20); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = sun.shadow.camera.bottom = -55;
sun.shadow.camera.right = sun.shadow.camera.top = 55;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.00012;
sun.shadow.normalBias = 0.045;
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);
const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: 0 });
const urlParams = new URLSearchParams(location.search);
const features = readWorldFeatures(urlParams);
let seed = Math.random() * 100;
let terrain = createTerrainFeature({
  enabled: features.terrain,
  plugin: features.terrainPlugin,
  registry: plugins,
  scene,
  material: terrainMaterial,
  seed,
  trackEnabled: features.track,
});

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) }); world.allowSleep = true;
world.defaultContactMaterial.friction = .78; world.defaultContactMaterial.restitution = .1;
const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() }); floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(floorBody);
const simulationChunks = new ChunkRegistry({ world, chunkSize: CELL_SIZE * 10, activeRadius: 2, releaseRadius: 3 });
const cameraCuller = new CameraCuller({ maxDistance: 573.75, shadowDistance: 68 });
const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const projectiles = []; const debris = []; const props = []; const buildings = []; const buildingParts = []; const pendingBuildingImpacts = []; const effects = [];
const performanceMonitor = new PerformanceMonitor();
const chunksElement = document.querySelector('#chunks');
const debrisElement = document.querySelector('#debris');
const frameTimeElement = document.querySelector('#frame-time');
const physicsTimeElement = document.querySelector('#physics-time');
const physicsBodiesElement = document.querySelector('#physics-bodies');
const drawCallsElement = document.querySelector('#draw-calls');
const trianglesElement = document.querySelector('#triangles');

function registerSimulationItem(item, { visual = item.mesh, alwaysActive = false } = {}) {
  const entity = item.entity ?? ecs.create(item.body?.userData?.kind ?? 'simulation-object');
  if (!entity.has(COMPONENTS.physics)) entity.add(COMPONENTS.physics, createPhysicsComponent(item.body));
  if (visual && !entity.has(COMPONENTS.visual)) entity.add(COMPONENTS.visual, createVisualComponent(visual));
  item.simulation = simulationChunks.register({
    body: item.body,
    visual,
    alwaysActive,
    onActivate: () => { item.simulationActive = true; },
    onDeactivate: () => { item.simulationActive = false; },
  });
  entity.add(COMPONENTS.simulation, item.simulation);
  item.entity = entity;
  item.simulationActive = true;
  return item;
}

function unregisterSimulationItem(item) {
  if (!item?.simulation) return;
  simulationChunks.unregister(item.simulation);
  if (item.entity) ecs.remove(item.entity, { dispose: false });
  item.entity = null;
  item.simulation = null;
  item.simulationActive = false;
}

function registerVisualItem(item, name = item.type ?? 'visual-object') {
  const entity = ecs.create(name);
  entity.add(COMPONENTS.visual, createVisualComponent(item.mesh ?? item.group));
  item.entity = entity;
  return item;
}

function unregisterVisualItem(item) {
  if (!item?.entity) return;
  ecs.remove(item.entity, { dispose: false });
  item.entity = null;
}
const remoteBuildingBlueprints = [];
const settlementClusters = [];
let city = null;
const MAX_DEBRIS_BODIES = 110;
const MAX_MERGEABLE_DEBRIS_PER_BLAST = 36;
const MAX_VISUAL_CHIPS = 30;
const MAX_BUILDING_SHARDS = 44;
// Vehicle impacts should crumble a wall in its footprint, not turn it into a radial blast.
// The impact direction is supplied per collision below; these values only provide a little
// breakup variation around that direction.
const CRUMBLE_SHARD_OPTIONS = { impulseScale: .1, scatterScale: .08, spawnScatterScale: .08, upwardBias: .01, upwardRange: .04, baseSpeed: .3, verticalBase: .18, spinScale: .16, panelScatterScale: .15, directionBias: .92, collisionGraceMs: 180 };
const MIN_FRAGMENT_CELLS = 2;
const BOULDER_ROLLING_RESISTANCE = .88;
const CHIP_ROLLING_RESISTANCE = .42;
const BOULDER_STATIC_FRICTION_SPEED = .68;
const BOULDER_STATIC_FRICTION_MIN_NORMAL_Y = .52;
const keys = new Set();
let controlMode = features.buggy && localStorage.getItem('sandcastle-control-mode') === 'car' ? 'car' : 'bomber';
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
const buildingMaterials = {
  plaster: new THREE.MeshStandardMaterial({ color: '#e9e3cf', roughness: .92, flatShading: true }),
  brick: new THREE.MeshStandardMaterial({ color: '#b8573e', roughness: .88, flatShading: true }),
  stone: new THREE.MeshStandardMaterial({ color: '#8d918a', roughness: .94, flatShading: true }),
  concrete: new THREE.MeshStandardMaterial({ color: '#b6b8af', roughness: .96, flatShading: true }),
  roof: new THREE.MeshStandardMaterial({ color: '#7e4b42', roughness: .82, flatShading: true }),
  darkRoof: new THREE.MeshStandardMaterial({ color: '#3f4a4d', roughness: .8, flatShading: true }),
  roofSoffit: new THREE.MeshStandardMaterial({ color: '#56645f', roughness: .86, flatShading: true }),
  foundation: new THREE.MeshStandardMaterial({ color: '#3c4140', roughness: .94, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: '#8a613f', roughness: .9, flatShading: true }),
  door: new THREE.MeshStandardMaterial({ color: '#5a382a', roughness: .78, flatShading: true }),
  glass: new THREE.MeshStandardMaterial({ color: '#83b7c7', roughness: .26, metalness: .05, transparent: true, opacity: .58 }),
  steel: new THREE.MeshStandardMaterial({ color: '#6f7c7d', roughness: .58, metalness: .28, flatShading: true }),
  oxidized: new THREE.MeshStandardMaterial({ color: '#8e8b62', roughness: .74, metalness: .12, flatShading: true }),
  warning: new THREE.MeshStandardMaterial({ color: '#e2bf42', roughness: .7, flatShading: true }),
  pipe: new THREE.MeshStandardMaterial({ color: '#516267', roughness: .62, metalness: .35, flatShading: true }),
  redSteel: new THREE.MeshStandardMaterial({ color: '#a6463d', roughness: .68, metalness: .12, flatShading: true }),
};
const buildingPalettes = {
  house: { wall: buildingMaterials.plaster, roof: buildingMaterials.roof, interior: buildingMaterials.wood, trim: buildingMaterials.stone },
  brick: { wall: buildingMaterials.brick, roof: buildingMaterials.darkRoof, interior: buildingMaterials.concrete, trim: buildingMaterials.stone },
  farm: { wall: buildingMaterials.wood, roof: buildingMaterials.roof, interior: buildingMaterials.wood, trim: buildingMaterials.steel },
  industrial: { wall: buildingMaterials.concrete, roof: buildingMaterials.darkRoof, interior: buildingMaterials.steel, trim: buildingMaterials.warning },
  plant: { wall: buildingMaterials.stone, roof: buildingMaterials.steel, interior: buildingMaterials.pipe, trim: buildingMaterials.redSteel },
};
const cityBuildingProfiles = {
  residence: { palette: buildingPalettes.house, floorHeight: 2.45, roomsX: 2, roomsZ: 1, roof: 'gable' },
  apartment: { palette: buildingPalettes.brick, floorHeight: 2.55, roomsX: 3, roomsZ: 2, roof: 'flat' },
  office: { palette: buildingPalettes.industrial, floorHeight: 2.8, roomsX: 3, roomsZ: 2, roof: 'flat' },
  'police-station': { palette: buildingPalettes.industrial, floorHeight: 2.8, roomsX: 3, roomsZ: 2, roof: 'flat' },
  'fire-department': { palette: buildingPalettes.brick, floorHeight: 3.15, roomsX: 2, roomsZ: 2, roof: 'flat', industrial: 1 },
  hospital: { palette: buildingPalettes.industrial, floorHeight: 2.9, roomsX: 3, roomsZ: 3, roof: 'flat' },
  'taxi-station': { palette: buildingPalettes.industrial, floorHeight: 2.9, roomsX: 2, roomsZ: 2, roof: 'flat', industrial: 1 },
  pizzeria: { palette: buildingPalettes.brick, floorHeight: 2.55, roomsX: 2, roomsZ: 1, roof: 'gable' },
  supermarket: { palette: buildingPalettes.industrial, floorHeight: 3.1, roomsX: 3, roomsZ: 2, roof: 'flat', industrial: 1 },
  school: { palette: buildingPalettes.brick, floorHeight: 2.65, roomsX: 3, roomsZ: 2, roof: 'gable' },
  library: { palette: buildingPalettes.house, floorHeight: 2.7, roomsX: 3, roomsZ: 2, roof: 'gable' },
  cafe: { palette: buildingPalettes.house, floorHeight: 2.5, roomsX: 2, roomsZ: 1, roof: 'gable' },
  warehouse: { palette: buildingPalettes.industrial, floorHeight: 3.35, roomsX: 3, roomsZ: 2, roof: 'saw', industrial: 2, stacks: 1 },
};
let sillyMode = false;
const vehicleModeButton = document.querySelector('#vehicle-mode');
const soundButton = document.querySelector('#sound');
const firstPersonButton = document.querySelector('#first-person');
const reticleElement = document.querySelector('.reticle');
const firstPersonRotation = new THREE.Euler(0, 0, 0, 'YXZ');
let firstPersonMode = localStorage.getItem('sandcastle-camera') === 'first-person';
const soundState = {
  enabled: localStorage.getItem('sandcastle-sound') !== 'off',
  context: null,
  master: null,
  compressor: null,
  noiseBuffer: null,
  lastImpactAt: 0,
};
const duneBuggy = createBuggyFeature({
  scene,
  world,
  terrain,
  camera,
  controls,
  keys,
  createParticleBurst,
  spawnShard: spawnPropShard,
  triggerScreenShake,
  getSpawnObstacles: () => ({ buildingBlueprints: city?.plan?.buildings ?? [...buildingBlueprints, ...remoteBuildingBlueprints], props }),
  onDestroyed: () => {
    if (controlMode === 'car') setControlMode('bomber', false);
  },
}, features.buggy);
if (duneBuggy.entity) ecs.add(duneBuggy.entity);

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

function updateFirstPersonButton() {
  firstPersonButton.setAttribute('aria-pressed', String(firstPersonMode));
  firstPersonButton.firstChild.textContent = firstPersonMode ? 'FIRST CAM ' : 'ORBIT CAM ';
  firstPersonButton.querySelector('span').textContent = firstPersonMode ? '●' : '○';
  firstPersonButton.disabled = controlMode === 'car';
}

function updateVehicleModeButton() {
  const carMode = controlMode === 'car';
  vehicleModeButton.setAttribute('aria-pressed', String(carMode));
  vehicleModeButton.firstChild.textContent = carMode ? 'CAR MODE ' : 'BOMBER MODE ';
  vehicleModeButton.querySelector('span').textContent = carMode ? '●' : '○';
  reticleElement.classList.toggle('hidden', carMode);
}

function applyCameraControlsState() {
  controls.enabled = controlMode === 'bomber' && !firstPersonMode;
}

function updateCameraTarget(distance = 24) {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  controls.target.copy(camera.position).add(direction.multiplyScalar(distance));
}

function setFirstPersonMode(enabled, persist = true) {
  const wasFirstPerson = firstPersonMode;
  firstPersonMode = enabled;
  applyCameraControlsState();
  if (persist) localStorage.setItem('sandcastle-camera', firstPersonMode ? 'first-person' : 'orbit');
  if (firstPersonMode) firstPersonRotation.setFromQuaternion(camera.quaternion, 'YXZ');
  if (firstPersonMode || wasFirstPerson || persist) updateCameraTarget();
  updateFirstPersonButton();
}

function setControlMode(mode, persist = true) {
  controlMode = !features.buggy && mode === 'car' ? 'bomber' : mode;
  if (controlMode === 'car') {
    if (!duneBuggy.alive) duneBuggy.spawn();
    duneBuggy.updateChaseCamera(1 / 60, true, true);
    updateSettlementLod(duneBuggy.body.position, true);
  } else if (!firstPersonMode) {
    updateCameraTarget();
  }
  applyCameraControlsState();
  if (persist) localStorage.setItem('sandcastle-control-mode', controlMode);
  updateVehicleModeButton();
  updateFirstPersonButton();
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
  const radius = item.mesh?.userData.radius ?? item.actor?.radius ?? item.group?.userData.radius ?? .45;
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

function playActorVoice(prop, mood, position, nowMs) {
  const context = ensureAudio();
  if (!context || nowMs - (prop.lastVoiceAt ?? 0) < 650) return;
  prop.lastVoiceAt = nowMs;
  const now = context.currentTime;
  const animal = prop.type === 'camel';
  const volume = soundDistanceGain(position, animal ? .22 : .16, 42);
  const base = animal ? (mood === 'annoyed' ? 165 : 215) : (mood === 'annoyed' ? 470 : 620);
  const count = animal ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const osc = context.createOscillator();
    const gain = connectSpatialGain(context, position, volume * (1 - i * .14));
    osc.type = animal ? 'sawtooth' : 'square';
    const start = now + i * (animal ? .16 : .09);
    const bend = mood === 'annoyed' ? 1.18 + i * .05 : .72 - i * .04;
    osc.frequency.setValueAtTime(base * (1 + i * .11), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(80, base * bend), start + (animal ? .24 : .15));
    envelopeParam(gain.gain, .0001, volume * (animal ? .7 : .45), .0001, animal ? .34 : .2, start, 'exponential');
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + (animal ? .38 : .22));
  }
  if (animal && mood === 'annoyed') {
    const grumble = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = connectSpatialGain(context, position, volume * .38);
    grumble.buffer = soundState.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = 260;
    filter.Q.value = 1.8;
    envelopeParam(gain.gain, .0001, volume * .38, .0001, .52, now, 'exponential');
    grumble.connect(filter).connect(gain);
    grumble.start(now, Math.random() * .6, .55);
  }
}

function throwBomb(clientX, clientY) {
  ensureAudio();
  pointer.set(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1); raycaster.setFromCamera(pointer, camera);
  const mesh = new THREE.Mesh(bombGeometry, bombMaterial); mesh.castShadow = true; mesh.position.copy(camera.position).add(raycaster.ray.direction.clone().multiplyScalar(1.6)); scene.add(mesh);
  const body = new CANNON.Body({ mass: 1.3, shape: new CANNON.Sphere(.42), linearDamping: .015 });
  body.userData = { kind: 'projectile' };
  body.position.copy(mesh.position); const velocity = raycaster.ray.direction.clone().multiplyScalar(34); velocity.y += 7;
  body.velocity.set(velocity.x, velocity.y, velocity.z); body.addEventListener('collide', () => { projectile.pendingExplosion = true; }); world.addBody(body);
  const projectile = registerSimulationItem({ mesh, body, born: performance.now(), exploded: false, pendingExplosion: false }, { alwaysActive: true }); projectiles.push(projectile);
}

function explode(projectile) {
  if (projectile.exploded) return; projectile.exploded = true;
  const center = new THREE.Vector3().copy(projectile.body.position); removePhysics(projectile);
  playExplosionSound(center);
  explodeDebris(center, 5.2);
  damageBuildings(center, 5.8);
  const removed = terrain.carveSphere(center, 4.2);
  for (const piece of allocateTerrainDebris(removed)) spawnDebris(piece.position, center, piece.cells, piece.color);
  spawnRockChips(center, removed);
  spawnExplosionParticles(center, removed);
  triggerScreenShake(.72, .42);
  explodeProps(center, 5.2);
  duneBuggy.damageFromExplosion(center, 5.2);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.5, .72, 32), new THREE.MeshBasicMaterial({ color: '#fff0ad', transparent: true, side: THREE.DoubleSide }));
  ring.position.copy(center); ring.lookAt(camera.position); scene.add(ring); effects.push(registerVisualItem({ type: 'ring', mesh: ring, age: 0, lifetime: .42 }));
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
  count, color, size, lifetime, speed, gravity = 9, drag = .985, opacity = .9, spread = 1, upLift = .8, sizeGrowth = 1, fadePower = 2, renderOrder = 2, directionBias = null, biasStrength = 0,
}) {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const index = i * 3;
    const direction = particleDirection(upLift);
    if (directionBias) direction.lerp(directionBias, biasStrength).normalize();
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
  effects.push(registerVisualItem({ type: 'particles', mesh, center: center.clone(), cullingRadius: speed[1] * lifetime + spread + size * sizeGrowth, age: 0, lifetime, velocities, gravity, drag, startOpacity: opacity, startSize: size, endSize: size * sizeGrowth, fadePower }));
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
  body.userData = { kind: 'debris' };
  body.position.copy(position); const out = position.clone().sub(center).normalize().add(new THREE.Vector3((Math.random()-.5)*.5, .55 + Math.random()*.55, (Math.random()-.5)*.5)).normalize();
  const impulse = 7 + Math.random() * 8;
  body.velocity.set(out.x * impulse, out.y * impulse, out.z * impulse);
  body.angularVelocity.set(Math.random()*7, Math.random()*7, Math.random()*7); world.addBody(body); debris.push(registerSimulationItem({ mesh, body, stillSince: null, mergeToTerrain: true, voxelCells, lastImpactAt: 0, rollingResistance: BOULDER_ROLLING_RESISTANCE }));
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
    body.userData = { kind: 'debris' };
    body.position.copy(mesh.position);
    const out = mesh.position.clone().sub(center).normalize().add(new THREE.Vector3((Math.random() - .5) * .7, .75 + Math.random() * .75, (Math.random() - .5) * .7)).normalize();
    body.velocity.set(out.x * (8 + Math.random() * 12), out.y * (7 + Math.random() * 11), out.z * (8 + Math.random() * 12));
    body.angularVelocity.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    world.addBody(body);
    debris.push(registerSimulationItem({ mesh, body, stillSince: null, mergeToTerrain: false, lastImpactAt: 0, rollingResistance: CHIP_ROLLING_RESISTANCE }));
  }
}

function explodeDebris(center, radius) {
  const targets = [];
  for (let i = debris.length - 1; i >= 0; i--) {
    const item = debris[i];
    if (!item.simulationActive) continue;
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
    body.userData = { kind: 'debris' };
    body.position.copy(mesh.position);
    const out = mesh.position.clone().sub(center).normalize().add(new THREE.Vector3((Math.random() - .5) * .7, .6 + Math.random() * .75, (Math.random() - .5) * .7)).normalize();
    body.velocity.set(out.x * (7 + Math.random() * 9), out.y * (6 + Math.random() * 9), out.z * (7 + Math.random() * 9));
    body.angularVelocity.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
    world.addBody(body);
    debris.push(registerSimulationItem({ mesh, body, stillSince: null, mergeToTerrain: false, lastImpactAt: 0, rollingResistance: CHIP_ROLLING_RESISTANCE }));
  }
}

function removePhysics(item) { unregisterSimulationItem(item); scene.remove(item.mesh); world.removeBody(item.body); }
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

function makePartSpec(name, size, position, material, options = {}) {
  return {
    name,
    size,
    position,
    material,
    rotation: options.rotation ?? [0, 0, 0],
    geometry: options.geometry ?? null,
    strength: options.strength ?? 7,
    mass: options.mass ?? Math.max(.7, size[0] * size[1] * size[2] * .22),
    brittle: options.brittle ?? false,
    type: options.type ?? 'structure',
    castShadow: options.castShadow ?? true,
  };
}

function createProfilePrismGeometry(points, thickness, axis = 'z') {
  const positions = [];
  const indices = [];
  const half = thickness / 2;
  const pushVertex = (a, y, b) => {
    if (axis === 'x') positions.push(-half, y, a);
    else positions.push(a, y, -half);
    if (axis === 'x') positions.push(half, y, a);
    else positions.push(a, y, half);
  };
  for (const [a, y] of points) pushVertex(a, y, 0);
  const count = points.length;
  for (let i = 1; i < count - 1; i++) {
    indices.push(0, i * 2, (i + 1) * 2);
    indices.push(1, (i + 1) * 2 + 1, i * 2 + 1);
  }
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    const a = i * 2;
    const b = next * 2;
    indices.push(a, a + 1, b + 1, a, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

function createRectBuildingSpecs(options) {
  const {
    width,
    depth,
    stories = 1,
    floorHeight = 2.4,
    palette = buildingPalettes.house,
    roomsX = 1,
    roomsZ = 1,
    roof = 'flat',
    industrial = 0,
    stacks = 0,
    tanks = 0,
  } = options;
  const specs = [];
  const height = stories * floorHeight;
  const wallThickness = .28;
  const trimDepth = .1;
  const trimWidth = .12;
  const floors = Math.max(1, stories);
  const addWindowedFace = (name, axis, centerAlong, centerCross, crossSign, span, material, includeWindow) => {
    const faceSize = span;
    const windowWidth = Math.min(faceSize * .46, 1.05);
    const windowHeight = Math.min(.86, height * .28);
    const windowCenterY = THREE.MathUtils.clamp(height * .58, 1.18, Math.max(1.18, height - windowHeight * .65));
    const bottomTop = windowCenterY - windowHeight / 2;
    const topBottom = windowCenterY + windowHeight / 2;
    const lowerHeight = includeWindow ? Math.max(.24, bottomTop) : height;
    const upperHeight = includeWindow ? Math.max(.24, height - topBottom) : 0;
    const sideWidth = includeWindow ? Math.max(.18, (faceSize - windowWidth) / 2) : 0;
    const wallZ = axis === 'x' ? wallThickness : faceSize;
    const wallX = axis === 'x' ? faceSize : wallThickness;
    const makePosition = (along, y) => axis === 'x'
      ? [along, y, centerCross]
      : [centerCross, y, along];
    const makeSize = (alongSize, ySize) => axis === 'x'
      ? [alongSize, ySize, wallThickness]
      : [wallThickness, ySize, alongSize];
    const addWindowFrame = () => {
      const frameWidth = .12;
      const frameDepth = .12;
      const outside = centerCross + crossSign * (wallThickness / 2 + frameDepth / 2 + .018);
      const trimOptions = { strength: 3.6, mass: .14, brittle: true, type: 'trim', castShadow: false };
      const horizontalSize = axis === 'x'
        ? [windowWidth + frameWidth * 2, frameWidth, frameDepth]
        : [frameDepth, frameWidth, windowWidth + frameWidth * 2];
      const verticalSize = axis === 'x'
        ? [frameWidth, windowHeight + frameWidth * 2, frameDepth]
        : [frameDepth, windowHeight + frameWidth * 2, frameWidth];
      const horizontalPosition = (y) => axis === 'x'
        ? [centerAlong, y, outside]
        : [outside, y, centerAlong];
      const verticalPosition = (along) => axis === 'x'
        ? [along, windowCenterY, outside]
        : [outside, windowCenterY, along];
      specs.push(makePartSpec(`${name}-top-frame`, horizontalSize, horizontalPosition(windowCenterY + windowHeight / 2 - frameWidth / 2), material, trimOptions));
      specs.push(makePartSpec(`${name}-bottom-frame`, horizontalSize, horizontalPosition(windowCenterY - windowHeight / 2 + frameWidth / 2), material, trimOptions));
      specs.push(makePartSpec(`${name}-left-frame`, verticalSize, verticalPosition(centerAlong - windowWidth / 2 - frameWidth / 2), material, trimOptions));
      specs.push(makePartSpec(`${name}-right-frame`, verticalSize, verticalPosition(centerAlong + windowWidth / 2 + frameWidth / 2), material, trimOptions));
    };
    if (!includeWindow) {
      specs.push(makePartSpec(name, [wallX, height, wallZ], makePosition(centerAlong, height / 2), material, { strength: 6.7, brittle: true }));
      return;
    }
    specs.push(makePartSpec(`${name}-sill-panel`, makeSize(faceSize, lowerHeight), makePosition(centerAlong, lowerHeight / 2), material, { strength: 6.1, brittle: true }));
    specs.push(makePartSpec(`${name}-header-panel`, makeSize(faceSize, upperHeight), makePosition(centerAlong, topBottom + upperHeight / 2), material, { strength: 6.1, brittle: true }));
    specs.push(makePartSpec(`${name}-left-jamb`, makeSize(sideWidth, windowHeight), makePosition(centerAlong - (windowWidth + sideWidth) / 2, windowCenterY), material, { strength: 5.6, brittle: true }));
    specs.push(makePartSpec(`${name}-right-jamb`, makeSize(sideWidth, windowHeight), makePosition(centerAlong + (windowWidth + sideWidth) / 2, windowCenterY), material, { strength: 5.6, brittle: true }));
    const glassSize = axis === 'x' ? [windowWidth + .04, windowHeight + .04, .08] : [.08, windowHeight + .04, windowWidth + .04];
    const glassPosition = axis === 'x'
      ? [centerAlong, windowCenterY, centerCross + crossSign * (wallThickness / 2 + .05)]
      : [centerCross + crossSign * (wallThickness / 2 + .05), windowCenterY, centerAlong];
    specs.push(makePartSpec(`${name}-glass`, glassSize, glassPosition, buildingMaterials.glass, { strength: 1.7, mass: .22, brittle: true, type: 'glass', castShadow: false }));
    addWindowFrame();
  };
  const addDoorFace = (name, centerAlong, centerCross, crossSign, span, material) => {
    const faceSize = span;
    const doorWidth = Math.min(faceSize * .56, 1.2);
    const doorHeight = Math.min(1.55, height - .45);
    const sideWidth = Math.max(.18, (faceSize - doorWidth) / 2);
    const headerHeight = Math.max(.28, height - doorHeight);
    specs.push(makePartSpec(`${name}-left-jamb`, [sideWidth, doorHeight, wallThickness], [centerAlong - (doorWidth + sideWidth) / 2, doorHeight / 2, centerCross], material, { strength: 5.4, brittle: true }));
    specs.push(makePartSpec(`${name}-right-jamb`, [sideWidth, doorHeight, wallThickness], [centerAlong + (doorWidth + sideWidth) / 2, doorHeight / 2, centerCross], material, { strength: 5.4, brittle: true }));
    specs.push(makePartSpec(`${name}-header`, [faceSize, headerHeight, wallThickness], [centerAlong, doorHeight + headerHeight / 2, centerCross], material, { strength: 5.8, brittle: true }));
    specs.push(makePartSpec(`${name}-door`, [doorWidth * .82, doorHeight * .92, .14], [centerAlong, doorHeight * .46, centerCross + crossSign * (wallThickness / 2 + .07)], buildingMaterials.door, { strength: 2.5, mass: .7, brittle: true, type: 'door' }));
  };
  const addVerticalCover = (name, axis, along, centerCross, crossSign, material) => {
    const outward = centerCross + crossSign * (wallThickness / 2 + trimDepth / 2 + .012);
    const size = axis === 'x' ? [trimWidth, height + .06, trimDepth] : [trimDepth, height + .06, trimWidth];
    const position = axis === 'x' ? [along, height / 2 + .03, outward] : [outward, height / 2 + .03, along];
    specs.push(makePartSpec(name, size, position, material, { strength: 5.2, mass: .28, brittle: true, type: 'trim', castShadow: false }));
  };
  const addHorizontalCover = (name, axis, centerAlong, centerCross, crossSign, span, y, material) => {
    const outward = centerCross + crossSign * (wallThickness / 2 + trimDepth / 2 + .018);
    const size = axis === 'x' ? [span, trimWidth, trimDepth] : [trimDepth, trimWidth, span];
    const position = axis === 'x' ? [centerAlong, y, outward] : [outward, y, centerAlong];
    specs.push(makePartSpec(name, size, position, material, { strength: 5, mass: .24, brittle: true, type: 'trim', castShadow: false }));
  };
  const addCornerPost = (name, x, z, material) => {
    specs.push(makePartSpec(name, [wallThickness + .08, height + .08, wallThickness + .08], [x, height / 2 + .04, z], material, { strength: 6.2, mass: .5, brittle: true, type: 'trim', castShadow: false }));
  };
  const addRoofPanels = (name, size, position, material, options = {}, axis = 'x', panelCount = null) => {
    const axisIndex = axis === 'z' ? 2 : 0;
    const span = size[axisIndex];
    const count = panelCount ?? (span > 9 ? 3 : 2);
    const segment = span / count;
    for (let i = 0; i < count; i++) {
      const panelSize = [...size];
      const panelPosition = [...position];
      panelSize[axisIndex] = segment + .04;
      panelPosition[axisIndex] += -span / 2 + segment * (i + .5);
      specs.push(makePartSpec(`${name}-${i + 1}`, panelSize, panelPosition, material, {
        ...options,
        mass: (options.mass ?? span * size[1] * size[2] * .08) / count,
        strength: options.strength ?? 7.2,
        brittle: options.brittle ?? true,
        type: options.type ?? 'roof',
      }));
    }
    for (let i = 1; i < count; i++) {
      const seamSize = [...size];
      const seamPosition = [...position];
      seamSize[axisIndex] = .07;
      seamSize[1] = Math.max(.06, size[1] + .05);
      seamPosition[axisIndex] += -span / 2 + segment * i;
      seamPosition[1] += .045;
      specs.push(makePartSpec(`${name}-seam-${i}`, seamSize, seamPosition, buildingMaterials.roofSoffit, {
        rotation: options.rotation ?? [0, 0, 0],
        strength: 4.6,
        mass: .18,
        brittle: true,
        type: 'trim',
        castShadow: false,
      }));
    }
  };
  const addFloorPanels = (level, y) => {
    const count = width > 9 ? 3 : 2;
    const segment = width / count;
    const mass = width * depth * .055 / count;
    for (let i = 0; i < count; i++) {
      const x = -width / 2 + segment * (i + .5);
      specs.push(makePartSpec(`floor-${level}-panel-${i + 1}`, [segment + .04, .18, depth + .12], [x, y, 0], palette.interior, {
        strength: 8.8 + (level - 1) * .6,
        mass,
        brittle: true,
        type: 'floor',
      }));
    }
  };

  for (let level = 0; level < floors; level++) {
    const y = level * floorHeight + .09;
    addFloorPanels(level + 1, y);
  }
  if (roof === 'flat') addRoofPanels('roof-deck-panel', [width + .42, .2, depth + .42], [0, height + .16, 0], palette.roof, { strength: 9.2, mass: width * depth * .055 }, width >= depth ? 'x' : 'z');
  if (roof === 'saw') addRoofPanels('saw-roof-ceiling-panel', [width + .3, .18, depth + .3], [0, height + .13, 0], palette.roof, { strength: 8.8, mass: width * depth * .05 }, width >= depth ? 'x' : 'z');

  const sideSegments = Math.max(2, Math.ceil(width / 2.4));
  const depthSegments = Math.max(2, Math.ceil(depth / 2.4));
  for (let i = 0; i < sideSegments; i++) {
    const segmentWidth = width / sideSegments;
    const x = -width / 2 + segmentWidth * (i + .5);
    const frontDoor = i === Math.floor(sideSegments / 2);
    if (frontDoor) addDoorFace('front-entry', x, -depth / 2, -1, segmentWidth, palette.wall);
    else addWindowedFace(`front-wall-${i + 1}`, 'x', x, -depth / 2, -1, segmentWidth, palette.wall, i % 2 === 0 && height > 2.2);
    addWindowedFace(`back-wall-${i + 1}`, 'x', x, depth / 2, 1, segmentWidth, palette.wall, i % 2 === 0 && height > 2.2);
  }
  for (let i = 1; i < sideSegments; i++) {
    const x = -width / 2 + width * i / sideSegments;
    addVerticalCover(`front-panel-cover-${i}`, 'x', x, -depth / 2, -1, palette.wall);
    addVerticalCover(`back-panel-cover-${i}`, 'x', x, depth / 2, 1, palette.wall);
  }
  addHorizontalCover('front-eave-wall-cover', 'x', 0, -depth / 2, -1, width, height - .04, palette.wall);
  addHorizontalCover('back-eave-wall-cover', 'x', 0, depth / 2, 1, width, height - .04, palette.wall);

  for (let i = 0; i < depthSegments; i++) {
    const segmentDepth = depth / depthSegments;
    const z = -depth / 2 + segmentDepth * (i + .5);
    const sideWindow = i % 2 === 0 && width > 4.8 && height > 2.2;
    addWindowedFace(`left-wall-${i + 1}`, 'z', z, -width / 2, -1, segmentDepth, palette.wall, sideWindow);
    addWindowedFace(`right-wall-${i + 1}`, 'z', z, width / 2, 1, segmentDepth, palette.wall, sideWindow);
  }
  for (let i = 1; i < depthSegments; i++) {
    const z = -depth / 2 + depth * i / depthSegments;
    addVerticalCover(`left-panel-cover-${i}`, 'z', z, -width / 2, -1, palette.wall);
    addVerticalCover(`right-panel-cover-${i}`, 'z', z, width / 2, 1, palette.wall);
  }
  addHorizontalCover('left-eave-wall-cover', 'z', 0, -width / 2, -1, depth, height - .04, palette.wall);
  addHorizontalCover('right-eave-wall-cover', 'z', 0, width / 2, 1, depth, height - .04, palette.wall);
  addCornerPost('front-left-corner-post', -width / 2, -depth / 2, palette.wall);
  addCornerPost('front-right-corner-post', width / 2, -depth / 2, palette.wall);
  addCornerPost('back-left-corner-post', -width / 2, depth / 2, palette.wall);
  addCornerPost('back-right-corner-post', width / 2, depth / 2, palette.wall);

  for (let x = 1; x < roomsX; x++) {
    const px = -width / 2 + width * x / roomsX;
    specs.push(makePartSpec(`interior-x-wall-${x}`, [.16, Math.max(1.8, height - .35), depth * .36], [px, height / 2, -depth * .22], palette.interior, { strength: 4.5, brittle: true }));
    specs.push(makePartSpec(`interior-x-door-${x}`, [.18, 1.45, .72], [px, .82, depth * .18], buildingMaterials.door, { strength: 2.4, mass: .42, brittle: true, type: 'door' }));
    specs.push(makePartSpec(`interior-x-wall-return-${x}`, [.16, Math.max(1.8, height - .35), depth * .26], [px, height / 2, depth * .37], palette.interior, { strength: 4.5, brittle: true }));
  }
  for (let z = 1; z < roomsZ; z++) {
    const pz = -depth / 2 + depth * z / roomsZ;
    specs.push(makePartSpec(`interior-z-wall-${z}`, [width * .38, Math.max(1.8, height - .35), .16], [-width * .26, height / 2, pz], palette.interior, { strength: 4.5, brittle: true }));
    specs.push(makePartSpec(`interior-z-door-${z}`, [.72, 1.45, .18], [width * .18, .82, pz], buildingMaterials.door, { strength: 2.4, mass: .42, brittle: true, type: 'door' }));
    specs.push(makePartSpec(`interior-z-wall-return-${z}`, [width * .24, Math.max(1.8, height - .35), .16], [width * .38, height / 2, pz], palette.interior, { strength: 4.5, brittle: true }));
  }

  if (roof === 'gable') {
    const pitch = .42;
    const overhang = .38;
    const halfRun = depth / 2 + overhang;
    const slopeLength = halfRun / Math.cos(pitch);
    const eaveY = height;
    const ridgeY = eaveY + Math.tan(pitch) * halfRun;
    const centerY = (eaveY + ridgeY) / 2;
    const gableHeight = ridgeY - eaveY;
    const gableGeometry = createProfilePrismGeometry(
      [[-depth / 2, -gableHeight / 2], [depth / 2, -gableHeight / 2], [0, gableHeight / 2]],
      wallThickness + .08,
      'x',
    );
    specs.push(makePartSpec('left-gable-end-wall', [wallThickness + .08, gableHeight, depth], [-width / 2, eaveY + gableHeight / 2, 0], palette.wall, { geometry: gableGeometry.clone(), strength: 5.9, mass: width * .02, brittle: true }));
    specs.push(makePartSpec('right-gable-end-wall', [wallThickness + .08, gableHeight, depth], [width / 2, eaveY + gableHeight / 2, 0], palette.wall, { geometry: gableGeometry.clone(), strength: 5.9, mass: width * .02, brittle: true }));
    addRoofPanels('front-roof-slope-panel', [width + overhang * 2, .18, slopeLength], [0, centerY, -halfRun / 2], palette.roof, { rotation: [-pitch, 0, 0], strength: 6.3, mass: width * depth * .036 }, 'x');
    addRoofPanels('back-roof-slope-panel', [width + overhang * 2, .18, slopeLength], [0, centerY, halfRun / 2], palette.roof, { rotation: [pitch, 0, 0], strength: 6.3, mass: width * depth * .036 }, 'x');
    specs.push(makePartSpec('ridge-cap', [width + overhang * 2 + .08, .16, .2], [0, ridgeY + .03, 0], palette.roof, { strength: 5.8, mass: width * .025 }));
  } else if (roof === 'saw') {
    const teeth = Math.max(2, Math.round(width / 3.8));
    const sawPitch = .22;
    const sawEaveY = height + .2;
    const fasciaBaseY = height - .02;
    for (let i = 0; i < teeth; i++) {
      const toothWidth = width / teeth;
      const x = -width / 2 + (i + .5) * toothWidth;
      const angle = i % 2 ? -sawPitch : sawPitch;
      const halfTooth = toothWidth / 2;
      const roofCenterY = sawEaveY + Math.abs(Math.sin(angle)) * halfTooth;
      const leftTop = roofCenterY - Math.sin(angle) * halfTooth - .1;
      const rightTop = roofCenterY + Math.sin(angle) * halfTooth - .1;
      const fasciaCenterY = (Math.max(leftTop, rightTop) + fasciaBaseY) / 2;
      const fasciaHeight = Math.max(.22, Math.max(leftTop, rightTop) - fasciaBaseY);
      const frontGeometry = createProfilePrismGeometry(
        [[-halfTooth, fasciaBaseY - fasciaCenterY], [halfTooth, fasciaBaseY - fasciaCenterY], [halfTooth, rightTop - fasciaCenterY], [-halfTooth, leftTop - fasciaCenterY]],
        wallThickness + .08,
        'z',
      );
      specs.push(makePartSpec(`saw-front-fascia-${i + 1}`, [toothWidth, fasciaHeight, wallThickness + .08], [x, fasciaCenterY, -depth / 2], palette.wall, { geometry: frontGeometry.clone(), strength: 5.9, mass: .5, brittle: true, type: 'trim', castShadow: false }));
      specs.push(makePartSpec(`saw-back-fascia-${i + 1}`, [toothWidth, fasciaHeight, wallThickness + .08], [x, fasciaCenterY, depth / 2], palette.wall, { geometry: frontGeometry.clone(), strength: 5.9, mass: .5, brittle: true, type: 'trim', castShadow: false }));
      specs.push(makePartSpec(`saw-front-soffit-lip-${i + 1}`, [toothWidth + .12, .14, .18], [x, roofCenterY - .17, -depth / 2 - .29], buildingMaterials.roofSoffit, { rotation: [0, 0, angle], strength: 4.8, mass: .24, brittle: true, type: 'trim', castShadow: false }));
      specs.push(makePartSpec(`saw-back-soffit-lip-${i + 1}`, [toothWidth + .12, .14, .18], [x, roofCenterY - .17, depth / 2 + .29], buildingMaterials.roofSoffit, { rotation: [0, 0, angle], strength: 4.8, mass: .24, brittle: true, type: 'trim', castShadow: false }));
      specs.push(makePartSpec(`saw-left-return-${i + 1}`, [.16, .32, depth + .58], [x - halfTooth - .02, leftTop - .15, 0], buildingMaterials.roofSoffit, { strength: 4.8, mass: .28, brittle: true, type: 'trim', castShadow: false }));
      specs.push(makePartSpec(`saw-right-return-${i + 1}`, [.16, .32, depth + .58], [x + halfTooth + .02, rightTop - .15, 0], buildingMaterials.roofSoffit, { strength: 4.8, mass: .28, brittle: true, type: 'trim', castShadow: false }));
      addRoofPanels(`sawtooth-roof-${i + 1}-panel`, [toothWidth + .04, .18, depth + .5], [x, roofCenterY, 0], palette.roof, { rotation: [0, 0, angle], strength: 6.8, mass: toothWidth * depth * .034 }, 'z', depth > 7 ? 3 : 2);
    }
  }

  if (industrial > 0) {
    const columnRows = Math.max(2, Math.ceil(width / 4.5));
    const columnDepths = Math.max(2, Math.ceil(depth / 4.5));
    for (let ix = 0; ix < columnRows; ix++) {
      for (let iz = 0; iz < columnDepths; iz++) {
        const x = -width / 2 + (ix + .5) * width / columnRows;
        const z = -depth / 2 + (iz + .5) * depth / columnDepths;
        specs.push(makePartSpec(`steel-column-${ix + 1}-${iz + 1}`, [.22, height + .35, .22], [x, height / 2 + .08, z], buildingMaterials.steel, { strength: 9.6, mass: 1.5, type: 'beam' }));
      }
    }
    specs.push(makePartSpec('overhead-crane-rail-a', [width + .3, .18, .18], [0, height - .38, -depth * .28], buildingMaterials.warning, { strength: 8.2, mass: 1.2, type: 'beam' }));
    specs.push(makePartSpec('overhead-crane-rail-b', [width + .3, .18, .18], [0, height - .38, depth * .28], buildingMaterials.warning, { strength: 8.2, mass: 1.2, type: 'beam' }));
  }

  for (let i = 0; i < tanks; i++) {
    const x = -width / 2 + 1.5 + i * 2.6;
    specs.push(makePartSpec(`tank-block-${i + 1}`, [1.45, 1.45, 1.45], [x, .92, depth / 2 + 1.15], buildingMaterials.oxidized, { strength: 7.4, mass: 2.2, type: 'tank' }));
  }
  for (let i = 0; i < stacks; i++) {
    const x = width / 2 - 1.2 - i * 1.6;
    specs.push(makePartSpec(`exhaust-stack-${i + 1}`, [.74, height * .92, .74], [x, height + height * .42, depth / 2 - 1.1], buildingMaterials.pipe, { strength: 7.8, mass: 2.1, type: 'stack' }));
  }
  return specs;
}

const buildingBlueprints = [
  { name: 'simple-house', x: -32, z: -25, rotation: .18, width: 5.2, depth: 4.4, stories: 1, roomsX: 2, roof: 'gable', palette: buildingPalettes.house },
  { name: 'beach-cottage', x: -22, z: -30, rotation: -.45, width: 5.8, depth: 5, stories: 1, roomsX: 2, roomsZ: 2, roof: 'gable', palette: buildingPalettes.house },
  { name: 'duplex', x: -9, z: -30, rotation: .08, width: 7.2, depth: 5.2, stories: 2, roomsX: 2, roomsZ: 2, roof: 'gable', palette: buildingPalettes.brick },
  { name: 'row-shop', x: 6, z: -29, rotation: -.08, width: 8.4, depth: 5.5, stories: 2, roomsX: 3, roomsZ: 1, roof: 'flat', palette: buildingPalettes.brick },
  { name: 'farm-barn', x: 22, z: -28, rotation: .38, width: 8.8, depth: 6.2, stories: 1, floorHeight: 3.1, roomsX: 2, roomsZ: 1, roof: 'gable', palette: buildingPalettes.farm },
  { name: 'service-garage', x: 33, z: -14, rotation: 1.2, width: 7.6, depth: 7.1, stories: 1, floorHeight: 2.7, roomsX: 2, roomsZ: 2, roof: 'flat', palette: buildingPalettes.industrial, industrial: 1 },
  { name: 'air-hangar', x: 31, z: 3, rotation: 1.55, width: 11.2, depth: 7.6, stories: 1, floorHeight: 3.8, roomsX: 2, roomsZ: 1, roof: 'saw', palette: buildingPalettes.industrial, industrial: 1 },
  { name: 'warehouse', x: 24, z: 22, rotation: -.32, width: 12.4, depth: 8.5, stories: 1, floorHeight: 3.4, roomsX: 3, roomsZ: 2, roof: 'flat', palette: buildingPalettes.industrial, industrial: 2 },
  { name: 'machine-shop', x: 6, z: 29, rotation: .16, width: 10.5, depth: 7.2, stories: 2, floorHeight: 2.9, roomsX: 3, roomsZ: 2, roof: 'saw', palette: buildingPalettes.industrial, industrial: 2, stacks: 1 },
  { name: 'refinery-shed', x: -12, z: 28, rotation: -.18, width: 11.6, depth: 7.6, stories: 1, floorHeight: 3.2, roomsX: 3, roomsZ: 2, roof: 'flat', palette: buildingPalettes.plant, industrial: 2, tanks: 3, stacks: 2 },
  { name: 'power-substation', x: -29, z: 20, rotation: .72, width: 9.5, depth: 8.4, stories: 1, floorHeight: 3, roomsX: 2, roomsZ: 2, roof: 'flat', palette: buildingPalettes.plant, industrial: 2, tanks: 2, stacks: 3 },
  { name: 'power-plant', x: -34, z: 3, rotation: 1.35, width: 12.8, depth: 9.2, stories: 2, floorHeight: 3.1, roomsX: 3, roomsZ: 3, roof: 'saw', palette: buildingPalettes.plant, industrial: 3, tanks: 4, stacks: 4 },
];

const SETTLEMENT_LOD_ENTER_DISTANCE = 118;
const SETTLEMENT_LOD_EXIT_DISTANCE = 156;

function settlementRng(seed) {
  let state = (Math.floor(seed * 1e6) ^ 0x9E3779B9) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function trackSampleAtDistance(track, distance) {
  const target = ((distance % track.length) + track.length) % track.length;
  return track.samples.find((sample) => sample.s >= target) ?? track.samples[0];
}

function terrainVariationAt(x, z, radius = 12) {
  const values = [
    terrain.surfaceY(x, z),
    terrain.surfaceY(x - radius, z), terrain.surfaceY(x + radius, z),
    terrain.surfaceY(x, z - radius), terrain.surfaceY(x, z + radius),
  ];
  return Math.max(...values) - Math.min(...values);
}

function findSettlementSite(sample, side, rng) {
  let best = null;
  for (let attempt = 0; attempt < 7; attempt++) {
    const distance = 34 + rng() * 30;
    const along = (rng() - .5) * 48;
    const x = sample.x + sample.normalX * side * distance + sample.tangentX * along;
    const z = sample.z + sample.normalZ * side * distance + sample.tangentZ * along;
    const variation = terrainVariationAt(x, z);
    if (!best || variation < best.variation) best = { x, z, variation };
  }
  return best;
}

function createTrackStartTown(track) {
  const pose = track.startPose();
  const road = track.sample(pose.x, pose.z);
  if (!road) return;

  const rng = settlementRng(terrain.seed + 73.1);
  const blueprints = [];
  const streetOffsets = [-24, -8, 9, 25];
  for (const side of [-1, 1]) {
    for (let index = 0; index < streetOffsets.length; index++) {
      const along = streetOffsets[index] + (rng() - .5) * 2.4;
      const setback = 15 + rng() * 1.8;
      const towardRoadX = -road.normalX * side;
      const towardRoadZ = -road.normalZ * side;
      blueprints.push({
        name: `start-town-${side < 0 ? 'west' : 'east'}-${index + 1}`,
        x: pose.x + road.tangentX * along + road.normalX * side * setback,
        z: pose.z + road.tangentZ * along + road.normalZ * side * setback,
        // The local front (negative Z) faces the race street, leaving a clear
        // corridor around the buggy's start position.
        rotation: Math.atan2(-towardRoadX, -towardRoadZ),
        width: 4.8 + rng() * 1.6,
        depth: 4.6 + rng() * 1.5,
        stories: rng() < .22 ? 2 : 1,
        floorHeight: 2.45 + rng() * .28,
        roomsX: 2,
        roomsZ: rng() < .42 ? 2 : 1,
        roof: rng() < .72 ? 'gable' : 'flat',
        palette: rng() < .7 ? buildingPalettes.house : buildingPalettes.brick,
      });
    }
  }
  const cluster = {
    name: 'start-town',
    x: pose.x,
    z: pose.z,
    blueprints,
    lodGroup: null,
    detailedBuildings: [],
    detailed: false,
  };
  remoteBuildingBlueprints.push(...blueprints);
  settlementClusters.push(cluster);
  createSettlementLod(cluster);
}

function createSettlementLod(cluster) {
  const group = new THREE.Group();
  group.name = `${cluster.name}-lod`;
  for (const blueprint of cluster.blueprints) {
    const height = (blueprint.floorHeight ?? 2.6) * blueprint.stories;
    const baseY = terrain.surfaceY(blueprint.x, blueprint.z);
    const building = new THREE.Group();
    building.position.set(blueprint.x, baseY, blueprint.z);
    building.rotation.y = blueprint.rotation;
    building.userData.cullingRadius = Math.hypot(blueprint.width, height, blueprint.depth) * .55;

    const walls = new THREE.Mesh(new THREE.BoxGeometry(blueprint.width, height, blueprint.depth), blueprint.palette.wall);
    walls.position.y = height * .5;
    walls.castShadow = false;
    walls.receiveShadow = true;
    building.add(walls);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(blueprint.width + .35, .26, blueprint.depth + .35), blueprint.palette.roof);
    roof.position.y = height + .13;
    roof.castShadow = false;
    roof.receiveShadow = true;
    building.add(roof);
    group.add(building);
  }
  cluster.lodGroup = group;
  scene.add(group);
}

function createTrackSettlements() {
  disposeSettlementLods();
  remoteBuildingBlueprints.length = 0;
  if (!terrain.track) return;

  const rng = settlementRng(terrain.seed + 31.7);
  createTrackStartTown(terrain.track);
  const clusterCount = 5;
  for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex++) {
    const progress = (.08 + clusterIndex * .18 + (rng() - .5) * .05) % 1;
    const sample = trackSampleAtDistance(terrain.track, terrain.track.length * progress);
    const side = rng() < .5 ? -1 : 1;
    const site = findSettlementSite(sample, side, rng);
    const blueprints = [];
    const buildingCount = 3 + Math.floor(rng() * 2);
    const heading = Math.atan2(sample.tangentX, sample.tangentZ);
    for (let buildingIndex = 0; buildingIndex < buildingCount; buildingIndex++) {
      const along = (rng() - .5) * 34;
      const across = (rng() - .5) * 24;
      const x = site.x + sample.tangentX * along + sample.normalX * across;
      const z = site.z + sample.tangentZ * along + sample.normalZ * across;
      const palette = rng() < .7 ? buildingPalettes.house : buildingPalettes.brick;
      const blueprint = {
        name: `track-settlement-${clusterIndex + 1}-home-${buildingIndex + 1}`,
        x,
        z,
        rotation: heading + (rng() - .5) * .42,
        width: 4.7 + rng() * 1.8,
        depth: 4.3 + rng() * 1.6,
        stories: rng() < .2 ? 2 : 1,
        floorHeight: 2.45 + rng() * .28,
        roomsX: 2,
        roomsZ: rng() < .45 ? 2 : 1,
        roof: rng() < .72 ? 'gable' : 'flat',
        palette,
      };
      blueprints.push(blueprint);
      remoteBuildingBlueprints.push(blueprint);
    }
    const cluster = {
      name: `track-settlement-${clusterIndex + 1}`,
      x: site.x,
      z: site.z,
      blueprints,
      lodGroup: null,
      detailedBuildings: [],
      detailed: false,
    };
    settlementClusters.push(cluster);
    createSettlementLod(cluster);
  }
}

function disposeBuilding(building) {
  for (const part of building.parts) {
    unregisterSimulationItem(part);
    if (part.body) world.removeBody(part.body);
    if (part.mesh?.parent) part.mesh.parent.remove(part.mesh);
    part.mesh?.geometry.dispose();
    const index = buildingParts.indexOf(part);
    if (index >= 0) buildingParts.splice(index, 1);
  }
  for (const block of building.foundation ?? []) {
    unregisterSimulationItem(block);
    if (block.body) world.removeBody(block.body);
    block.mesh?.geometry.dispose();
  }
  building.group.removeFromParent();
  unregisterVisualItem(building);
  const index = buildings.indexOf(building);
  if (index >= 0) buildings.splice(index, 1);
}

function setSettlementDetail(cluster, enabled) {
  if (enabled === cluster.detailed) return;
  if (enabled) {
    cluster.lodGroup.visible = false;
    cluster.detailedBuildings = cluster.blueprints.map(createBuilding);
  } else {
    for (const building of cluster.detailedBuildings) disposeBuilding(building);
    cluster.detailedBuildings = [];
    cluster.lodGroup.visible = true;
  }
  cluster.detailed = enabled;
}

function updateSettlementLod(anchor, force = false) {
  for (const cluster of settlementClusters) {
    const distance = Math.hypot(anchor.x - cluster.x, anchor.z - cluster.z);
    if (!cluster.detailed && (force ? distance < SETTLEMENT_LOD_ENTER_DISTANCE : distance < SETTLEMENT_LOD_ENTER_DISTANCE)) {
      setSettlementDetail(cluster, true);
    } else if (cluster.detailed && distance > SETTLEMENT_LOD_EXIT_DISTANCE) {
      setSettlementDetail(cluster, false);
    }
  }
}

function disposeSettlementLods() {
  for (const cluster of settlementClusters) {
    for (const building of cluster.detailedBuildings) {
      if (buildings.includes(building)) disposeBuilding(building);
    }
    cluster.detailedBuildings = [];
    cluster.lodGroup?.traverse((child) => { if (child.isMesh) child.geometry.dispose(); });
    if (cluster.lodGroup) scene.remove(cluster.lodGroup);
  }
  settlementClusters.length = 0;
}

function createBuilding(blueprint) {
  const group = new THREE.Group();
  group.name = blueprint.name;
  group.position.set(blueprint.x, terrain.surfaceY(blueprint.x, blueprint.z) + .08, blueprint.z);
  group.rotation.y = blueprint.rotation;
  scene.add(group);
  const building = registerVisualItem({ name: blueprint.name, group, parts: [], foundation: [], cullingRadius: Math.hypot(blueprint.width, blueprint.depth) * .62 + 4 }, 'building');
  building.entity.add('building', { blueprint });
  createBuildingFoundation(building, blueprint);
  const specs = createRectBuildingSpecs(blueprint);
  for (const spec of specs) createBuildingPart(building, spec);
  buildings.push(building);
  return building;
}

function createCityBuilding(blueprint) {
  const profile = cityBuildingProfiles[blueprint.type] ?? cityBuildingProfiles.residence;
  return createBuilding({
    ...blueprint,
    ...profile,
    name: `city-${blueprint.type}-${blueprint.id}`,
  });
}

function createBuildingFoundation(building, blueprint) {
  const height = Math.max(.9, Math.min(1.35, Math.max(blueprint.width, blueprint.depth) * .085 + .36));
  const topY = .04;
  const rim = .34;
  const blocks = [
    { name: 'front', size: [blueprint.width + .7, height, rim], position: [0, topY - height / 2, -blueprint.depth / 2 - rim / 2] },
    { name: 'back', size: [blueprint.width + .7, height, rim], position: [0, topY - height / 2, blueprint.depth / 2 + rim / 2] },
    { name: 'left', size: [rim, height, blueprint.depth + .7], position: [-blueprint.width / 2 - rim / 2, topY - height / 2, 0] },
    { name: 'right', size: [rim, height, blueprint.depth + .7], position: [blueprint.width / 2 + rim / 2, topY - height / 2, 0] },
  ];
  for (const block of blocks) {
    const size = new THREE.Vector3(...block.size);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), buildingMaterials.foundation);
    mesh.name = `${building.name}:grounding-${block.name}`;
    mesh.position.set(...block.position);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    building.group.add(mesh);
    building.group.updateMatrixWorld(true);

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    mesh.getWorldPosition(position);
    mesh.getWorldQuaternion(quaternion);
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(size.x * .5, size.y * .5, size.z * .5)),
    });
    body.position.set(position.x, position.y, position.z);
    body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    body.userData = { kind: 'buildingFoundation', building };
    world.addBody(body);
    building.foundation.push(registerSimulationItem({ mesh, body }));
  }
}

function createBuildingPart(building, spec) {
  const geometry = spec.geometry ?? new THREE.BoxGeometry(spec.size[0], spec.size[1], spec.size[2]);
  const mesh = new THREE.Mesh(geometry, spec.material);
  mesh.name = `${building.name}:${spec.name}`;
  mesh.position.set(...spec.position);
  mesh.rotation.set(...spec.rotation);
  mesh.castShadow = spec.castShadow;
  mesh.receiveShadow = true;
  mesh.userData.radius = Math.hypot(spec.size[0], spec.size[1], spec.size[2]) * .5;
  mesh.userData.bottomOffset = spec.size[1] * .5;
  building.group.add(mesh);
  building.group.updateMatrixWorld(true);

  const part = {
    building,
    mesh,
    size: new THREE.Vector3(...spec.size),
    material: spec.material,
    strength: spec.strength,
    impactThreshold: spec.strength + (spec.type === 'beam' ? 3 : 1.4),
    mass: spec.mass,
    brittle: spec.brittle,
    type: spec.type,
    castShadow: spec.castShadow,
    detached: false,
    destroyed: false,
    fractured: false,
    stillSince: null,
    lastDamageAt: 0,
  };
  const body = createBuildingBody(part, 0);
  part.body = body;
  registerSimulationItem(part);
  building.parts.push(part);
  buildingParts.push(part);
}

function createBuildingBody(part, mass) {
  part.mesh.updateMatrixWorld(true);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  part.mesh.getWorldPosition(position);
  part.mesh.getWorldQuaternion(quaternion);
  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Box(new CANNON.Vec3(part.size.x * .5, part.size.y * .5, part.size.z * .5)),
    linearDamping: mass > 0 ? .12 : 0,
    angularDamping: mass > 0 ? .28 : 0,
    allowSleep: mass > 0,
    sleepSpeedLimit: .18,
    sleepTimeLimit: .7,
  });
  body.position.set(position.x, position.y, position.z);
  body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  body.userData = { kind: 'buildingPart', part };
  body.addEventListener('collide', (event) => handleBuildingPartCollision(part, event.body));
  world.addBody(body);
  return body;
}

function populateBuildings() {
  const createSettlements = () => {
    buildingBlueprints.forEach(createBuilding);
    createTrackSettlements();
    updateSettlementLod(terrainStreamAnchor(), true);
    return {
      get plan() { return { buildings: [...buildingBlueprints, ...remoteBuildingBlueprints] }; },
      update(_delta, anchor) { updateSettlementLod(anchor); },
      dispose() {
        disposeBuildings();
        disposeSettlementLods();
      },
    };
  };
  city = plugins.activate('city', 'city', features.cityPlugin, {
    ecs,
    scene,
    terrain,
    seed,
    size: features.citySize,
    createBuilding: createCityBuilding,
    disposeBuilding,
    createSettlements,
  }).api;
}

function bodySpeed(body) {
  return body?.velocity ? Math.hypot(body.velocity.x, body.velocity.y, body.velocity.z) : 0;
}

function isKineticBuildingImpact(body) {
  const kind = body?.userData?.kind;
  return kind === 'car' || kind === 'debris' || kind === 'buildingPart' || kind === 'dynamicProp';
}

function impactEnergy(body, speed) {
  return .5 * Math.max(0, body?.mass ?? 0) * speed * speed;
}

function markExplosiveMomentum(body) {
  if (body?.userData) body.userData.explosiveUntil = performance.now() + 650;
}

function handleBuildingPartCollision(part, otherBody) {
  if (part.destroyed || !isKineticBuildingImpact(otherBody)) return;
  const now = performance.now();
  if (now - part.lastDamageAt < 130) return;
  // The contact callback runs after Cannon has resolved the static wall contact.
  // Keep the pre-solve vehicle velocity so a break is judged from the actual hit,
  // and so the buggy can carry through the newly opened gap.
  const recordedVelocity = otherBody.userData?.impactVelocity;
  const impactVelocity = recordedVelocity
    ? new THREE.Vector3(recordedVelocity.x, recordedVelocity.y, recordedVelocity.z)
    : new THREE.Vector3(otherBody.velocity?.x ?? 0, otherBody.velocity?.y ?? 0, otherBody.velocity?.z ?? 0);
  impactVelocity.sub(new THREE.Vector3(part.body.velocity.x, part.body.velocity.y, part.body.velocity.z));
  const speed = impactVelocity.length();
  // A light fragment needs much more speed than the buggy to break a wall.
  // This admits meaningful kinetic hits without letting ordinary rubble chain
  // through a building.
  const requiredEnergy = part.strength * 22;
  const energy = impactEnergy(otherBody, speed);
  if (speed < 3.5 || energy < requiredEnergy) return;
  part.lastDamageAt = now;
  const center = new THREE.Vector3().copy(otherBody.position ?? part.body.position);
  const direction = speed > .001 ? impactVelocity.multiplyScalar(1 / speed) : null;
  pendingBuildingImpacts.push({
    part,
    center,
    speed,
    direction,
    otherBody,
    now,
    crumble: true,
    // Blast energy only affects a brief, genuinely high-energy collision window;
    // a tagged part that has already settled fractures like ordinary rubble.
    explosive: now < (otherBody.userData?.explosiveUntil ?? 0) && energy >= requiredEnergy * 1.35,
  });
}

function processBuildingImpacts() {
  if (!pendingBuildingImpacts.length) return;
  const impacts = pendingBuildingImpacts.splice(0, pendingBuildingImpacts.length);
  for (const { part, center, speed, direction, otherBody, crumble, explosive } of impacts) {
    if (part.destroyed) continue;
    if (performance.now() - part.lastDamageAt > 900) continue;
    applyBuildingImpact(part, center, speed, { crumble, direction, otherBody, explosive });
  }
}

function applyBuildingImpact(part, center, speed, options = {}) {
  if (options.crumble) {
    const crumbleStrength = Math.max(2.2, speed * .2);
    const shardOptions = options.explosive
      ? { explosive: true }
      : { ...CRUMBLE_SHARD_OPTIONS, direction: options.direction, ignoreBody: options.otherBody };
    fractureBuildingPart(part, center, crumbleStrength, shardOptions);
    carryVehicleThroughBreak(options.otherBody, options.direction, speed);
    return;
  }
  if (part.type === 'roof' || part.type === 'floor') {
    fractureBuildingPart(part, center, speed * .6);
    damageBuildingAtPoint(center, speed * .24, part.building, part);
    triggerScreenShake(THREE.MathUtils.clamp(speed / 65, .06, .24), .14);
    return;
  }
  if (part.detached) {
    if (speed > part.impactThreshold + 4 || part.brittle) fractureBuildingPart(part, center, speed * .55);
    return;
  }
  detachBuildingPart(part, center, speed);
  damageBuildingAtPoint(center, speed * .32, part.building, part);
  if (speed > part.impactThreshold + 5 || part.brittle) fractureBuildingPart(part, center, speed * .45);
  triggerScreenShake(THREE.MathUtils.clamp(speed / 55, .08, .32), .18);
}

function carryVehicleThroughBreak(body, direction, impactSpeed) {
  if (body?.userData?.kind !== 'car' || !direction) return;
  const now = performance.now();
  // A single bumper can touch several adjacent pieces in one simulation step.
  // Only compensate once, otherwise each break would add another full impulse.
  if (now - (body.userData.lastBuildingBreakAt ?? 0) < 90) return;
  body.userData.lastBuildingBreakAt = now;
  const forwardSpeed = body.velocity.x * direction.x + body.velocity.y * direction.y + body.velocity.z * direction.z;
  const carrySpeed = impactSpeed * .58;
  if (forwardSpeed >= carrySpeed) return;
  const impulse = (carrySpeed - forwardSpeed) * body.mass;
  body.applyImpulse(new CANNON.Vec3(direction.x * impulse, direction.y * impulse, direction.z * impulse));
}

function detachBuildingPart(part, center, strength = 8) {
  if (part.destroyed || part.detached) return;
  const worldPosition = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();
  part.mesh.getWorldPosition(worldPosition);
  part.mesh.getWorldQuaternion(worldQuaternion);
  scene.attach(part.mesh);
  unregisterSimulationItem(part);
  world.removeBody(part.body);
  part.detached = true;
  part.body = createBuildingBody(part, Math.max(.25, part.mass));
  registerSimulationItem(part);
  part.body.position.set(worldPosition.x, worldPosition.y, worldPosition.z);
  part.body.quaternion.set(worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w);
  const out = worldPosition.clone().sub(center).normalize();
  if (out.lengthSq() < .001) out.set((Math.random() - .5), .35 + Math.random() * .5, (Math.random() - .5)).normalize();
  out.y += .2 + Math.random() * .26;
  out.normalize();
  const impulse = Math.max(2.4, strength * (.32 + Math.random() * .22));
  part.body.velocity.x += out.x * impulse;
  part.body.velocity.y += out.y * impulse;
  part.body.velocity.z += out.z * impulse;
  part.body.angularVelocity.set((Math.random() - .5) * strength * .28, (Math.random() - .5) * strength * .34, (Math.random() - .5) * strength * .28);
}

function damageBuildingAtPoint(center, strength, sourceBuilding = null, primaryPart = null, options = {}) {
  const candidates = [];
  for (const part of buildingParts) {
    if (part.destroyed || part === primaryPart) continue;
    if (sourceBuilding && part.building !== sourceBuilding) continue;
    const position = new THREE.Vector3().copy(part.body.position);
    const partRadius = part.mesh.userData.radius ?? .8;
    const distance = position.distanceTo(center);
    const reach = 1.4 + strength * .28 + partRadius * .45;
    if (distance <= reach) candidates.push({ part, distance, partRadius });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const limit = Math.min(options.crumble ? 3 : 5, candidates.length);
  for (let i = 0; i < limit; i++) {
    const { part, distance } = candidates[i];
    const falloff = THREE.MathUtils.clamp(1 - distance / Math.max(1, 1.4 + strength * .28), .12, 1);
    const roll = falloff * strength + (part.brittle ? 2 : 0);
    if (options.crumble) {
      const shardOptions = options.explosive
        ? { explosive: true }
        : { ...CRUMBLE_SHARD_OPTIONS, direction: options.direction, ignoreBody: options.ignoreBody };
      if (roll > part.strength * .72) fractureBuildingPart(part, center, strength * falloff, shardOptions);
      continue;
    }
    if ((part.type === 'roof' || part.type === 'floor') && roll > part.strength * .65) {
      fractureBuildingPart(part, center, strength * falloff, options.explosive ? { explosive: true } : {});
      continue;
    }
    if (!part.detached && roll > part.strength * (.82 + Math.random() * .45)) {
      detachBuildingPart(part, center, strength * falloff);
      if (options.explosive) markExplosiveMomentum(part.body);
    }
    if ((part.detached || part.brittle) && roll > part.strength * 1.35 && Math.random() < .55) fractureBuildingPart(part, center, strength * falloff, options.explosive ? { explosive: true } : {});
  }
}

function damageBuildings(center, radius) {
  const blastCenter = center.clone();
  const candidates = [];
  for (const part of buildingParts) {
    if (part.destroyed) continue;
    const position = new THREE.Vector3().copy(part.body.position);
    const partRadius = part.mesh.userData.radius ?? .7;
    const distance = position.distanceTo(blastCenter);
    if (distance <= radius + partRadius) candidates.push({ part, position, distance, partRadius });
  }
  candidates.sort((a, b) => a.distance - b.distance);
  for (const { part, distance, partRadius } of candidates.slice(0, 28)) {
    const falloff = THREE.MathUtils.clamp(1 - distance / Math.max(radius + partRadius, .001), .08, 1);
    const strength = 4 + falloff * 13;
    if (part.detached) {
      markExplosiveMomentum(part.body);
      const out = new THREE.Vector3().copy(part.body.position).sub(blastCenter).normalize();
      part.body.velocity.x += out.x * strength;
      part.body.velocity.y += Math.max(.6, out.y + .35) * strength;
      part.body.velocity.z += out.z * strength;
      if (falloff > .48 || part.brittle) fractureBuildingPart(part, blastCenter, strength, { explosive: true });
    } else if (strength > part.strength * (.72 + Math.random() * .38)) {
      if (part.type === 'roof' || part.type === 'floor') {
        fractureBuildingPart(part, blastCenter, strength, { explosive: true });
        damageBuildingAtPoint(part.body.position, strength * .3, part.building, part, { explosive: true });
        continue;
      }
      detachBuildingPart(part, blastCenter, strength);
      markExplosiveMomentum(part.body);
      if (falloff > .62 || (part.brittle && falloff > .32)) fractureBuildingPart(part, blastCenter, strength, { explosive: true });
      damageBuildingAtPoint(part.body.position, strength * .42, part.building, part, { explosive: true });
    }
  }
}

function createStructuralShardGeometry(radius, sourceSize) {
  const type = Math.floor(Math.random() * 4);
  let geometry;
  if (type === 0) geometry = createDebrisGeometry(radius);
  else if (type === 1) geometry = new THREE.BoxGeometry(radius * (1.4 + Math.random()), radius * (.45 + Math.random() * .85), radius * (.75 + Math.random()));
  else if (type === 2) geometry = new THREE.ConeGeometry(radius * .62, radius * (1.3 + Math.random() * .7), 5);
  else geometry = new THREE.TetrahedronGeometry(radius * 1.1, 0);
  geometry.rotateX(Math.random() * Math.PI);
  geometry.rotateY(Math.random() * Math.PI);
  geometry.rotateZ(Math.random() * Math.PI);
  if (sourceSize) geometry.scale(
    THREE.MathUtils.clamp(sourceSize.x / Math.max(sourceSize.z, .1), .65, 1.75),
    1,
    THREE.MathUtils.clamp(sourceSize.z / Math.max(sourceSize.x, .1), .65, 1.75),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

function spawnBuildingShard(position, center, material, sourceSize, strength = 8, options = {}) {
  if (debris.length >= MAX_DEBRIS_BODIES) return;
  const radius = THREE.MathUtils.clamp(.14 + Math.random() * .32 + Math.cbrt(sourceSize.x * sourceSize.y * sourceSize.z) * .035, .14, .58);
  const geometry = createStructuralShardGeometry(radius, sourceSize);
  const mesh = new THREE.Mesh(geometry, material);
  const scatterScale = options.scatterScale ?? 1;
  // Spawn close to the source surface. The velocity below, rather than a large
  // initial offset, supplies the visible energy for both impacts and explosions.
  const spawnScatterScale = options.spawnScatterScale ?? .2;
  mesh.position.copy(position).add(new THREE.Vector3((Math.random() - .5) * .8 * spawnScatterScale, (Math.random() - .5) * .4 * spawnScatterScale, (Math.random() - .5) * .8 * spawnScatterScale));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.radius = Math.max(radius, geometry.boundingSphere?.radius ?? radius);
  mesh.userData.bottomOffset = Math.max(.08, -(geometry.boundingBox?.min.y ?? -radius));
  scene.add(mesh);
  const body = new CANNON.Body({ mass: .18 + radius * 1.2, shape: new CANNON.Sphere(mesh.userData.radius), linearDamping: .11, angularDamping: .16, allowSleep: true, sleepSpeedLimit: .2, sleepTimeLimit: .8 });
  body.position.copy(mesh.position);
  body.userData = { kind: 'debris' };
  if (options.explosive) markExplosiveMomentum(body);
  const upwardBias = options.upwardBias ?? .45;
  const upwardRange = options.upwardRange ?? .65;
  const radial = mesh.position.clone().sub(center).normalize();
  const impactDirection = options.direction?.clone?.();
  const baseDirection = impactDirection?.lengthSq() ? impactDirection.normalize().lerp(radial, 1 - (options.directionBias ?? 0)) : radial;
  const out = baseDirection.add(new THREE.Vector3((Math.random() - .5) * .55 * scatterScale, upwardBias + Math.random() * upwardRange, (Math.random() - .5) * .55 * scatterScale)).normalize();
  const impulseScale = options.impulseScale ?? 1;
  body.velocity.set(out.x * ((options.baseSpeed ?? 5) + strength * .52) * impulseScale, out.y * ((options.verticalBase ?? 4) + strength * .58) * impulseScale, out.z * ((options.baseSpeed ?? 5) + strength * .52) * impulseScale);
  const spinScale = options.spinScale ?? 1;
  body.angularVelocity.set(Math.random() * 10 * spinScale, Math.random() * 10 * spinScale, Math.random() * 10 * spinScale);
  if (options.ignoreBody?.userData?.kind === 'car' && options.collisionGraceMs) {
    // Fresh fragments start inside the collision footprint of the wall.  Let them
    // leave it before they become solid so they cannot kick the buggy backward.
    body.collisionResponse = false;
    body.userData.activateCollisionAt = performance.now() + options.collisionGraceMs;
  }
  world.addBody(body);
  debris.push(registerSimulationItem({ mesh, body, stillSince: null, mergeToTerrain: false, lastImpactAt: 0, rollingResistance: CHIP_ROLLING_RESISTANCE }));
}

function fractureBuildingPart(part, center, strength = 8, options = {}) {
  if (part.destroyed || part.fractured) return;
  // High fragment velocity is reserved for damage created by explode().
  const shardOptions = options.explosive ? options : { ...CRUMBLE_SHARD_OPTIONS, ...options };
  part.fractured = true;
  part.destroyed = true;
  const position = new THREE.Vector3().copy(part.body.position);
  const quaternion = new THREE.Quaternion(part.body.quaternion.x, part.body.quaternion.y, part.body.quaternion.z, part.body.quaternion.w);
  const volume = part.size.x * part.size.y * part.size.z;
  const slab = part.type === 'roof' || part.type === 'floor';
  const count = Math.min(MAX_BUILDING_SHARDS, Math.max(slab ? 8 : 4, Math.round(Math.sqrt(volume) * (slab ? 4.6 : part.brittle ? 3.2 : 2.2))));
  for (let i = 0; i < count; i++) {
    const shardPosition = position.clone();
    if (slab) {
      const panelScatterScale = shardOptions.panelScatterScale ?? 1;
      const offset = new THREE.Vector3((Math.random() - .5) * part.size.x * .82 * panelScatterScale, (Math.random() - .5) * part.size.y, (Math.random() - .5) * part.size.z * .82 * panelScatterScale).applyQuaternion(quaternion);
      shardPosition.add(offset);
    }
    spawnBuildingShard(shardPosition, center, part.material, part.size, strength, shardOptions);
  }
  if (part.mesh.parent) part.mesh.parent.remove(part.mesh);
  else scene.remove(part.mesh);
  unregisterSimulationItem(part);
  world.removeBody(part.body);
  part.mesh.geometry.dispose();
}

function updateBuildingParts(delta, now) {
  for (let i = buildingParts.length - 1; i >= 0; i--) {
    const part = buildingParts[i];
    if (part.destroyed) {
      unregisterSimulationItem(part);
      buildingParts.splice(i, 1);
      continue;
    }
    if (!part.simulationActive) continue;
    if (!part.detached) continue;
    part.mesh.position.copy(part.body.position);
    part.mesh.quaternion.copy(part.body.quaternion);
    const radius = part.mesh.userData.radius ?? .8;
    const collision = terrain.sphereCollision(part.body.position, radius);
    if (collision) {
      const speed = bodySpeed(part.body);
      applyTerrainContact(part, collision, now);
      if ((part.brittle && speed > 6.4) || speed > part.impactThreshold + 3.2) fractureBuildingPart(part, new THREE.Vector3().copy(part.body.position), speed);
    }
    const grounded = !!collision && collision.normal.y > .45;
    const slow = grounded && part.body.velocity.lengthSquared() < .12 && part.body.angularVelocity.lengthSquared() < .24;
    if (slow) part.stillSince ??= now; else part.stillSince = null;
    if (part.body.position.y < -7) {
      scene.remove(part.mesh);
      unregisterSimulationItem(part);
      world.removeBody(part.body);
      part.mesh.geometry.dispose();
      part.destroyed = true;
      buildingParts.splice(i, 1);
    }
  }
}

function disposeBuildings() {
  for (const building of [...buildings]) disposeBuilding(building);
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

function addTopPivotLimb(group, geometry, material, topPosition, length, rotation = [0, 0, 0]) {
  geometry.translate(0, -length / 2, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return addPart(group, geometry, material, topPosition, [1, 1, 1], rotation);
}

function createActorState(type, x, z, rotation, variant, parts, bodyOffsetY, radius) {
  const speed = type === 'camel' ? .85 : 1.15;
  return {
    state: 'walking',
    parts,
    bodyOffsetY,
    radius,
    visualYawOffset: type === 'camel' ? -Math.PI / 2 : 0,
    home: new THREE.Vector3(x, 0, z),
    heading: rotation,
    targetHeading: rotation + (Math.random() - .5) * .8,
    speed: speed * (.78 + (variant % 5) * .08),
    phase: variant * 1.9,
    nextTurnAt: performance.now() + 900 + Math.random() * 2400,
    knockedAt: 0,
    stillSince: null,
    recoverStartedAt: 0,
    recoverFromPosition: new THREE.Vector3(),
    recoverFromQuaternion: new THREE.Quaternion(),
    annoyanceUntil: 0,
  };
}

function updateActorsPreStep(delta, now) {
  for (const prop of props) {
    if (!prop.simulationActive || !prop.actor) continue;
    if (prop.actor.state === 'walking' || prop.actor.state === 'annoyed') updateActorIntent(prop, delta, now);
    else if (prop.actor.state === 'recovering') lockActorUpright(prop);
  }
}

function updateActorsPostStep(delta, now) {
  for (const prop of props) {
    if (!prop.simulationActive || !prop.actor) continue;
    if (prop.actor.state === 'walking' || prop.actor.state === 'annoyed') {
      maybeKnockActorFromCar(prop, now);
      if (isActorTipped(prop)) knockActor(prop, actorForward(prop).multiplyScalar(-1), 2.4, now);
      syncUprightActorVisual(prop);
    } else if (prop.actor.state === 'knocked') {
      updateKnockedActor(prop, now);
      syncKnockedActorVisual(prop);
    } else if (prop.actor.state === 'recovering') {
      updateRecoveringActor(prop, now);
    }
    if (prop.group.visible) animateActorParts(prop, delta, now);
  }
}

function updateActorIntent(prop, delta, now) {
  const actor = prop.actor;
  const body = prop.body;
  const annoyed = actor.state === 'annoyed';
  if (!annoyed) {
    if (now > actor.nextTurnAt) {
      const drift = new THREE.Vector3(body.position.x - actor.home.x, 0, body.position.z - actor.home.z);
      actor.targetHeading = drift.length() > 12
        ? Math.atan2(drift.x, drift.z) + Math.PI
        : actor.heading + (Math.random() - .5) * 1.4;
      actor.nextTurnAt = now + 1200 + Math.random() * 2600;
    }
    actor.heading = THREE.MathUtils.lerp(actor.heading, actor.targetHeading, 1 - Math.exp(-delta * 1.6));
  } else if (now > actor.annoyanceUntil) {
    actor.state = 'walking';
    actor.nextTurnAt = now + 400 + Math.random() * 1200;
  }

  const speed = annoyed ? 0 : actor.speed;
  const forward = actorForward(prop);
  body.position.y = terrain.surfaceY(body.position.x, body.position.z) + actor.bodyOffsetY;
  body.velocity.set(forward.x * speed, 0, forward.z * speed);
  body.angularVelocity.set(0, 0, 0);
  body.quaternion.setFromEuler(0, actor.heading, 0);
}

function lockActorUpright(prop) {
  const actor = prop.actor;
  prop.body.position.y = terrain.surfaceY(prop.body.position.x, prop.body.position.z) + actor.bodyOffsetY;
  prop.body.velocity.set(0, 0, 0);
  prop.body.angularVelocity.set(0, 0, 0);
  prop.body.quaternion.setFromEuler(0, actor.heading, 0);
}

function actorForward(prop) {
  return new THREE.Vector3(Math.sin(prop.actor.heading), 0, Math.cos(prop.actor.heading)).normalize();
}

function maybeKnockActorFromCar(prop, now) {
  if (!duneBuggy.alive || prop.actor.state === 'knocked') return;
  const dx = prop.body.position.x - duneBuggy.body.position.x;
  const dz = prop.body.position.z - duneBuggy.body.position.z;
  const dy = Math.abs(prop.body.position.y - duneBuggy.body.position.y);
  const reach = prop.actor.radius + 1.25;
  if (dx * dx + dz * dz > reach * reach || dy > 2.4) return;
  const carSpeed = Math.hypot(duneBuggy.body.velocity.x, duneBuggy.body.velocity.z);
  const actorSpeed = Math.hypot(prop.body.velocity.x, prop.body.velocity.z);
  const impactSpeed = carSpeed - actorSpeed * .35;
  if (impactSpeed < 2.15) return;
  const direction = new THREE.Vector3(duneBuggy.body.velocity.x, 0, duneBuggy.body.velocity.z);
  if (direction.lengthSq() < .01) direction.set(dx, 0, dz);
  knockActor(prop, direction.normalize(), impactSpeed, now);
}

function isActorTipped(prop) {
  const up = new CANNON.Vec3(0, 1, 0);
  prop.body.quaternion.vmult(up, up);
  return up.y < .55 || prop.body.velocity.lengthSquared() > 10;
}

function knockActor(prop, direction, strength, now) {
  const actor = prop.actor;
  if (!actor || actor.state === 'knocked') return;
  actor.state = 'knocked';
  actor.knockedAt = now;
  actor.stillSince = null;
  prop.body.wakeUp();
  const impulse = THREE.MathUtils.clamp(strength, 2.2, 9.5);
  prop.body.velocity.x += direction.x * impulse * .9;
  prop.body.velocity.y += 2.2 + impulse * .18;
  prop.body.velocity.z += direction.z * impulse * .9;
  prop.body.angularVelocity.set((Math.random() - .5) * 5.8, (Math.random() - .5) * 2.2, (Math.random() - .5) * 5.8);
  playActorVoice(prop, 'knocked', prop.body.position, now);
}

function updateKnockedActor(prop, now) {
  const actor = prop.actor;
  const collision = terrain.sphereCollision(prop.body.position, actor.radius * .72, -1);
  if (collision) applyTerrainContact(prop, collision, now);
  const grounded = !!collision && collision.normal.y > .35;
  const slow = grounded && prop.body.velocity.lengthSquared() < .18 && prop.body.angularVelocity.lengthSquared() < .22;
  if (slow && now - actor.knockedAt > 900) actor.stillSince ??= now;
  else actor.stillSince = null;
  if (actor.stillSince && now - actor.stillSince > 1650) startActorRecovery(prop, now);
}

function startActorRecovery(prop, now) {
  const actor = prop.actor;
  actor.state = 'recovering';
  actor.recoverStartedAt = now;
  actor.recoverFromPosition.copy(prop.group.position);
  actor.recoverFromQuaternion.copy(prop.group.quaternion);
  actor.heading = Math.atan2(Math.sin(actor.heading), Math.cos(actor.heading));
  prop.body.velocity.set(0, 0, 0);
  prop.body.angularVelocity.set(0, 0, 0);
}

function updateRecoveringActor(prop, now) {
  const actor = prop.actor;
  const progress = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp((now - actor.recoverStartedAt) / 950, 0, 1), 0, 1);
  const surface = terrain.surfaceY(prop.body.position.x, prop.body.position.z);
  const standPosition = new THREE.Vector3(prop.body.position.x, surface, prop.body.position.z);
  const standQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, actor.heading, 0));
  prop.group.position.copy(actor.recoverFromPosition).lerp(standPosition, progress);
  const visualStandQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, actor.heading + actor.visualYawOffset, 0));
  prop.group.quaternion.copy(actor.recoverFromQuaternion).slerp(visualStandQuaternion, progress);
  prop.body.position.y = surface + actor.bodyOffsetY;
  prop.body.quaternion.setFromEuler(0, actor.heading, 0);
  if (progress >= 1) {
    actor.state = 'annoyed';
    actor.annoyanceUntil = now + 1900 + Math.random() * 700;
    playActorVoice(prop, 'annoyed', prop.body.position, now);
  }
}

function syncUprightActorVisual(prop) {
  const actor = prop.actor;
  const surface = terrain.surfaceY(prop.body.position.x, prop.body.position.z);
  prop.group.position.set(prop.body.position.x, surface, prop.body.position.z);
  prop.group.quaternion.setFromEuler(new THREE.Euler(0, actor.heading + actor.visualYawOffset, 0));
}

function syncKnockedActorVisual(prop) {
  const offset = new THREE.Vector3(0, -prop.actor.bodyOffsetY, 0).applyQuaternion(prop.body.quaternion);
  prop.group.position.set(
    prop.body.position.x + offset.x,
    prop.body.position.y + offset.y,
    prop.body.position.z + offset.z,
  );
  prop.group.quaternion.copy(prop.body.quaternion);
}

function animateActorParts(prop, delta, now) {
  const actor = prop.actor;
  actor.phase += delta * (actor.state === 'walking' ? 6.5 * actor.speed : actor.state === 'annoyed' ? 9 : 2.5);
  const walk = actor.state === 'walking' ? Math.sin(actor.phase) : 0;
  const annoyed = actor.state === 'annoyed';
  if (prop.type === 'person') animatePerson(prop, walk, annoyed, now);
  else animateCamel(prop, walk, annoyed, now);
}

function animatePerson(prop, walk, annoyed, now) {
  const { head, torso, arms = [], legs = [] } = prop.actor.parts;
  if (head) head.rotation.set(0, annoyed ? Math.sin(now * .012) * .55 : 0, annoyed ? Math.sin(now * .018) * .28 : 0);
  if (torso) torso.rotation.set(annoyed ? Math.sin(now * .016) * .08 : 0, 0, annoyed ? Math.sin(now * .019) * .08 : 0);
  legs.forEach((leg, index) => { leg.rotation.x = walk * (index ? -.55 : .55); leg.rotation.z = 0; });
  arms.forEach((arm, index) => {
    arm.rotation.x = annoyed ? Math.sin(now * .021 + index * Math.PI) * .65 : -walk * (index ? -.42 : .42);
    arm.rotation.z = (index ? .35 : -.35) + (annoyed ? Math.sin(now * .017 + index) * .48 : 0);
  });
}

function animateCamel(prop, walk, annoyed, now) {
  const { body, neck, head, legs = [] } = prop.actor.parts;
  if (body) body.rotation.z = annoyed ? Math.sin(now * .011) * .06 : 0;
  if (neck) neck.rotation.set(0, 0, -.48 + (annoyed ? Math.sin(now * .013) * .28 : Math.sin(prop.actor.phase * .5) * .05));
  if (head) head.rotation.set(0, annoyed ? Math.sin(now * .016) * .45 : 0, annoyed ? Math.sin(now * .014) * .2 : 0);
  legs.forEach((leg, index) => {
    const pair = index < 2 ? 1 : -1;
    leg.rotation.x = 0;
    leg.rotation.z = walk * pair * .32 + (annoyed && index < 2 ? Math.abs(Math.sin(now * .018)) * .22 : 0);
  });
}

function createProp(type, x, z, rotation = 0, variant = 0) {
  const group = new THREE.Group();
  group.position.set(x, terrain.surfaceY(x, z), z);
  group.rotation.y = rotation;
  let halfExtents = new CANNON.Vec3(1.2, 1.2, 1.2);
  let bodyOffsetY = halfExtents.y;
  let blastRadius = 2;
  const actorParts = {};
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
    actorParts.body = addPart(group, new THREE.SphereGeometry(.62, 9, 6), propMaterials.camel, [0, 1.05, 0], [1.55, .7, .58]);
    actorParts.humps = [
      addPart(group, new THREE.SphereGeometry(.38, 8, 5), propMaterials.camel, [-.28, 1.58, 0], [.8, .95, .7]),
      addPart(group, new THREE.SphereGeometry(.34, 8, 5), propMaterials.camel, [.42, 1.54, 0], [.78, .9, .7]),
    ];
    actorParts.neck = addPart(group, new THREE.CylinderGeometry(.12, .16, .95, 6), propMaterials.camel, [1.04, 1.48, 0], [1, 1, 1], [0, 0, -.48]);
    actorParts.head = addPart(group, new THREE.SphereGeometry(.27, 8, 5), propMaterials.camel, [1.38, 1.84, 0], [1.15, .78, .72]);
    actorParts.legs = [];
    for (const leg of [[-.68, .86, -.3], [-.68, .86, .3], [.72, .86, -.3], [.72, .86, .3]]) {
      actorParts.legs.push(addTopPivotLimb(group, new THREE.CylinderGeometry(.08, .1, .9, 5), propMaterials.camel, leg, .9));
    }
    halfExtents = new CANNON.Vec3(1.45, 1.05, .65); bodyOffsetY = .95; blastRadius = 2.2;
  } else {
    const cloth = propMaterials.personCloth[variant % propMaterials.personCloth.length];
    actorParts.head = addPart(group, new THREE.SphereGeometry(.18, 8, 6), propMaterials.person, [0, 1.38, 0]);
    actorParts.torso = addPart(group, new THREE.BoxGeometry(.34, .62, .2), cloth, [0, .91, 0]);
    actorParts.legs = [
      addTopPivotLimb(group, new THREE.CylinderGeometry(.045, .055, .55, 5), propMaterials.person, [-.1, .62, 0], .55),
      addTopPivotLimb(group, new THREE.CylinderGeometry(.045, .055, .55, 5), propMaterials.person, [.1, .62, 0], .55),
    ];
    actorParts.arms = [
      addTopPivotLimb(group, new THREE.CylinderGeometry(.04, .045, .46, 5), propMaterials.person, [-.21, 1.16, 0], .46, [0, 0, -.35]),
      addTopPivotLimb(group, new THREE.CylinderGeometry(.04, .045, .46, 5), propMaterials.person, [.21, 1.16, 0], .46, [0, 0, .35]),
    ];
    halfExtents = new CANNON.Vec3(.35, .8, .3); bodyOffsetY = .78; blastRadius = 1.2;
  }
  scene.add(group);
  const isActor = type === 'person' || type === 'camel';
  const isDynamicProp = type === 'car';
  const body = new CANNON.Body({
    mass: isActor ? (type === 'camel' ? 2.4 : .82) : isDynamicProp ? 2.8 : 0,
    shape: new CANNON.Box(halfExtents),
    linearDamping: isActor ? .24 : isDynamicProp ? .12 : 0,
    angularDamping: isActor ? .34 : isDynamicProp ? .28 : 0,
    allowSleep: !isActor,
    sleepSpeedLimit: isDynamicProp ? .18 : undefined,
    sleepTimeLimit: isDynamicProp ? .65 : undefined,
  });
  body.position.set(x, group.position.y + bodyOffsetY, z);
  body.quaternion.setFromEuler(0, rotation, 0);
  body.userData = { kind: isActor ? 'actor' : isDynamicProp ? 'dynamicProp' : 'prop', type };
  world.addBody(body);
  group.userData.radius = Math.max(halfExtents.x, halfExtents.y, halfExtents.z);
  const prop = registerSimulationItem({ type, group, mesh: group, body, blastRadius, bodyOffsetY, dynamic: isDynamicProp, dynamicRadius: isDynamicProp ? .78 : group.userData.radius, lastImpactAt: 0, lastVoiceAt: 0 });
  if (isActor) prop.actor = createActorState(type, x, z, rotation, variant, actorParts, bodyOffsetY, group.userData.radius);
  props.push(prop);
}

function populateProps() {
  if (features.city) return;
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
  body.userData = { kind: 'debris' };
  body.position.copy(position);
  const out = position.clone().sub(center).normalize().add(new THREE.Vector3((Math.random()-.5)*.6, .6 + Math.random()*.6, (Math.random()-.5)*.6)).normalize();
  body.velocity.set(out.x * (5 + Math.random()*7), out.y * (5 + Math.random()*8), out.z * (5 + Math.random()*7));
  body.angularVelocity.set(Math.random()*8, Math.random()*8, Math.random()*8);
  world.addBody(body);
  debris.push(registerSimulationItem({ mesh, body, stillSince: null, mergeToTerrain: false, lastImpactAt: 0, rollingResistance: CHIP_ROLLING_RESISTANCE }));
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
  unregisterSimulationItem(prop);
  world.removeBody(prop.body);
}

function explodeProps(center, radius) {
  for (let i = props.length - 1; i >= 0; i--) {
    const prop = props[i];
    if (!prop.simulationActive) continue;
    const distance = prop.group.position.distanceTo(center);
    if (distance <= radius + prop.blastRadius) {
      explodeProp(prop, center);
      props.splice(i, 1);
    }
  }
}

function syncDynamicPropVisual(prop) {
  const offset = new THREE.Vector3(0, -prop.bodyOffsetY, 0).applyQuaternion(prop.body.quaternion);
  prop.group.position.set(
    prop.body.position.x + offset.x,
    prop.body.position.y + offset.y,
    prop.body.position.z + offset.z,
  );
  prop.group.quaternion.copy(prop.body.quaternion);
}

function updateDynamicProps(now) {
  for (const prop of props) {
    if (!prop.simulationActive || !prop.dynamic) continue;
    const collision = terrain.sphereCollision(prop.body.position, prop.dynamicRadius, -1);
    if (collision) applyTerrainContact(prop, collision, now);
    if (!collision && prop.body.sleepState === CANNON.Body.SLEEPING) prop.body.wakeUp();
    syncDynamicPropVisual(prop);
  }
}

function crashThroughProps(now) {
  if (!duneBuggy.alive) return;
  const carSpeed = Math.hypot(duneBuggy.body.velocity.x, duneBuggy.body.velocity.z);
  if (carSpeed < 3.4) return;
  for (let i = props.length - 1; i >= 0; i--) {
    const prop = props[i];
    if (!prop.simulationActive) continue;
    if (prop.type !== 'palm' && prop.type !== 'rainbow') continue;
    const dx = prop.body.position.x - duneBuggy.body.position.x;
    const dz = prop.body.position.z - duneBuggy.body.position.z;
    const reach = prop.blastRadius + 1.05;
    if (dx * dx + dz * dz > reach * reach) continue;
    if (now - (prop.lastCrashAt ?? 0) < 400) continue;
    prop.lastCrashAt = now;
    const center = new THREE.Vector3().copy(duneBuggy.body.position);
    explodeProp(prop, center);
    props.splice(i, 1);
    triggerScreenShake(prop.type === 'rainbow' ? .26 : .18, .18);
  }
}

function updatePhysics(delta, now) {
  simulationChunks.update(terrainStreamAnchor());
  city?.update(delta, terrainStreamAnchor());
  updateActorsPreStep(delta, now);
  duneBuggy.updatePhysics(delta, now, controlMode === 'car');
  if (duneBuggy.alive) duneBuggy.body.userData.impactVelocity = duneBuggy.body.velocity.clone();
  world.step(1 / 60, delta, 3);
  processBuildingImpacts();
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const item = projectiles[i]; if (item.exploded) { projectiles.splice(i, 1); continue; }
    item.mesh.position.copy(item.body.position); item.mesh.quaternion.copy(item.body.quaternion);
    // Voxel terrain collision is sampled locally; Cannon handles debris/floor dynamics.
    const gx = terrain.worldToGrid(item.body.position.x), gy = terrain.worldToGrid(item.body.position.y), gz = terrain.worldToGrid(item.body.position.z);
    const hitCar = duneBuggy.alive && item.body.position.distanceTo(duneBuggy.body.position) < 2.15;
    if (item.pendingExplosion || hitCar || terrain.has(gx, gy, gz) || terrain.sphereCollision(item.body.position, .42) || now - item.born > 6500) explode(item);
  }
  duneBuggy.afterPhysicsStep(delta);
  updateBuildingParts(delta, now);
  updateActorsPostStep(delta, now);
  updateDynamicProps(now);
  crashThroughProps(now);
  for (let i = debris.length - 1; i >= 0; i--) {
    const item = debris[i];
    if (!item.simulationActive) continue;
    item.mesh.position.copy(item.body.position); item.mesh.quaternion.copy(item.body.quaternion);
    if (item.body.userData?.activateCollisionAt && now >= item.body.userData.activateCollisionAt) {
      item.body.collisionResponse = true;
      delete item.body.userData.activateCollisionAt;
    }
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

function rotateFirstPerson(yaw, pitch) {
  firstPersonRotation.setFromQuaternion(camera.quaternion, 'YXZ');
  firstPersonRotation.y += yaw;
  firstPersonRotation.x = THREE.MathUtils.clamp(firstPersonRotation.x + pitch, -Math.PI * .49, Math.PI * .49);
  firstPersonRotation.z = 0;
  camera.quaternion.setFromEuler(firstPersonRotation);
  updateCameraTarget();
}

function updateFirstPersonKeyboard(delta) {
  const move = 16 * delta;
  const localMove = new THREE.Vector3();
  if (keys.has('KeyW')) localMove.z -= 1;
  if (keys.has('KeyS')) localMove.z += 1;
  if (keys.has('KeyA')) localMove.x -= 1;
  if (keys.has('KeyD')) localMove.x += 1;
  if (keys.has('KeyQ') || keys.has('Minus')) localMove.y -= 1;
  if (keys.has('KeyE') || keys.has('Equal')) localMove.y += 1;
  if (localMove.lengthSq() > 0) {
    localMove.normalize().multiplyScalar(move);
    camera.translateX(localMove.x);
    camera.translateY(localMove.y);
    camera.translateZ(localMove.z);
    updateCameraTarget();
  }
  if (keys.has('ArrowLeft')) rotateFirstPerson(1.7 * delta, 0);
  if (keys.has('ArrowRight')) rotateFirstPerson(-1.7 * delta, 0);
  if (keys.has('ArrowUp')) rotateFirstPerson(0, 1.2 * delta);
  if (keys.has('ArrowDown')) rotateFirstPerson(0, -1.2 * delta);
}

function updateKeyboard(delta) {
  if (controlMode === 'car') return;
  if (firstPersonMode) {
    updateFirstPersonKeyboard(delta);
    return;
  }
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
  if (keys.has('ArrowLeft')) rotateAroundTarget(1.7 * delta, 0);
  if (keys.has('ArrowRight')) rotateAroundTarget(-1.7 * delta, 0);
  if (keys.has('ArrowUp')) rotateAroundTarget(0, -1.2 * delta);
  if (keys.has('ArrowDown')) rotateAroundTarget(0, 1.2 * delta);
  if (keys.has('KeyQ') || keys.has('Minus')) camera.position.lerp(controls.target, -1.5 * delta);
  if (keys.has('KeyE') || keys.has('Equal')) camera.position.lerp(controls.target, 1.5 * delta);
}

function disposeEffect(effect) {
  unregisterVisualItem(effect);
  scene.remove(effect.mesh);
  effect.mesh.geometry.dispose();
  effect.mesh.material.dispose();
}

function updateEffects(delta) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    effect.age += delta;
    const progress = THREE.MathUtils.clamp(effect.age / effect.lifetime, 0, 1);
    effect.mesh.visible = cameraCuller.isPointWithinDistance(effect.center ?? effect.mesh.position, effect.cullingRadius ?? 2);
    if (!effect.mesh.visible) {
      if (progress >= 1) {
        disposeEffect(effect);
        effects.splice(i, 1);
      }
      continue;
    }
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

function updateTerrainMeshCulling(mesh) {
  // Terrain mesh bounds are reliable, so use Three.js's native frustum culling
  // instead of manually toggling visibility around the viewport edge.
  mesh.visible = true;
  mesh.frustumCulled = true;
  mesh.userData.baseCastShadow ??= mesh.castShadow;
  mesh.castShadow = mesh.userData.baseCastShadow && cameraCuller.isObjectWithinDistance(mesh, 68);
}

function updateSceneCulling() {
  cameraCuller.update(camera);
  for (const mesh of terrain.chunks.values()) updateTerrainMeshCulling(mesh);
  for (const mesh of terrain.lodChunks.values()) { mesh.visible = true; mesh.frustumCulled = true; }
  if (terrain.lodTransitionSkirt) { terrain.lodTransitionSkirt.visible = true; terrain.lodTransitionSkirt.frustumCulled = true; }
  if (terrain.lodOuterSkirt) { terrain.lodOuterSkirt.visible = true; terrain.lodOuterSkirt.frustumCulled = true; }
  if (terrain.horizonMesh) { terrain.horizonMesh.visible = true; terrain.horizonMesh.frustumCulled = true; }
  city?.update(0, terrainStreamAnchor(), cameraCuller);

  for (const building of buildings) {
    cameraCuller.updateObject(building.group, building.cullingRadius);
    if (building.group.visible) cameraCuller.updateShadowCasting(building.group);
  }
  for (const cluster of settlementClusters) {
    if (cluster.detailed) continue;
    for (const building of cluster.lodGroup.children) cameraCuller.updateObject(building, building.userData.cullingRadius ?? 12);
  }
  for (const prop of props) {
    cameraCuller.updateObject(prop.group, prop.group.userData.radius ?? prop.blastRadius);
    if (prop.group.visible) cameraCuller.updateShadowCasting(prop.group);
  }
  for (const item of [...projectiles, ...debris]) {
    const radius = item.mesh.userData.radius ?? .5;
    cameraCuller.updateObject(item.mesh, radius);
    if (item.mesh.visible) cameraCuller.updateShadowCasting(item.mesh);
  }
  for (const part of buildingParts) {
    if (!part.detached) continue;
    cameraCuller.updateObject(part.mesh, part.mesh.userData.radius ?? 1);
    if (part.mesh.visible) cameraCuller.updateShadowCasting(part.mesh);
  }
  if (duneBuggy.alive) {
    cameraCuller.updateObject(duneBuggy.group, 3);
    if (duneBuggy.group.visible) cameraCuller.updateShadowCasting(duneBuggy.group);
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
canvas.addEventListener('pointerdown', (event) => {
  if (event.button === 0) {
    down = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
    if (controlMode === 'bomber' && firstPersonMode) canvas.setPointerCapture(event.pointerId);
  }
});
canvas.addEventListener('pointermove', (event) => {
  if (controlMode !== 'bomber' || !firstPersonMode || !down || !(event.buttons & 1)) return;
  const dx = event.clientX - down.lastX;
  const dy = event.clientY - down.lastY;
  down.lastX = event.clientX;
  down.lastY = event.clientY;
  if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) down.moved = true;
  rotateFirstPerson(-dx * .003, -dy * .003);
});
canvas.addEventListener('pointerup', (event) => {
  if (firstPersonMode && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (controlMode === 'bomber' && down && !down.moved && Math.hypot(event.clientX-down.x, event.clientY-down.y) < 7) throwBomb(event.clientX, event.clientY);
  down = null;
});
addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (controlMode === 'car') {
      keys.add(event.code);
      return;
    }
    if (!event.repeat) throwCenterBomb();
    return;
  }
  if (controlMode === 'car' && (event.code.startsWith('Arrow') || ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code))) event.preventDefault();
  keys.add(event.code);
});
addEventListener('keyup', (event) => keys.delete(event.code));
vehicleModeButton.addEventListener('click', () => setControlMode(controlMode === 'car' ? 'bomber' : 'car'));
vehicleModeButton.disabled = !features.buggy;
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
firstPersonButton.addEventListener('click', () => setFirstPersonMode(!firstPersonMode));
document.querySelector('#reset').addEventListener('click', () => {
  projectiles.forEach(removePhysics);
  debris.forEach((item) => { removePhysics(item); disposeDebrisMesh(item); });
  effects.forEach(disposeEffect);
  duneBuggy.dispose(false);
  simulationChunks.clear();
  for (const prop of props) {
    scene.remove(prop.group);
    prop.group.traverse((child) => { if (child.isMesh) child.geometry.dispose(); });
    world.removeBody(prop.body);
  }
  plugins.deactivate('city');
  city = null;
  projectiles.length = debris.length = props.length = pendingBuildingImpacts.length = effects.length = 0; screenShake.age = screenShake.duration; seed = Math.random() * 100; terrain.seed = seed; terrain.generate(); populateProps(); populateBuildings(); duneBuggy.spawn();
  if (controlMode === 'car') duneBuggy.updateChaseCamera(1 / 60, true, true);
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

let previous = performance.now();
let running = false;
function terrainStreamAnchor() {
  if (controlMode === 'car' && duneBuggy.alive) return duneBuggy.body.position;
  return controls.target;
}

function animate(now) {
  if (!running) return;
  requestAnimationFrame(animate);
  performanceMonitor.beginFrame(now);
  const delta = Math.min((now - previous) / 1000, .05);
  previous = now;
  performanceMonitor.measure('physics', () => updatePhysics(delta, now));
  performanceMonitor.measure('input', () => {
    updateKeyboard(delta);
    if (controls.enabled) controls.update();
    duneBuggy.updateChaseCamera(delta, false, controlMode === 'car');
  });
  performanceMonitor.measure('streaming', () => {
    terrain.updateVisibleChunks(terrainStreamAnchor());
    terrain.processRemeshQueue();
    updateSceneCulling();
  });
  performanceMonitor.measure('effects', () => updateEffects(delta));
  performanceMonitor.measure('render', () => renderScene(delta));
  performanceMonitor.endFrame();

  const snapshot = performanceMonitor.snapshot();
  chunksElement.textContent = terrain.chunks.size + terrain.lodChunks.size;
  debrisElement.textContent = debris.length;
  frameTimeElement.textContent = `${snapshot.frame.p95.toFixed(1)}ms`;
  physicsTimeElement.textContent = `${(snapshot.phaseP95.physics ?? 0).toFixed(1)}ms`;
  physicsBodiesElement.textContent = world.bodies.length;
  drawCallsElement.textContent = renderer.info.render.calls;
  trianglesElement.textContent = renderer.info.render.triangles.toLocaleString();
}
populateProps();
populateBuildings();
duneBuggy.spawn();
setFirstPersonMode(firstPersonMode, false);
setControlMode(controlMode, false);

return {
  ecs,
  plugins,
  get terrain() { return terrain; },
  get city() { return city; },
  get buggy() { return duneBuggy; },
  get running() { return running; },
  start() {
    if (running) return;
    running = true;
    previous = performance.now();
    requestAnimationFrame(animate);
    setTimeout(() => document.querySelector('#loading').classList.add('hidden'), 400);
  },
  stop() {
    running = false;
  },
  dispose() {
    running = false;
    plugins.dispose();
    ecs.dispose();
  },
};
}
