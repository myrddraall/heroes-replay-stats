import { computed, Service, signal } from '@angular/core';

/**
 * The background's frames over the last while: how many a second, and how long one takes to draw
 * (its CPU side, in ms; the last drawn's where none was), and the GPU's side where the browser
 * can time it (none where it can't).
 */
export interface FrameStat {
  readonly fps: number;
  readonly ms: number;
  readonly gpuMs: number | null;
}

/** How often the stats are given, over the frames since, in ms. */
const WINDOW = 500;

/**
 * How the background's frames are drawn, while anything shows it (an editor's frame stats): its
 * canvas times each frame then (and only then), and these are given every WINDOW ms. A still scene
 * draws only when something changes: 0 frames a second between.
 */
@Service()
export class FrameStats {
  private readonly watchers = signal(0);
  /** Whether anything shows the stats: frames are timed only then. */
  readonly watching = computed(() => this.watchers() > 0);
  /** The stats over the last WINDOW ms; none until one has passed. */
  readonly current = signal<FrameStat | null>(null);
  private frames = 0;
  private drawing = 0;
  private gpuFrames = 0;
  private gpuDrawing = 0;
  private since = 0;
  private timer?: ReturnType<typeof setInterval>;

  /** The stats shown from now on; what it gives back stops showing them. */
  watch(): () => void {
    this.watchers.update((n) => n + 1);
    if (!this.timer) {
      this.start(performance.now());
      this.timer = setInterval(() => this.publish(performance.now()), WINDOW);
    }
    return () => {
      this.watchers.update((n) => n - 1);
      if (this.watchers()) return;
      clearInterval(this.timer);
      this.timer = undefined;
      this.current.set(null);
    };
  }

  /** A frame drawn, taking `ms` to draw. */
  frame(ms: number): void {
    this.frames++;
    this.drawing += ms;
  }

  /** A frame the GPU took `ms` over (measured a frame or two after it was drawn). */
  gpu(ms: number): void {
    this.gpuFrames++;
    this.gpuDrawing += ms;
  }

  /** The stats over the frames since the last given, at `at`. */
  publish(at: number): void {
    const took = at - this.since;
    if (took <= 0) return;
    const before = this.current();
    this.current.set({
      fps: (this.frames * 1000) / took,
      ms: this.frames ? this.drawing / this.frames : (before?.ms ?? 0),
      gpuMs: this.gpuFrames ? this.gpuDrawing / this.gpuFrames : (before?.gpuMs ?? null),
    });
    this.start(at);
  }

  private start(at: number): void {
    this.frames = 0;
    this.drawing = 0;
    this.gpuFrames = 0;
    this.gpuDrawing = 0;
    this.since = at;
  }
}
