import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { DEFAULT_THEME, type ThemeSettings, validTheme } from '../model';

/** Where the theme's settings the user chose are kept, as JSON. */
export const THEME_STORAGE_KEY = 'hrs.theme';
/**
 * Where the Graphics settings kept the theme before it had its own: the look's settings, as JSON,
 * and the quality, whose Ultra and Extreme presets blurred the glass.
 */
const EARLIER_LOOK_KEY = 'hrs.graphics';
const EARLIER_QUALITY_KEY = 'hrs.graphics.quality';
const EARLIER_BLURRED = ['ultra', 'extreme'];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Record<string, unknown> {
  try {
    const v: unknown = raw === null ? null : JSON.parse(raw);
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The settings the user chose; until any is, what the Graphics settings had for them. */
function load(): Partial<ThemeSettings> {
  const saved = read(THEME_STORAGE_KEY);
  if (saved !== null) return validTheme(parse(saved));
  const quality = read(EARLIER_QUALITY_KEY);
  const blur =
    quality === null
      ? undefined
      : EARLIER_BLURRED.includes(quality) || parse(quality)['blur'] === true;
  return validTheme({ ...parse(read(EARLIER_LOOK_KEY)), blur });
}

/**
 * The theme's settings: the theme, the glass and the frame's opacity, and the blur behind the
 * glass, kept in `localStorage` once the user changes one. Until then, what the Graphics settings
 * had for them, or the defaults.
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
