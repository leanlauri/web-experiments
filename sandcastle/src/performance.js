const percentile = (samples, fraction) => {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
};

export class PerformanceMonitor {
  constructor({ sampleSize = 120, now = () => performance.now() } = {}) {
    this.sampleSize = sampleSize;
    this.now = now;
    this.frameStartedAt = 0;
    this.frameSamples = [];
    this.phaseSamples = new Map();
  }

  beginFrame(startedAt = this.now()) {
    this.frameStartedAt = startedAt;
  }

  measure(name, callback) {
    const startedAt = this.now();
    const result = callback();
    this.recordPhase(name, this.now() - startedAt);
    return result;
  }

  recordPhase(name, duration) {
    const samples = this.phaseSamples.get(name) ?? [];
    samples.push(duration);
    if (samples.length > this.sampleSize) samples.shift();
    this.phaseSamples.set(name, samples);
  }

  endFrame(endedAt = this.now()) {
    const duration = Math.max(0, endedAt - this.frameStartedAt);
    this.frameSamples.push(duration);
    if (this.frameSamples.length > this.sampleSize) this.frameSamples.shift();
    return duration;
  }

  snapshot() {
    const phaseP95 = {};
    for (const [name, samples] of this.phaseSamples) phaseP95[name] = percentile(samples, .95);
    return {
      frame: {
        median: percentile(this.frameSamples, .5),
        p95: percentile(this.frameSamples, .95),
      },
      phaseP95,
    };
  }
}
