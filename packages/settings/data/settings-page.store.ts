import { inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import {
  defaultParallelImports,
  deviceCores,
  MAX_PARALLEL_IMPORTS,
  MIN_PARALLEL_IMPORTS,
  SettingsStore,
} from './settings.store';

/** {@link SettingsPanel}'s component store: the importing settings, and this device. */
export const SettingsPageStore = signalStore(
  withProps(() => {
    const cores = deviceCores() ?? null;
    return {
      _settings: inject(SettingsStore),
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
