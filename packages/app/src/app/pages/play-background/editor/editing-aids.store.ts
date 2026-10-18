import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { withLocalStorage } from '../../../data/store-features/with-local-storage';
import type { Backdrop } from '../../../scenes/play-background/scene-renderer';

/** What is behind an asset on the preview stage: a sky, a plain colour, or a grid. */
export type BackdropFill = 'sky' | 'colour' | 'grid';
/** What the stand-in planet is: a plain colour, or a grid. */
export type StandInFill = 'colour' | 'grid';
export type GridSize = 'small' | 'medium' | 'large';

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
  readonly gridSize: GridSize;
  /** Whether a material opened on its own is shown on its planet rather than on the stand-in. */
  readonly materialOnPlanet: boolean;
}

export const EDITING_AIDS_DEFAULTS: EditingAidsState = {
  backdrop: 'grid',
  backdropSky: 'play',
  backdropColour: '#2e2e2e',
  standIn: 'grid',
  standInColour: '#9a9a9a',
  gridSize: 'medium',
  materialOnPlanet: false,
};

/** `#rrggbb` as 0 to 1. */
const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * The editor's aids (component store, provided by the Background page): the preview stage's
 * backdrop in place of the sky (the sky, a plain colour, or a transparency grid) and the stand-in
 * planet a material opened on its own is shown on (a plain colour, or the grid). Only there to
 * help edit: kept in this browser, never in the design (not drafted, saved or published).
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
    'gridSize',
    'materialOnPlanet',
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
);
