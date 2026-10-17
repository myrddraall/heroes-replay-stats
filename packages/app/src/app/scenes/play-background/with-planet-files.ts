import {
  patchState,
  signalMethod,
  signalStoreFeature,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { PLAY_SCENE_URL } from './play-scene';
import { loadPlanetFile, type PlanetFile } from './scene-planets';

export interface PlanetFilesState {
  /** The planets' and styles' files loaded so far, by id. */
  readonly files: Readonly<Record<string, PlanetFile>>;
}

/**
 * Planets' files (and styles', `style-<id>`) as a store needs them: `needFiles` follows a list of
 * ids and loads each not yet loaded, once; each lands in `files` when it has. One that can't be
 * loaded is left out (a warning says why), and is tried again when asked for again.
 */
export function withPlanetFiles(base: string = PLAY_SCENE_URL) {
  return signalStoreFeature(
    withState<PlanetFilesState>({ files: {} }),
    withProps(() => ({ _loadingFiles: new Set<string>() })),
    withMethods((store) => ({
      needFiles: signalMethod<readonly string[]>((ids) => {
        for (const id of ids) {
          if (store.files()[id] || store._loadingFiles.has(id)) continue;
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
