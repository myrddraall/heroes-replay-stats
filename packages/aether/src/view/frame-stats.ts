import { computed, Service, signal } from '@angular/core';
import type { FrameSections } from '../render';

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

/**
 * Where the frames' time went over the last while (see `FrameSections`), for finding what is slow:
 * the CPU's ms in each part on average (the still sky's over the frames it was drawn in), how many
 * bodies a frame baked, passes it rendered and draw calls it made, the GPU's pipelines and
 * textures at its end; the camera's moves told it, and the longest wait
 * between two frames drawn.
 */
export interface FrameDetail {
  readonly frames: number;
  readonly moves: number;
  readonly longestGap: number;
  readonly stillFrames: number;
  readonly still: number;
  readonly bakes: number;
  readonly baked: number;
  readonly resized: number;
  readonly passes: number;
  readonly post: number;
  readonly renders: number;
  readonly calls: number;
  readonly pipelines: number;
  readonly textures: number;
  readonly textureMb: number;
  readonly width: number;
  readonly height: number;
  readonly backend: string;
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
  /** Where the time went over the same frames (see `FrameDetail`); none until frames are drawn. */
  readonly detail = signal<FrameDetail | null>(null);
  private sectionList: FrameSections[] = [];
  private moves = 0;
  private lastFrameAt: number | null = null;
  private longestGap = 0;
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
      this.detail.set(null);
    };
  }

  /** A frame drawn, taking `ms` to draw. */
  frame(ms: number, at = performance.now()): void {
    this.frames++;
    this.drawing += ms;
    if (this.lastFrameAt !== null)
      this.longestGap = Math.max(this.longestGap, at - this.lastFrameAt);
    this.lastFrameAt = at;
  }

  /** A frame's parts, as its renderer timed them. */
  sections(s: FrameSections): void {
    this.sectionList.push(s);
  }

  /** The camera moved (a frame to draw from there). */
  moved(): void {
    this.moves++;
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
    const list = this.sectionList;
    const last = list.at(-1);
    if (!last) this.detail.set(null);
    else {
      const mean = (pick: (s: FrameSections) => number, of = list) =>
        of.length ? of.reduce((sum, s) => sum + pick(s), 0) / of.length : 0;
      const still = list.filter((s) => s.stillDrawn);
      this.detail.set({
        frames: list.length,
        moves: this.moves,
        longestGap: this.longestGap,
        stillFrames: still.length,
        still: mean((s) => s.still, still),
        bakes: mean((s) => s.bakes),
        baked: mean((s) => s.baked),
        resized: mean((s) => s.resized),
        passes: mean((s) => s.passes),
        post: mean((s) => s.post),
        renders: mean((s) => s.renders),
        calls: mean((s) => s.calls),
        pipelines: last.pipelines,
        textures: last.textures,
        textureMb: last.textureMb,
        width: last.width,
        height: last.height,
        backend: last.backend,
      });
    }
    this.start(at);
  }

  private start(at: number): void {
    this.frames = 0;
    this.drawing = 0;
    this.gpuFrames = 0;
    this.gpuDrawing = 0;
    this.sectionList = [];
    this.moves = 0;
    this.longestGap = 0;
    this.since = at;
  }
}
