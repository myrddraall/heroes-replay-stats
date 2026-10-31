import { computed, inject, InjectionToken, type Signal } from '@angular/core';
import { RENDER_API } from './render-api';
import type { LoadedPlayScene, SceneCameraSet } from '../formats/play-scene';
import type { EditingAid } from '../aids/beams';
import type { AddedLight } from '../lights/lights';
import type { DrawnSky } from '../sky/drawn-sky';
import type { Backdrop } from '../space/space';
import type { DrawnBody } from '../bodies/drawn-body';
import { ThreeRenderer } from './three-renderer';
import type { Grading } from '../tints/grading';
import type { Vec3 } from '../space/vectors';

/**
 * How long a frame took on the CPU in each of its parts, in ms, while frames are timed: the still
 * sky drawn again (where `stillDrawn`), the bodies baked again (`baked` of them, `resized` of
 * them into a bake made again at another size), the frame's
 * passes, and bloom, the tone and the aids; its passes rendered and draw calls, the GPU's pipelines
 * and textures made so far (their megabytes too), and what it was drawn at.
 */
export interface FrameSections {
  readonly stillDrawn: boolean;
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

/** What draws the Play screen's scene into a canvas, as the scene canvas drives it. */
export interface Renderer {
  timing: boolean;
  streak: number;
  smear: number;
  grading: Grading;
  fadingFrom: Grading;
  fade: number;
  /** How strongly the editor's beams and outlines show, 0 to 1. */
  aidFade: number;
  /** How bright the sky and the bodies marked dimmed are drawn, 0 to 1 (1: as they are). */
  dim: number;
  /** Whether it is still compiling or baking: a frame drawn now isn't the whole picture yet. */
  readonly settling: boolean;
  draw(seconds: number): boolean;
  needsFrame(seconds: number): boolean;
  gpuTimes(): number[];
  /** The frames drawn since last asked, part by part, while timed (see `FrameSections`). */
  frameSections(): FrameSections[];
  anchors(): { id: string; x: number; y: number; top: number }[];
  pick(x: number, y: number, aspect: number): number | null;
  /** The bodies put up, each as drawn (see `drawnBody`). */
  setBodies(bodies: readonly DrawnBody[]): void;
  placePlanets(positions: readonly Vec3[], radii?: readonly number[]): void;
  setYaw(yaw: number): void;
  setCamera(set: SceneCameraSet | undefined): void;
  /**
   * The camera an anchored sky moves with: null, the camera that draws; else one put where this
   * says, over the game's (see `sky-anchors.ts`).
   */
  setSkyFollow(set: SceneCameraSet | null): void;
  /** The sky shown, as drawn (see `drawnSky`). */
  setSky(sky: DrawnSky): void;
  setSceneLights(lights: readonly AddedLight[]): void;
  setBackdrop(backdrop: Backdrop | null): void;
  setBeams(beams: readonly EditingAid[]): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

/** Makes the renderer for a canvas and its scene (throws where the browser can't draw it). */
export type RendererFactory = (canvas: HTMLCanvasElement, loaded: LoadedPlayScene) => Renderer;

/**
 * The renderer the scene canvas draws with, as the graphics API asked for chooses it: three.js's, on
 * WebGPU or its WebGL 2 backend (`auto`: WebGPU where the browser has it, as `webgpu`; where
 * another API serves better, `auto` is where to say so). A new one each time the choice changes
 * (the canvas makes its renderer again), unless a subtree provides another (the renderer check
 * page draws with three.js on WebGPU and on WebGL 2 at once, to compare the two).
 */
export const RENDERER = new InjectionToken<Signal<RendererFactory>>('RENDERER', {
  providedIn: 'root',
  factory: () => {
    const api = inject(RENDER_API);
    const forceWebGL = computed(() => api() === 'webgl2');
    return computed((): RendererFactory => {
      const options = { forceWebGL: forceWebGL() };
      return (canvas, loaded) => new ThreeRenderer(canvas, loaded, options);
    });
  },
});
