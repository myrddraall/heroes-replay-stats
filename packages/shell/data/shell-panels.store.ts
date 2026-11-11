import { computed, type TemplateRef } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

/** What a page puts in the shell's right-hand panel: its tools. */
export interface ShellPanelContent {
  /** What the panel is ("Columns"): its name for screen readers and the toolbar's toggle. */
  readonly label: string;
  readonly template: TemplateRef<unknown>;
}

/** Where in the shell's left-hand drawer a page's own content goes: above or below its sections. */
export type ShellSideSlot = 'header' | 'footer';

/**
 * The shell's two drawers, each from under the bars to the window's bottom, the page between them.
 * The right one holds the page's tools (a `hrsShellPanel` template); none while the page has none.
 * The left one holds the page's sections (level 3), with the page's own content above and below
 * them (`hrsShellSide` templates: a match's name over its sections, its facts under them). Provided
 * by the shell, so the pages under it reach it.
 */
export const ShellPanelsStore = signalStore(
  withState({
    end: null as ShellPanelContent | null,
    /** Whether the panel is shown when the page has one; it stays as chosen from page to page. */
    endOpen: true,
    /** The page's own content over its sections in the left-hand drawer. */
    sideHeader: null as TemplateRef<unknown> | null,
    /** The page's own content under its sections in the left-hand drawer. */
    sideFooter: null as TemplateRef<unknown> | null,
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
    showSide(slot: ShellSideSlot, template: TemplateRef<unknown>): void {
      patchState(store, slot === 'header' ? { sideHeader: template } : { sideFooter: template });
    },
    /** Stop showing `template` in the slot, unless another page's has replaced it. */
    clearSide(slot: ShellSideSlot, template: TemplateRef<unknown>): void {
      if (slot === 'header' && store.sideHeader() === template) patchState(store, { sideHeader: null });
      if (slot === 'footer' && store.sideFooter() === template) patchState(store, { sideFooter: null });
    },
  })),
);
