import * as THREE from "three";
import type { FrameSet, FrameSetName } from "./assets";
import { Actor } from "./actor";

export type Obstacle = {
  x: number;
  width: number;
  height: number;
};

type ScreenTheme = {
  floor: number;
  trim: number;
  accent: number;
};

const themes: ScreenTheme[] = [
  { floor: 0x587269, trim: 0x2f4c58, accent: 0xd6b96d },
  { floor: 0x6d7560, trim: 0x39535e, accent: 0xc07d5a },
  { floor: 0x526e7a, trim: 0x2e3f54, accent: 0x78b9a8 },
  { floor: 0x766b55, trim: 0x3f4750, accent: 0xe0c46e },
  { floor: 0x536d63, trim: 0x344854, accent: 0x8fa8d8 },
];

export const SCREEN_WIDTH = 24;
export const SCREEN_COUNT = themes.length;
export const WORLD_LENGTH = SCREEN_WIDTH * SCREEN_COUNT;

export function buildWorld(scene: THREE.Scene): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const world = new THREE.Group();
  scene.add(world);

  addSkyBand(world);
  themes.forEach((theme, index) => {
    const origin = index * SCREEN_WIDTH;
    addFloor(world, origin, theme);
    addArchitecture(world, origin, index, theme);
    addObstacleSet(world, origin, index, theme, obstacles);
  });

  return obstacles;
}

export function populateSprites(
  scene: THREE.Scene,
  frames: Record<FrameSetName, FrameSet>,
): { creatures: Actor[]; plants: Actor[] } {
  const creatures = [
    new Actor({
      name: "courtyard walker",
      kind: "ground",
      frameSetName: "tallWalker",
      frames: frames.tallWalker,
      height: 2.25,
      x: 14,
      patrol: [10, 21],
      speed: 0.9,
      direction: 1,
      frameRate: 8,
    }),
    new Actor({
      name: "little beetle",
      kind: "ground",
      frameSetName: "beetle",
      frames: frames.beetle,
      height: 0.78,
      x: 31,
      patrol: [27, 37],
      speed: 0.65,
      direction: -1,
      frameRate: 9,
    }),
    new Actor({
      name: "arrow holder",
      kind: "enemy",
      frameSetName: "arrowHolder",
      frames: frames.arrowHolder,
      height: 1.62,
      x: 27,
      patrol: [24.5, 32],
      speed: 0.72,
      direction: 1,
      frameRate: 8,
      visualDirection: -1,
    }),
    new Actor({
      name: "hovering friend",
      kind: "flyer",
      frameSetName: "flyer",
      frames: frames.flyer,
      height: 1.05,
      x: 47,
      y: 2.0,
      patrol: [43, 54],
      speed: 0.85,
      direction: 1,
      frameRate: 12,
      bob: 0.24,
    }),
    new Actor({
      name: "round crawler",
      kind: "ground",
      frameSetName: "blob",
      frames: frames.blob,
      height: 1.05,
      x: 68,
      patrol: [62, 74],
      speed: 0.55,
      direction: 1,
      frameRate: 7,
    }),
    new Actor({
      name: "tripod rover",
      kind: "ground",
      frameSetName: "spider",
      frames: frames.spider,
      height: 1.22,
      x: 87,
      patrol: [80, 94],
      speed: 0.8,
      direction: -1,
      frameRate: 10,
    }),
    new Actor({
      name: "garden beetle",
      kind: "ground",
      frameSetName: "beetle",
      frames: frames.beetle,
      height: 0.82,
      x: 108,
      patrol: [102, 116],
      speed: 0.7,
      direction: 1,
      frameRate: 9,
    }),
  ];

  const plantPositions = [6, 18, 26, 39, 51, 60, 76, 91, 100, 113];
  const plants = plantPositions.map(
    (x, index) =>
      new Actor({
        name: `swaying plant ${index + 1}`,
        kind: "plant",
        frameSetName: "plant",
        frames: frames.plant,
        height: 1.05 + (index % 3) * 0.12,
        x,
        z: -0.32,
        speed: 0,
        frameRate: 4 + (index % 2),
      }),
  );

  for (const actor of [...plants, ...creatures]) {
    scene.add(actor.shadow);
    scene.add(actor.sprite);
  }

  return { creatures, plants };
}

function addSkyBand(world: THREE.Group): void {
  const material = new THREE.MeshBasicMaterial({
    color: 0xbad7d3,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_LENGTH + 50, 18), material);
  backdrop.position.set(WORLD_LENGTH / 2 - 5, 6, -6.2);
  world.add(backdrop);
}

