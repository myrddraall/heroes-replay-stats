import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';

export const SETTINGS_STORAGE_KEY = 'hrs.settings';
export const MIN_PARALLEL_IMPORTS = 1;
export const MAX_PARALLEL_IMPORTS = 16;
/** Used when the browser does not report its core count. */
export const FALLBACK_PARALLEL_IMPORTS = 2;

export interface Settings {
  /** How many replays are imported at the same time, each in its own worker. */
  readonly parallelImports: number;
}

/** What the user chose; an absent value means "this device's default". */
type SavedSettings = Partial<Settings>;

function clampParallel(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : FALLBACK_PARALLEL_IMPORTS;
  return Math.min(MAX_PARALLEL_IMPORTS, Math.max(MIN_PARALLEL_IMPORTS, v));
}

/**
 * A quarter of the logical cores (2 on a typical 8-thread machine), kept within 1–16.
 * Parsing is CPU-bound and each import holds a whole replay in memory, so this leaves
 * most cores to the page and the rest of the machine. `cores` is
 * `navigator.hardwareConcurrency`, which some browsers do not report.
 */
export function defaultParallelImports(cores: number | undefined): number {
  return cores === undefined || !(cores > 0)
    ? FALLBACK_PARALLEL_IMPORTS
    : clampParallel(Math.floor(cores / 4));
}

/** This device's logical core count, when the browser reports it. */
export function deviceCores(): number | undefined {
  return globalThis.navigator?.hardwareConcurrency;
}

function load(): SavedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const saved = (raw === null ? {} : JSON.parse(raw)) as Partial<Record<keyof Settings, unknown>>;
    return saved.parallelImports === undefined
      ? {}
      : { parallelImports: clampParallel(saved.parallelImports) };
  } catch {
    return {};
  }
}

function save(settings: SavedSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable: the setting still applies until the page closes
  }
}

/**
 * The user's settings. Only values the user chose are kept in `localStorage`; the rest
 * follow this device's defaults.
 */
export const SettingsStore = signalStore(
  { providedIn: 'root' },
  withState<Settings>({ parallelImports: FALLBACK_PARALLEL_IMPORTS }),
  withMethods((store) => ({
    /** Rounded, kept within 1–16, and remembered on this device. */
    setParallelImports(n: number): void {
      const parallelImports = clampParallel(n);
      patchState(store, { parallelImports });
      save({ ...load(), parallelImports });
    },
  })),
  withHooks({
    onInit(store) {
      patchState(store, { parallelImports: defaultParallelImports(deviceCores()), ...load() });
    },
  }),
);
