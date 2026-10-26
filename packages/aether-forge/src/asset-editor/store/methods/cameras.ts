import { type SceneCameraSet } from '@myrddraall/heroes-replay-stats-aether/formats';
import { patchState } from '@ngrx/signals';
import type { AssetMethodsStore } from '../../asset-editor.store';

/** The camera the editor looks through. */
export function assetCameraMethods(store: AssetMethodsStore) {
  return {
    /** The camera the stage is seen through moved (dragged in the view): the editor's, kept while the asset is open. */
    moveCamera(set: SceneCameraSet): void {
      patchState(store, { editorCamera: { ...store.editorCamera(), ...set } });
    },
    lookThrough(): void {
      // the stage has one camera (the game's, moved by the editor's)
    },
    /** The editor's camera back where the game's is. */
    resetEditorCamera(): void {
      patchState(store, { editorCamera: null });
    },
  };
}
