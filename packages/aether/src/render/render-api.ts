import { InjectionToken, type Signal, signal } from '@angular/core';

/** Which graphics API a renderer draws with: WebGPU where the browser has it (`auto`), or one asked for. */
export type RenderApi = 'auto' | 'webgpu' | 'webgl2';

/**
 * The graphics API asked for (an app gives its own setting, `provideAether`); none: `auto`. Apart
 * from the renderer, so what sets it up doesn't load three.js.
 */
export const RENDER_API = new InjectionToken<Signal<RenderApi>>('RENDER_API', {
  providedIn: 'root',
  factory: () => signal<RenderApi>('auto'),
});
