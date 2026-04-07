import * as THREE from 'three';
import { createTerrainMesh, getTriangleCount } from './terrain.js';

const showFatalError = (error) => {
  const overlay = document.getElementById('fatalOverlay');
  const message = document.getElementById('fatalMessage');
  const detail = error instanceof Error ? error.message : String(error);
  if (message) message.textContent = `The 3D scene could not start.\n\n${detail}`;
  if (overlay) overlay.style.display = 'flex';
};

const updateHud = ({ camera, terrain }) => {
  const cameraInfo = document.getElementById('cameraInfo');
  const meshInfo = document.getElementById('meshInfo');
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);

  if (cameraInfo) {
    cameraInfo.textContent = `Camera: position (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}) looking ${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)} toward the origin.`;
  }

  if (meshInfo) {
    meshInfo.textContent = `Triangles: ${getTriangleCount(terrain.geometry)} across a ${terrain.geometry.parameters.widthSegments}×${terrain.geometry.parameters.heightSegments} split plane.`;
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

  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(18, 14, 18);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.HemisphereLight(0xf2f7ff, 0x7e93a8, 1.4);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(12, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 0, 0);

  const axes = new THREE.AxesHelper(6);
  scene.add(axes);

  const grid = new THREE.GridHelper(40, 20, 0x3a658f, 0x89a7c3);
  grid.position.y = -0.02;
  scene.add(grid);

  const terrain = createTerrainMesh();
  scene.add(terrain);

  updateHud({ camera, terrain });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  const animate = () => {
    const elapsed = clock.getElapsedTime();
    camera.position.x = Math.cos(elapsed * 0.18) * 18;
    camera.position.z = Math.sin(elapsed * 0.18) * 18;
    camera.lookAt(0, 0, 0);
    updateHud({ camera, terrain });
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
