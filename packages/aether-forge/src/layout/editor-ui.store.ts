import { FORGE_OPTIONS } from '../forge-options';
import { storageKey } from '@myrddraall/heroes-replay-stats-aether';
import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  patchState,
  signalMethod,
  signalStore,
  withHooks,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withLocalStorage } from '@myrddraall/heroes-replay-stats-signals';
import { libraryPath, type OpenKind, type OpenTarget, openPath } from './open-target';
import type { MarkerColours } from '../viewport/marker-aids';

/** How soon a second click on the same thing makes a double-click, in milliseconds. */
export const DOUBLE_CLICK = 500;

/**
 * Which markers the view shows: all of them (the unselected lights' small), only the selected
 * thing's (a light's own; a body's: its lights'), or none.
 */
export type MarkerMode = 'all' | 'selected' | 'none';

interface EditorUiState {
  /** Whether the library shows (its lists on the left), as the URL says; else the editor (its tree). */
  readonly browsing: boolean;
  /** Whether the bodies' names float over them. */
  readonly names: boolean;
  /** Which of a scene's cameras, the groups put in it and the selected's lights the view marks. */
  readonly markers: MarkerMode;
  /** Whether the view shows the background's frame stats. */
  readonly stats: boolean;
  /**
   * Whether a sky anchored against the camera moves with the camera the view looks through (as a
   * player would see it); else with the scene's camera, so the view shows it from outside, where
   * it is for that camera.
   */
  readonly skyFollows: boolean;
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
  /** The page of the properties' panel last shown for each kind of thing selected, by kind. */
  readonly panelPages: Readonly<Record<string, string>>;
  /** What the pointer is over in the view, by its row's key: a marker's button, a body's disk. */
  readonly hoveredMarker: string | null;
  readonly hoveredBody: string | null;
  /** The colours the markers are drawn in, as the page's theme has them (read from it once shown). */
  readonly markerColours: MarkerColours;
}

/**
 * The Background page's own state (component store, provided by the page): whether the library or
 * the editor shows (as the URL says), the names over the bodies, its panels, the view's shape, the
 * screenshot mode; and where it goes (the library showing something, the editor opening it: put
 * in the URL, which the page follows). Kept in `localStorage`, but for what only lasts while it is
 * open.
 */
export const EditorUiStore = signalStore(
  withState<EditorUiState>({
    browsing: true,
    names: true,
    markers: 'all',
    stats: false,
    skyFollows: true,
    left: true,
    right: true,
    aspect: 16 / 9,
    confirmingReset: false,
    confirmingClear: false,
    screenshot: false,
    panelPages: {},
    hoveredMarker: null,
    hoveredBody: null,
    markerColours: { edge: [0.85, 0.6, 1], selected: [0.75, 0.4, 1] },
  }),
  withLocalStorage<EditorUiState>(storageKey('editor'), [
    'names',
    'markers',
    'stats',
    'skyFollows',
    'left',
    'right',
    'panelPages',
  ]),
  withComputed((store) => ({
    /** What the pointer is over in the view (a marker's button over a body's disk). */
    hovered: computed(() => store.hoveredMarker() ?? store.hoveredBody()),
  })),
  withProps(() => ({
    _router: inject(Router),
    /** The editor's own URL, what its paths are under. */
    _root: `/${inject(FORGE_OPTIONS).path}`,
    /** The last click on something in the lists: what (its key), and when. */
    _lastClick: { key: '', at: -Infinity },
  })),
  withMethods((store) => {
    const go = (path: string[], replaceUrl = false) => {
      patchState(store, { confirmingReset: false });
      void store._router.navigate([store._root, ...path], { replaceUrl });
    };
    const inLibrary = (target: OpenTarget) => libraryPath(target.kind, target.id || undefined);
    return {
      /**
       * Something shown in the library, its kind listed (the random sets: the scenes): a step of
       * the history's own changed, not one added (arrowing through a list).
       */
      show(target: OpenTarget): void {
        go(inLibrary(target), true);
      },
      /** The library listing a kind of thing (nothing of it shown yet: the random sets behind). */
      showKind(kind: OpenKind): void {
        go(libraryPath(kind), true);
      },
      /** Back to the library from the editor: what was open shown, its kind listed. */
      toLibrary(target: OpenTarget): void {
        go(inLibrary(target));
      },
      /**
       * Something opened in the editor (a step of the history of its own). From the library, the
       * library shows it first, so going back finds it there (a double-click's first click may
       * not have shown it yet: the second's navigation takes over the first's).
       */
      open(target: OpenTarget): void {
        if (!store.browsing()) {
          go(openPath(target));
          return;
        }
        patchState(store, { confirmingReset: false });
        void store._router
          .navigate([store._root, ...inLibrary(target)], { replaceUrl: true })
          .then(() => store._router.navigate([store._root, ...openPath(target)]));
      },
      /** Whether the library shows, as the URL says (else the editor). */
      followBrowsing: signalMethod<boolean>((browsing) => {
        patchState(store, { browsing, confirmingReset: false });
      }),
      /**
       * A click on something in the lists: whether it is the second on it soon after the first (a
       * double-click). Kept here, as the list clicked may not be the one clicked first: showing
       * another kind of thing (a planet after a scene) builds the editor, its list too, afresh.
       */
      clickedAgain(key: string, at = performance.now()): boolean {
        const last = store._lastClick;
        const again = last.key === key && at - last.at <= DOUBLE_CLICK;
        store._lastClick = again ? { key: '', at: -Infinity } : { key, at };
        return again;
      },
      /** A page of the properties' panel shown for a kind of thing, and kept for it. */
      showPanelPage(kind: string, page: string): void {
        patchState(store, { panelPages: { ...store.panelPages(), [kind]: page } });
      },
      setNames(names: boolean): void {
        patchState(store, { names });
      },
      setMarkers(markers: MarkerMode): void {
        patchState(store, { markers });
      },
      setStats(stats: boolean): void {
        patchState(store, { stats });
      },
      setSkyFollows(skyFollows: boolean): void {
        patchState(store, { skyFollows });
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
      /** The pointer onto a marker's button (its key) or off it (none). */
      hoverMarker(key: string | null): void {
        if (key !== store.hoveredMarker()) patchState(store, { hoveredMarker: key });
      },
      /** The pointer onto a body's disk in the view (its key) or off it (none). */
      hoverBody(key: string | null): void {
        if (key !== store.hoveredBody()) patchState(store, { hoveredBody: key });
      },
      setMarkerColours(markerColours: MarkerColours): void {
        patchState(store, { markerColours });
      },
    };
  }),
  withHooks({
    onInit(store) {
      // Kept as on or off before there were modes: all, or none.
      const kept: unknown = store.markers();
      if (typeof kept === 'boolean') patchState(store, { markers: kept ? 'all' : 'none' });
    },
  }),
);
