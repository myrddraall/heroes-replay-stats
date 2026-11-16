import { STORAGE_NAMES, storageKey } from '@myrddraall/heroes-replay-stats-aether';
import type { LightSettingsMap } from '@myrddraall/heroes-replay-stats-aether/lights';
import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withLocalStorage } from '@myrddraall/heroes-replay-stats-signals';
import { forgetReference, keepReference, loadReference } from './reference-image';
import type { PreviewKind, PreviewSetup } from './preview-setup';

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
  /** Each library item's own Preview stage, as set for it (by its key: see `openKey`). */
  readonly previews: Readonly<Record<string, Partial<PreviewSetup>>>;
  /** Each kind's, as set for all of that kind (over what it starts with: see `previewDefault`). */
  readonly kindPreviews: Readonly<Partial<Record<PreviewKind, Partial<PreviewSetup>>>>;
  readonly standInLights: LightSettingsMap;
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
  previews: {},
  kindPreviews: {},
  standInLights: {},
  referenceUrl: null,
  referenceName: '',
  referenceShown: true,
  referenceMode: 'split',
  referenceAmount: 0.5,
  referenceScale: 1,
  referenceAcross: 0,
  referenceUp: 0,
};

/**
 * The editor's aids (component store, provided by the Background page): each library item's
 * Preview stage (its backdrop in place of the sky, the stand-in planet's fill, the planet an
 * overlay is worn by: see `PreviewSetup`), as set for it or for its kind; the stand-in's lights;
 * and a reference
 * image laid over the view to compare it with (split or faded, fitted to it). Only there to help
 * edit: kept in this browser, never in the design (not drafted, saved or published).
 */
export const EditingAidsStore = signalStore(
  withState<EditingAidsState>(EDITING_AIDS_DEFAULTS),
  // (A new key: the first one kept the sky, the backdrop's first default, as if chosen.)
  withLocalStorage<EditingAidsState>(storageKey('editing-aids-2'), [
    'previews',
    'kindPreviews',
    'standInLights',
    'referenceShown',
    'referenceMode',
    'referenceAmount',
    'referenceScale',
    'referenceAcross',
    'referenceUp',
  ]),
  withProps(() => ({ _database: `${inject(STORAGE_NAMES).databasePrefix}editor` })),
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
      void keepReference(store._database, { image, name });
    },
    /** The reference image taken away, and no longer kept. */
    clearReference(): void {
      const old = store.referenceUrl();
      if (old) URL.revokeObjectURL(old);
      patchState(store, { referenceUrl: null, referenceName: '' });
      void forgetReference(store._database);
    },
    set(change: Partial<EditingAidsState>): void {
      patchState(store, change);
    },
    /**
     * An item's Preview stage (`key`; of a `kind`): as it is set for it, else for its kind, else as
     * the kind starts (`base`).
     */
    previewOf(key: string, kind: PreviewKind, base: PreviewSetup): PreviewSetup {
      return { ...base, ...store.kindPreviews()[kind], ...store.previews()[key] };
    },
    /** Some of an item's Preview stage set for it. */
    setPreview(key: string, change: Partial<PreviewSetup>): void {
      patchState(store, {
        previews: { ...store.previews(), [key]: { ...store.previews()[key], ...change } },
      });
    },
    /** Some of an item's Preview stage (all: none named) back as its kind has it. */
    clearPreview(key: string, keys?: readonly (keyof PreviewSetup)[]): void {
      const own = { ...store.previews()[key] };
      for (const k of keys ?? (Object.keys(own) as (keyof PreviewSetup)[])) delete own[k];
      const previews = { ...store.previews() };
      if (Object.keys(own).length) previews[key] = own;
      else delete previews[key];
      patchState(store, { previews });
    },
    /** An item's Preview stage made its kind's: every item of the kind not set otherwise shown so. */
    usePreviewForKind(key: string, kind: PreviewKind): void {
      const own = store.previews()[key] ?? {};
      const previews = { ...store.previews() };
      delete previews[key];
      patchState(store, {
        previews,
        kindPreviews: {
          ...store.kindPreviews(),
          [kind]: { ...store.kindPreviews()[kind], ...own },
        },
      });
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
      void loadReference(store._database).then((kept) => {
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
