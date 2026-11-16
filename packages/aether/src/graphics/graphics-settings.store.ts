import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import type { RenderApi } from '../render/render-api';
import { storageKey } from '../storage/storage-names';
import {
  type GraphicsQuality,
  type GraphicsSettings,
  type Quality,
  QUALITIES,
  QUALITY_KEYS,
  QUALITY_PRESETS,
  qualityOf,
  RENDER_APIS,
  validGraphics,
  validQuality,
} from './graphics-settings';
import { HARDWARE_ACCELERATION } from './hardware-acceleration';

/** Where the quality is kept (after the app's prefix): a preset's id, or when custom all its values, as JSON. */
export const QUALITY_STORAGE_NAME = 'graphics.quality';
/** Where the last custom quality is kept, as JSON, to go back to after trying a preset. */
export const CUSTOM_STORAGE_NAME = 'graphics.custom';
/** Where the graphics API chosen is kept. */
export const API_STORAGE_NAME = 'graphics.api';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the settings still apply until the page closes
  }
}

function parse(raw: string | null): unknown {
  try {
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * The engine's graphics settings, an app's to show however it likes: the quality (a preset, or
 * custom as soon as one of its values is changed) and the graphics API, kept in `localStorage`
 * under the app's prefix: the quality as its preset's id, or all its values when custom. Until
 * chosen, High, or Low where the browser draws without hardware acceleration (it costs the CPU
 * dearly then); until a quality is chosen it is detected again on each load, so turning
 * acceleration on or off shows. The last custom quality is kept too: a change that leaves the
 * quality at no preset becomes it, and choosing a preset leaves it, so it can be had back.
 * `provideAether` has the background drawn, and the renderer made, by them.
 */
export const GraphicsSettingsStore = signalStore(
  { providedIn: 'root' },
  withState<GraphicsSettings & { custom: GraphicsQuality | null }>({
    ...QUALITY_PRESETS.high,
    api: 'auto',
    custom: null,
  }),
  withProps(() => ({
    _qualityKey: storageKey(QUALITY_STORAGE_NAME)(),
    _customKey: storageKey(CUSTOM_STORAGE_NAME)(),
    _apiKey: storageKey(API_STORAGE_NAME)(),
  })),
  withComputed((store) => {
    const values = computed((): GraphicsQuality => ({
      animate: store.animate(),
      idleFps: store.idleFps(),
      animationFps: store.animationFps(),
      interactingFps: store.interactingFps(),
      resolution: store.resolution(),
    }));
    return {
      /** The quality's values as they are. */
      qualityValues: values,
      /** The quality preset the settings are at; custom when they are at none. */
      quality: computed(() => qualityOf(values())),
    };
  }),
  withMethods((store) => {
    /** Changes the settings given (each kept within its range), and remembers them on this device. */
    const set = (changes: Partial<GraphicsSettings>): void => {
      const kept = validGraphics(changes);
      patchState(store, kept);
      if (QUALITY_KEYS.some((k) => k in kept)) {
        // The settings at no preset are the custom quality from now on.
        if (store.quality() === 'custom') patchState(store, { custom: store.qualityValues() });
        const quality = store.quality();
        write(
          store._qualityKey,
          quality === 'custom' ? JSON.stringify(store.qualityValues()) : quality,
        );
        const custom = store.custom();
        if (custom) write(store._customKey, JSON.stringify(custom));
      }
      if (kept.api) write(store._apiKey, kept.api);
    };
    return {
      set,
      /** Sets the quality's values to a preset's; the last custom quality is kept. */
      setQuality(quality: Quality): void {
        set(QUALITY_PRESETS[quality]);
      },
      /** Back to the last custom quality, if there is one. */
      restoreCustom(): void {
        const custom = store.custom();
        if (custom) set(custom);
      },
    };
  }),
  withHooks({
    onInit(store) {
      const raw = read(store._qualityKey);
      const preset = QUALITIES.find((q) => q === raw);
      // Without hardware acceleration, Low: the CPU draws it all then.
      const detected = inject(HARDWARE_ACCELERATION) ? 'high' : 'low';
      const quality = preset ? QUALITY_PRESETS[preset] : validQuality(parse(raw));
      const api = RENDER_APIS.find((a) => a === read(store._apiKey)) as RenderApi | undefined;
      patchState(store, quality ?? QUALITY_PRESETS[detected], {
        ...(api ? { api } : {}),
        custom: validQuality(parse(read(store._customKey))),
      });
      if (store.quality() === 'custom') patchState(store, { custom: store.qualityValues() });
    },
  }),
);
