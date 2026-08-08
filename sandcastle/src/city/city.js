import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { animateAgentVisual, createAgentLodVisual, createAgentVisual, advanceAgent, knockAgent } from './agents.js';
import { createCityPlan } from './layout.js';
import { COMPONENTS, createVisualComponent } from '../ecs/components.js';
import { updateObjectLod } from '../objectLod.js';

function cityChunkKey(position, chunkSize) {
  return `${Math.floor(position.x / chunkSize)},${Math.floor(position.z / chunkSize)}`;
}

const FULL_AGENT_SIMULATION_DISTANCE = 72;
const SIMPLIFIED_AGENT_SIMULATION_DISTANCE = 132;
const SIMPLIFIED_AGENT_UPDATE_INTERVAL = 0.45;

export class CityRuntime {
  constructor({
    ecs = null,
    scene,
    terrain,
    world = null,
    seed,
    size = 'medium',
    plan = null,
    createBuilding,
    disposeBuilding,
    obstacleAt = null,
    chunkSize = 180,
    activeRadius = 1,
    releaseRadius = 2,
    fullAgentSimulationDistance = FULL_AGENT_SIMULATION_DISTANCE,
    simplifiedAgentSimulationDistance = SIMPLIFIED_AGENT_SIMULATION_DISTANCE,
    simplifiedAgentUpdateInterval = SIMPLIFIED_AGENT_UPDATE_INTERVAL,
  }) {
    this.scene = scene;
    this.ecs = ecs;
    this.terrain = terrain;
    this.world = world;
    this.seed = seed;
    this.size = size;
    this.chunkSize = chunkSize;
    this.activeRadius = activeRadius;
    this.releaseRadius = releaseRadius;
    this.fullAgentSimulationDistanceSq = fullAgentSimulationDistance ** 2;
    this.simplifiedAgentSimulationDistanceSq = simplifiedAgentSimulationDistance ** 2;
    this.simplifiedAgentUpdateInterval = simplifiedAgentUpdateInterval;
    this.createBuilding = createBuilding;
    this.disposeBuilding = disposeBuilding;
    this.obstacleAt = obstacleAt;
    this.root = new THREE.Group();
    this.root.name = 'procedural-city';
    this.chunks = new Map();
    this.plan = plan;
    this.scene.add(this.root);
    this.rebuild(seed, size);
  }

  rebuild(seed = this.seed, size = this.size, plan = this.plan) {
    this.disposeContents();
    this.seed = seed;
    this.size = size;
    this.plan = plan ?? createCityPlan({ seed, size });
    for (const blueprint of this.plan.buildings) this.addToChunk(blueprint, { blueprint, building: null }, 'buildings');
    for (const agent of this.plan.agents) {
      const routeStart = agent.route[0] ?? { x: 0, z: 0 };
      const visual = createAgentVisual(agent);
      const lodVisual = createAgentLodVisual(agent);
      visual.position.set(routeStart.x, this.terrain.surfaceY(routeStart.x, routeStart.z), routeStart.z);
      lodVisual.position.copy(visual.position);
      lodVisual.visible = false;
      agent.visual = visual;
      agent.lodVisual = lodVisual;
      visual.userData.agent = agent;
      agent.chunkKey = cityChunkKey(routeStart, this.chunkSize);
      this.addToChunk(routeStart, visual, 'agents');
      visual.parent.add(lodVisual);
      visual.userData.entity?.add('agent', agent);
    }
  }

