import type { SceneCamera, SceneCameraSet } from '@myrddraall/heroes-replay-stats-aether/formats';
import { computed } from '@angular/core';
import type { AssetMethodsStore, WithSelection } from './asset-editor.store';
import { patchState } from '@ngrx/signals';

/** The camera the stage is seen through: the scene's, or the editor's own as it is moved. */
export function assetCameraViews(store: WithSelection) {
  const { _sceneFile, editorCamera } = store;

  return {
    // The stage is seen through the game's camera, moved where the editor's is (dragged).
    camera: computed((): SceneCamera | null => {
      const scene = _sceneFile.hasValue() ? _sceneFile.value() : null;
      return scene ? { ...scene.camera, ...editorCamera() } : null;
    }),
    lookOptions: computed((): readonly { readonly id: string; readonly label: string }[] => []),
    look: computed(() => ''),
    lookShown: computed(() => ''),
    editorCameraMoved: computed(() => editorCamera() !== null),
  };
}

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
