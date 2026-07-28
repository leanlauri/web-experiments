import * as THREE from 'three';
import { createAgentVisual, advanceAgent } from './agents.js';
import { createCityPlan } from './layout.js';
import { COMPONENTS, createVisualComponent } from '../ecs/components.js';

function roadMesh(road, surfaceY) {
  const startY = surfaceY(road.start.x, road.start.z) + .045;
  const endY = surfaceY(road.end.x, road.end.z) + .045;
  const dx = road.end.x - road.start.x;
  const dz = road.end.z - road.start.z;
  const length = Math.hypot(dx, dz);
  const width = road.kind === 'city' ? 10 : road.kind === 'borough' ? 8 : 6;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, .08, length + width),
    new THREE.MeshStandardMaterial({ color: road.kind === 'city' ? '#3e4546' : '#515655', roughness: .94, flatShading: true }),
  );
  mesh.position.set((road.start.x + road.end.x) * .5, (startY + endY) * .5, (road.start.z + road.end.z) * .5);
  mesh.rotation.y = Math.atan2(dx, dz);
  mesh.rotation.x = -Math.atan2(endY - startY, length);
  mesh.receiveShadow = true;
  return mesh;
}

function cityChunkKey(position, chunkSize) {
  return `${Math.floor(position.x / chunkSize)},${Math.floor(position.z / chunkSize)}`;
}

export class CityRuntime {
  constructor({
    ecs = null,
    scene,
    terrain,
    seed,
    size = 'medium',
    createBuilding,
    disposeBuilding,
    chunkSize = 180,
    activeRadius = 1,
    releaseRadius = 2,
  }) {
    this.scene = scene;
    this.ecs = ecs;
    this.terrain = terrain;
    this.seed = seed;
    this.size = size;
    this.chunkSize = chunkSize;
    this.activeRadius = activeRadius;
    this.releaseRadius = releaseRadius;
    this.createBuilding = createBuilding;
    this.disposeBuilding = disposeBuilding;
    this.root = new THREE.Group();
    this.root.name = 'procedural-city';
    this.chunks = new Map();
    this.plan = null;
    this.scene.add(this.root);
    this.rebuild(seed, size);
  }

  rebuild(seed = this.seed, size = this.size) {
    this.disposeContents();
    this.seed = seed;
    this.size = size;
    this.plan = createCityPlan({ seed, size });
    for (const road of this.plan.roads) this.addToChunk(road.start, roadMesh(road, this.terrain.surfaceY.bind(this.terrain)), 'roads');
    for (const blueprint of this.plan.buildings) this.addToChunk(blueprint, { blueprint, building: null }, 'buildings');
    for (const agent of this.plan.agents) {
      const routeStart = agent.route[0] ?? { x: 0, z: 0 };
      const visual = createAgentVisual(agent);
      visual.position.set(routeStart.x, this.terrain.surfaceY(routeStart.x, routeStart.z), routeStart.z);
      agent.visual = visual;
      agent.chunkKey = cityChunkKey(routeStart, this.chunkSize);
      this.addToChunk(routeStart, visual, 'agents');
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
    }
    chunk.group.traverse((child) => {
      if (!child.isMesh) return;
      child.userData.baseCastShadow ??= child.castShadow;
      child.castShadow = child.userData.baseCastShadow && active;
    });
  }

  update(delta, anchor, culler = null) {
    const anchorChunk = cityChunkKey(anchor, this.chunkSize).split(',').map(Number);
    for (const chunk of this.chunks.values()) {
      const [x, z] = chunk.key.split(',').map(Number);
      const distance = Math.max(Math.abs(x - anchorChunk[0]), Math.abs(z - anchorChunk[1]));
      const threshold = chunk.active ? this.releaseRadius : this.activeRadius;
      const active = distance <= threshold;
      this.setChunkActive(chunk, active);
      if (chunk.active && culler) {
        for (const entry of chunk.collections.buildings) {
          if (entry.building) culler.updateObject(entry.building.group, entry.building.cullingRadius);
        }
      }
    }
    for (const agent of this.plan.agents) {
      const currentChunk = this.chunks.get(agent.chunkKey);
      if (!currentChunk?.active) continue;
      advanceAgent(agent, delta, this.terrain.surfaceY.bind(this.terrain));
      agent.visual.position.copy(agent.position);
      agent.visual.rotation.y = agent.heading;
      if (agent.kind !== 'vehicle') {
        const bob = Math.sin((agent.phase + performance.now() * .006) * (agent.kind === 'animal' ? 1.5 : 2.2)) * .035;
        agent.visual.position.y += bob;
      }
      if (culler) culler.updateObject(agent.visual, agent.visual.userData.radius ?? 1);
    }
  }

  disposeContents() {
    for (const chunk of this.chunks.values()) {
      for (const entry of chunk.collections.buildings) {
        if (entry.building) this.disposeBuilding(entry.building);
      }
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
