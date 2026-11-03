import type { TemplateRef } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

/**
 * What the pages put under the shell's main nav items, by the item's path (`/replays`): a page's
 * own navigation, shown under its parent's item while the page is open. Provided by the shell, so
 * the pages under it reach it.
 */
export const ShellNavStore = signalStore(
  withState({ children: {} as Readonly<Record<string, TemplateRef<unknown>>> }),
  withMethods((store) => ({
    show(path: string, template: TemplateRef<unknown>): void {
      patchState(store, { children: { ...store.children(), [path]: template } });
    },
    /** Stop showing `template` under `path`, unless another page's has replaced it. */
    clear(path: string, template: TemplateRef<unknown>): void {
      if (store.children()[path] !== template) return;
      const rest = Object.entries(store.children()).filter(([p]) => p !== path);
      patchState(store, { children: Object.fromEntries(rest) });
    },
  })),
);
