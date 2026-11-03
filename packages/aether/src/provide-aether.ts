import {
  effect,
  type EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { DATA_URL } from './formats/data-url';
import { GraphicsSettingsStore } from './graphics';
import { RENDER_API } from './render/render-api';
import { STORAGE_NAMES, type StorageNames } from './storage/storage-names';
import { TINT_PRESETS, type TintPreset } from './tints/tint-presets';
import { ViewStore } from './view/view.store';

/** How an app sets Aether up. */
export interface AetherOptions {
  /** Where the game data the exporter wrote is served, ending in `/`. */
  readonly dataUrl: string;
  /** What things are kept under in this browser (default: Aether's own names). */
  readonly storage?: StorageNames;
  /** The tints a scene's tint is chosen from, the first untinted (default: untinted only). */
  readonly tintPresets?: readonly TintPreset[];
}

/** Aether in an app: where its game data is, and its graphics settings applied. */
export function provideAether(options: AetherOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: DATA_URL, useValue: options.dataUrl },
    ...(options.storage ? [{ provide: STORAGE_NAMES, useValue: options.storage }] : []),
    // The graphics settings: the renderer is made for their API, and the background drawn as they say.
    { provide: RENDER_API, useFactory: () => inject(GraphicsSettingsStore).api },
    provideEnvironmentInitializer(() => {
      const graphics = inject(GraphicsSettingsStore);
      const view = inject(ViewStore);
      effect(() => view.setDrawing(graphics.qualityValues()));
    }),
    ...(options.tintPresets ? [{ provide: TINT_PRESETS, useValue: options.tintPresets }] : []),
  ]);
}