  addToChunk(position, object, collection) {
    const key = cityChunkKey(position, this.chunkSize);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      const group = new THREE.Group();
      group.name = `city-chunk:${key}`;
      group.visible = false;
      this.root.add(group);
      chunk = { key, group, active: false, collections: { roads: [], buildings: [], agents: [] } };
      this.chunks.set(key, chunk);
    }
    chunk.collections[collection].push(object);
    if (collection !== 'buildings') {
      chunk.group.add(object);
      if (this.ecs) {
        const entity = this.ecs.create(`city-${collection}`);
        entity.add(COMPONENTS.visual, createVisualComponent(object));
        object.userData.entity = entity;
      }
    }
    return chunk;
  }

  setChunkActive(chunk, active) {
    if (chunk.active === active) return;
    chunk.active = active;
    chunk.group.visible = active;
    if (active) {
      for (const entry of chunk.collections.buildings) {
        if (entry.building) continue;
        entry.building = this.createBuilding(entry.blueprint);
        chunk.group.add(entry.building.group);
      }
    } else {
      for (const entry of chunk.collections.buildings) {
        if (!entry.building) continue;
        this.disposeBuilding(entry.building);
        entry.building = null;
      }
      for (const visual of chunk.collections.agents) this.releaseAgentBody(visual.userData.agent);
    }
    chunk.group.traverse((child) => {
      if (!child.isMesh) return;
      child.userData.baseCastShadow ??= child.castShadow;
      child.castShadow = child.userData.baseCastShadow && active;
    });
  }

  update(delta, anchor, culler = null) {
    if (delta > 0) {
      const anchorChunk = cityChunkKey(anchor, this.chunkSize).split(',').map(Number);
      for (const chunk of this.chunks.values()) {
        const [x, z] = chunk.key.split(',').map(Number);
        const distance = Math.max(Math.abs(x - anchorChunk[0]), Math.abs(z - anchorChunk[1]));
        const threshold = chunk.active ? this.releaseRadius : this.activeRadius;
        this.setChunkActive(chunk, distance <= threshold);
      }
    }
    if (culler) {
      for (const chunk of this.chunks.values()) {
        if (!chunk.active) continue;
        for (const entry of chunk.collections.buildings) {
          if (entry.building) culler.updateObject(entry.building.group, entry.building.cullingRadius);
        }
      }
    }

    for (const agent of this.plan.agents) {
      const currentChunk = this.chunks.get(agent.chunkKey);
      if (!currentChunk?.active) continue;
      if (culler) {
        const distance = culler.cameraPosition.distanceTo(agent.visual.position);
        agent.usingLod = updateObjectLod({
          full: agent.visual,
          low: agent.lodVisual,
          distance,
          usingLod: agent.usingLod,
          radius: agent.visual.userData.radius ?? 1,
          culler,
        });
        // Rendering still relies on Three's mesh frustum culling, but this
        // lightweight point check lets simulation skip full AI off-screen.
        agent.inCameraRange = culler.isPointVisible(agent.visual.position, agent.visual.userData.radius ?? 1);
        continue;
      }
      this.updateAgentSimulation(agent, delta, anchor, performance.now());
    }
  }

  updateAgentSimulation(agent, delta, anchor, now) {
    const position = agent.position ?? agent.visual.position;
    const dx = position.x - anchor.x;
    const dz = position.z - anchor.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq > this.simplifiedAgentSimulationDistanceSq) {
      this.releaseAgentBody(agent);
      return;
    }

    const fullSimulation = distanceSq <= this.fullAgentSimulationDistanceSq && agent.inCameraRange !== false;
    const needsRagdollPhysics = (agent.state === 'knocked' || agent.state === 'recovering') && distanceSq <= this.simplifiedAgentSimulationDistanceSq;
    if (fullSimulation || needsRagdollPhysics) this.ensureAgentBody(agent);
    else this.releaseAgentBody(agent);
    if (!fullSimulation && now < (agent.nextSimplifiedUpdateAt ?? 0)) return;
    const elapsed = fullSimulation
      ? delta
      : Math.min(.9, Math.max(delta, (now - (agent.lastSimplifiedUpdateAt ?? now)) / 1000));
    if (!fullSimulation) {
      agent.lastSimplifiedUpdateAt = now;
      agent.nextSimplifiedUpdateAt = now + this.simplifiedAgentUpdateInterval * 1000;
    }

    advanceAgent(agent, elapsed, this.terrain.surfaceY.bind(this.terrain), {
      now,
      // Path sampling and obstacle searches are the expensive part of town AI.
      // Keep them near the player, where the resulting reroute is observable.
      isBlocked: fullSimulation ? (point, radius, currentAgent) => this.isPathBlocked(point, radius, currentAgent) : null,
    });
    this.syncAgentVisual(agent, now, fullSimulation);
    if (fullSimulation && !agent.usingLod) animateAgentVisual(agent, elapsed, now);
  }

  syncAgentVisual(agent, now, animateIdle) {
    if (agent.body && (agent.state === 'knocked' || agent.state === 'recovering')) {
      const rootOffset = agent.body.quaternion.vmult(new CANNON.Vec3(0, -agent.bodyOffsetY, 0));
      agent.position.set(agent.body.position.x + rootOffset.x, agent.body.position.y + rootOffset.y, agent.body.position.z + rootOffset.z);
      agent.visual.position.copy(agent.position);
      agent.lodVisual.position.copy(agent.position);
      agent.visual.quaternion.copy(agent.body.quaternion);
      agent.lodVisual.quaternion.copy(agent.body.quaternion);
      if (agent.kind === 'animal') {
        const offset = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
        agent.visual.quaternion.multiply(offset);
        agent.lodVisual.quaternion.multiply(offset);
      }
      return;
    }
    agent.visual.position.copy(agent.position);
    agent.lodVisual.position.copy(agent.position);
    // Animal models face local +X while vehicle and person models face +Z.
    const yaw = agent.heading + (agent.kind === 'animal' ? -Math.PI / 2 : 0);
    agent.visual.rotation.set(agent.ragdollTilt?.x ?? 0, yaw, agent.ragdollTilt?.z ?? 0);
    agent.lodVisual.rotation.set(agent.ragdollTilt?.x ?? 0, yaw, agent.ragdollTilt?.z ?? 0);
    if (!animateIdle || agent.kind === 'vehicle') return;
    const bob = Math.sin((agent.phase + now * .006) * (agent.kind === 'animal' ? 1.5 : 2.2)) * .035;
    agent.visual.position.y += bob;
    agent.lodVisual.position.y += bob;
  }

  ensureAgentBody(agent) {
    if (agent.body || !this.world) return;
    agent.radius ??= agent.kind === 'vehicle' ? 1.35 : agent.kind === 'animal' ? .8 : .4;
    const shape = agent.kind === 'vehicle'
      ? new CANNON.Box(new CANNON.Vec3(.58, .54, 1.12))
      : agent.kind === 'animal'
        ? new CANNON.Box(new CANNON.Vec3(.58, .48, .4))
        : new CANNON.Box(new CANNON.Vec3(.22, .68, .2));
    agent.bodyOffsetY = agent.kind === 'vehicle' ? .54 : agent.kind === 'animal' ? .48 : .68;
    agent.terrainRadius = agent.kind === 'vehicle' ? .72 : agent.kind === 'animal' ? .58 : .48;
    const mass = agent.kind === 'vehicle' ? 2.8 : agent.kind === 'animal' ? 2.1 : .78;
    const position = agent.position ?? agent.visual.position;
    const body = new CANNON.Body({
      mass,
      shape,
      linearDamping: .16,
      angularDamping: .22,
      allowSleep: false,
    });
    body.position.set(position.x, this.terrain.surfaceY(position.x, position.z) + agent.bodyOffsetY, position.z);
    body.quaternion.setFromEuler(0, agent.heading ?? 0, 0);
    body.userData = { kind: 'cityAgent', agent };
    body.addEventListener('collide', (event) => this.handleAgentCollision(agent, event.body));
    this.world.addBody(body);
    agent.body = body;
  }

  releaseAgentBody(agent) {
    if (!agent?.body) return;
    agent.position ??= new THREE.Vector3();
    const rootOffset = agent.body.quaternion.vmult(new CANNON.Vec3(0, -agent.bodyOffsetY, 0));
    agent.position.set(agent.body.position.x + rootOffset.x, agent.body.position.y + rootOffset.y, agent.body.position.z + rootOffset.z);
    this.world?.removeBody(agent.body);
    agent.body = null;
  }

  handleAgentCollision(agent, otherBody) {
    if (!agent.body || agent.state === 'knocked' || agent.state === 'recovering') return;
    const kind = otherBody?.userData?.kind;
    if (!['car', 'debris', 'dynamicProp', 'buildingPart', 'cityAgent'].includes(kind)) return;
    const relativeX = (otherBody.velocity?.x ?? 0) - agent.body.velocity.x;
    const relativeZ = (otherBody.velocity?.z ?? 0) - agent.body.velocity.z;
    const impactSpeed = Math.hypot(relativeX, relativeZ);
    if (impactSpeed < 2.1) return;
    const center = new THREE.Vector3(agent.body.position.x - relativeX, agent.body.position.y, agent.body.position.z - relativeZ);
    knockAgent(agent, center, performance.now(), { preserveBodyMomentum: true });
  }

  resolveAgentTerrainContact(agent) {
    const body = agent.body;
    const collision = this.terrain.sphereCollision?.(body.position, agent.terrainRadius ?? .5, -1);
    if (!collision) return;
    const { normal, penetration } = collision;
    body.position.x += normal.x * penetration;
    body.position.y += normal.y * penetration;
    body.position.z += normal.z * penetration;
    const normalSpeed = body.velocity.x * normal.x + body.velocity.y * normal.y + body.velocity.z * normal.z;
    if (normalSpeed < 0) {
      body.velocity.x -= normal.x * normalSpeed * 1.12;
      body.velocity.y -= normal.y * normalSpeed * 1.12;
      body.velocity.z -= normal.z * normalSpeed * 1.12;
    }
    // This substitutes for Cannon's ground contact because the voxel terrain
    // is sampled rather than represented by a giant rigid mesh.
    if (normal.y > .35) {
      body.velocity.x *= .72;
      body.velocity.z *= .72;
      body.angularVelocity.scale(.56, body.angularVelocity);
    }
  }

  afterPhysics(_delta, now = performance.now()) {
    for (const agent of this.plan.agents) {
      if (!agent.body) continue;
      const surface = this.terrain.surfaceY(agent.body.position.x, agent.body.position.z);
      const standY = surface + agent.bodyOffsetY;
      if (agent.state === 'walking' || agent.state === 'annoyed') {
        const up = new CANNON.Vec3(0, 1, 0);
        agent.body.quaternion.vmult(up, up);
        const excessiveSpeed = Math.max(20, agent.speed * agent.speed * 3.5);
        if (up.y < .55 || agent.body.velocity.lengthSquared() > excessiveSpeed) {
          const center = new THREE.Vector3(agent.body.position.x - agent.body.velocity.x, agent.body.position.y, agent.body.position.z - agent.body.velocity.z);
          knockAgent(agent, center, now, { preserveBodyMomentum: true });
        } else {
          agent.body.position.y = standY;
          agent.body.velocity.y = 0;
        }
      } else if (agent.state === 'knocked') {
        this.resolveAgentTerrainContact(agent);
      } else if (agent.state === 'recovering') {
        agent.body.position.y = standY;
        agent.body.velocity.set(0, 0, 0);
        agent.body.angularVelocity.set(0, 0, 0);
        agent.body.quaternion.setFromEuler(0, agent.heading, 0);
      }
      if (agent.state !== 'knocked' && agent.state !== 'recovering') {
        agent.position.set(agent.body.position.x, agent.body.position.y - agent.bodyOffsetY, agent.body.position.z);
      }
      this.syncAgentVisual(agent, now, false);
    }
  }

  isPathBlocked(point, radius, agent) {
    const baseSurface = this.terrain.baseSurfaceY?.(point.x, point.z);
    const surface = this.terrain.surfaceY(point.x, point.z);
    // A blast can leave the road visually close to its former level at the rim,
    // so inspect both the changed ground height and the solid field below it.
    if (baseSurface != null && baseSurface - surface > .72) return true;
    if (this.obstacleAt?.(point, radius, agent)) return true;
    return false;
  }

  explode(center, radius, now = performance.now()) {
    for (const agent of this.plan.agents) {
      const chunk = this.chunks.get(agent.chunkKey);
      if (!chunk?.active || !agent.position) continue;
      const reach = radius + (agent.radius ?? .8);
      if (agent.position.distanceToSquared(center) <= reach * reach) {
        this.ensureAgentBody(agent);
        knockAgent(agent, center, now);
      }
    }
  }

  disposeContents() {
    for (const chunk of this.chunks.values()) {
      for (const entry of chunk.collections.buildings) {
        if (entry.building) this.disposeBuilding(entry.building);
      }
      for (const visual of chunk.collections.agents) this.releaseAgentBody(visual.userData.agent);
      chunk.group.traverse((child) => {
        if (child.userData.entity) {
          this.ecs?.remove(child.userData.entity, { dispose: false });
          child.userData.entity = null;
        }
        if (!child.isMesh) return;
        child.geometry.dispose();
        child.material?.dispose?.();
      });
      this.root.remove(chunk.group);
    }
    this.chunks.clear();
  }

  dispose() {
    this.disposeContents();
    this.scene.remove(this.root);
  }
}
