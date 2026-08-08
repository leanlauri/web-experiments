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

function addTopPivotLimb(group, geometry, color, topPosition, length) {
  geometry.translate(0, -length / 2, 0);
  const pivot = new THREE.Group();
  pivot.position.set(...topPosition);
  const mesh = new THREE.Mesh(geometry, standard(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  pivot.add(mesh);
  group.add(pivot);
  return pivot;
}

export function createAgentVisual(agent) {
  const group = new THREE.Group();
  if (agent.kind === 'vehicle') {
    add(group, new THREE.BoxGeometry(1.08, .52, 2.15), vehicleColors[agent.palette % vehicleColors.length], [0, .42, 0]);
    add(group, new THREE.BoxGeometry(.82, .5, 1.02), '#b6d5dc', [0, .82, -.12]);
    group.userData.parts = { wheels: [] };
    for (const [x, z] of [[-.55, -.67], [.55, -.67], [-.55, .67], [.55, .67]]) {
      const wheel = add(group, new THREE.CylinderGeometry(.19, .19, .16, 7), '#202525', [x, .2, z]);
      wheel.rotation.x = Math.PI / 2;
      group.userData.parts.wheels.push(wheel);
    }
    group.userData.radius = 1.35;
  } else if (agent.kind === 'animal') {
    const body = add(group, new THREE.SphereGeometry(.37, 8, 6), '#af824f', [0, .62, 0]);
    body.scale.set(1.45, .75, .72);
    const head = add(group, new THREE.SphereGeometry(.17, 7, 5), '#af824f', [.55, .82, 0]);
    group.userData.parts = { body, head, legs: [] };
    for (const [x, z] of [[-.38, -.2], [-.38, .2], [.35, -.2], [.35, .2]]) group.userData.parts.legs.push(add(group, new THREE.CylinderGeometry(.045, .055, .48, 5), '#805b39', [x, .27, z]));
    group.userData.radius = .8;
  } else {
    const head = add(group, new THREE.SphereGeometry(.15, 8, 6), '#edcf9a', [0, 1.25, 0]);
    const torso = add(group, new THREE.BoxGeometry(.3, .56, .2), clothes[agent.palette % clothes.length], [0, .82, 0]);
    const legs = [
      add(group, new THREE.CylinderGeometry(.04, .05, .52, 5), '#313a3b', [-.1, .3, 0]),
      add(group, new THREE.CylinderGeometry(.04, .05, .52, 5), '#313a3b', [.1, .3, 0]),
    ];
    const arms = [
      addTopPivotLimb(group, new THREE.CylinderGeometry(.035, .045, .42, 5), '#edcf9a', [-.23, 1.08, 0], .42),
      addTopPivotLimb(group, new THREE.CylinderGeometry(.035, .045, .42, 5), '#edcf9a', [.23, 1.08, 0], .42),
    ];
    group.userData.parts = { head, torso, legs, arms };
    group.userData.radius = .4;
  }
  return group;
}

export function createAgentLodVisual(agent) {
  const group = new THREE.Group();
  let geometry;
  let color;
  let position;
  if (agent.kind === 'vehicle') {
    geometry = new THREE.BoxGeometry(1.08, .68, 2.15);
    color = vehicleColors[agent.palette % vehicleColors.length];
    position = [0, .42, 0];
    group.userData.radius = 1.35;
  } else if (agent.kind === 'animal') {
    geometry = new THREE.DodecahedronGeometry(.48, 0);
    color = '#af824f';
    position = [0, .62, 0];
    group.userData.radius = .8;
  } else {
    geometry = new THREE.ConeGeometry(.24, 1.28, 5);
    color = clothes[agent.palette % clothes.length];
    position = [0, .64, 0];
    group.userData.radius = .4;
  }
  const mesh = new THREE.Mesh(geometry, standard(color));
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

export function animateAgentVisual(agent, delta, now) {
  const parts = agent.visual?.userData.parts;
  if (!parts) return;
  const walking = agent.state === 'walking' || !agent.state;
  const annoyed = agent.state === 'annoyed';
  agent.gaitPhase = (agent.gaitPhase ?? agent.phase) + delta * (walking ? agent.speed * 4.8 : 2.6);
  const gait = Math.sin(agent.gaitPhase);
  if (agent.kind === 'vehicle') {
    if (walking) for (const wheel of parts.wheels) wheel.rotation.y -= delta * agent.speed / .19;
    return;
  }
  if (agent.kind === 'animal') {
    parts.legs.forEach((leg, index) => {
      leg.rotation.z = walking ? gait * (index % 2 ? -.48 : .48) : annoyed && index < 2 ? Math.abs(gait) * .28 : 0;
    });
    parts.head.rotation.z = annoyed ? Math.sin(now * .014 + agent.phase) * .32 : Math.sin(agent.gaitPhase * .5) * .1;
    parts.body.rotation.z = annoyed ? Math.sin(now * .011 + agent.phase) * .06 : gait * .04;
    return;
  }
  parts.legs.forEach((leg, index) => { leg.rotation.x = walking ? gait * (index ? -.55 : .55) : 0; });
  parts.arms.forEach((arm, index) => {
    arm.rotation.x = annoyed ? Math.sin(now * .021 + index * Math.PI + agent.phase) * .65 : walking ? gait * (index ? .48 : -.48) : 0;
    arm.rotation.z = annoyed ? (index ? .35 : -.35) + Math.sin(now * .017 + index + agent.phase) * .38 : 0;
  });
  parts.head.rotation.y = annoyed ? Math.sin(now * .012 + agent.phase) * .5 : Math.sin(now * .0015 + agent.phase) * .08;
}

function segmentBlocked(from, to, agent, isBlocked) {
  if (!isBlocked) return false;
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const samples = Math.max(1, Math.ceil(distance / 2));
  for (let index = 1; index <= samples; index++) {
    const t = index / samples;
    if (isBlocked({
      x: THREE.MathUtils.lerp(from.x, to.x, t),
      z: THREE.MathUtils.lerp(from.z, to.z, t),
    }, agent.radius, agent)) return true;
  }
  return false;
}

function chooseRouteDirection(agent, isBlocked) {
  const route = agent.route;
  const index = agent.routeIndex ?? 0;
  const from = agent.position ?? new THREE.Vector3(route[index].x, 0, route[index].z);
  const preferred = agent.routeDirection ?? 1;
  for (const direction of [preferred, -preferred]) {
    const target = route[(index + direction + route.length) % route.length];
    if (!segmentBlocked(from, target, agent, isBlocked)) {
      agent.routeDirection = direction;
      return true;
    }
  }
  return false;
}

export function advanceAgent(agent, delta, surfaceY, { isBlocked = null, now = performance.now() } = {}) {
  const route = agent.route;
  if (!route.length) return;
  agent.position ??= new THREE.Vector3();
  agent.radius ??= agent.kind === 'vehicle' ? 1.35 : agent.kind === 'animal' ? .8 : .4;
  agent.state ??= 'walking';
  agent.routeIndex ??= 0;
  agent.routeDirection ??= 1;
  if (!agent.initialized) {
    // Spread a neighborhood's residents around its loop on spawn, rather than
    // making every agent start at the same corner and immediately block one another.
    const phase = ((agent.phase ?? 0) % (Math.PI * 2)) / (Math.PI * 2) * route.length;
    agent.routeIndex = Math.floor(phase) % route.length;
    const progress = phase - Math.floor(phase);
    const start = route[agent.routeIndex];
    const target = route[(agent.routeIndex + 1) % route.length];
    const x = THREE.MathUtils.lerp(start.x, target.x, progress);
    const z = THREE.MathUtils.lerp(start.z, target.z, progress);
    agent.position.set(x, surfaceY(x, z), z);
    agent.initialized = true;
    if (agent.body) agent.body.position.set(x, agent.position.y + agent.bodyOffsetY, z);
  }
  if (agent.body && agent.state !== 'knocked' && agent.state !== 'recovering') {
    agent.position.set(agent.body.position.x, agent.body.position.y - agent.bodyOffsetY, agent.body.position.z);
  }

  if (agent.state === 'knocked') {
    if (agent.body) {
      agent.position.set(agent.body.position.x, agent.body.position.y - agent.bodyOffsetY, agent.body.position.z);
      if (now >= agent.recoverAt) {
        agent.state = 'recovering';
        agent.recoverStartedAt = now;
      }
      return;
    }
    const velocity = agent.ragdollVelocity;
    velocity.y -= 18 * delta;
    agent.position.addScaledVector(velocity, delta);
    const ground = surfaceY(agent.position.x, agent.position.z);
    if (agent.position.y <= ground) {
      agent.position.y = ground;
      velocity.y = Math.max(0, -velocity.y * .18);
      velocity.x *= .83;
      velocity.z *= .83;
    }
    agent.ragdollTilt.x += agent.ragdollSpin.x * delta;
    agent.ragdollTilt.z += agent.ragdollSpin.z * delta;
    agent.ragdollSpin.multiplyScalar(Math.exp(-delta * 2.6));
    if (now >= agent.recoverAt) {
      agent.state = 'recovering';
      agent.recoverStartedAt = now;
    }
    return;
  }

  if (agent.state === 'recovering') {
    const progress = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp((now - agent.recoverStartedAt) / 850, 0, 1), 0, 1);
    agent.ragdollTilt.multiplyScalar(1 - progress);
    agent.position.y = surfaceY(agent.position.x, agent.position.z);
    if (progress >= 1) {
      agent.state = 'annoyed';
      agent.annoyanceUntil = now + 1700 + Math.random() * 700;
      agent.nextRouteCheckAt = 0;
    }
    return;
  }

  if (agent.state === 'annoyed') {
    agent.position.y = surfaceY(agent.position.x, agent.position.z);
    if (now < agent.annoyanceUntil) {
      if (agent.body) agent.body.velocity.set(0, 0, 0);
      return;
    }
    agent.state = 'walking';
    agent.nextRouteCheckAt = 0;
  }

  if (now >= (agent.nextRouteCheckAt ?? 0)) {
    agent.nextRouteCheckAt = now + 450 + Math.random() * 220;
    if (!chooseRouteDirection(agent, isBlocked)) return;
  }
  const target = route[(agent.routeIndex + agent.routeDirection + route.length) % route.length];
  const dx = target.x - agent.position.x;
  const dz = target.z - agent.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance < .08) {
    agent.routeIndex = (agent.routeIndex + agent.routeDirection + route.length) % route.length;
    agent.nextRouteCheckAt = 0;
    return;
  }
  if (agent.body) {
    agent.heading = Math.atan2(dx, dz);
    agent.body.velocity.set(dx / distance * agent.speed, 0, dz / distance * agent.speed);
    agent.body.angularVelocity.set(0, 0, 0);
    agent.body.quaternion.setFromEuler(0, agent.heading, 0);
    return;
  }
  const travel = Math.min(distance, agent.speed * delta);
  agent.position.x += dx / distance * travel;
  agent.position.z += dz / distance * travel;
  agent.position.y = surfaceY(agent.position.x, agent.position.z);
  agent.heading = Math.atan2(dx, dz);
}

export function knockAgent(agent, center, now = performance.now(), { preserveBodyMomentum = false } = {}) {
  if (agent.state === 'knocked' || agent.state === 'recovering') return;
  agent.position ??= new THREE.Vector3(agent.route[0]?.x ?? 0, 0, agent.route[0]?.z ?? 0);
  const direction = new THREE.Vector3(agent.position.x - center.x, 0, agent.position.z - center.z);
  if (direction.lengthSq() < .001) direction.set(Math.random() - .5, 0, Math.random() - .5);
  direction.normalize();
  const reach = agent.radius ?? .8;
  const strength = 3.8 + Math.random() * 3.6;
  const distance = Math.max(.4, Math.hypot(agent.position.x - center.x, agent.position.z - center.z));
  const impulse = THREE.MathUtils.clamp((8.4 - distance) * 1.35 + reach, 4.5, 12.5);
  agent.state = 'knocked';
  agent.ragdollVelocity = direction.multiplyScalar(impulse);
  agent.ragdollVelocity.y = 3.8 + impulse * .48;
  agent.ragdollSpin = new THREE.Vector3((Math.random() - .5) * strength * 1.8, 0, (Math.random() - .5) * strength * 1.8);
  agent.ragdollTilt = new THREE.Vector3((Math.random() - .5) * .8, 0, (Math.random() - .5) * .8);
  agent.recoverAt = now + 2400 + Math.random() * 1200;
  if (agent.body) {
    agent.body.wakeUp();
    if (preserveBodyMomentum) {
      agent.body.velocity.y += Math.max(1.1, impulse * .18);
      agent.body.angularVelocity.x += agent.ragdollSpin.x * .34;
      agent.body.angularVelocity.z += agent.ragdollSpin.z * .34;
    } else {
      agent.body.velocity.set(agent.ragdollVelocity.x, agent.ragdollVelocity.y, agent.ragdollVelocity.z);
      agent.body.angularVelocity.set(agent.ragdollSpin.x, agent.ragdollSpin.y, agent.ragdollSpin.z);
    }
  }
}
