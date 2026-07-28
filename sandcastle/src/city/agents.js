import * as THREE from 'three';

const vehicleColors = ['#dc4f4f', '#3e83c3', '#e0ac36', '#4c9b6d'];
const clothes = ['#d45e78', '#4977ba', '#55a36d', '#d79f37'];

function standard(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: .78, flatShading: true });
}

function add(group, geometry, color, position) {
  const mesh = new THREE.Mesh(geometry, standard(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function createAgentVisual(agent) {
  const group = new THREE.Group();
  if (agent.kind === 'vehicle') {
    add(group, new THREE.BoxGeometry(2.15, .52, 1.08), vehicleColors[agent.palette % vehicleColors.length], [0, .42, 0]);
    add(group, new THREE.BoxGeometry(1.02, .5, .82), '#b6d5dc', [.12, .82, 0]);
    for (const [x, z] of [[-.67, -.55], [.67, -.55], [-.67, .55], [.67, .55]]) add(group, new THREE.CylinderGeometry(.19, .19, .16, 7), '#202525', [x, .2, z]).rotation.x = Math.PI / 2;
    group.userData.radius = 1.35;
  } else if (agent.kind === 'animal') {
    add(group, new THREE.SphereGeometry(.37, 8, 6), '#af824f', [0, .62, 0]).scale.set(1.45, .75, .72);
    add(group, new THREE.SphereGeometry(.17, 7, 5), '#af824f', [.55, .82, 0]);
    for (const [x, z] of [[-.38, -.2], [-.38, .2], [.35, -.2], [.35, .2]]) add(group, new THREE.CylinderGeometry(.045, .055, .48, 5), '#805b39', [x, .27, z]);
    group.userData.radius = .8;
  } else {
    add(group, new THREE.SphereGeometry(.15, 8, 6), '#edcf9a', [0, 1.25, 0]);
    add(group, new THREE.BoxGeometry(.3, .56, .2), clothes[agent.palette % clothes.length], [0, .82, 0]);
    add(group, new THREE.CylinderGeometry(.04, .05, .52, 5), '#313a3b', [-.1, .3, 0]);
    add(group, new THREE.CylinderGeometry(.04, .05, .52, 5), '#313a3b', [.1, .3, 0]);
    group.userData.radius = .4;
  }
  return group;
}

export function advanceAgent(agent, delta, surfaceY) {
  const route = agent.route;
  if (!route.length) return;
  const routeIndex = agent.routeIndex ?? 0;
  const from = route[routeIndex];
  const to = route[(routeIndex + 1) % route.length];
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz) || 1;
  agent.progress = (agent.progress ?? agent.phase % 1) + agent.speed * delta / distance;
  if (agent.progress >= 1) {
    agent.progress %= 1;
    agent.routeIndex = ((agent.routeIndex ?? 0) + 1) % route.length;
  }
  const current = route[agent.routeIndex ?? 0];
  const next = route[((agent.routeIndex ?? 0) + 1) % route.length];
  agent.position ??= new THREE.Vector3();
  agent.position.set(
    THREE.MathUtils.lerp(current.x, next.x, agent.progress),
    surfaceY(THREE.MathUtils.lerp(current.x, next.x, agent.progress), THREE.MathUtils.lerp(current.z, next.z, agent.progress)),
    THREE.MathUtils.lerp(current.z, next.z, agent.progress),
  );
  agent.heading = Math.atan2(next.x - current.x, next.z - current.z);
}
