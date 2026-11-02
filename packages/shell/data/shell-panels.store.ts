import { computed, type TemplateRef } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

/** What a page puts in the shell's right-hand panel: its tools. */
export interface ShellPanelContent {
  /** What the panel is ("Columns"): its name for screen readers and the toolbar's toggle. */
  readonly label: string;
  readonly template: TemplateRef<unknown>;
}

/**
 * The shell's extra panel on the right, the window's full height against its edge, which the page
 * fills with its tools (a `hrsShellPanel` template); none while the page has none. Provided by the
 * shell, so the pages under it reach it.
 */
export const ShellPanelsStore = signalStore(
  withState({
    end: null as ShellPanelContent | null,
    /** Whether the panel is shown when the page has one; it stays as chosen from page to page. */
    endOpen: true,
  }),
  withComputed(({ end, endOpen }) => ({
    endShown: computed(() => end() !== null && endOpen()),
  })),
  withMethods((store) => ({
    show(content: ShellPanelContent): void {
      patchState(store, { end: content });
    },
    /** Stop showing `content`, unless another page's has replaced it. */
    clear(content: ShellPanelContent): void {
      if (store.end() === content) patchState(store, { end: null });
    },
    setEndOpen(endOpen: boolean): void {
      patchState(store, { endOpen });
    },
  })),
);
