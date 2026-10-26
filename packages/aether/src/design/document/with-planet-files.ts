import {
  patchState,
  signalMethod,
  signalStoreFeature,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { computed, inject, resource } from '@angular/core';
import { DESIGN_SOURCE } from './design.tokens';
import { createdFiles, lookupIn, sourceFiles } from '../overlays/created-overlays';
import { createdOverlay } from '../overlays/overlays';
import { loadPlaySceneFile } from '../../formats/play-scene';
import { DATA_URL } from '../../formats/data-url';
import { loadPlanetFile } from '../../formats/planet-loader';
import type { PlanetFile } from '../../formats/planet-files';

export interface PlanetFilesState {
  /** The planets' and styles' files loaded so far, by id. */
  readonly _loaded: Readonly<Record<string, PlanetFile>>;
}

/**
 * Planets' files (and overlays', `style-<id>`) as a store needs them: `needFiles` follows a list of
 * ids and loads each not yet loaded, once; each is in `files` when it has. One that can't be
 * loaded is left out (a warning says why), and is tried again when asked for again. The overlays
 * made in the editor (`@overlay-<n>#<revision>`) are built from the design in effect, their
 * materials found where they are in the game data (`madeLookup`): the files they are in are loaded
 * for them, and the scene's (`_sceneFile`) is.
 */
export function withPlanetFiles() {
  return signalStoreFeature(
    withState<PlanetFilesState>({ _loaded: {} }),
    withProps(() => {
      const base = inject(DATA_URL);
      return {
        _base: base,
        _loadingFiles: new Set<string>(),
        _design: inject(DESIGN_SOURCE),
        _sceneFile: resource({
          loader: ({ abortSignal }) => loadPlaySceneFile(base, abortSignal),
        }),
      };
    }),
    withComputed(({ _loaded, _design, _sceneFile }) => {
      /** Finds the materials of overlays made in the editor where they are (those loaded). */
      const madeLookup = computed(() =>
        lookupIn(_loaded(), _sceneFile.hasValue() ? _sceneFile.value() : null),
      );
      return {
        madeLookup,
        /** The files loaded, and the planets' overlays made in the editor (built from them). */
        files: computed((): Readonly<Record<string, PlanetFile>> => ({
          ..._loaded(),
          ...createdFiles(_design.library(), madeLookup()),
        })),
        /** The files the overlays made in the editor read their materials from. */
        _madeSources: computed(() =>
          Object.values(_design.library().created ?? {}).flatMap(sourceFiles),
        ),
      };
    }),
    withMethods((store) => ({
      needFiles: signalMethod<readonly string[]>((ids) => {
        for (const id of ids) {
          // One made in the editor is built (its sources are always needed).
          if (createdOverlay(id) || store._loaded()[id] || store._loadingFiles.has(id)) continue;
          store._loadingFiles.add(id);
          loadPlanetFile(store._base, id)
            .then((file) => patchState(store, { _loaded: { ...store._loaded(), [id]: file } }))
            .catch((error: unknown) => console.warn(`the planet ${id} is not shown:`, error))
            .finally(() => store._loadingFiles.delete(id));
        }
      }),
    })),
    withHooks({
      onInit(store) {
        store.needFiles(store._madeSources);
      },
    }),
  );
}
