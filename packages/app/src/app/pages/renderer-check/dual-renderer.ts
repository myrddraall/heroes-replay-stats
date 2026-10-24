import type { BackgroundRenderer } from '../../scenes/play-background/background-renderer';
import type { LoadedPlayScene, SceneCameraSet } from '../../scenes/play-background/play-scene';
import type { LightAid } from '../../scenes/play-background/scene-beams';
import type { AddedLight } from '../../scenes/play-background/scene-lights';
import type { SkySettings } from '../../scenes/play-background/scene-planets';
import type { Backdrop, PlanetPlacement } from '../../scenes/play-background/scene-space';
import { NO_TINT, type Tint } from '../../scenes/play-background/scene-tints';
import { ThreeSceneRenderer } from '../../scenes/play-background/three/three-scene-renderer';

type Vec3 = readonly [number, number, number];

/** Which of three.js's backends the check draws with: WebGPU, WebGL 2, or both at once. */
export type CheckMode = 'webgpu' | 'webgl' | 'both';

/** Each backend's renderer as the check's tables and pictures name it. */
export const SLOT_LABELS = { webgpu: 'three.js on WebGPU', webgl: 'three.js on WebGL 2' } as const;

/** One of the check's renderers, and its times (from when the check's renderers were made, ms). */
export interface CheckSlot {
  readonly renderer: ThreeSceneRenderer;
  /** Its first frame drawn (perhaps the sky alone, the planets still compiling). */
  first: number | null;
  /** Its whole picture: its first frame with every body up drawn (every program compiled, every bake whole). */
  whole: number | null;
  /** When the GPU had done all its work up to its whole picture. */
  gpuDone: number | null;
  /** Why it stopped (it threw drawing, or its GPU work couldn't be waited for), if it did. */
  failure: string | null;
}

