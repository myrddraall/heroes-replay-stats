import { inject, InjectionToken } from '@angular/core';

/** What an app's things are kept under in this browser: keys in `localStorage`, IndexedDB databases. */
export interface StorageNames {
  readonly keyPrefix: string;
  readonly databasePrefix: string;
}

/** The app's storage names (`provideAether`); without one, Aether's own. */
export const STORAGE_NAMES = new InjectionToken<StorageNames>('STORAGE_NAMES', {
  providedIn: 'root',
  factory: () => ({ keyPrefix: 'aether.', databasePrefix: 'aether-' }),
});

/** The `localStorage` key something is kept under, read where it is injected: the app's prefix, then `name`. */
export const storageKey = (name: string) => (): string => inject(STORAGE_NAMES).keyPrefix + name;
