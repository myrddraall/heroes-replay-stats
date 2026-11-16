import { computed, inject, type Signal, signal } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import {
  resolveShellNav,
  SHELL_AREAS,
  SHELL_SECTIONS,
  SHELL_UTILITY_LINKS,
  type ShellItem,
} from '../model';


const NONE: Signal<ShellItem | null> = signal(null);

/**
 * The shell's navigation for the page shown: the areas and their sections (`provideShellArea`,
 * `provideShellSection`), the utilities' pages (`provideShellUtilityLink`), what the open page has open (a match, a map: `follow`), and the URL
 * (`at`), resolved into the top bar, the sub-bar, the page's side nav, the breadcrumb and the tree.
 * Provided by the shell, so the pages under it reach it.
 */
export const ShellNavStore = signalStore(
  withState({ url: '/' }),
  withProps(() => ({
    areas: inject(SHELL_AREAS),
    sections: inject(SHELL_SECTIONS),
    utilities: inject(SHELL_UTILITY_LINKS),
    /** Where what is open comes from: the open page's signal. */
    source: signal(NONE),
  })),
  withComputed((store) => ({
    item: computed(() => store.source()()),
  })),
  withComputed((store) => ({
    nav: computed(() => resolveShellNav(store.areas, store.sections, store.utilities, store.item(), store.url())),
  })),
  withMethods((store) => ({
    /** The page shown is now at `url`. */
    at(url: string): void {
      patchState(store, { url });
    },
    /** Take what is open from `item` from now on. */
    follow(item: Signal<ShellItem | null>): void {
      store.source.set(item);
    },
    /** Stop following `item`, unless another page's has replaced it. */
    unfollow(item: Signal<ShellItem | null>): void {
      if (store.source() === item) store.source.set(NONE);
    },
  })),
);
