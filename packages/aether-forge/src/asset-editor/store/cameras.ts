import { type SceneCamera } from '@myrddraall/heroes-replay-stats-aether/formats';
import { computed } from '@angular/core';
import type { WithSelection } from '../asset-editor.store';

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