function addFloor(world: THREE.Group, origin: number, theme: ScreenTheme): void {
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(SCREEN_WIDTH + 0.1, 0.42, 4.2),
    new THREE.MeshStandardMaterial({
      color: theme.floor,
      roughness: 0.75,
      metalness: 0.04,
    }),
  );
  floor.position.set(origin + SCREEN_WIDTH / 2, -0.21, 0);
  floor.receiveShadow = true;
  world.add(floor);

  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(SCREEN_WIDTH + 0.1, 0.12, 4.38),
    new THREE.MeshStandardMaterial({ color: theme.trim, roughness: 0.85 }),
  );
  lip.position.set(origin + SCREEN_WIDTH / 2, 0.06, 0.06);
  lip.receiveShadow = true;
  world.add(lip);
}

function addArchitecture(world: THREE.Group, origin: number, index: number, theme: ScreenTheme): void {
  const rearMaterial = new THREE.MeshStandardMaterial({
    color: theme.trim,
    roughness: 0.8,
    metalness: 0.08,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: theme.accent,
    roughness: 0.62,
    metalness: 0.12,
  });

  const blockCount = 4 + (index % 2);
  for (let i = 0; i < blockCount; i += 1) {
    const height = 1.3 + ((i + index) % 3) * 0.72;
    const width = 1.2 + (i % 2) * 0.48;
    const block = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.9), rearMaterial);
    block.position.set(origin + 3.2 + i * 4.8, height / 2, -1.55 - (i % 2) * 0.4);
    block.castShadow = true;
    block.receiveShadow = true;
    world.add(block);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.25, 0.18, 1.05), accentMaterial);
    cap.position.set(block.position.x, height + 0.12, block.position.z);
    cap.castShadow = true;
    world.add(cap);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.1 + index * 0.04, 0.08, 12, 32),
    accentMaterial,
  );
  ring.position.set(origin + 17.4, 3.2 + (index % 2) * 0.45, -2.1);
  ring.rotation.y = Math.PI / 2;
  ring.castShadow = true;
  world.add(ring);

  const frontPebbles = new THREE.Group();
  for (let i = 0; i < 7; i += 1) {
    const pebble = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.18 + (i % 3) * 0.04, 0),
      new THREE.MeshStandardMaterial({ color: lighten(theme.floor, 0.18), roughness: 0.9 }),
    );
    pebble.position.set(origin + 1.8 + i * 3.1, 0.12, 1.45 + (i % 2) * 0.28);
    pebble.scale.y = 0.45;
    pebble.castShadow = true;
    frontPebbles.add(pebble);
  }
  world.add(frontPebbles);
}

function addObstacleSet(
  world: THREE.Group,
  origin: number,
  index: number,
  theme: ScreenTheme,
  obstacles: Obstacle[],
): void {
  const local: Obstacle[] = [
    { x: origin + 9.2, width: 1.12, height: 0.86 + (index % 2) * 0.16 },
    { x: origin + 19.1, width: 1.42, height: 0.66 + (index % 3) * 0.08 },
  ];

  if (index === 2 || index === 4) {
    local.push({ x: origin + 14.7, width: 1.05, height: 1.18 });
  }

  const materials = [
    new THREE.MeshStandardMaterial({ color: theme.accent, roughness: 0.7, metalness: 0.08 }),
    new THREE.MeshStandardMaterial({ color: lighten(theme.trim, 0.22), roughness: 0.82 }),
  ];

  for (const [obstacleIndex, obstacle] of local.entries()) {
    obstacles.push(obstacle);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(obstacle.width, obstacle.height, 1.35),
      materials[obstacleIndex % materials.length],
    );
    mesh.position.set(obstacle.x, obstacle.height / 2, 0.05);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    world.add(mesh);

    const bevelHint = new THREE.Mesh(
      new THREE.BoxGeometry(obstacle.width * 0.86, 0.08, 1.42),
      new THREE.MeshStandardMaterial({ color: 0xfff0b4, roughness: 0.7, metalness: 0.06 }),
    );
    bevelHint.position.set(obstacle.x, obstacle.height + 0.06, 0.05);
    bevelHint.castShadow = true;
    world.add(bevelHint);
  }
}

function lighten(color: number, amount: number): number {
  const base = new THREE.Color(color);
  base.lerp(new THREE.Color(0xffffff), amount);
  return base.getHex();
}
