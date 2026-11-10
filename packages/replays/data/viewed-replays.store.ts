import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';

export const VIEWED_REPLAYS_STORAGE_KEY = 'hrs.viewed-replays';

/** For each match you opened (by replay id), the import you last saw (its `importedAt`). */
export type SeenImports = Readonly<Record<string, string>>;

/** What `localStorage` holds, keeping only well-formed entries. */
export function parseSeenImports(raw: string | null): SeenImports {
  if (raw === null) return {};
  try {
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return {};
    return Object.fromEntries(
      Object.entries(saved).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
  } catch {
    return {};
  }
}

function load(): SeenImports {
  try {
    return parseSeenImports(localStorage.getItem(VIEWED_REPLAYS_STORAGE_KEY));
  } catch {
    return {};
  }
}

function persist(seen: SeenImports): void {
  try {
    localStorage.setItem(VIEWED_REPLAYS_STORAGE_KEY, JSON.stringify(seen));
  } catch {
    // storage unavailable: the matches still count as viewed until the page closes
  }
}

/** The matches you opened, and which import of each you saw, remembered on this device. */
export const ViewedReplaysStore = signalStore(
  { providedIn: 'root' },
  withState<{ seen: SeenImports }>({ seen: {} }),
  withMethods((store) => ({
    /** You opened this match as it was imported at `importedAt`. */
    markViewed(id: string, importedAt: string): void {
      if (store.seen()[id] === importedAt) return;
      patchState(store, { seen: { ...store.seen(), [id]: importedAt } });
      persist(store.seen());
    },
  })),
  withHooks({
    onInit(store) {
      patchState(store, { seen: load() });
    },
  }),
);
