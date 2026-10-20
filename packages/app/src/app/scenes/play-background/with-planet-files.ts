import {
  patchState,
  signalMethod,
  signalStoreFeature,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { inject } from '@angular/core';
import { BACKGROUND_DESIGN } from './background-design.tokens';
import { createdOf, createdPlanetFile } from './created-overlays';
import { PLAY_SCENE_URL } from './play-scene';
import { loadPlanetFile, type PlanetFile } from './scene-planets';

export interface PlanetFilesState {
  /** The planets' and styles' files loaded so far, by id. */
  readonly files: Readonly<Record<string, PlanetFile>>;
}

/**
 * Planets' files (and overlays', `style-<id>`) as a store needs them: `needFiles` follows a list of
 * ids and loads each not yet loaded, once; each lands in `files` when it has. One that can't be
 * loaded is left out (a warning says why), and is tried again when asked for again. An overlay
 * made in the editor (`@overlay-<n>#<revision>`) is built from the design in effect.
 */
export function withPlanetFiles(base: string = PLAY_SCENE_URL) {
  return signalStoreFeature(
    withState<PlanetFilesState>({ files: {} }),
    withProps(() => ({ _loadingFiles: new Set<string>(), _design: inject(BACKGROUND_DESIGN) })),
    withMethods((store) => ({
      needFiles: signalMethod<readonly string[]>((ids) => {
        for (const id of ids) {
          if (store.files()[id] || store._loadingFiles.has(id)) continue;
          const created = createdOf(store._design.library(), id);
          if (created) {
            if (created.kind === 'planet')
              patchState(store, { files: { ...store.files(), [id]: createdPlanetFile(created) } });
            continue;
          }
          store._loadingFiles.add(id);
          loadPlanetFile(base, id)
            .then((file) => patchState(store, { files: { ...store.files(), [id]: file } }))
            .catch((error: unknown) => console.warn(`the planet ${id} is not shown:`, error))
            .finally(() => store._loadingFiles.delete(id));
        }
      }),
    })),
  );
}
