import { computed, inject } from '@angular/core';
import {
  GraphicsSettingsStore,
  type Quality,
} from '@myrddraall/heroes-replay-stats-aether/graphics';
import { getState, signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { BackgroundColourStore } from '../../data/settings/background-colour.store';
import { PRESETS } from '../tint-presets';
import type { GraphicsSettings } from './graphics-form';

/**
 * {@link GraphicsSection}'s component store: the engine's graphics settings (Aether's), the
 * background's colour, and the colours to pick from.
 */
export const GraphicsSectionStore = signalStore(
  withProps(() => ({
    _engine: inject(GraphicsSettingsStore),
    _colour: inject(BackgroundColourStore),
    /** The colours the background can be in. */
    colours: PRESETS,
  })),
  withComputed(({ _engine, _colour }) => ({
    graphics: computed((): GraphicsSettings => ({
      ..._engine.qualityValues(),
      api: _engine.api(),
      ...getState(_colour),
    })),
    quality: _engine.quality,
    /** Whether there is a custom quality to go back to. */
    hasCustom: computed(() => _engine.custom() !== null),
  })),
  withMethods(({ _engine, _colour }) => ({
    /** A preset, or back to the last custom quality. */
    setQuality(quality: Quality | 'custom'): void {
      if (quality === 'custom') _engine.restoreCustom();
      else _engine.setQuality(quality);
    },
    setGraphics({ colourMode, colour, ...engine }: Partial<GraphicsSettings>): void {
      if (colourMode !== undefined || colour !== undefined)
        _colour.set({ ...(colourMode ? { colourMode } : {}), ...(colour ? { colour } : {}) });
      if (Object.keys(engine).length) _engine.set(engine);
    },
  })),
);
