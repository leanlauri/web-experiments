export function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeChunkRng(seed, xIndex, zIndex, salt = 0) {
  const mixed = (
    (seed | 0)
    + Math.imul(xIndex, 73856093)
    + Math.imul(zIndex, 19349663)
    + Math.imul(salt, 83492791)
  ) | 0;
  return mulberry32(mixed >>> 0);
}

export class ValueNoise {
  constructor(seed = 1337) {
    this.seed = seed | 0;
  }

  fbm(x, z, octaves = 4) {
    let value = 0;
    let amp = 1;
    let freq = 1;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.valueNoise(x * freq, z * freq) * amp;
      max += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return value / max;
  }

  signedFbm(x, z, octaves = 4) {
    return this.fbm(x, z, octaves) * 2 - 1;
  }

  valueNoise(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const xf = x - x0;
    const zf = z - z0;

    const v00 = this.hash2(x0, z0);
    const v10 = this.hash2(x0 + 1, z0);
    const v01 = this.hash2(x0, z0 + 1);
    const v11 = this.hash2(x0 + 1, z0 + 1);

    const u = smoothstep(xf);
    const v = smoothstep(zf);
    const x1 = lerp(v00, v10, u);
    const x2 = lerp(v01, v11, u);
    return lerp(x1, x2, v);
  }

  hash2(x, z) {
    let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(this.seed, 144269);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
