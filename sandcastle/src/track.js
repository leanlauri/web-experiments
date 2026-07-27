const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const hashSeed = (seed) => {
  const source = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const rotatePoint = (x, z, rotation) => {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return { x: x * cos - z * sin, z: x * sin + z * cos };
};

const normalize2 = (x, z) => {
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length, length };
};

function pushPoint(points, x, z, metadata) {
  const last = points[points.length - 1];
  if (last && Math.hypot(last.x - x, last.z - z) < 0.05) return;
  points.push({ x, z, ...metadata });
}

function addLine(points, start, end, spacing, metadata) {
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  const steps = Math.max(2, Math.ceil(length / spacing));
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    pushPoint(points, lerp(start.x, end.x, t), lerp(start.z, end.z, t), metadata);
  }
}

function addQuadratic(points, start, control, end, spacing, metadata) {
  let length = 0;
  let previous = start;
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    const a = lerp(start.x, control.x, t);
    const b = lerp(control.x, end.x, t);
    const c = lerp(start.z, control.z, t);
    const d = lerp(control.z, end.z, t);
    const sample = { x: lerp(a, b, t), z: lerp(c, d, t) };
    length += Math.hypot(sample.x - previous.x, sample.z - previous.z);
    previous = sample;
  }
  const steps = Math.max(8, Math.ceil(length / spacing));
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const a = lerp(start.x, control.x, t);
    const b = lerp(control.x, end.x, t);
    const c = lerp(start.z, control.z, t);
    const d = lerp(control.z, end.z, t);
    pushPoint(points, lerp(a, b, t), lerp(c, d, t), metadata);
  }
}

