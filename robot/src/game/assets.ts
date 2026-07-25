import * as THREE from "three";

const stylisedSheet = new URL(
  "../../resource/movement_sprite_sheets/stylised_robot_and_creature_sprite_sheet.png",
  import.meta.url,
).href;
const robotSheet = new URL(
  "../../resource/movement_sprite_sheets/robot_walk_cycles_and_plant_sway.png",
  import.meta.url,
).href;
const creatureSheet = new URL(
  "../../resource/movement_sprite_sheets/creature_animation_sprite_sheet.png",
  import.meta.url,
).href;

export type FrameSetName =
  | "robot"
  | "tallWalker"
  | "plant"
  | "spider"
  | "flyer"
  | "beetle"
  | "arrowHolder"
  | "blob";

export type FrameSet = {
  textures: THREE.CanvasTexture[];
  aspect: number;
};

type GridSpec = {
  name: FrameSetName;
  url: string;
  columns: number;
  row: number;
  rows?: number;
  count: number;
  y?: number;
  height?: number;
  xInset?: number;
  pad?: number;
};

const specs: GridSpec[] = [
  { name: "robot", url: robotSheet, columns: 8, row: 0, rows: 3, count: 8, y: 22, height: 330, xInset: 8 },
  { name: "plant", url: robotSheet, columns: 8, row: 2, rows: 3, count: 8, y: 770, height: 200, xInset: 14 },
  { name: "spider", url: stylisedSheet, columns: 7, row: 0, rows: 4, count: 7, y: 78, height: 205, xInset: 8 },
  { name: "flyer", url: stylisedSheet, columns: 7, row: 1, rows: 4, count: 7, y: 345, height: 180, xInset: 10 },
  { name: "beetle", url: stylisedSheet, columns: 7, row: 2, rows: 4, count: 7, y: 598, height: 150, xInset: 8 },
  { name: "arrowHolder", url: stylisedSheet, columns: 7, row: 3, rows: 4, count: 7, y: 778, height: 215, xInset: 8 },
  { name: "tallWalker", url: creatureSheet, columns: 8, row: 0, rows: 2, count: 8, y: 100, height: 460, xInset: 8 },
  { name: "blob", url: creatureSheet, columns: 7, row: 1, rows: 2, count: 7, y: 590, height: 295, xInset: 10 },
];

export async function loadFrameSets(): Promise<Record<FrameSetName, FrameSet>> {
  const images = new Map<string, HTMLImageElement>();
  for (const url of new Set(specs.map((spec) => spec.url))) {
    images.set(url, await loadImage(url));
  }

  const entries = specs.map((spec) => {
    const image = images.get(spec.url);
    if (!image) {
      throw new Error(`Missing image for ${spec.name}`);
    }

    const textures = createFrameTextures(image, spec);
    const first = textures[0].image as HTMLCanvasElement;
    return [spec.name, { textures, aspect: first.width / first.height }] as const;
  });

  return Object.fromEntries(entries) as Record<FrameSetName, FrameSet>;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

function createFrameTextures(image: HTMLImageElement, spec: GridSpec): THREE.CanvasTexture[] {
  const rows = spec.rows ?? 1;
  const cellWidth = image.naturalWidth / spec.columns;
  const fallbackHeight = image.naturalHeight / rows;
  const sourceY = spec.y ?? spec.row * fallbackHeight;
  const sourceHeight = spec.height ?? fallbackHeight;
  const inset = spec.xInset ?? 0;

  return Array.from({ length: spec.count }, (_, index) => {
    const sourceX = index * cellWidth + inset;
    const sourceWidth = cellWidth - inset * 2;
    const frame = cropFrame(image, sourceX, sourceY, sourceWidth, sourceHeight, spec.pad ?? 5);
    const texture = new THREE.CanvasTexture(frame);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  });
}

function cropFrame(
  image: HTMLImageElement,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  pad: number,
): HTMLCanvasElement {
  const width = Math.round(sourceWidth);
  const height = Math.round(sourceHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Could not create sprite canvas");
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  removeFloodedCheckerboard(imageData);
  removeNeighborFragments(imageData);

  const bounds = findOpaqueBounds(imageData, pad);
  const trimmed = document.createElement("canvas");
  trimmed.width = bounds.width;
  trimmed.height = bounds.height;
  const trimmedContext = trimmed.getContext("2d");
  if (!trimmedContext) {
    throw new Error("Could not create trimmed sprite canvas");
  }

  context.putImageData(imageData, 0, 0);
  trimmedContext.drawImage(
    canvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );
  return trimmed;
}

function removeNeighborFragments(imageData: ImageData): void {
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const components: Array<{ pixels: number[]; area: number; minY: number; maxY: number }> = [];

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || data[start * 4 + 3] <= 10) {
      continue;
    }

    const queue = [start];
    const pixels: number[] = [];
    let minY = height;
    let maxY = 0;
    visited[start] = 1;

    while (queue.length > 0) {
      const index = queue.pop();
      if (index === undefined) {
        break;
      }

      pixels.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      for (const neighbor of [index - 1, index + 1, index - width, index + width]) {
        if (neighbor < 0 || neighbor >= width * height || visited[neighbor]) {
          continue;
        }

        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) {
          continue;
        }

        visited[neighbor] = 1;
        if (data[neighbor * 4 + 3] > 10) {
          queue.push(neighbor);
        }
      }
    }

    components.push({ pixels, area: pixels.length, minY, maxY });
  }

  const largestArea = Math.max(1, ...components.map((component) => component.area));
  for (const component of components) {
    const touchesTopOrBottom = component.minY <= 1 || component.maxY >= height - 2;
    const isTinyEdgeFragment = touchesTopOrBottom && component.area < largestArea * 0.18;
    if (!isTinyEdgeFragment) {
      continue;
    }

    for (const pixel of component.pixels) {
      data[pixel * 4 + 3] = 0;
    }
  }
}

function removeFloodedCheckerboard(imageData: ImageData): void {
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const index = y * width + x;
    if (visited[index]) {
      return;
    }

    visited[index] = 1;
    const offset = index * 4;
    if (isCheckerPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) {
      queue.push(index);
    }
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queue.length > 0) {
    const index = queue.shift();
    if (index === undefined) {
      break;
    }

    const offset = index * 4;
    data[offset + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }
}

function isCheckerPixel(red: number, green: number, blue: number, alpha: number): boolean {
  if (alpha < 16) {
    return true;
  }

  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  return red > 218 && green > 218 && blue > 218 && spread < 9;
}

function findOpaqueBounds(imageData: ImageData, pad: number) {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}
