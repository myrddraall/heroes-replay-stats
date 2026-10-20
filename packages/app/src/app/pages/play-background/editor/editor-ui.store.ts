import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  patchState,
  signalMethod,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withLocalStorage } from '../../../data/store-features/with-local-storage';
import { type OpenTarget, openPath } from './open-target';

interface EditorUiState {
  /** Whether the left panel shows the library's lists (else the tree of what is open). */
  readonly browsing: boolean;
  /** Whether the bodies' names float over them. */
  readonly names: boolean;
  /** Whether the view marks a scene's cameras, the groups put in it and the selected's lights. */
  readonly markers: boolean;
  /** Whether the tree's panel and the properties' panel are open. */
  readonly left: boolean;
  readonly right: boolean;
  /** The view's shape (its width over its height), between the panels. */
  readonly aspect: number;
  /** Whether a reset of everything in what is open was asked for and waits to be confirmed. */
  readonly confirmingReset: boolean;
  /** Whether clearing all the saved and drafted design was asked for and waits to be confirmed. */
  readonly confirmingClear: boolean;
  /** Whether the page shows nothing but the background, full screen (to take a screenshot). */
  readonly screenshot: boolean;
}

/**
 * The Background page's own state (component store, provided by the page): whether the lists or
 * the tree of what is open show on the left, the names over the bodies, its panels, the view's
 * shape, the screenshot mode; and what is opened (put in the URL, which the page follows). Kept
 * in `localStorage`, but for what only lasts while it is open.
 */
export const EditorUiStore = signalStore(
  withState<EditorUiState>({
    browsing: true,
    names: true,
    markers: true,
    left: true,
    right: true,
    aspect: 16 / 9,
    confirmingReset: false,
    confirmingClear: false,
    screenshot: false,
  }),
  withLocalStorage<EditorUiState>('hrs.background-editor', ['names', 'markers', 'left', 'right']),
  withProps(() => ({ _router: inject(Router), _followed: { first: true } })),
  withMethods((store) => {
    const navigate = (target: OpenTarget, replaceUrl = false) =>
      void store._router.navigate(openPath(target), { replaceUrl });
    return {
      /** Something selected in the lists: put in the URL, so the background shows it; the lists stay. */
      show(target: OpenTarget): void {
        patchState(store, { confirmingReset: false });
        // A selection changes the history's last step, not adds one (arrowing through a list).
        navigate(target, true);
      },
      /** Something opened in the editor: put in the URL; its tree shown. */
      open(target: OpenTarget): void {
        patchState(store, { browsing: false, confirmingReset: false });
        navigate(target);
      },
      /**
       * What the URL has open (as a key, `<kind>:<id>`): nothing, the library's list (the random sets' scene behind it); as
       * the page starts, something: its tree. Later, what is selected in the list is in the URL
       * too, so a key alone changes nothing.
       */
      followOpen: signalMethod<string | undefined>((key) => {
        const first = store._followed.first;
        store._followed.first = false;
        if (key === undefined) patchState(store, { browsing: true, confirmingReset: false });
        else if (first) patchState(store, { browsing: false });
      }),
      setBrowsing(browsing: boolean): void {
        patchState(store, { browsing });
      },
      setNames(names: boolean): void {
        patchState(store, { names });
      },
      setMarkers(markers: boolean): void {
        patchState(store, { markers });
      },
      setPanel(panel: 'left' | 'right', open: boolean): void {
        patchState(store, { [panel]: open });
      },
      setAspect(aspect: number): void {
        if (Number.isFinite(aspect) && aspect > 0) patchState(store, { aspect });
      },
      confirmReset(asked: boolean): void {
        patchState(store, { confirmingReset: asked, confirmingClear: false });
      },
      confirmClear(asked: boolean): void {
        patchState(store, { confirmingClear: asked, confirmingReset: false });
      },
      setScreenshot(screenshot: boolean): void {
        patchState(store, { screenshot });
      },
    };
  }),
);
