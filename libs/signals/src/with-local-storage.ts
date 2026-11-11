import { effect } from '@angular/core';
import { getState, patchState, signalStoreFeature, type, withHooks } from '@ngrx/signals';

/** What was kept under a key, as an object; nothing where there is none or it can't be read. */
function read(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Some of a store's state kept in `localStorage` under `key` (or the key a function gives, called
 * where the store is injected): what was kept is put back as the
 * store starts (each of `keys` that was kept), and kept again whenever any of them changes.
 * Where storage can't be read or written the store works as it would without it.
 */
export function withLocalStorage<State extends object>(
  key: string | (() => string),
  keys: readonly (keyof State & string)[],
) {
  return signalStoreFeature(
    type<{ state: State }>(),
    withHooks({
      onInit(store) {
        const at = typeof key === 'function' ? key() : key;
        const kept = read(at);
        if (kept) {
          const restored: Partial<State> = {};
          for (const k of keys) if (kept[k] !== undefined) restored[k] = kept[k] as State[typeof k];
          patchState(store, restored);
        }
        effect(() => {
          const state = getState(store) as State;
          const keep: Partial<State> = {};
          for (const k of keys) keep[k] = state[k];
          try {
            localStorage.setItem(at, JSON.stringify(keep));
          } catch {
            // nowhere to keep it: the store works as it is
          }
        });
      },
    }),
  );
}
