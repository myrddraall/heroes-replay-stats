import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FrameStats } from './frame-stats';

describe('frame stats', () => {
  it('give frames a second and the time one takes, none drawn: 0 a second, the last time kept', () => {
    const stats = TestBed.inject(FrameStats);
    const stop = stats.watch();
    expect(stats.watching()).toBe(true);
    const at = performance.now();
    for (let i = 0; i < 30; i++) stats.frame(4);
    stats.publish(at + 500);
    expect(stats.current()!.fps).toBeCloseTo(60, 0);
    expect(stats.current()!.ms).toBeCloseTo(4);
    stats.publish(at + 1000);
    expect(stats.current()).toEqual({ fps: 0, ms: 4, gpuMs: null });
    stats.gpu(2);
    stats.gpu(4);
    stats.publish(at + 1500);
    expect(stats.current()!.gpuMs).toBeCloseTo(3);
    stop();
    expect(stats.watching()).toBe(false);
    expect(stats.current()).toBeNull();
  });
});
