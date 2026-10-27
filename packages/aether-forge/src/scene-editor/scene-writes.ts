import {
  type BodyPath,
  type CameraPlacement,
  changedLight,
  changeSettings,
  GAME_CAMERA,
  type GroupPlacement,
  pathKey,
  pathOf,
  removeAt,
  type SceneBody,
  setOverlays,
  storedBodies,
  withLightChange,
  withMaterial,
  without,
  indexOfKey,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { SceneCameraSet } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { MaterialSettings } from '@myrddraall/heroes-replay-stats-aether/materials';
import type { LightSettings } from '@myrddraall/heroes-replay-stats-aether/lights';
import { patchState } from '@ngrx/signals';
import { wornIds, wornKeyOf } from '../bodies/body';
import { keepingPose } from '../viewport/markers';
import { lightsOfBody } from '../lights/lights';
import {
  CAMERAS,
  EDITOR_CAMERA,
  SCENE,
  SCENE_LIGHTS,
  SKY,
  type Target,
  bodyKey,
  lightsKey,
  overlayKey,
  overlayLightsKey,
  partRowKey,
  skyPartKey,
  targetOf,
} from './scene-targets';
import type { SceneMethodsStore } from './scene-editor.store';
import type { Vec3 } from '@myrddraall/heroes-replay-stats-aether/space';
import type { BodySettings } from '@myrddraall/heroes-replay-stats-aether/bodies';

/** What the scene editor's methods change the scene through: its bodies, a body's settings, its lights, groups and cameras, and what is selected. */
export function sceneWrites(store: SceneMethodsStore) {
  /** Where the pole being dragged is (see `dragPole`). */
  const dragging = { pole: null as Vec3 | null };
  const d = store._draft;
  /** The scene's planets changed (the random sets' have none of their own). */
  const edit = (change: (bodies: readonly SceneBody[]) => readonly SceneBody[]) => {
    if (store.hasPlanets())
      d.setSceneBodies(store.scene(), storedBodies(change(store.sceneBodies()), d.library()));
  };
  /** The selected body's path, if a body (or one of its materials) is selected. */
  const selectedPath = (): BodyPath | null => {
    const t = store.target();
    return 'path' in t ? t.path : null;
  };
  /** The key of what a body wears (a planet's settings are kept by it). */
  const wornAt = (path: BodyPath) => {
    const b = store.bodyByKey().get(bodyKey(path));
    return b ? wornKeyOf(b) : '';
  };
  const settings = (path: BodyPath, change: (s: BodySettings) => BodySettings | undefined) =>
    edit((b) => changeSettings(b, path, wornAt(path), change));
  /** A body's settings after a change, kept where it is as its Axis moves (see `keepingPose`). */
  const posed = (path: BodyPath, next: BodySettings, touched: readonly (keyof BodySettings)[]) => {
    const b = store.bodyByKey().get(bodyKey(path));
    const kept = b ? keepingPose(b, next, touched) : next;
    return Object.keys(kept).length ? kept : undefined;
  };
  /** What the selected body wears changed (the later over the earlier). */
  const wear = (change: (worn: readonly string[]) => readonly string[]) => {
    const path = selectedPath();
    const b = path && store.bodyByKey().get(bodyKey(path));
    if (path && b) edit((bodies) => setOverlays(bodies, path, change(wornIds(b)), wornKeyOf(b)));
  };
  /** A light changed: the scene's own, or a body's (one added there itself, else what is set for it). */
  const lightChange = (t: Target, change: Partial<LightSettings>) => {
    if (t.kind === 'scene-light')
      d.setSceneLights(store.scene(), changedLight(store.sceneLights(), t.id, change));
    else if (t.kind === 'light') settings(t.path, (s) => withLightChange(s, t.id, change));
  };
  /** A group put in the scene changed (a setting given as none: taken back). */
  const changePlacement = (key: string, change: Partial<GroupPlacement>) => {
    const placements = store.placements();
    const index = indexOfKey(placements, key);
    const p = placements[index];
    if (!p) return;
    const next = { ...p, ...change } as Record<string, unknown>;
    for (const k of Object.keys(change)) if (next[k] === undefined) delete next[k];
    d.setSceneGroups(
      store.scene(),
      placements.map((x, i) => (i === index ? (next as unknown as GroupPlacement) : x)),
    );
  };
  /** Something selected by its row's key, the rows above it unfolded to it. */
  const reveal = (key: string) => {
    const t = targetOf(key);
    store.expand(SCENE);
    if (t.kind === 'camera') store.reopen(CAMERAS);
    if (t.kind === 'scene-light') store.reopen(SCENE_LIGHTS);
    if (t.kind === 'body' || t.kind === 'part') {
      // (A body's own rows: under each it is a moon of; a part's, under its body too.)
      const upTo = t.kind === 'body' ? t.path.length - 1 : t.path.length;
      store.expand(...t.path.slice(0, upTo).map((_, i) => bodyKey(t.path.slice(0, i + 1))));
    }
    if (t.kind === 'sky-part') store.expand(SKY);
    if (t.kind === 'light') {
      const path = t.path;
      store.expand(...path.map((_, i) => bodyKey(path.slice(0, i + 1))));
      const b = store.bodyByKey().get(bodyKey(path));
      const overlay = b && lightsOfBody(b).find((l) => l.light.id === t.id)?.overlay;
      if (overlay) {
        store.reopen(overlayKey(path, overlay));
        store.expand(overlayLightsKey(path, overlay));
      } else store.expand(lightsKey(path));
    }
    patchState(store, { selected: key });
  };
  /** A camera added to the scene taken out; the view through it back to the editor's. */
  const dropCamera = (id: string) => {
    d.setSceneCameras(
      store.scene(),
      store.addedCameras().filter((a) => a.id !== id),
    );
    if (store.look() === id) patchState(store, { look: EDITOR_CAMERA });
  };
  /**
   * A body taken out (a planet with its moons, a moon with its own): what was selected of it, its
   * parent selected (the scene, for a planet); the view off it.
   */
  const removeBody = (path: BodyPath) => {
    edit((b) => removeAt(b, path));
    const inside = (key: string | null) =>
      key !== null && path.every((v, i) => pathOf(key)[i] === v);
    const t = store.target();
    const selected = 'path' in t && t.path.length >= path.length && inside(pathKey(t.path));
    const focus = store.focus();
    patchState(store, {
      ...(selected ? { selected: path.length > 1 ? bodyKey(path.slice(0, -1)) : SCENE } : {}),
      focus: inside(focus) ? null : focus,
    });
  };
  /** One of the scene's cameras moved or set: the game's over the data's, one added as it is. */
  const changeCamera = (id: string, set: SceneCameraSet & { placement?: CameraPlacement }) => {
    if (id === GAME_CAMERA) {
      const game = store.cameraList().find((c) => c.id === GAME_CAMERA);
      const placement = 'placement' in set ? set.placement : game?.placement;
      d.setSceneCamera(store.scene(), {
        ...game?.set,
        ...without(set, ['placement']),
        ...(placement ? { placement } : {}),
      });
    } else
      d.setSceneCameras(
        store.scene(),
        store.addedCameras().map((a) => (a.id === id ? { ...a, ...set } : a)),
      );
  };
  /** A part just added onto the body or sky selected selected, its row shown. */
  const selectAdded = (id: string) => {
    const t = store.target();
    if (t.kind === 'body') {
      store.expand(bodyKey(t.path));
      patchState(store, { selected: partRowKey(t.path, `own:${id}`) });
    } else {
      store.expand(SKY);
      patchState(store, { selected: skyPartKey(`own:${id}`) });
    }
  };
  const materialChange = (key: string, change: Partial<MaterialSettings>) => {
    const t = targetOf(key);
    if (t.kind === 'sky-material') d.setSkyMaterial(store.scene(), t.key, change);
    else if (t.kind === 'material') settings(t.path, (s) => withMaterial(s, t.key, change));
  };
  return {
    d,
    edit,
    selectedPath,
    wornAt,
    settings,
    posed,
    wear,
    lightChange,
    changePlacement,
    reveal,
    dropCamera,
    removeBody,
    changeCamera,
    selectAdded,
    materialChange,
    dragging,
  };
}

export type SceneWrites = ReturnType<typeof sceneWrites>;
