import { computed, inject, InjectionToken, type Signal } from '@angular/core';
import { GraphicsStore } from '../../data/settings/graphics.store';
import type { LoadedPlayScene, SceneCameraSet } from './play-scene';
import type { LightAid } from './scene-beams';
import type { AddedLight } from './scene-lights';
import type { SkySettings } from './scene-planets';
import type { Backdrop, PlanetPlacement } from './scene-space';
import { ThreeSceneRenderer } from './three/three-scene-renderer';
import type { Tint } from './scene-tints';

type Vec3 = readonly [number, number, number];

/** What draws the Play screen's scene into a canvas, as the scene canvas drives it. */
export interface BackgroundRenderer {
  timing: boolean;
  streak: number;
  smear: number;
  tint: Tint;
  fadingFrom: Tint;
  fade: number;
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
  setSky(settings: SkySettings): void;
  setSceneLights(lights: readonly AddedLight[]): void;
  setBackdrop(backdrop: Backdrop | null): void;
  setBeams(beams: readonly LightAid[]): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

/** Makes the renderer for a canvas and its scene (throws where the browser can't draw it). */
export type BackgroundRendererFactory = (canvas: HTMLCanvasElement, loaded: LoadedPlayScene) => BackgroundRenderer;

/**
 * The renderer the scene canvas draws with, as the Graphics settings choose it: three.js's, on
 * WebGPU or its WebGL 2 backend (`auto`: WebGPU where the browser has it, as `webgpu`; where
 * another API serves better, `auto` is where to say so). A new one each time the choice changes
 * (the canvas makes its renderer again), unless a subtree provides another (the renderer check
 * page draws with three.js on WebGPU and on WebGL 2 at once, to compare the two).
 */
export const BACKGROUND_RENDERER = new InjectionToken<Signal<BackgroundRendererFactory>>('BACKGROUND_RENDERER', {
  providedIn: 'root',
  factory: () => {
    const graphics = inject(GraphicsStore);
    const forceWebGL = computed(() => graphics.api() === 'webgl2');
    return computed((): BackgroundRendererFactory => {
      const options = { forceWebGL: forceWebGL() };
      return (canvas, loaded) => new ThreeSceneRenderer(canvas, loaded, options);
    });
  },
});
