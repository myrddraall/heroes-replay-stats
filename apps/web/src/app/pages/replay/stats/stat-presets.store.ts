import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import type { StatColumnChoice } from '@myrddraall/heroes-replay-stats-common/ui';
import { STAT_SECTION_IDS, type StatSectionId } from './stat-sections';

export const STAT_PRESETS_STORAGE_KEY = 'hrs.stat-presets';

/** The user's presets by section, each a named choice of columns. */
export type SavedStatPresets = Readonly<
  Partial<Record<StatSectionId, Readonly<Record<string, readonly StatColumnChoice[]>>>>
>;

function isChoice(v: unknown): v is StatColumnChoice {
  const c = v as Partial<StatColumnChoice> | null;
  return typeof c?.id === 'string' && typeof c.shown === 'boolean';
}

/** What `localStorage` holds, keeping only well-formed presets of known sections. */
export function parseStatPresets(raw: string | null): SavedStatPresets {
  if (raw === null) return {};
  try {
    const saved = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<StatSectionId, Record<string, readonly StatColumnChoice[]>>> = {};
    for (const section of STAT_SECTION_IDS) {
      const presets = saved[section];
      if (typeof presets !== 'object' || presets === null) continue;
      for (const [name, choices] of Object.entries(presets))
        if (Array.isArray(choices) && choices.every(isChoice))
          (out[section] ??= {})[name] = choices;
    }
    return out;
  } catch {
    return {};
  }
}

function load(): SavedStatPresets {
  try {
    return parseStatPresets(localStorage.getItem(STAT_PRESETS_STORAGE_KEY));
  } catch {
    return {};
  }
}

function persist(saved: SavedStatPresets): void {
  try {
    localStorage.setItem(STAT_PRESETS_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // storage unavailable: the presets still apply until the page closes
  }
}

/** The player stats presets the user saved, per section, remembered on this device. */
export const StatPresetsStore = signalStore(
  { providedIn: 'root' },
  withState<{ saved: SavedStatPresets }>({ saved: {} }),
  withMethods((store) => ({
    save(section: StatSectionId, name: string, choices: readonly StatColumnChoice[]): void {
      const saved = store.saved();
      patchState(store, { saved: { ...saved, [section]: { ...saved[section], [name]: choices } } });
      persist(store.saved());
    },
    remove(section: StatSectionId, name: string): void {
      const saved = store.saved();
      const rest = Object.entries(saved[section] ?? {}).filter(([n]) => n !== name);
      patchState(store, { saved: { ...saved, [section]: Object.fromEntries(rest) } });
      persist(store.saved());
    },
  })),
  withHooks({
    onInit(store) {
      patchState(store, { saved: load() });
    },
  }),
);
