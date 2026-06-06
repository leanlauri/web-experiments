import * as THREE from 'three';
import { AssetFactory } from './assets.js';
import { Entity, FlightComponent, MeshComponent } from './entity.js';
import { ValueNoise, clamp, makeChunkRng, smoothstep } from './procedural.js';
import { BirdController } from './scripts/BirdController.js';

export class World {
  constructor(engine, { input = null, seed = 424242 } = {}) {
    this.engine = engine;
    this.input = input;
    this.entities = [];
    this.assets = new AssetFactory();
    this.noise = new ValueNoise(seed);
    this.seed = seed;
    this.fieldRegionCache = new Map();
    this.player = null;
    this.flightState = 'flying';
    this.lastBiome = 'Open country';
    this.stats = {
      chunks: 0,
      highChunks: 0,
      fixtures: 0,
    };

    this.terrain = {
      chunkSize: 96,
      chunks: new Map(),
      lod: {
        highSegments: 36,
        lowSegments: 18,
        highRadius: 2,
        lowExtraRadius: 1,
      },
    };
  }

  addEntity(entity) {
    this.entities.push(entity);
  }

  removeEntity(entity) {
    const index = this.entities.indexOf(entity);
    if (index !== -1) this.entities.splice(index, 1);
  }

  init() {
    const scene = this.engine.scene;
    scene.add(new THREE.HemisphereLight(0xc9e8ff, 0x5f744f, 1.55));

    const sun = new THREE.DirectionalLight(0xfff1c2, 1.45);
    sun.position.set(-38, 76, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 240;
    scene.add(sun);
    this.sun = sun;

    scene.add(this.createClouds());
    this.addPlayer();
    this.updateTerrain();

    this.engine.addPostUpdate(() => this.updateTerrain());
    this.engine.addPostUpdate((dt) => this.updateCameraFollow(dt));
    this.engine.addPostUpdate(() => this.updateSunFollow());
  }

  createClouds() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      transparent: true,
      opacity: 0.76,
    });
    const geom = new THREE.SphereGeometry(1, 12, 8);
    const rng = makeChunkRng(this.seed, 0, 0, 99);

    for (let i = 0; i < 26; i++) {
      const cloud = new THREE.Group();
      const puffs = 4 + Math.floor(rng() * 5);
      for (let j = 0; j < puffs; j++) {
        const puff = new THREE.Mesh(geom, mat);
        puff.scale.set(5 + rng() * 7, 1.6 + rng() * 2.7, 3.4 + rng() * 5);
        puff.position.set((rng() - 0.5) * 20, (rng() - 0.5) * 2.5, (rng() - 0.5) * 12);
        cloud.add(puff);
      }
      cloud.position.set((rng() - 0.5) * 520, 62 + rng() * 44, (rng() - 0.5) * 520);
      group.add(cloud);
    }
    return group;
  }

  addPlayer() {
    const bird = this.assets.createBird();
    bird.position.set(0, 34, 18);
    bird.rotation.y = Math.PI;

    const entity = new Entity('bird');
    entity.addComponent(new MeshComponent(bird));
    entity.addComponent(new FlightComponent({
      velocity: new THREE.Vector3(0, 0, -13),
      speed: 14,
    }));
    entity.addScript(new BirdController({ input: this.input, world: this }));
    this.engine.addEntity(entity);
    this.player = entity;
    this.flightState = 'flying';
  }

  restartPlayer() {
    const controller = this.player?.scripts?.find((script) => typeof script.reset === 'function');
    controller?.reset();
  }

  updateCameraFollow(dt) {
    if (!this.player || !this.engine.camera) return;
    const mesh = this.player.getComponent(MeshComponent.type).mesh;
    const flight = this.player.getComponent(FlightComponent.type);
    const cam = this.engine.camera;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(mesh.quaternion).normalize();
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.quaternion).normalize();
    const desired = new THREE.Vector3()
      .copy(mesh.position)
      .addScaledVector(forward, -12)
      .addScaledVector(side, -flight.velocity.x * 0.04)
      .add(new THREE.Vector3(0, 5.2, 0));

    cam.position.lerp(desired, clamp(dt * 3.4, 0, 1));
    const lookAt = new THREE.Vector3()
      .copy(mesh.position)
      .addScaledVector(forward, 13)
      .add(new THREE.Vector3(0, -5.6, 0));
    cam.lookAt(lookAt);
  }

  updateSunFollow() {
    if (!this.sun || !this.player) return;
    const mesh = this.player.getComponent(MeshComponent.type).mesh;
    this.sun.position.set(mesh.position.x - 38, mesh.position.y + 74, mesh.position.z + 26);
  }

  updateTerrain() {
    const focus = this.player?.getComponent(MeshComponent.type)?.mesh?.position ?? this.engine.camera?.position;
    const { xi: baseX, zi: baseZ } = this.getChunkIndices(focus?.x ?? 0, focus?.z ?? 0);
    const desired = this.getDesiredChunkLods(baseX, baseZ);

    for (const [key, lodLevel] of desired) {
      const existing = this.terrain.chunks.get(key);
      if (existing?.lodLevel === lodLevel) continue;
      if (existing) this.removeTerrainChunk(key, existing);
      const [xi, zi] = key.split(',').map(Number);
      this.createTerrainChunk(xi, zi, lodLevel);
    }

    for (const [key, chunk] of this.terrain.chunks) {
      if (!desired.has(key)) this.removeTerrainChunk(key, chunk);
    }

    this.updateStats();
  }

  getDesiredChunkLods(baseX, baseZ) {
    const desired = new Map();
    const { highRadius, lowExtraRadius } = this.terrain.lod;
    const lowRadius = highRadius + lowExtraRadius;
    for (let zi = baseZ - lowRadius; zi <= baseZ + lowRadius; zi++) {
      for (let xi = baseX - lowRadius; xi <= baseX + lowRadius; xi++) {
        const high = Math.abs(xi - baseX) <= highRadius && Math.abs(zi - baseZ) <= highRadius;
        desired.set(`${xi},${zi}`, high ? 'high' : 'low');
      }
    }
    return desired;
  }

  getSegmentsForLod(lodLevel) {
    return lodLevel === 'high' ? this.terrain.lod.highSegments : this.terrain.lod.lowSegments;
  }

  createTerrainChunk(xIndex, zIndex, lodLevel = 'high') {
    const { chunkSize } = this.terrain;
    const segments = this.getSegmentsForLod(lodLevel);
    const centerX = (xIndex + 0.5) * chunkSize;
    const centerZ = (zIndex + 0.5) * chunkSize;

    const group = new THREE.Group();
    group.position.set(centerX, 0, centerZ);

    const geometry = new THREE.PlaneGeometry(chunkSize, chunkSize, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    const colors = [];

    for (let i = 0; i < positions.count; i++) {
      const localX = positions.getX(i);
      const localZ = positions.getZ(i);
      const worldX = centerX + localX;
      const worldZ = centerZ + localZ;
      const height = this.getHeight(worldX, worldZ);
      const normal = this.getNormal(worldX, worldZ);
      positions.setY(i, height);
      const color = this.getTerrainColor(worldX, worldZ, height, normal);
      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    group.add(mesh);

    const fixtureCount = this.populateChunk(group, xIndex, zIndex, centerX, centerZ, lodLevel);

    const entity = new Entity(`terrain-${xIndex}-${zIndex}`);
    entity.addComponent(new MeshComponent(group));
    this.engine.addEntity(entity);
    this.terrain.chunks.set(`${xIndex},${zIndex}`, {
      entity,
      lodLevel,
      fixtureCount,
    });
  }

  populateChunk(group, xIndex, zIndex, centerX, centerZ, lodLevel) {
    const rng = makeChunkRng(this.seed, xIndex, zIndex, 10);
    const { chunkSize } = this.terrain;
    let count = 0;

    count += this.addRoads(group, centerX, centerZ);
    if (lodLevel === 'low') return count;

    const biome = this.getChunkBiome(centerX, centerZ);
    const forestChance = biome.forest;
    const townChance = biome.settlement;
    const farmChance = biome.farm;
    const mountainChance = biome.mountain;

    if (farmChance > 0.48) {
      count += this.addFarm(group, xIndex, zIndex, centerX, centerZ, rng);
    }

    if (townChance > 0.68 && mountainChance < 0.45) {
      count += this.addTown(group, centerX, centerZ, rng);
    }

    const trees = Math.floor((forestChance * 34 + rng() * 7) * (mountainChance > 0.62 ? 0.45 : 1));
    for (let i = 0; i < trees; i++) {
      const x = (rng() - 0.5) * chunkSize * 0.88;
      const z = (rng() - 0.5) * chunkSize * 0.88;
      const worldX = centerX + x;
      const worldZ = centerZ + z;
      if (this.getRoadBlend(worldX, worldZ) > 0.2) continue;
      const normal = this.getNormal(worldX, worldZ);
      if (normal.y < 0.78) continue;
      const tree = this.assets.createTree(rng);
      tree.position.set(x, this.getHeight(worldX, worldZ), z);
      tree.rotation.y = rng() * Math.PI * 2;
      tree.scale.setScalar(0.78 + rng() * 0.65);
      group.add(tree);
      count += 1;
    }

    if (mountainChance > 0.56) {
      const rocks = 8 + Math.floor(rng() * 12);
      for (let i = 0; i < rocks; i++) {
        const x = (rng() - 0.5) * chunkSize * 0.92;
        const z = (rng() - 0.5) * chunkSize * 0.92;
        const worldX = centerX + x;
        const worldZ = centerZ + z;
        const rock = this.assets.createRock(rng);
        rock.position.set(x, this.getHeight(worldX, worldZ) + 0.35, z);
        rock.rotation.set(rng(), rng() * Math.PI, rng());
        group.add(rock);
        count += 1;
      }
    }

    return count;
  }

  addRoads(group, centerX, centerZ) {
    const { chunkSize } = this.terrain;
    const minZ = centerZ - chunkSize / 2;
    const maxZ = centerZ + chunkSize / 2;
    const points = [];
    for (let z = minZ - 8; z <= maxZ + 8; z += 8) {
      const x = this.getRoadX(z);
      if (x < centerX - chunkSize * 0.65 || x > centerX + chunkSize * 0.65) continue;
      points.push(new THREE.Vector3(x - centerX, this.getHeight(x, z) + 0.16, z - centerZ));
    }
    if (points.length < 2) return 0;
    group.add(this.assets.createRoadRibbon(points, 4.6));
    return 1;
  }

  addFarm(group, xIndex, zIndex, centerX, centerZ, rng) {
    let count = 0;
    for (const region of this.getFieldRegionsForChunk(xIndex, zIndex)) {
      const field = this.assets.createField(region.width, region.depth, rng);
      field.position.set(region.x - centerX, this.getHeight(region.x, region.z) + 0.08, region.z - centerZ);
      field.rotation.y = region.rotation;
      group.add(field);
      count += 1;
    }
    return count;
  }

  addTown(group, centerX, centerZ, rng) {
    const houses = 5 + Math.floor(rng() * 8);
    let count = 0;
    for (let i = 0; i < houses; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = 5 + rng() * 28;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const worldX = centerX + x;
      const worldZ = centerZ + z;
      const house = this.assets.createHouse(rng);
      house.position.set(x, this.getHeight(worldX, worldZ), z);
      house.rotation.y = rng() * Math.PI * 2;
      group.add(house);
      count += 1;
    }
    return count;
  }

  removeTerrainChunk(key, chunk) {
    this.engine.removeEntity(chunk.entity);
    this.terrain.chunks.delete(key);
  }

  updateStats() {
    let highChunks = 0;
    let fixtures = 0;
    for (const chunk of this.terrain.chunks.values()) {
      if (chunk.lodLevel === 'high') highChunks += 1;
      fixtures += chunk.fixtureCount ?? 0;
    }
    this.stats = {
      chunks: this.terrain.chunks.size,
      highChunks,
      fixtures,
    };
  }

  getChunkIndices(x, z) {
    const { chunkSize } = this.terrain;
    return {
      xi: Math.floor(x / chunkSize),
      zi: Math.floor(z / chunkSize),
    };
  }

  getChunkBiome(centerX, centerZ) {
    return {
      forest: this.noise.fbm(centerX * 0.008, centerZ * 0.008, 4),
      settlement: this.noise.fbm(centerX * 0.004 + 80, centerZ * 0.004 - 13, 3),
      farm: this.noise.fbm(centerX * 0.005 - 24, centerZ * 0.005 + 42, 3),
      mountain: this.getMountainFactor(centerX, centerZ),
    };
  }

  getFieldRegionsForChunk(xIndex, zIndex) {
    const key = `${xIndex},${zIndex}`;
    if (this.fieldRegionCache.has(key)) return this.fieldRegionCache.get(key);

    const { chunkSize } = this.terrain;
    const centerX = (xIndex + 0.5) * chunkSize;
    const centerZ = (zIndex + 0.5) * chunkSize;
    const biome = this.getChunkBiome(centerX, centerZ);
    const regions = [];

    if (biome.farm > 0.48 && biome.mountain < 0.52) {
      const rng = makeChunkRng(this.seed, xIndex, zIndex, 31);
      const baseX = (rng() - 0.5) * 42;
      const baseZ = (rng() - 0.5) * 42;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const width = 13 + rng() * 13;
          const depth = 10 + rng() * 12;
          const localX = baseX + (col - 1) * 20 + (rng() - 0.5) * 4;
          const localZ = baseZ + (row - 0.5) * 18 + (rng() - 0.5) * 4;
          const x = centerX + localX;
          const z = centerZ + localZ;
          if (this.getRoadBlend(x, z) > 0.16) continue;
          const rotation = (rng() - 0.5) * 0.28;
          regions.push({
            x,
            z,
            width,
            depth,
            rotation,
            height: this.getFieldBaseHeight(x, z, width, depth, rotation),
          });
        }
      }
    }

    this.fieldRegionCache.set(key, regions);
    return regions;
  }

  getFieldBaseHeight(x, z, width, depth, rotation) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const samples = [
      [0, 0],
      [-width * 0.35, -depth * 0.35],
      [width * 0.35, -depth * 0.35],
      [-width * 0.35, depth * 0.35],
      [width * 0.35, depth * 0.35],
    ];
    let total = 0;
    for (const [localX, localZ] of samples) {
      const sampleX = x + localX * cos + localZ * sin;
      const sampleZ = z - localX * sin + localZ * cos;
      total += this.getBaseHeight(sampleX, sampleZ);
    }
    return total / samples.length;
  }

  getHeight(x, z) {
    return this.applyFieldFlattening(x, z, this.getBaseHeight(x, z));
  }

  getBaseHeight(x, z) {
    const ridgeNoise = this.noise.fbm(x * 0.007 - 100, z * 0.007 + 25, 5);
    const ridge = Math.pow(1 - Math.abs(ridgeNoise * 2 - 1), 2.3);
    const mountain = this.getMountainFactor(x, z);
    const rolling = this.noise.signedFbm(x * 0.016, z * 0.016, 5) * 15;
    const detail = this.noise.signedFbm(x * 0.055 + 10, z * 0.055 - 8, 3) * 3.6;
    const valley = Math.sin((x + z * 0.28) * 0.005) * 7;
    const roadBlend = this.getRoadBlend(x, z);
    const raw = rolling + detail + valley + mountain * (ridge * 80 + 24);
    const softenedRoad = raw * (1 - roadBlend * 0.45) + (rolling * 0.45 + valley * 0.2) * roadBlend;
    return softenedRoad;
  }

  applyFieldFlattening(x, z, height) {
    const { xi, zi } = this.getChunkIndices(x, z);
    let flattened = height;
    for (let cz = zi - 1; cz <= zi + 1; cz++) {
      for (let cx = xi - 1; cx <= xi + 1; cx++) {
        for (const region of this.getFieldRegionsForChunk(cx, cz)) {
          const blend = this.getFieldBlend(x, z, region);
          if (blend <= 0) continue;
          flattened = THREE.MathUtils.lerp(flattened, region.height, blend * 0.94);
        }
      }
    }
    return flattened;
  }

  getFieldBlend(x, z, region) {
    const dx = x - region.x;
    const dz = z - region.z;
    const cos = Math.cos(region.rotation);
    const sin = Math.sin(region.rotation);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    const edge = Math.min(region.width / 2 - Math.abs(localX), region.depth / 2 - Math.abs(localZ));
    const fade = 5;
    if (edge <= -fade) return 0;
    return smoothstep(clamp((edge + fade) / fade, 0, 1));
  }

  getMountainFactor(x, z) {
    const value = this.noise.fbm(x * 0.0032 + 17, z * 0.0032 - 31, 4);
    return smoothstep(clamp((value - 0.52) / 0.34, 0, 1));
  }

  getRoadX(z) {
    const long = Math.sin(z * 0.006) * 48;
    const noise = this.noise.signedFbm(15, z * 0.008, 4) * 34;
    return long + noise;
  }

  getRoadBlend(x, z) {
    const dist = Math.abs(x - this.getRoadX(z));
    return 1 - smoothstep(clamp((dist - 2.8) / 7.5, 0, 1));
  }

  getNormal(x, z) {
    const eps = 1.2;
    const hL = this.getHeight(x - eps, z);
    const hR = this.getHeight(x + eps, z);
    const hD = this.getHeight(x, z - eps);
    const hU = this.getHeight(x, z + eps);
    return new THREE.Vector3(hL - hR, 2 * eps, hD - hU).normalize();
  }

  getTerrainColor(x, z, height, normal) {
    const mountain = this.getMountainFactor(x, z);
    const forest = this.noise.fbm(x * 0.014, z * 0.014, 4);
    const farm = this.noise.fbm(x * 0.01 - 24, z * 0.01 + 42, 3);
    const road = this.getRoadBlend(x, z);
    const slope = 1 - normal.y;

    const grass = new THREE.Color(0x67935a);
    const meadow = new THREE.Color(0x95aa5c);
    const forestColor = new THREE.Color(0x315f3d);
    const field = new THREE.Color(farm > 0.58 ? 0xb69f54 : 0x78984b);
    const rock = new THREE.Color(0x88897f);
    const cliff = new THREE.Color(0x5f625e);
    const roadColor = new THREE.Color(0x7b7469);

    let color = grass.clone().lerp(meadow, this.noise.fbm(x * 0.04, z * 0.04, 2) * 0.55);
    if (farm > 0.6 && mountain < 0.42) color.lerp(field, 0.58);
    if (forest > 0.58 && mountain < 0.72) color.lerp(forestColor, clamp((forest - 0.5) * 1.8, 0, 0.7));
    if (mountain > 0.38 || height > 38) color.lerp(rock, clamp(mountain * 0.72 + height / 180, 0, 0.86));
    if (slope > 0.2) color.lerp(cliff, clamp(slope * 2.5, 0, 0.8));
    if (road > 0) color.lerp(roadColor, road * 0.76);
    return color;
  }

  getBiomeLabelAt(x, z) {
    const mountain = this.getMountainFactor(x, z);
    const forest = this.noise.fbm(x * 0.014, z * 0.014, 4);
    const farm = this.noise.fbm(x * 0.01 - 24, z * 0.01 + 42, 3);
    const settlement = this.noise.fbm(x * 0.006 + 80, z * 0.006 - 13, 3);
    if (this.getRoadBlend(x, z) > 0.42) return 'Country road';
    if (mountain > 0.64) return 'Cliffs and mountains';
    if (settlement > 0.72 && mountain < 0.45) return 'Town';
    if (farm > 0.62 && mountain < 0.42) return 'Farmland';
    if (forest > 0.62) return 'Forest';
    return 'Open country';
  }
}
