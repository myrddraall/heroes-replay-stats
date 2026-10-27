import {
  cameraAngles,
  fieldOfView,
  forwardOf,
} from '@myrddraall/heroes-replay-stats-aether/camera';
import {
  type AddedCamera,
  cameraSetOf,
  GAME_CAMERA,
  without,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { SceneCamera, SceneCameraSet } from '@myrddraall/heroes-replay-stats-aether/formats';
import { computed } from '@angular/core';
import type { CameraPlaced, CameraPlanet, CameraValues } from '../cameras/camera-properties';
import { bodyLabel } from '../bodies/body';
import type { SceneMethodsStore, WithScene } from './scene-editor.store';
import {
  bodyKey,
  type CameraEntry,
  cameraKey,
  CAMERAS,
  EDITOR_CAMERA,
  SCENE,
  targetOf,
} from './scene-targets';
import { patchState } from '@ngrx/signals';
import type { SceneWrites } from './scene-writes';
import type { Vec3 } from '@myrddraall/heroes-replay-stats-aether/space';

/** The scene's cameras: the game's and those added, the one looked through, the editor's own, and the selected camera's values. */
export function cameraViews(store: WithScene) {
  const {
    look,
    editorCamera,
    selected,
    _random: random,
    groupOpen,
    _choices: choices,
    _browsing: browsing,
    _sceneFileValue: sceneFile,
    _sceneBodiesNow: sceneBodiesNow,
    bodyByKey,
  } = store;
  /** Its cameras, the game's first (none: the random sets'; a group has none of its own). */
  const cameraList = computed((): readonly CameraEntry[] => {
    if (random() || groupOpen()) return [];
    const c = choices();
    return [
      {
        id: GAME_CAMERA,
        name: 'Game camera',
        set: without(c.camera, ['placement']) ?? {},
        game: true,
        ...(c.camera?.placement ? { placement: c.camera.placement } : {}),
      },
      ...(c.cameras ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        set: cameraSetOf(a),
        game: false,
        ...(a.placement ? { placement: a.placement } : {}),
      })),
    ];
  });
  /** The camera it is shown through, by id (the game's unless one added is). */
  const primaryCamera = computed(() => {
    const id = choices().primaryCamera;
    return id && cameraList().some((c) => c.id === id) ? id : GAME_CAMERA;
  });
  const cameraSetById = (id: string) => cameraList().find((c) => c.id === id)?.set;
  /** What the view looks through now: as chosen, but the library's preview through the primary, not the editor's camera. */
  const lookShown = computed(() =>
    browsing() && look() === EDITOR_CAMERA ? primaryCamera() : look(),
  );
  /**
   * The camera the view looks through (none: the random sets', or loading): one of its own,
   * or the editor's, where it has been moved to from its primary.
   */
  const camera = computed((): SceneCamera | null => {
    const scene = sceneFile();
    if (!scene || random()) return null;
    const own = lookShown() === EDITOR_CAMERA ? undefined : cameraSetById(lookShown());
    return own
      ? { ...scene.camera, ...own }
      : { ...scene.camera, ...cameraSetById(primaryCamera()), ...editorCamera() };
  });
  return {
    cameraList,
    primaryCamera,
    lookShown,
    camera,
    /** The cameras added to it, as kept. */
    addedCameras: computed((): readonly AddedCamera[] => choices().cameras ?? []),
    /** Where the view puts the camera, for the background (none: the random sets' own). */
    viewCamera: computed((): SceneCameraSet | undefined => {
      const c = camera();
      return c ? { eye: c.eye, forward: c.forward, fovY: c.fovY } : undefined;
    }),
    /**
     * The scene's camera being authored, for an anchored sky to move with where it doesn't
     * follow the view: the one of its own looked through, else its primary (never the editor's
     * camera); the random sets': the game's.
     */
    sceneCamera: computed((): SceneCameraSet => {
      if (random()) return {};
      const shown = lookShown();
      return cameraSetById(shown === EDITOR_CAMERA ? primaryCamera() : shown) ?? {};
    }),
    /** The selected camera of the scene's. */
    selectedCamera: computed((): CameraEntry | null => {
      const t = targetOf(selected());
      return t.kind === 'camera' ? (cameraList().find((c) => c.id === t.id) ?? null) : null;
    }),
    /** The scene's planets a camera may be placed about, in order: each named, where it is, how big. */
    cameraPlanets: computed((): readonly CameraPlanet[] =>
      sceneBodiesNow().map((p, i) => {
        const b = bodyByKey().get(bodyKey([i]));
        return { label: b ? bodyLabel(b) : p.id, position: p.position, radius: p.radius };
      }),
    ),
    /** The selected camera as its panel shows it: where it is, its turn and tilt, its field of view. */
    cameraValues: computed((): CameraValues | null => {
      const t = targetOf(selected());
      const set = t.kind === 'camera' ? cameraSetById(t.id) : undefined;
      const scene = sceneFile();
      if (!set || !scene) return null;
      const c = { ...scene.camera, ...set };
      // (Its place as kept, to a thousandth: no -0 from the data's.)
      const eye = c.eye.map((v) => Math.round(v * 1000) / 1000 || 0) as unknown as Vec3;
      return { eye, ...cameraAngles(c.forward), fovY: c.fovY };
    }),
    /** What the view may look through: the editor's camera (not in the library's preview), then the scene's (none: no choice). */
    lookOptions: computed((): readonly { readonly id: string; readonly label: string }[] =>
      cameraList().length
        ? [
            ...(browsing() ? [] : [{ id: EDITOR_CAMERA, label: 'Editor camera' }]),
            ...cameraList().map((c) => ({
              id: c.id,
              label: c.id === primaryCamera() ? `${c.name} (primary)` : c.name,
            })),
          ]
        : [],
    ),
    /** Whether the view looks through the editor's camera, moved from the scene's primary. */
    editorCameraMoved: computed(
      () => !random() && !browsing() && look() === EDITOR_CAMERA && editorCamera() !== null,
    ),
  };
}

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