const slot = (renderer: ThreeSceneRenderer): CheckSlot => ({ renderer, first: null, whole: null, gpuDone: null, failure: null });
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The renderer check's renderers driven as one: three.js on WebGPU, three.js forced to its WebGL 2
 * backend, or both (the WebGL 2 one into the scene canvas, the WebGPU one into a canvas of the
 * page's); every call to each, so each frame is the same scene at the same time. While `holding`,
 * no frame is drawn (the pictures stay as they are, to be compared).
 */
export class DualRenderer implements BackgroundRenderer {
  readonly webgpu: CheckSlot | null;
  readonly webgl: CheckSlot | null;
  /** The scene canvas (the one renderer's where one draws, the WebGL 2 one's where both do). */
  private readonly canvas: HTMLCanvasElement;
  /** Every slot, the scene canvas's first. */
  private readonly slots: CheckSlot[];
  private readonly all: ThreeSceneRenderer[];
  holding = false;
  /** When it was made (`performance.now`): the slots' times are from then, ms. */
  readonly made = performance.now();
  /** Whether the last frame drew in both (else they can't be compared). */
  bothDrew = false;

  constructor(canvas: HTMLCanvasElement, loaded: LoadedPlayScene, pageCanvas: HTMLCanvasElement, mode: CheckMode) {
    this.canvas = canvas;
    // Each canvas keeps one kind of context across tests: the page's WebGPU, the scene's whichever
    // its test draws with (a new scene canvas each test).
    this.webgl = mode === 'webgpu' ? null : slot(new ThreeSceneRenderer(canvas, loaded, { forceWebGL: true }));
    this.webgpu =
      mode === 'webgl' ? null : slot(new ThreeSceneRenderer(mode === 'both' ? pageCanvas : canvas, loaded));
    this.slots = [this.webgl, this.webgpu].filter((s): s is CheckSlot => s !== null);
    this.all = this.slots.map((s) => s.renderer);
  }

  private get first(): ThreeSceneRenderer {
    return this.all[0]!;
  }
  get timing(): boolean {
    return this.first.timing;
  }
  set timing(on: boolean) {
    for (const r of this.all) r.timing = on;
  }
  get streak(): number {
    return this.first.streak;
  }
  set streak(v: number) {
    for (const r of this.all) r.streak = v;
  }
  get smear(): number {
    return this.first.smear;
  }
  set smear(v: number) {
    for (const r of this.all) r.smear = v;
  }
  get tint(): Tint {
    return this.first.tint ?? NO_TINT;
  }
  set tint(v: Tint) {
    for (const r of this.all) r.tint = v;
  }
  get fadingFrom(): Tint {
    return this.first.fadingFrom;
  }
  set fadingFrom(v: Tint) {
    for (const r of this.all) r.fadingFrom = v;
  }
  get fade(): number {
    return this.first.fade;
  }
  set fade(v: number) {
    for (const r of this.all) r.fade = v;
  }
  get settling(): boolean {
    return this.all.some((r) => r.settling);
  }

  draw(seconds: number): boolean {
    if (this.holding) return true;
    const drew = this.slots.map((s) => this.drawSlot(s, seconds));
    this.bothDrew = drew.length === 2 && drew.every(Boolean);
    return drew[0]!;
  }

  /** One slot's frame, its times noted as it is done drawing (not after the other has drawn too). */
  private drawSlot(s: CheckSlot, seconds: number): boolean {
    if (s.failure) return false;
    let drew: boolean;
    try {
      drew = s.renderer.draw(seconds);
    } catch (e) {
      s.failure = message(e);
      return false;
    }
    const at = performance.now() - this.made;
    if (!drew) return false;
    s.first ??= at;
    const { placed, baked } = s.renderer.bodyCounts();
    if (s.whole === null && !s.renderer.settling && placed > 0 && baked === placed) {
      s.whole = at;
      s.renderer.gpuDone().then(
        () => (s.gpuDone = performance.now() - this.made),
        (e: unknown) => (s.failure = message(e)),
      );
    }
    return true;
  }

  /** Why a renderer stopped drawing, if one did. */
  get failedWith(): string | null {
    for (const [name, s] of [
      ['webgl', this.webgl],
      ['webgpu', this.webgpu],
    ] as const) {
      const why = s && (s.renderer.failedWith ?? s.failure);
      if (why) return `${SLOT_LABELS[name]}: ${why}`;
    }
    return null;
  }
  needsFrame(seconds: number): boolean {
    return this.all.some((r) => r.needsFrame(seconds));
  }
  /** The scene canvas's renderer's GPU times (every renderer's taken, so none piles up). */
  gpuTimes(): number[] {
    const times = this.all.map((r) => r.gpuTimes());
    return times[0] ?? [];
  }
  anchors(): { id: string; x: number; y: number; top: number }[] {
    return this.first.anchors();
  }
  pick(x: number, y: number, aspect: number): number | null {
    return this.first.pick(x, y, aspect);
  }
  setPlanets(placements: readonly PlanetPlacement[]): void {
    for (const r of this.all) r.setPlanets(placements);
  }
  placePlanets(positions: readonly Vec3[], radii?: readonly number[]): void {
    for (const r of this.all) r.placePlanets(positions, radii);
  }
  setYaw(yaw: number): void {
    for (const r of this.all) r.setYaw(yaw);
  }
  setCamera(set: SceneCameraSet | undefined): void {
    for (const r of this.all) r.setCamera(set);
  }
  setSkyFollow(set: SceneCameraSet | null): void {
    for (const r of this.all) r.setSkyFollow(set);
  }
  setSky(settings: SkySettings): void {
    for (const r of this.all) r.setSky(settings);
  }
  setSceneLights(lights: readonly AddedLight[]): void {
    for (const r of this.all) r.setSceneLights(lights);
  }
  setBackdrop(backdrop: Backdrop | null): void {
    for (const r of this.all) r.setBackdrop(backdrop);
  }
  setBeams(beams: readonly LightAid[]): void {
    for (const r of this.all) r.setBeams(beams);
  }
  resize(width: number, height: number): void {
    for (const r of this.all) r.resize(width, height);
  }
  dispose(): void {
    for (const r of this.all) r.dispose();
  }

  /** The picture's size, in device pixels (the scene canvas's; the page's beside it is the same size). */
  get size(): { width: number; height: number } {
    return { width: this.canvas.width, height: this.canvas.height };
  }
}
