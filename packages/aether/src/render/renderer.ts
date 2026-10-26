import { computed, inject, InjectionToken, type Signal } from '@angular/core';
import { RENDER_API } from './render-api';
import type { LoadedPlayScene, SceneCameraSet } from '../formats/play-scene';
import type { EditingAid } from '../aids/beams';
import type { AddedLight } from '../lights/lights';
import type { SkySettings } from '../formats/settings-types';
import type { Backdrop, PlanetPlacement } from '../space/space';
import { ThreeRenderer } from './three-renderer';
import type { Tint } from '../tints/tints';

type Vec3 = readonly [number, number, number];

/** What draws the Play screen's scene into a canvas, as the scene canvas drives it. */
export interface Renderer {
  timing: boolean;
  streak: number;
  smear: number;
  tint: Tint;
  fadingFrom: Tint;
  fade: number;
  /** How strongly the editor's beams and outlines show, 0 to 1. */
  aidFade: number;
  /** Whether it is still compiling or baking: a frame drawn now isn't the whole picture yet. */
  readonly settling: boolean;
  draw(seconds: number): boolean;
  needsFrame(seconds: number): boolean;
  gpuTimes(): number[];
  anchors(): { id: string; x: number; y: number; top: number }[];
  pick(x: number, y: number, aspect: number): number | null;
  setPlanets(placements: readonly PlanetPlacement[]): void;
  placePlanets(positions: readonly Vec3[], radii?: readonly number[]): void;
  setYaw(yaw: number): void;
  setCamera(set: SceneCameraSet | undefined): void;
  /**
   * The camera an anchored sky moves with: null, the camera that draws; else one put where this
   * says, over the game's (see `sky-anchors.ts`).
   */
  setSkyFollow(set: SceneCameraSet | null): void;
  setSky(settings: SkySettings): void;
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
