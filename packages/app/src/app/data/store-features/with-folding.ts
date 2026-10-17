import { computed } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

export interface FoldingState {
  /** The rows unfolded, by key. */
  readonly expanded: readonly string[];
}

/**
 * Which rows of a tree are unfolded (`expanded`, by key, as kept; `isExpanded` to ask), starting
 * with `initial`; rows folded and unfolded one at a time, or unfolded together.
 */
export function withFolding(initial: readonly string[] = []) {
  return signalStoreFeature(
    withState<FoldingState>({ expanded: initial }),
    withComputed(({ expanded }) => ({
      unfolded: computed(() => new Set(expanded())),
    })),
    withMethods((store) => ({
      isExpanded(key: string): boolean {
        return store.unfolded().has(key);
      },
      toggleExpanded(key: string): void {
        const open = store.unfolded();
        patchState(store, {
          expanded: open.has(key) ? store.expanded().filter((k) => k !== key) : [...open, key],
        });
      },
      expand(...keys: string[]): void {
        const open = store.unfolded();
        const more = keys.filter((k) => !open.has(k));
        if (more.length) patchState(store, { expanded: [...open, ...more] });
      },
    })),
  );
}
