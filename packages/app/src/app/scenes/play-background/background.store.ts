import { DOCUMENT } from '@angular/common';
import { computed, effect, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import type { PlanetSet } from './planet-sets';
import { PLANETS, type BackgroundTints, type PartTint, type PlanetSize, UNTINTED } from './scene-tints';

/** How the background is drawn: what it costs. */
export interface BackgroundDrawing {
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
export const DEFAULT_DRAWING: BackgroundDrawing = {
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
  readonly siteTints: BackgroundTints;
  /** The tints the open page holds over the site's, if it does. */
  readonly pageTints: BackgroundTints | null;
  readonly drawing: BackgroundDrawing;
  /** How many asked for the interacting frame rate and haven't given it back. */
  readonly interacting: number;
  /** Counts the pictures asked for, one for each page: a background that doesn't move draws one. */
  readonly picture: number;
  /** Which set of planets is up: 0 the game's own; any other, a set drawn from that number. */
  readonly planetSet: number;
  /** The planets the open page holds up instead, if it does (the Background page, reviewing one). */
  readonly pagePlanets: PlanetSet | null;
}

/**
 * The site's Play screen background: how it is tinted, the whole of it and each planet on its own,
 * and how it is drawn.
 * What sets a tint calls this; the background follows it. The site's tints are the Graphics
 * settings' colour; a page can hold its own over them while it is open. As a side effect the tints
 * shown are on the root element as custom properties for the interface to use:
 * `--hrs-background-tint` and `--hrs-background-tint-blend`, and each planet's,
 * `--hrs-planet-<size>-tint` and `-blend` (the background's where it has none of its own), none set
 * where nothing is tinted.
 * Something that needs the page to itself for a while (the map while it is dragged) asks for the
 * interacting frame rate, and gives it back when done.
 * The planets up are a set by number: the game's own (0) as the site loads, then one drawn from
 * each number in turn (`nextPlanetSet`, each page), the background flying to it.
 */
export const BackgroundStore = signalStore(
  { providedIn: 'root' },
  withState<BackgroundState>({
    siteTints: UNTINTED,
    pageTints: null,
    drawing: DEFAULT_DRAWING,
    interacting: 0,
    picture: 0,
    planetSet: 0,
    pagePlanets: null,
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
    setDrawing(drawing: BackgroundDrawing): void {
      patchState(store, { drawing });
    },
    /** The site's tints. */
    setTints(siteTints: BackgroundTints): void {
      patchState(store, { siteTints });
    },
    /** The site's whole background's tint; null untints it (the planets with their own keep theirs). */
    setBackgroundTint(background: PartTint | null): void {
      patchState(store, { siteTints: { ...store.siteTints(), background } });
    },
    /** A planet's own tint on the site; null has it follow the background again. */
    setPlanetTint(size: PlanetSize, tint: PartTint | null): void {
      const planets = { ...store.siteTints().planets };
      if (tint) planets[size] = tint;
      else delete planets[size];
      patchState(store, { siteTints: { ...store.siteTints(), planets } });
    },
    /** The open page's tints over the site's; null gives the site's back (a page does, closing). */
    setPageTints(pageTints: BackgroundTints | null): void {
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
    /** The open page's planets instead of the set; null gives the set back (a page does, closing). */
    setPagePlanets(pagePlanets: PlanetSet | null): void {
      patchState(store, { pagePlanets });
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
  withHooks({
    onInit(store) {
      const root = inject(DOCUMENT).documentElement;
      effect(() => {
        const { background, planets } = store.tints();
        const set = (name: string, tint: PartTint | null | undefined) => {
          if (tint) {
            root.style.setProperty(`--hrs-${name}-tint`, tint.colour);
            root.style.setProperty(`--hrs-${name}-tint-blend`, tint.blend);
          } else {
            root.style.removeProperty(`--hrs-${name}-tint`);
            root.style.removeProperty(`--hrs-${name}-tint-blend`);
          }
        };
        set('background', background);
        for (const size of PLANETS) set(`planet-${size}`, planets[size] ?? background);
      });
    },
  }),
);
