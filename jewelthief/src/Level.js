import * as THREE from "three";

const COLORS = {
  roof: 0x24313a,
  roofTop: 0x364952,
  parapet: 0x151d24,
  glass: 0x66ecff,
  gold: 0xf4bd4f,
  trim: 0x121922,
  pipe: 0x8a9aa0,
  balcony: 0x3f5360,
  litWindow: 0xffd978,
  coolWindow: 0x67b8d8,
  sign: 0xd1495b,
  awning: 0x2db8a8,
  awningAlt: 0xe6b449,
  plant: 0x3d8f5b,
  soil: 0x4b3540,
  scaffold: 0x91a0a7,
  crane: 0xf0b84c,
  laser: 0xff477e,
  water: 0x4ac7d8,
  brick: 0x2b2937,
  brick2: 0x203743,
  obstacle: 0x7f6475,
  jewel: 0x3bf5ee,
};

export class Level {
  constructor(scene, world, rapier) {
    this.scene = scene;
    this.world = world;
    this.RAPIER = rapier;
    this.platforms = [];
    this.obstacles = [];
    this.standableSurfaces = [];
    this.ladders = [];
    this.balconyHops = [];
    this.gates = [];
    this.jewels = [];
    this.meshes = [];
    this.routeLength = 128;

    this.materials = {
      roof: new THREE.MeshStandardMaterial({ color: COLORS.roof, roughness: 0.8 }),
      roofTop: new THREE.MeshStandardMaterial({ color: COLORS.roofTop, roughness: 0.75 }),
      parapet: new THREE.MeshStandardMaterial({ color: COLORS.parapet, roughness: 0.9 }),
      glass: new THREE.MeshStandardMaterial({
        color: COLORS.glass,
        emissive: 0x163c48,
        roughness: 0.28,
        metalness: 0.15,
      }),
      gold: new THREE.MeshStandardMaterial({
        color: COLORS.gold,
        emissive: 0x2d1e00,
        roughness: 0.42,
        metalness: 0.25,
      }),
      trim: new THREE.MeshStandardMaterial({ color: COLORS.trim, roughness: 0.82 }),
      pipe: new THREE.MeshStandardMaterial({ color: COLORS.pipe, roughness: 0.48, metalness: 0.2 }),
      balcony: new THREE.MeshStandardMaterial({ color: COLORS.balcony, roughness: 0.66 }),
      litWindow: new THREE.MeshStandardMaterial({
        color: COLORS.litWindow,
        emissive: 0x3b2400,
        roughness: 0.36,
      }),
      coolWindow: new THREE.MeshStandardMaterial({
        color: COLORS.coolWindow,
        emissive: 0x092636,
        roughness: 0.44,
      }),
      sign: new THREE.MeshStandardMaterial({
        color: COLORS.sign,
        emissive: 0x2d0610,
        roughness: 0.45,
      }),
      awning: new THREE.MeshStandardMaterial({ color: COLORS.awning, roughness: 0.62 }),
      awningAlt: new THREE.MeshStandardMaterial({ color: COLORS.awningAlt, roughness: 0.58 }),
      plant: new THREE.MeshStandardMaterial({ color: COLORS.plant, roughness: 0.74 }),
      soil: new THREE.MeshStandardMaterial({ color: COLORS.soil, roughness: 0.88 }),
      scaffold: new THREE.MeshStandardMaterial({ color: COLORS.scaffold, roughness: 0.42, metalness: 0.25 }),
      crane: new THREE.MeshStandardMaterial({ color: COLORS.crane, roughness: 0.5, metalness: 0.18 }),
      laser: new THREE.MeshBasicMaterial({ color: COLORS.laser }),
      water: new THREE.MeshStandardMaterial({
        color: COLORS.water,
        emissive: 0x0d3540,
        roughness: 0.22,
        transparent: true,
        opacity: 0.62,
      }),
      brick: new THREE.MeshStandardMaterial({ color: COLORS.brick, roughness: 0.86 }),
      brick2: new THREE.MeshStandardMaterial({ color: COLORS.brick2, roughness: 0.82 }),
      obstacle: new THREE.MeshStandardMaterial({ color: COLORS.obstacle, roughness: 0.7 }),
      jewel: new THREE.MeshStandardMaterial({
        color: COLORS.jewel,
        emissive: 0x129e9a,
        roughness: 0.25,
        metalness: 0.35,
      }),
    };
  }

