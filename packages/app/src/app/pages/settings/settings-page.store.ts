import { inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import {
  defaultParallelImports,
  deviceCores,
  MAX_PARALLEL_IMPORTS,
  MIN_PARALLEL_IMPORTS,
  SettingsStore,
} from '../../data/settings/settings.store';
import { injectPlatform } from '../../platform/platform';

/** {@link SettingsPage}'s component store: the settings, and this device and app. */
export const SettingsPageStore = signalStore(
  withProps(() => {
    const cores = deviceCores() ?? null;
    return {
      _settings: inject(SettingsStore),
      platform: injectPlatform(),
      min: MIN_PARALLEL_IMPORTS,
      max: MAX_PARALLEL_IMPORTS,
      cores,
      deviceDefault: defaultParallelImports(cores ?? undefined),
    };
  }),
  withComputed(({ _settings }) => ({
    parallelImports: _settings.parallelImports,
  })),
  withMethods(({ _settings }) => ({
    setParallelImports(n: number): void {
      _settings.setParallelImports(n);
    },
  })),
);
