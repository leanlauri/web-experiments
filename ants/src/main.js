import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AntSystem } from './ant-system.js';
import { TERRAIN_CONFIG, createTerrainMesh, createTerrainOverlay, getTriangleCount } from './terrain.js';

const showFatalError = (error) => {
  const overlay = document.getElementById('fatalOverlay');
  const message = document.getElementById('fatalMessage');
  const detail = error instanceof Error ? error.message : String(error);
  if (message) message.textContent = `The 3D scene could not start.\n\n${detail}`;
  if (overlay) overlay.style.display = 'flex';
};

const updateHud = ({ camera, terrain, antSystem }) => {
  const cameraInfo = document.getElementById('cameraInfo');
  const meshInfo = document.getElementById('meshInfo');
  const antInfo = document.getElementById('antInfo');
  const hudHint = document.getElementById('hudHint');
  const hud = document.getElementById('hud');
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);

  if (hudHint && hud) {
    hudHint.textContent = hud.open ? 'tap to collapse' : 'tap to expand';
  }

  if (cameraInfo) {
    cameraInfo.textContent = `Camera: drag to orbit, pinch or wheel to zoom.`;
  }

  if (meshInfo) {
    meshInfo.textContent = `Terrain: ${getTriangleCount(terrain.geometry)} tris, x/z [-50, 50], y [-${TERRAIN_CONFIG.maxHeight}, ${TERRAIN_CONFIG.maxHeight}].`;
  }

  if (antInfo && antSystem) {
    const summary = antSystem.getSummary();
    antInfo.textContent = `Ants: ${summary.total} total, ${summary.visible} visible, LOD ${summary.near}/${summary.mid}/${summary.far}, render ${summary.fullMesh}/${summary.impostor}.`;
  }
};

const bootstrap = () => {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdbe7f4);
  scene.fog = new THREE.Fog(0xdbe7f4, 30, 80);

  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 260);
  camera.position.set(36, 26, 36);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 2, 0);
  controls.minDistance = 10;
  controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.enablePan = true;

  const ambient = new THREE.HemisphereLight(0xf2f7ff, 0x7e93a8, 1.4);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(12, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 0, 0);

  const axes = new THREE.AxesHelper(12);
  scene.add(axes);

  const grid = new THREE.GridHelper(100, 20, 0x3a658f, 0x89a7c3);
  grid.position.y = -0.02;
  scene.add(grid);

  const terrain = createTerrainMesh();
  scene.add(terrain);
  const terrainOverlay = createTerrainOverlay(terrain.geometry);
  scene.add(terrainOverlay);

  const antSystem = new AntSystem({ scene, camera, count: 200 });

  updateHud({ camera, terrain, antSystem });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  const fixedStep = 1 / 60;
  const maxFrameDt = 0.1;
  const maxSubsteps = 4;
  let accumulator = 0;
  const animate = () => {
    const dt = Math.min(maxFrameDt, clock.getDelta());
    accumulator += dt;

    controls.update();
    let substeps = 0;
    while (accumulator >= fixedStep && substeps < maxSubsteps) {
      antSystem.update(fixedStep);
      accumulator -= fixedStep;
      substeps += 1;
    }

    updateHud({ camera, terrain, antSystem });
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  };

  animate();
};

try {
  bootstrap();
} catch (error) {
  console.error('Ants bootstrap failed:', error);
  showFatalError(error);
}