  build() {
    this.addPlatform(-3, 0, 16, 1.1, 7, "Theater roof");
    this.addPlatform(17, 1.15, 13, 1.1, 7, "Gallery roof");
    this.addPlatform(35, 0.15, 14, 1.1, 7, "Market roof");
    this.addPlatform(53, 2.1, 12, 1.1, 7, "Clock roof");
    this.addPlatform(69, 0.75, 13, 1.1, 7, "Atrium roof");
    this.addPlatform(88, 1.85, 15, 1.1, 7, "Museum roof");
    this.addPlatform(109, 0.2, 22, 1.1, 7, "Safehouse roof");

    this.addLowVault(18.8, 1.95, 1.2, 0.72);
    this.addLowVault(39.5, 0.95, 1.35, 0.78);
    this.addLowVault(91.5, 2.65, 1.5, 0.82);

    this.addGate(30.2, 1.95, "window");
    this.addGate(56.8, 3.08, "window");
    this.addGate(74.2, 1.54, "door");
    this.addGate(103.5, 1.0, "door");

    this.addFireEscapeLanding(25.2, 4.25, 2.35);
    this.addLadder(25.2, 1.15, 4.25);
    this.addFireEscapeLanding(80.4, 3.65, 2.35);
    this.addLadder(80.4, 0.75, 3.65);
    this.addBalconyClimbRoute(45.4, 0.15, [
      { x: 45.4, y: 1.72, side: 1 },
      { x: 42.8, y: 3.02, side: -1 },
      { x: 45.8, y: 4.32, side: 1 },
      { x: 42.6, y: 5.62, side: -1 },
      { x: 46.0, y: 6.92, side: 1 },
    ]);

    this.addNightMarketDistrict();
    this.addClockTowerDistrict();
    this.addRooftopGardenDistrict();
    this.addConstructionDistrict();
    this.addMuseumDistrict();
    this.addSafehouseFinale();

    this.addJewelLine(6, 2.3, 6, 1.7, 0.18);
    this.addJewelLine(24, 3.15, 5, 1.4, 0.26);
    this.addJewelLadder(25.2, 2.2, 4.6, 5);
    this.addJewelBalconies();
    this.addJewelLine(48, 2.15, 4, 1.5, 0.2);
    this.addJewelLine(61, 4.25, 5, 1.35, 0.28);
    this.addJewelLine(82, 3.65, 5, 1.35, 0.22);
    this.addJewelLine(110, 2.45, 7, 1.4, 0.18);

    this.addBackgroundCity();
    this.addMoon();
  }

  addStandableProp(type, x, y, width, height, depth, material, visualZ = 0, colliderDepth = 3.0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, visualZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = type;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(width / 2, height / 2, colliderDepth / 2)
      .setFriction(0.86)
      .setRestitution(0);
    colliderDesc.setTranslation(x, y, 0);
    this.world.createCollider(colliderDesc);

    const surface = {
      type,
      x,
      y,
      width,
      height,
      depth,
      left: x - width / 2,
      right: x + width / 2,
      top: y + height / 2,
    };
    this.standableSurfaces.push(surface);
    return { mesh, surface };
  }

  addNightMarketDistrict() {
    const awnings = [
      { x: 5.4, y: 1.0, width: 2.6, material: this.materials.awning },
      { x: 8.3, y: 1.48, width: 2.4, material: this.materials.awningAlt },
      { x: 11.2, y: 1.05, width: 2.8, material: this.materials.awning },
    ];
    for (const awning of awnings) {
      this.addStandableProp("market-awning", awning.x, awning.y, awning.width, 0.18, 1.35, awning.material, -0.35, 2.7);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(awning.width * 0.86, 0.06, 0.08), this.materials.trim);
      stripe.position.set(awning.x, awning.y + 0.13, 0.36);
      this.scene.add(stripe);
      this.meshes.push(stripe);
      this.addJewel(awning.x, awning.y + 1.0);
    }

