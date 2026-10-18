import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { withLocalStorage } from '../../../data/store-features/with-local-storage';

/** Which layer the page edits: a scene, or the library. */
export type EditorMode = 'scene' | 'library';

interface EditorUiState {
  readonly mode: EditorMode;
  /** Whether the bodies' names float over them. */
  readonly names: boolean;
  /** Whether the tree's panel and the properties' panel are open. */
  readonly left: boolean;
  readonly right: boolean;
  /** The view's shape (its width over its height), between the panels. */
  readonly aspect: number;
  /** Whether a reset of everything in the layer edited was asked for and waits to be confirmed. */
  readonly confirmingReset: boolean;
  /** Whether the page shows nothing but the background, full screen (to take a screenshot). */
  readonly screenshot: boolean;
}

/**
 * The Background page's own state (component store, provided by the page): which layer it edits,
 * the names over the bodies, its panels, the view's shape, the screenshot mode. Kept in `localStorage`, but for what
 * only lasts while it is open.
 */
export const EditorUiStore = signalStore(
  withState<EditorUiState>({
    mode: 'scene',
    names: true,
    left: true,
    right: true,
    aspect: 16 / 9,
    confirmingReset: false,
    screenshot: false,
  }),
  withLocalStorage<EditorUiState>('hrs.background-editor', ['mode', 'names', 'left', 'right']),
  withMethods((store) => ({
    setMode(mode: EditorMode): void {
      patchState(store, { mode, confirmingReset: false });
    },
    setNames(names: boolean): void {
      patchState(store, { names });
    },
    setPanel(panel: 'left' | 'right', open: boolean): void {
      patchState(store, { [panel]: open });
    },
    setAspect(aspect: number): void {
      if (Number.isFinite(aspect) && aspect > 0) patchState(store, { aspect });
    },
    confirmReset(asked: boolean): void {
      patchState(store, { confirmingReset: asked });
    },
    setScreenshot(screenshot: boolean): void {
      patchState(store, { screenshot });
    },
  })),
);
