import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { DEFAULT_THEME, type ThemeSettings, validTheme } from '../model';

/** Where the theme's settings the user chose are kept, as JSON. */
export const THEME_STORAGE_KEY = 'hrs.theme';

/** The settings the user chose on this device. */
function load(): Partial<ThemeSettings> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? 'null');
    return typeof v === 'object' && v !== null ? validTheme(v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * The theme's settings: the neutral theme, how solid the films are, and the blur behind them,
 * kept in `localStorage` once the user changes one; the defaults until then.
 */
export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState<ThemeSettings>(DEFAULT_THEME),
  withMethods((store) => ({
    /** Changes the settings given (each kept within its range), and remembers them on this device. */
    set(changes: Partial<ThemeSettings>): void {
      const kept = validTheme(changes);
      patchState(store, kept);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ ...load(), ...kept }));
      } catch {
        // not kept; the defaults again next session
      }
    },
  })),
  withHooks({
    onInit(store) {
      patchState(store, load());
    },
  }),
);
