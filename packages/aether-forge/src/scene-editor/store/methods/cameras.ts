import { fieldOfView, forwardOf } from '@myrddraall/heroes-replay-stats-aether/camera';
import { type AddedCamera } from '@myrddraall/heroes-replay-stats-aether/design';
import { type SceneCameraSet } from '@myrddraall/heroes-replay-stats-aether/formats';
import { patchState } from '@ngrx/signals';
import type { CameraPlaced, CameraValues } from '../../../properties/camera/camera-properties';
import { CAMERAS, EDITOR_CAMERA, SCENE, cameraKey } from '../../scene-targets';
import type { SceneMethodsStore } from '../../scene-editor.store';
import type { SceneWrites } from './scene-writes';

/** The scene's cameras, and the camera the editor looks through. */
export function cameraMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, dropCamera, changeCamera } = w;
  return {
    /**
     * The camera the view looks through moved (dragged in the view): the editor's, kept while
     * the scene is open; one of the scene's, kept with it.
     */
    moveCamera(set: SceneCameraSet): void {
      if (store.sets() || store._ui.browsing()) return; // the library's preview isn't moved
      if (store.look() === EDITOR_CAMERA || !store.cameraList().some((c) => c.id === store.look()))
        patchState(store, { editorCamera: { ...store.editorCamera(), ...set } });
      else changeCamera(store.look(), set);
    },
    /** The selected camera set in its panel: where it is, its turn and tilt, its field of view. */
    setCamera(change: Partial<CameraValues>): void {
      const now = store.cameraValues();
      const c = store.selectedCamera();
      if (!now || !c) return;
      const { turn = now.turn, tilt = now.tilt } = change;
      changeCamera(c.id, {
        ...(change.eye ? { eye: change.eye } : {}),
        ...(change.turn !== undefined || change.tilt !== undefined
          ? { forward: forwardOf(turn, tilt) }
          : {}),
        ...(change.fovY !== undefined ? { fovY: fieldOfView(change.fovY) } : {}),
      });
    },
    /** The selected camera placed (about a planet, or in the scene's own space): where it is now, how it is set. */
    setCameraPlacement(change: CameraPlaced): void {
      const c = store.selectedCamera();
      if (c) changeCamera(c.id, { eye: change.eye, placement: change.placement });
    },
    /** The game's camera, selected, back where the game puts it. */
    resetCamera(): void {
      if (store.selectedCamera()?.game) d.setSceneCamera(store.scene(), undefined);
    },
    /** A camera added where the view looks from (named after those there are): selected. */
    addCamera(): void {
      const view = store.camera();
      if (!view || !store.cameraList().length) return;
      const cameras = store.addedCameras();
      const taken = new Set(store.cameraList().map((c) => c.name));
      let n = cameras.length + 1;
      while (taken.has(`Camera ${n}`)) n++;
      const camera: AddedCamera = {
        id: `camera-${Math.random().toString(36).slice(2, 10)}`,
        name: `Camera ${n}`,
        eye: view.eye,
        forward: view.forward,
        fovY: view.fovY,
      };
      d.setSceneCameras(store.scene(), [...cameras, camera]);
      store.expand(SCENE);
      store.reopen(CAMERAS);
      patchState(store, { selected: cameraKey(camera.id) });
    },
    /** The selected camera (one added) named ('': as it was). */
    renameCamera(name: string): void {
      const c = store.selectedCamera();
      const named = name.trim();
      if (!c || c.game || !named) return;
      d.setSceneCameras(
        store.scene(),
        store.addedCameras().map((a) => (a.id === c.id ? { ...a, name: named } : a)),
      );
    },
    /** The selected camera (one added) taken out; the view through it back to the editor's. */
    removeCamera(): void {
      const c = store.selectedCamera();
      if (!c || c.game) return;
      dropCamera(c.id);
      patchState(store, { selected: CAMERAS });
    },
    /** The scene shown through the selected camera. */
    makePrimary(): void {
      const c = store.selectedCamera();
      if (c) d.setPrimaryCamera(store.scene(), c.id);
    },
    /** The view seen through one of the scene's cameras, or the editor's (`EDITOR_CAMERA`). */
    lookThrough(id: string): void {
      patchState(store, {
        look: store.cameraList().some((c) => c.id === id) ? id : EDITOR_CAMERA,
      });
    },
    /** The editor's camera back where the scene's primary is. */
    resetEditorCamera(): void {
      patchState(store, { editorCamera: null });
    },
  };
}
