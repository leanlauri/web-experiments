import { describe, expect, it } from 'vitest';
import { PerformanceMonitor } from '../src/performance.js';

describe('PerformanceMonitor', () => {
  it('keeps a bounded rolling frame window and reports percentiles', () => {
    const monitor = new PerformanceMonitor({ sampleSize: 3, now: () => 0 });
    for (const duration of [10, 20, 30, 40]) {
      monitor.beginFrame(0);
      monitor.endFrame(duration);
    }

    expect(monitor.snapshot().frame).toEqual({ median: 30, p95: 40 });
  });

  it('records phase timings independently', () => {
    const monitor = new PerformanceMonitor({ sampleSize: 4, now: () => 10 });
    monitor.recordPhase('physics', 3);
    monitor.recordPhase('physics', 7);
    monitor.recordPhase('render', 2);

    expect(monitor.snapshot().phaseP95).toEqual({ physics: 7, render: 2 });
  });
});
