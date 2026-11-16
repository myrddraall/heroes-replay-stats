import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { type ViewTints, type PartTint, NO_TINTS } from '../tints/tints';

/** How the background is drawn: what it costs. */
export interface ViewDrawing {
  /** Whether it moves; when not, it is drawn once for each page, cross-fading from the last. */
  readonly animate: boolean;
  /** Frames a second at most while it just moves. */
  readonly idleFps: number;
  /** Frames a second at most while it fades (a change of tint). */
  readonly animationFps: number;
  /** Frames a second at most, fading or not, while something asked for it (0: it stops). */
  readonly interactingFps: number;
  /** The share of the display's resolution it is drawn at (0–1). */
  readonly resolution: number;
}

/** The drawing until told otherwise: the High quality preset's. */
export const DEFAULT_DRAWING: ViewDrawing = {
  animate: true,
  idleFps: 12,
  animationFps: 60,
  interactingFps: 6,
  resolution: 1,
};

/** Gives back what was asked for; calling it again does nothing. */
export type Release = () => void;

interface BackgroundState {
  /** The site's tints. */
  readonly siteTints: ViewTints;
  /** The tints the open page holds over the site's, if it does. */
  readonly pageTints: ViewTints | null;
  readonly drawing: ViewDrawing;
  /** How many asked for the interacting frame rate and haven't given it back. */
  readonly interacting: number;
  /** Counts the pictures asked for, one for each page: a background that doesn't move draws one. */
  readonly picture: number;
  /** Which set of planets is up: 0 the game's own; any other, a set drawn from that number. */
  readonly planetSet: number;
}

/**
 * The site's Play screen background: how it is tinted, and how it is drawn.
 * What sets a tint calls this; the background follows it. The site's tint is the Graphics
 * settings' colour; a page can hold its own over it while it is open.
 * Something that needs the page to itself for a while (the map while it is dragged) asks for the
 * interacting frame rate, and gives it back when done.
 * The planets up are a set by number: the game's own (0) as the site loads, then one drawn from
 * each number in turn (`nextPlanetSet`, each page), the background flying to it.
 */
export const ViewStore = signalStore(
  { providedIn: 'root' },
  withState<BackgroundState>({
    siteTints: NO_TINTS,
    pageTints: null,
    drawing: DEFAULT_DRAWING,
    interacting: 0,
    picture: 0,
    planetSet: 0,
  }),
  withComputed((store) => ({
    /** The tints shown: the page's, or the site's. */
    tints: computed(() => store.pageTints() ?? store.siteTints()),
    /** Frames a second at most while it just moves. */
    fps: computed(() =>
      store.interacting() ? store.drawing().interactingFps : store.drawing().idleFps,
    ),
    /** Frames a second at most while it fades. */
    fadeFps: computed(() =>
      store.interacting() ? store.drawing().interactingFps : store.drawing().animationFps,
    ),
  })),
  withMethods((store) => ({
    setDrawing(drawing: ViewDrawing): void {
      patchState(store, { drawing });
    },
    /** The site's tints. */
    setTints(siteTints: ViewTints): void {
      patchState(store, { siteTints });
    },
    /** The site's whole background's tint; null untints it. */
    setBackgroundTint(background: PartTint | null): void {
      patchState(store, { siteTints: { background } });
    },
    /** The open page's tints over the site's; null gives the site's back (a page does, closing). */
    setPageTints(pageTints: ViewTints | null): void {
      patchState(store, { pageTints });
    },
    /** A new picture, for a new page: drawn when the background doesn't move. */
    newPicture(): void {
      patchState(store, { picture: store.picture() + 1 });
    },
    /** The next set of planets, drawn from the next number. */
    nextPlanetSet(): void {
      patchState(store, { planetSet: store.planetSet() + 1 });
    },
    /** A set of planets by number: 0 the game's own. */
    setPlanetSet(planetSet: number): void {
      patchState(store, { planetSet });
    },
    /** The interacting frame rate, until released; any number can hold it at once. */
    requestInteracting(): Release {
      patchState(store, { interacting: store.interacting() + 1 });
      let held = true;
      return () => {
        if (!held) return;
        held = false;
        patchState(store, { interacting: store.interacting() - 1 });
      };
    },
  })),
);