    for (let i = 0; i < 5; i += 1) {
      const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), this.materials.litWindow);
      lantern.position.set(3.4 + i * 2.1, 2.35 + Math.sin(i) * 0.18, -0.65);
      this.scene.add(lantern);
      this.meshes.push(lantern);
    }
  }

  addClockTowerDistrict() {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.15, 6.4, 1.0), this.materials.brick2);
    tower.position.set(56.5, 4.55, -3.05);
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.scene.add(tower);
    this.meshes.push(tower);

    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.08, 24), this.materials.gold);
    clockFace.position.set(56.5, 6.55, -2.42);
    clockFace.rotation.x = Math.PI / 2;
    this.scene.add(clockFace);
    this.meshes.push(clockFace);

    this.addStandableProp("clock-ledge", 56.2, 4.75, 3.25, 0.22, 1.1, this.materials.trim, -0.42, 2.5);
    this.addJewelLine(54.8, 5.75, 3, 0.8, 0.1);
  }

  addRooftopGardenDistrict() {
    const planterPositions = [
      { x: 64.8, y: 1.32 },
      { x: 68.1, y: 1.62 },
      { x: 72.2, y: 1.32 },
    ];
    for (const planter of planterPositions) {
      this.addStandableProp("garden-planter", planter.x, planter.y, 1.55, 0.42, 1.0, this.materials.soil, -0.42, 2.2);
      for (let i = 0; i < 3; i += 1) {
        const plant = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.58, 5), this.materials.plant);
        plant.position.set(planter.x - 0.42 + i * 0.42, planter.y + 0.5, -0.38);
        plant.rotation.z = (i - 1) * 0.2;
        this.scene.add(plant);
        this.meshes.push(plant);
      }
    }

    const greenhouse = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 1.1), this.materials.glass);
    greenhouse.position.set(70.0, 2.05, -1.25);
    greenhouse.castShadow = true;
    this.scene.add(greenhouse);
    this.meshes.push(greenhouse);
    this.addJewelLine(64.8, 2.4, 6, 1.45, 0.2);
  }

  addConstructionDistrict() {
    this.addStandableProp("scaffold-plank", 78.0, 2.28, 3.4, 0.2, 0.95, this.materials.scaffold, -0.45, 2.6);
    this.addStandableProp("scaffold-plank", 82.6, 3.9, 3.1, 0.2, 0.95, this.materials.scaffold, -0.45, 2.6);
    this.addStandableProp("crane-beam", 85.8, 5.05, 5.4, 0.22, 0.72, this.materials.crane, -0.35, 2.5);

    for (const x of [76.6, 79.4, 81.4, 84.0, 88.0]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), this.materials.scaffold);
      post.position.set(x, 2.35, -0.62);
      post.castShadow = true;
      this.scene.add(post);
      this.meshes.push(post);
    }

    const hookLine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.3, 0.04), this.materials.pipe);
    hookLine.position.set(87.7, 4.18, -0.2);
    this.scene.add(hookLine);
    this.meshes.push(hookLine);
    this.addJewelLine(78.0, 3.08, 7, 1.45, 0.28);
  }

  addMuseumDistrict() {
    for (const skylight of [
      { x: 93.5, y: 2.54 },
      { x: 97.2, y: 2.54 },
      { x: 101.0, y: 2.54 },
    ]) {
      this.addStandableProp("museum-skylight", skylight.x, skylight.y, 2.1, 0.22, 1.2, this.materials.glass, -0.52, 2.4);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.1), this.materials.trim);
      ridge.position.set(skylight.x, skylight.y + 0.33, -0.08);
      ridge.rotation.z = 0.9;
      this.scene.add(ridge);
      this.meshes.push(ridge);
    }

    for (let i = 0; i < 4; i += 1) {
      const laser = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.035, 0.035), this.materials.laser);
      laser.position.set(93.2 + i * 2.8, 3.45 + Math.sin(i) * 0.28, -0.18);
      laser.rotation.z = i % 2 === 0 ? 0.24 : -0.24;
      this.scene.add(laser);
      this.meshes.push(laser);
    }
    this.addJewelLine(92.4, 3.55, 7, 1.55, 0.22);
  }

  addSafehouseFinale() {
    const vaultDoor = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.16, 18), this.materials.gold);
    vaultDoor.position.set(116.2, 1.38, -1.0);
    vaultDoor.rotation.x = Math.PI / 2;
    vaultDoor.rotation.z = 0.32;
    this.scene.add(vaultDoor);
    this.meshes.push(vaultDoor);

    const pedestal = this.addStandableProp("safehouse-pedestal", 114.8, 1.1, 1.0, 0.5, 0.9, this.materials.trim, -0.3, 2.0);
    pedestal.mesh.rotation.y = 0.15;
    this.addJewel(114.8, 1.95);
    this.addJewelLine(119.0, 1.8, 5, 1.1, 0.16);
  }

  addPlatform(x, y, width, height, depth, name) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, this.materials.roof);
    mesh.position.set(x, y - height / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, depth + 0.12), this.materials.roofTop);
    cap.position.set(x, y + 0.07, 0);
    cap.receiveShadow = true;
    this.scene.add(cap);
    this.meshes.push(cap);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2)
      .setFriction(0.92)
      .setRestitution(0);
    colliderDesc.setTranslation(x, y - height / 2, 0);
    this.world.createCollider(colliderDesc);

    const platform = {
      type: "platform",
      x,
      y,
      width,
      height,
      depth,
      left: x - width / 2,
      right: x + width / 2,
      top: y,
    };
    this.platforms.push(platform);
    this.standableSurfaces.push(platform);
    this.addBuildingFacade(platform, name);

    this.addParapet(platform.left + 0.6, y + 0.38, 0.8);
    this.addParapet(platform.right - 0.6, y + 0.38, 0.8);
    return platform;
  }

  addParapet(x, y, width) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.6, 6.2), this.materials.parapet);
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(width / 2, 0.3, 3.1)
      .setFriction(0.88)
      .setRestitution(0);
    colliderDesc.setTranslation(x, y, 0);
    this.world.createCollider(colliderDesc);

    this.standableSurfaces.push({
      type: "parapet",
      x,
      y,
      width,
      height: 0.6,
      depth: 6.2,
      left: x - width / 2,
      right: x + width / 2,
      top: y + 0.3,
    });
  }

  addBuildingFacade(platform, name) {
    const height = 5.2 + ((Math.abs(Math.floor(platform.x)) % 4) * 0.85);
    const facadeMaterial = Math.abs(Math.floor(platform.x)) % 2 === 0 ? this.materials.brick : this.materials.brick2;
    const facade = new THREE.Mesh(new THREE.BoxGeometry(platform.width, height, 0.48), facadeMaterial);
    facade.position.set(platform.x, platform.top - height / 2 - 0.62, -3.22);
    facade.receiveShadow = true;
    this.scene.add(facade);
    this.meshes.push(facade);

    const cornice = new THREE.Mesh(new THREE.BoxGeometry(platform.width + 0.35, 0.24, 0.7), this.materials.trim);
    cornice.position.set(platform.x, platform.top - 0.22, -3.35);
    cornice.castShadow = true;
    this.scene.add(cornice);
    this.meshes.push(cornice);

    const floorCount = Math.max(2, Math.floor(height / 1.25));
    const columnCount = Math.max(2, Math.floor(platform.width / 2.2));
    for (let row = 0; row < floorCount; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        if ((row + column + Math.floor(platform.x)) % 5 === 0) continue;
        const windowMaterial = (row + column) % 3 === 0 ? this.materials.litWindow : this.materials.coolWindow;
        const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.56, 0.08), windowMaterial);
        const leftInset = platform.left + 1.1;
        const x = leftInset + column * ((platform.width - 2.2) / Math.max(1, columnCount - 1));
        windowMesh.position.set(x, platform.top - 1.05 - row * 1.08, -3.61);
        this.scene.add(windowMesh);
        this.meshes.push(windowMesh);

        const sill = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.08, 0.16), this.materials.trim);
        sill.position.set(x, windowMesh.position.y - 0.34, -3.67);
        this.scene.add(sill);
        this.meshes.push(sill);
      }
    }

    const pipeX = platform.left + 1.45 + (Math.abs(Math.floor(platform.x)) % 3) * 0.55;
    const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.09, height - 0.5, 0.12), this.materials.pipe);
    pipe.position.set(pipeX, platform.top - height / 2 - 0.88, -3.72);
    pipe.castShadow = true;
    this.scene.add(pipe);
    this.meshes.push(pipe);

    if (platform.width > 12) {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.62, 0.1), this.materials.sign);
      sign.position.set(platform.right - 2.1, platform.top - 1.55, -3.76);
      sign.name = `${name} sign`;
      this.scene.add(sign);
      this.meshes.push(sign);
    }
  }

  addLadder(x, bottomY, topY) {
    const height = topY - bottomY;
    const group = new THREE.Group();
    const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, 0.09), this.materials.pipe);
    const railRight = railLeft.clone();
    railLeft.position.set(-0.22, height / 2, 0);
    railRight.position.set(0.22, height / 2, 0);
    group.add(railLeft, railRight);
    const rungCount = Math.max(3, Math.floor(height / 0.42));
    for (let i = 0; i <= rungCount; i += 1) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.08), this.materials.pipe);
      rung.position.set(0, 0.18 + i * ((height - 0.36) / rungCount), 0);
      group.add(rung);
    }
    group.position.set(x, bottomY, -0.78);
    group.name = `ladder-${x}`;
    this.scene.add(group);
    this.meshes.push(group);
    this.ladders.push({
      type: "ladder",
      x,
      bottomY,
      topY,
      bottom: new THREE.Vector3(x, bottomY + 0.95, 0),
      top: new THREE.Vector3(x, topY + 0.95, 0),
    });
  }

  addFireEscapeLanding(x, y, width) {
    const height = 0.24;
    const depth = 1.25;
    const landing = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.balcony);
    landing.position.set(x, y, -0.64);
    landing.castShadow = true;
    landing.receiveShadow = true;
    this.scene.add(landing);
    this.meshes.push(landing);

    const braceLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.12), this.materials.pipe);
    const braceRight = braceLeft.clone();
    braceLeft.position.set(x - width * 0.36, y - 0.42, -0.55);
    braceRight.position.set(x + width * 0.36, y - 0.42, -0.55);
    this.scene.add(braceLeft, braceRight);
    this.meshes.push(braceLeft, braceRight);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(width / 2, height / 2, 3.0)
      .setFriction(0.9)
      .setRestitution(0);
    colliderDesc.setTranslation(x, y, 0);
    this.world.createCollider(colliderDesc);

    this.standableSurfaces.push({
      type: "fire-escape",
      x,
      y,
      width,
      height,
      depth,
      left: x - width / 2,
      right: x + width / 2,
      top: y + height / 2,
    });
  }

  addBalconyClimbRoute(_baseX, _baseY, points) {
    const routePoints = points.map((point, index) => this.addBalcony(point.x, point.y, point.side, index));
    for (let i = 0; i < routePoints.length - 1; i += 1) {
      this.balconyHops.push({
        type: "balcony-hop",
        from: routePoints[i],
        to: routePoints[i + 1],
      });
    }
  }

  addBalcony(x, y, side, index) {
    const width = 1.65;
    const height = 0.28;
    const depth = 1.3;
    const platform = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.balcony);
    platform.position.set(x, y, -0.75);
    platform.castShadow = true;
    platform.receiveShadow = true;
    this.scene.add(platform);
    this.meshes.push(platform);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.34, 0.11), this.materials.trim);
    rail.position.set(x, y + 0.36, 0.42);
    rail.castShadow = true;
    this.scene.add(rail);
    this.meshes.push(rail);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.08), this.materials.coolWindow);
    door.position.set(x - side * 0.18, y + 0.63, -0.86);
    this.scene.add(door);
    this.meshes.push(door);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(width / 2, height / 2, 3.2)
      .setFriction(0.9)
      .setRestitution(0);
    colliderDesc.setTranslation(x, y, 0);
    this.world.createCollider(colliderDesc);

    const surface = {
      type: "balcony",
      x,
      y,
      width,
      height,
      depth,
      left: x - width / 2,
      right: x + width / 2,
      top: y + height / 2,
      climbPoint: new THREE.Vector3(x, y + height / 2 + 0.95, 0),
      index,
    };
    this.standableSurfaces.push(surface);
    return surface;
  }

  addLowVault(x, y, width, height) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, 1.25), this.materials.obstacle);
    mesh.position.set(x, y + height / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(width / 2, height / 2, 0.62)
      .setFriction(0.88)
      .setRestitution(0);
    colliderDesc.setTranslation(x, y + height / 2, 0);
    this.world.createCollider(colliderDesc);

    const obstacle = {
      type: "vault",
      x,
      y,
      width,
      height,
      left: x - width / 2,
      right: x + width / 2,
      top: y + height,
      cleared: false,
      tripped: false,
      mesh,
    };
    this.obstacles.push(obstacle);
    this.standableSurfaces.push(obstacle);
  }

  addGate(x, y, type) {
    const frameMaterial = type === "window" ? this.materials.glass : this.materials.gold;
    const height = type === "window" ? 2.2 : 1.7;
    const width = type === "window" ? 1.8 : 1.35;
    const sillY = y + height / 2;
    const group = new THREE.Group();
    const sides = [
      [0, height, 0.14, -width / 2],
      [0, height, 0.14, width / 2],
      [width + 0.18, 0.14, 0.14, 0],
      [width + 0.18, 0.14, 0.14, 0],
    ];

    sides.forEach(([w, h, d, offset], index) => {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(w || 0.14, h, 1.18),
        index < 2 ? this.materials.brick2 : frameMaterial,
      );
      bar.position.set(offset, index === 2 ? height / 2 : index === 3 ? -height / 2 : 0, 0);
      bar.castShadow = true;
      group.add(bar);
    });

    const paneMaterial = frameMaterial.clone();
    paneMaterial.transparent = true;
    paneMaterial.opacity = type === "window" ? 0.22 : 0.14;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), paneMaterial);
    pane.position.set(0, 0, -0.62);
    group.add(pane);

    group.position.set(x, sillY, -0.72);
    group.name = `${type}-${x}`;
    this.scene.add(group);
    this.gates.push({
      type,
      x,
      y,
      width,
      height,
      left: x - width / 2,
      right: x + width / 2,
      bottom: y,
      top: y + height,
      used: false,
      mesh: group,
    });
  }

  addJewelLine(startX, y, count, spacing, wave) {
    for (let i = 0; i < count; i += 1) {
      this.addJewel(startX + i * spacing, y + Math.sin(i * 0.9) * wave);
    }
  }

  addJewel(x, y) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), this.materials.jewel);
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.jewels.push({ x, y, collected: false, mesh });
  }

  addJewelLadder(x, startY, endY, count) {
    for (let i = 0; i < count; i += 1) {
      const t = i / Math.max(1, count - 1);
      this.addJewel(x + Math.sin(t * Math.PI * 2) * 0.18, startY + (endY - startY) * t);
    }
  }

  addJewelBalconies() {
    for (const hop of this.balconyHops) {
      const midX = (hop.from.climbPoint.x + hop.to.climbPoint.x) / 2;
      const midY = (hop.from.climbPoint.y + hop.to.climbPoint.y) / 2 + 0.24;
      this.addJewel(midX, midY);
    }
  }

  addBackgroundCity() {
    const rng = seededRandom(14);
    for (let i = 0; i < 52; i += 1) {
      const x = -20 + i * 3.3;
      const depth = -6 - rng() * 13;
      const height = 3 + rng() * 8;
      const width = 1.5 + rng() * 2.8;
      const material = rng() > 0.5 ? this.materials.brick : this.materials.brick2;
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, 1.8), material);
      building.position.set(x, height / 2 - 1.2, depth);
      building.receiveShadow = true;
      this.scene.add(building);
      this.meshes.push(building);

      if (rng() > 0.28) {
        const windowCount = Math.floor(1 + rng() * 3);
        for (let w = 0; w < windowCount; w += 1) {
          const light = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.44, 0.04), this.materials.gold);
          light.position.set(
            x + (rng() - 0.5) * width * 0.5,
            0.5 + rng() * Math.max(1, height - 1.2),
            depth + 0.92,
          );
          this.scene.add(light);
          this.meshes.push(light);
        }
      }
    }
  }

  addMoon() {
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 28),
      new THREE.MeshBasicMaterial({ color: 0xdaf7ff }),
    );
    moon.position.set(18, 11.5, -26);
    this.scene.add(moon);
  }

  findGround(position, footY, tolerance = 0.16) {
    let best = null;
    for (const surface of this.standableSurfaces) {
      const insideX = position.x > surface.left - 0.45 && position.x < surface.right + 0.45;
      const closeY = footY >= surface.top - tolerance && footY <= surface.top + tolerance;
      if (insideX && closeY && (!best || surface.top > best.top)) best = surface;
    }
    return best;
  }

  findVaultCandidate(position, direction) {
    return this.obstacles.find((obstacle) => {
      const approach = direction >= 0 ? obstacle.left - position.x : position.x - obstacle.right;
      return approach > -0.3 && approach < 1.25 && Math.abs(position.y - obstacle.y) < 1.65;
    });
  }

  findGateCandidate(position, direction) {
    return this.gates.find((gate) => {
      const approach = direction >= 0 ? gate.left - position.x : position.x - gate.right;
      const verticalFit = position.y > gate.bottom - 0.2 && position.y < gate.top + 0.6;
      return !gate.used && approach > -0.4 && approach < 1.2 && verticalFit;
    });
  }

  findLadderCandidate(position) {
    return this.ladders.find((ladder) => {
      const horizontalFit = Math.abs(position.x - ladder.x) < 0.75;
      const verticalFit = position.y > ladder.bottomY + 0.35 && position.y < ladder.topY + 1.3;
      return horizontalFit && verticalFit;
    });
  }

  findBalconyHopCandidate(position) {
    return this.balconyHops.find((hop) => {
      const dx = Math.abs(position.x - hop.from.climbPoint.x);
      const dy = Math.abs(position.y - hop.from.climbPoint.y);
      return dx < 0.9 && dy < 0.75;
    });
  }

  update(delta, playerPosition) {
    for (const jewel of this.jewels) {
      if (!jewel.collected) {
        jewel.mesh.rotation.y += delta * 2.6;
        jewel.mesh.rotation.x += delta * 1.2;
        const pulse = 1 + Math.sin(performance.now() * 0.005 + jewel.x) * 0.08;
        jewel.mesh.scale.setScalar(pulse);
      }
    }

    const cameraRange = 44;
    for (const mesh of this.meshes) {
      if (mesh.position.x < playerPosition.x - cameraRange) {
        mesh.visible = false;
      } else {
        mesh.visible = mesh.position.x < playerPosition.x + cameraRange + 26;
      }
    }
  }

  collectNear(position) {
    let collected = 0;
    for (const jewel of this.jewels) {
      if (jewel.collected) continue;
      const dx = jewel.x - position.x;
      const dy = jewel.y - position.y;
      if (dx * dx + dy * dy < 0.82) {
        jewel.collected = true;
        jewel.mesh.visible = false;
        collected += 1;
      }
    }
    return collected;
  }

  resetCollectibles() {
    for (const jewel of this.jewels) {
      jewel.collected = false;
      jewel.mesh.visible = true;
    }
    for (const obstacle of this.obstacles) {
      obstacle.cleared = false;
      obstacle.tripped = false;
    }
    for (const gate of this.gates) {
      gate.used = false;
    }
  }
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}
