import { cameraAngles } from '@myrddraall/heroes-replay-stats-aether/camera';
import {
  type AddedCamera,
  cameraSetOf,
  GAME_CAMERA,
  type Vec3,
  without,
} from '@myrddraall/heroes-replay-stats-aether/design';
import {
  type SceneCamera,
  type SceneCameraSet,
} from '@myrddraall/heroes-replay-stats-aether/formats';
import { computed } from '@angular/core';
import type { CameraPlanet, CameraValues } from '../../properties/camera/camera-properties';
import { bodyLabel } from '../../editing/model/body';
import type { WithScene } from '../scene-editor.store';
import { CameraEntry, EDITOR_CAMERA, targetOf, bodyKey } from '../scene-targets';

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
