import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { withLocalStorage } from '../../../data/store-features/with-local-storage';
import type { Backdrop } from '../../../scenes/play-background/scene-renderer';
import type { LightSettingsMap } from '../../../scenes/play-background/scene-lights';
import { forgetReference, keepReference, loadReference } from './reference-image';

/** What is behind an asset on the preview stage: a sky, a plain colour, or a grid. */
export type BackdropFill = 'sky' | 'colour' | 'grid';
/** What the stand-in planet is: a plain colour, or a grid. */
export type StandInFill = 'colour' | 'grid';
export type GridSize = 'small' | 'medium' | 'large';
/** How the reference image is laid over the view: beside it past a line, or faded over it. */
export type ReferenceMode = 'split' | 'fade';

/** The reference row's key, in either editor's tree. */
export const REFERENCE_KEY = 'aid/reference';

/** The grid's two colours, as image editors show transparency: white and a light grey. */
export const GRID_COLOURS = ['#ffffff', '#cccccc'] as const;
/** The backdrop grid's squares, in CSS pixels, by size. */
export const GRID_SQUARE: Readonly<Record<GridSize, number>> = { small: 8, medium: 16, large: 32 };

/** The stand-in's grid: how many squares round its equator, by size. */
export const GRID_CELLS: Readonly<Record<GridSize, number>> = { small: 48, medium: 32, large: 16 };

export interface EditingAidsState {
  readonly backdrop: BackdropFill;
  /** The sky the backdrop is, where it is a sky. */
  readonly backdropSky: string;
  readonly backdropColour: string;
  readonly standIn: StandInFill;
  readonly standInColour: string;
  /** What is set for the stand-in's own lights (its ambient light, its directional light), by light. */
  readonly standInLights: LightSettingsMap;
  readonly gridSize: GridSize;
  /** Whether a material opened on its own is shown on its planet rather than on the stand-in. */
  readonly materialOnPlanet: boolean;
  /** The reference image (a picture of the game's own screen) laid over the view, if one is chosen. */
  readonly referenceUrl: string | null;
  readonly referenceName: string;
  readonly referenceShown: boolean;
  readonly referenceMode: ReferenceMode;
  /** Where the split is across the view (0 to 1: the image right of it), or how opaque the image is. */
  readonly referenceAmount: number;
  /** The image as tall as the view times this, its middle moved across and up by shares of the view. */
  readonly referenceScale: number;
  readonly referenceAcross: number;
  readonly referenceUp: number;
}

export const EDITING_AIDS_DEFAULTS: EditingAidsState = {
  backdrop: 'grid',
  backdropSky: 'play',
  backdropColour: '#2e2e2e',
  standIn: 'grid',
  standInColour: '#9a9a9a',
  standInLights: {},
  gridSize: 'medium',
  materialOnPlanet: false,
  referenceUrl: null,
  referenceName: '',
  referenceShown: true,
  referenceMode: 'split',
  referenceAmount: 0.5,
  referenceScale: 1,
  referenceAcross: 0,
  referenceUp: 0,
};

/** `#rrggbb` as 0 to 1. */
const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * The editor's aids (component store, provided by the Background page): the preview stage's
 * backdrop in place of the sky (the sky, a plain colour, or a transparency grid), the stand-in
 * planet a material opened on its own is shown on (a plain colour, or the grid), and a reference
 * image laid over the view to compare it with (split or faded, fitted to it). Only there to help
 * edit: kept in this browser, never in the design (not drafted, saved or published).
 */
export const EditingAidsStore = signalStore(
  withState<EditingAidsState>(EDITING_AIDS_DEFAULTS),
  // (A new key: the first one kept the sky, the backdrop's first default, as if chosen.)
  withLocalStorage<EditingAidsState>('hrs.background-editing-aids-2', [
    'backdrop',
    'backdropSky',
    'backdropColour',
    'standIn',
    'standInColour',
    'standInLights',
    'gridSize',
    'materialOnPlanet',
    'referenceShown',
    'referenceMode',
    'referenceAmount',
    'referenceScale',
    'referenceAcross',
    'referenceUp',
  ]),
  withComputed(({ backdrop, backdropColour, gridSize }) => ({
    /** The backdrop as the renderer takes it (none: the game's sky). */
    rendererBackdrop: computed((): Backdrop | null => {
      switch (backdrop()) {
        case 'sky':
          return null;
        case 'colour':
          return { kind: 'colour', colour: rgb(backdropColour()) };
        case 'grid':
          return {
            kind: 'grid',
            size: GRID_SQUARE[gridSize()],
            colours: [rgb(GRID_COLOURS[0]), rgb(GRID_COLOURS[1])],
          };
      }
    }),
  })),
  withMethods((store) => ({
    /** A reference image chosen (in place of any before it), shown, and kept for another visit. */
    chooseReference(image: Blob, name: string): void {
      const old = store.referenceUrl();
      if (old) URL.revokeObjectURL(old);
      patchState(store, {
        referenceUrl: URL.createObjectURL(image),
        referenceName: name,
        referenceShown: true,
      });
      void keepReference({ image, name });
    },
    /** The reference image taken away, and no longer kept. */
    clearReference(): void {
      const old = store.referenceUrl();
      if (old) URL.revokeObjectURL(old);
      patchState(store, { referenceUrl: null, referenceName: '' });
      void forgetReference();
    },
    set(change: Partial<EditingAidsState>): void {
      patchState(store, change);
    },
    /** Some of the aids back as they start. */
    reset(keys: readonly (keyof EditingAidsState)[]): void {
      patchState(
        store,
        Object.fromEntries(
          keys.map((k) => [k, EDITING_AIDS_DEFAULTS[k]]),
        ) as Partial<EditingAidsState>,
      );
    },
  })),
  withHooks({
    onInit(store) {
      // The image kept from before, unless one was chosen while it loaded.
      void loadReference().then((kept) => {
        if (kept && !store.referenceUrl())
          patchState(store, {
            referenceUrl: URL.createObjectURL(kept.image),
            referenceName: kept.name,
          });
      });
    },
    onDestroy(store) {
      const url = store.referenceUrl();
      if (url) URL.revokeObjectURL(url);
    },
  }),
);
