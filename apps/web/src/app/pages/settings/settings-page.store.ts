import { computed, inject } from '@angular/core';
import { getState, signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import {
  GraphicsStore,
  type GraphicsSettings,
  type Quality,
} from '../../data/settings/graphics.store';
import { PRESETS } from '../../site-background/tint-presets';
import {
  defaultParallelImports,
  deviceCores,
  MAX_PARALLEL_IMPORTS,
  MIN_PARALLEL_IMPORTS,
  SettingsStore,
} from '../../data/settings/settings.store';
import { injectPlatform } from '../../platform/platform';

/** {@link SettingsPanel}'s component store: the settings, the Graphics ones, and this device and app. */
export const SettingsPageStore = signalStore(
  withProps(() => {
    const cores = deviceCores() ?? null;
    return {
      _settings: inject(SettingsStore),
      _graphics: inject(GraphicsStore),
      /** The colours the background can be in. */
      colours: PRESETS,
      platform: injectPlatform(),
      min: MIN_PARALLEL_IMPORTS,
      max: MAX_PARALLEL_IMPORTS,
      cores,
      deviceDefault: defaultParallelImports(cores ?? undefined),
    };
  }),
  withComputed(({ _settings, _graphics }) => ({
    parallelImports: _settings.parallelImports,
    graphics: computed((): GraphicsSettings => getState(_graphics)),
    quality: _graphics.quality,
    /** Whether there is a custom quality to go back to. */
    hasCustom: computed(() => _graphics.custom() !== null),
  })),
  withMethods(({ _settings, _graphics }) => ({
    setParallelImports(n: number): void {
      _settings.setParallelImports(n);
    },
    /** A preset, or back to the last custom quality. */
    setQuality(quality: Quality | 'custom'): void {
      if (quality === 'custom') _graphics.restoreCustom();
      else _graphics.setQuality(quality);
    },
    setGraphics(changes: Partial<GraphicsSettings>): void {
      _graphics.set(changes);
    },
  })),
);
