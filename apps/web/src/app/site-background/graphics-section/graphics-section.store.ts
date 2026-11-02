import { computed, inject } from '@angular/core';
import { getState, signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import {
  GraphicsStore,
  type GraphicsSettings,
  type Quality,
} from '../../data/settings/graphics.store';
import { PRESETS } from '../tint-presets';

/** {@link GraphicsSection}'s component store: the Graphics settings and the colours to pick from. */
export const GraphicsSectionStore = signalStore(
  withProps(() => ({
    _graphics: inject(GraphicsStore),
    /** The colours the background can be in. */
    colours: PRESETS,
  })),
  withComputed(({ _graphics }) => ({
    graphics: computed((): GraphicsSettings => getState(_graphics)),
    quality: _graphics.quality,
    /** Whether there is a custom quality to go back to. */
    hasCustom: computed(() => _graphics.custom() !== null),
  })),
  withMethods(({ _graphics }) => ({
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
