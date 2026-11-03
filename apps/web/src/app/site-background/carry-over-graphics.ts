import { type EnvironmentProviders, provideEnvironmentInitializer } from '@angular/core';
import { storageKey } from '@myrddraall/heroes-replay-stats-aether';
import {
  API_STORAGE_NAME,
  CUSTOM_STORAGE_NAME,
  QUALITY_STORAGE_NAME,
} from '@myrddraall/heroes-replay-stats-aether/graphics';

/** Where the Graphics settings kept the quality, the last custom one, and the API (with the colour). */
const EARLIER_QUALITY = 'hrs.graphics.quality';
const EARLIER_CUSTOM = 'hrs.graphics.custom';
const EARLIER_LOOK = 'hrs.graphics';

/**
 * The quality, the last custom quality and the graphics API the Graphics settings had saved, copied
 * to where Aether's graphics settings keep them, once: where Aether has none of its own yet. List
 * it before `provideAether`, which reads them as the app starts.
 */
export function provideGraphicsCarryOver(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    try {
      const copy = (from: string | null, to: string) => {
        if (from !== null && localStorage.getItem(to) === null) localStorage.setItem(to, from);
      };
      copy(localStorage.getItem(EARLIER_QUALITY), storageKey(QUALITY_STORAGE_NAME)());
      copy(localStorage.getItem(EARLIER_CUSTOM), storageKey(CUSTOM_STORAGE_NAME)());
      const look: unknown = JSON.parse(localStorage.getItem(EARLIER_LOOK) ?? 'null');
      const api =
        typeof look === 'object' && look !== null ? (look as { api?: unknown }).api : null;
      copy(typeof api === 'string' ? api : null, storageKey(API_STORAGE_NAME)());
    } catch {
      // storage unavailable, or what was kept unreadable: the defaults, as for a first visit
    }
  });
}