function buildRoundedPolygonTrack(rng, straightCount, spacing, layoutScale) {
  const points = [];
  const rotation = rng() * TAU;
  const radiusX = (106 + rng() * 38) * layoutScale;
  const radiusZ = (86 + rng() * 32) * layoutScale;
  const angleOffset = rng() * TAU;
  const cornerCount = straightCount + 4 + Math.floor(rng() * 3);
  const vertices = [];
  const straightEdges = new Set();
  const straightIndexByEdge = new Map();

  for (let i = 0; i < straightCount; i++) {
    const edge = Math.floor(i * cornerCount / straightCount);
    straightEdges.add(edge);
    straightIndexByEdge.set(edge, i);
  }

  for (let i = 0; i < cornerCount; i++) {
    const angle = angleOffset + i * TAU / cornerCount + (rng() - 0.5) * 0.14;
    const radiusJitter = 0.88 + rng() * 0.26;
    const localX = Math.cos(angle) * radiusX * radiusJitter;
    const localZ = Math.sin(angle) * radiusZ * radiusJitter;
    const rotated = rotatePoint(localX, localZ, rotation);
    vertices.push({ x: rotated.x, z: rotated.z });
  }

  const corners = vertices.map((vertex, index) => {
    const previous = vertices[(index - 1 + vertices.length) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    const toPrevious = normalize2(previous.x - vertex.x, previous.z - vertex.z);
    const toNext = normalize2(next.x - vertex.x, next.z - vertex.z);
    const cut = Math.min(toPrevious.length, toNext.length) * (0.22 + rng() * 0.1);
    return {
      vertex,
      incoming: { x: vertex.x + toPrevious.x * cut, z: vertex.z + toPrevious.z * cut },
      outgoing: { x: vertex.x + toNext.x * cut, z: vertex.z + toNext.z * cut },
    };
  });

  for (let i = 0; i < corners.length; i++) {
    const next = (i + 1) % corners.length;
    const start = corners[i].outgoing;
    const end = corners[next].incoming;
    if (straightEdges.has(i)) {
      addLine(points, start, end, spacing, { kind: 'straight', straightIndex: straightIndexByEdge.get(i) });
    } else {
      const midpoint = { x: (start.x + end.x) * 0.5, z: (start.z + end.z) * 0.5 };
      const radial = normalize2(midpoint.x, midpoint.z);
      const bend = (26 + rng() * 42) * layoutScale;
      const control = {
        x: midpoint.x + radial.x * bend,
        z: midpoint.z + radial.z * bend,
      };
      addQuadratic(points, start, control, end, spacing, { kind: 'turn', cornerIndex: corners.length + i });
    }
    addQuadratic(points, corners[next].incoming, corners[next].vertex, corners[next].outgoing, spacing, { kind: 'turn', cornerIndex: next });
  }
  return points;
}

function annotateSamples(points, baseHeight, rng) {
  const count = points.length;
  const samples = points.map((point) => ({ ...point, height: baseHeight(point.x, point.z) }));
  for (let pass = 0; pass < 7; pass++) {
    const heights = samples.map((sample) => sample.height);
    for (let i = 0; i < count; i++) {
      const a = heights[(i - 2 + count) % count];
      const b = heights[(i - 1 + count) % count];
      const c = heights[i];
      const d = heights[(i + 1) % count];
      const e = heights[(i + 2) % count];
      samples[i].height = a * 0.08 + b * 0.22 + c * 0.4 + d * 0.22 + e * 0.08;
    }
  }
  for (let pass = 0; pass < 10; pass++) {
    for (let direction = 0; direction < 2; direction++) {
      for (let step = 0; step < count; step++) {
        const i = direction === 0 ? step : count - 1 - step;
        const next = direction === 0 ? (i + 1) % count : (i - 1 + count) % count;
        const distance = Math.hypot(samples[next].x - samples[i].x, samples[next].z - samples[i].z);
        const maxDelta = Math.max(0.02, distance * 0.055);
        samples[next].height = clamp(samples[next].height, samples[i].height - maxDelta, samples[i].height + maxDelta);
      }
    }
  }

  let distance = 0;
  const turnBankNoise = new Map();
  for (let i = 0; i < count; i++) {
    const previous = samples[(i - 1 + count) % count];
    const current = samples[i];
    const next = samples[(i + 1) % count];
    if (i > 0) distance += Math.hypot(current.x - previous.x, current.z - previous.z);
    const tangent = normalize2(next.x - previous.x, next.z - previous.z);
    const inVec = normalize2(current.x - previous.x, current.z - previous.z);
    const outVec = normalize2(next.x - current.x, next.z - current.z);
    const cross = inVec.x * outVec.z - inVec.z * outVec.x;
    const dot = clamp(inVec.x * outVec.x + inVec.z * outVec.z, -1, 1);
    const segmentLength = Math.max(0.001, (inVec.length + outVec.length) * 0.5);
    const curvature = Math.atan2(cross, dot) / segmentLength;
    if (current.kind === 'turn' && !turnBankNoise.has(current.cornerIndex)) {
      turnBankNoise.set(current.cornerIndex, 0.045 + rng() * 0.055);
    }
    const bankAmount = current.kind === 'turn'
      ? turnBankNoise.get(current.cornerIndex) * smoothstep(0.003, 0.035, Math.abs(curvature))
      : 0;
    current.s = distance;
    current.tangentX = tangent.x;
    current.tangentZ = tangent.z;
    current.normalX = -tangent.z;
    current.normalZ = tangent.x;
    current.curvature = curvature;
    current.bankSlope = curvature === 0 ? 0 : -Math.sign(curvature) * bankAmount;
  }

  return samples;
}

function createSegmentIndex(samples, maxDistance) {
  const cellSize = Math.max(20, maxDistance * 2.5);
  const buckets = new Map();
  const add = (cellX, cellZ, index) => {
    const key = `${cellX},${cellZ}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(index);
    buckets.set(key, bucket);
  };
  for (let index = 0; index < samples.length; index++) {
    const a = samples[index];
    const b = samples[(index + 1) % samples.length];
    const minX = Math.floor((Math.min(a.x, b.x) - maxDistance) / cellSize);
    const maxX = Math.floor((Math.max(a.x, b.x) + maxDistance) / cellSize);
    const minZ = Math.floor((Math.min(a.z, b.z) - maxDistance) / cellSize);
    const maxZ = Math.floor((Math.max(a.z, b.z) + maxDistance) / cellSize);
    for (let cellZ = minZ; cellZ <= maxZ; cellZ++) {
      for (let cellX = minX; cellX <= maxX; cellX++) add(cellX, cellZ, index);
    }
  }
  return { cellSize, buckets };
}

function segmentNearest(samples, index, x, z, maxDistance) {
  let best = null;
  const count = samples.length;
  const maxDistanceSq = maxDistance * maxDistance;
  const cellX = Math.floor(x / index.cellSize);
  const cellZ = Math.floor(z / index.cellSize);
  const candidates = index.buckets.get(`${cellX},${cellZ}`) ?? [];
  for (const i of candidates) {
    const a = samples[i];
    const b = samples[(i + 1) % count];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq < 0.0001) continue;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / lengthSq, 0, 1);
    const cx = a.x + dx * t;
    const cz = a.z + dz * t;
    const offsetX = x - cx;
    const offsetZ = z - cz;
    const distanceSq = offsetX * offsetX + offsetZ * offsetZ;
    if (distanceSq > maxDistanceSq || (best && distanceSq >= best.distanceSq)) continue;
    best = { index: i, a, b, t, x: cx, z: cz, distanceSq, segmentLength: Math.sqrt(lengthSq) };
  }
  return best;
}

export function createRaceTrack(seed = 8, options = {}) {
  const rng = mulberry32(hashSeed(`${seed}:race-track`));
  const straightCount = clamp(Math.floor(options.straightCount ?? (2 + Math.floor(rng() * 3))), 2, 4);
  const width = options.width ?? 7.2;
  const shoulderWidth = options.shoulderWidth ?? 4.8;
  const sampleSpacing = options.sampleSpacing ?? 1.8;
  // The circuit deliberately occupies the broader streamed landscape, not just town.
  const layoutScale = options.layoutScale ?? 5;
  const baseHeight = options.baseHeight ?? (() => 5);
  const points = buildRoundedPolygonTrack(rng, straightCount, sampleSpacing, layoutScale);
  const samples = annotateSamples(points, baseHeight, rng);
  const count = samples.length;
  const last = samples[count - 1];
  const first = samples[0];
  const totalLength = last.s + Math.hypot(first.x - last.x, first.z - last.z);
  const halfWidth = width * 0.5;
  const maxDistance = halfWidth + shoulderWidth;
  const segmentIndex = createSegmentIndex(samples, maxDistance);
  const bounds = samples.reduce((box, sample) => ({
    minX: Math.min(box.minX, sample.x - maxDistance),
    maxX: Math.max(box.maxX, sample.x + maxDistance),
    minZ: Math.min(box.minZ, sample.z - maxDistance),
    maxZ: Math.max(box.maxZ, sample.z + maxDistance),
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const straightLengths = new Array(straightCount).fill(0);
  for (let i = 0; i < count; i++) {
    const sample = samples[i];
    if (sample.kind !== 'straight') continue;
    const next = samples[(i + 1) % count];
    straightLengths[sample.straightIndex] += Math.hypot(next.x - sample.x, next.z - sample.z);
  }
  const straights = straightLengths.map((length, index) => ({ index, length }));
  const longestStraight = straights.reduce((best, item) => item.length > best.length ? item : best, straights[0]);
  const turns = new Set(samples.filter((sample) => sample.kind === 'turn').map((sample) => sample.cornerIndex));

  const track = {
    seed,
    samples,
    straights,
    turnCount: turns.size,
    width,
    shoulderWidth,
    length: totalLength,
    bounds,
    sample(x, z) {
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return null;
      const nearest = segmentNearest(samples, segmentIndex, x, z, maxDistance);
      if (!nearest) return null;
      const { a, b, t } = nearest;
      const tangent = normalize2(b.x - a.x, b.z - a.z);
      const normalX = -tangent.z;
      const normalZ = tangent.x;
      const signedDistance = (x - nearest.x) * normalX + (z - nearest.z) * normalZ;
      const distance = Math.sqrt(nearest.distanceSq);
      const height = lerp(a.height, b.height, t);
      const bankSlope = lerp(a.bankSlope, b.bankSlope, t);
      const s = (a.s + nearest.segmentLength * t) % totalLength;
      const blend = smoothstep(halfWidth, halfWidth + shoulderWidth, distance);
      const roadMask = 1 - blend;
      return {
        x: nearest.x,
        z: nearest.z,
        s,
        distance,
        signedDistance,
        tangentX: tangent.x,
        tangentZ: tangent.z,
        normalX,
        normalZ,
        height,
        bankSlope,
        bankOffset: signedDistance * bankSlope,
        roadMask,
        kind: a.kind,
      };
    },
    heightAt(x, z, fallbackHeight = baseHeight(x, z)) {
      const sample = this.sample(x, z);
      if (!sample) return fallbackHeight;
      const roadHeight = sample.height + sample.bankOffset;
      return lerp(roadHeight, fallbackHeight, 1 - sample.roadMask);
    },
    colorAt(x, z) {
      const sample = this.sample(x, z);
      if (!sample) return null;
      return {
        roadMask: sample.roadMask,
        shoulderMask: sample.distance > halfWidth ? sample.roadMask : 0,
      };
    },
    startPose() {
      const candidates = samples.filter((sample) => sample.kind === 'straight' && sample.straightIndex === longestStraight.index);
      const sample = candidates[Math.floor(candidates.length * 0.5)] ?? samples[0];
      return {
        x: sample.x,
        z: sample.z,
        heading: Math.atan2(-sample.tangentX, -sample.tangentZ),
      };
    },
  };

  return track;
}
