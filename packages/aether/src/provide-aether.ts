import { type EnvironmentProviders, makeEnvironmentProviders, type Signal } from '@angular/core';
import { DATA_URL } from './formats/data-url';
import { RENDER_API, type RenderApi } from './render/render-api';
import { STORAGE_NAMES, type StorageNames } from './storage/storage-names';
import { TINT_PRESETS, type TintPreset } from './tints/tint-presets';

/** How an app sets Aether up. */
export interface AetherOptions {
  /** Where the game data the exporter wrote is served, ending in `/`. */
  readonly dataUrl: string;
  /** What things are kept under in this browser (default: Aether's own names). */
  readonly storage?: StorageNames;
  /** The graphics API asked for, read where Aether is injected (default: `auto`). */
  readonly renderApi?: () => Signal<RenderApi>;
  /** The tints a scene's tint is chosen from, the first untinted (default: untinted only). */
  readonly tintPresets?: readonly TintPreset[];
}

/** Aether in an app: where its game data is, and what it takes from the app's settings. */
export function provideAether(options: AetherOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: DATA_URL, useValue: options.dataUrl },
    ...(options.storage ? [{ provide: STORAGE_NAMES, useValue: options.storage }] : []),
    ...(options.renderApi ? [{ provide: RENDER_API, useFactory: options.renderApi }] : []),
    ...(options.tintPresets ? [{ provide: TINT_PRESETS, useValue: options.tintPresets }] : []),
  ]);
}
