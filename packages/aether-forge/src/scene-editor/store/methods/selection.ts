import {
  pathKey,
  pathOf,
  skyOverlayOn,
  withLightSwitched,
  withMaterial,
  withMaterialSwitched,
  without,
  withoutPartSetting,
  withOverlaySwitched,
  withPartSetting,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { withLightChanged } from '@myrddraall/heroes-replay-stats-aether/lights';
import { patchState } from '@ngrx/signals';
import { overlayEnabledBelow } from '../../../editing/model/body';
import { lightsOfBody } from '../../../editing/model/lights';
import { materialAt, materialsOf } from '../../../editing/model/materials';
import { partsOfBody } from '../../../editing/model/parts';
import { removePart } from '../../../editing/part-hosts';
import { SCENE, bodyKey, targetOf } from '../../scene-targets';
import type { SceneMethodsStore } from '../../scene-editor.store';
import type { SceneWrites } from './scene-writes';

/** What is selected, shown, switched on or off, focused, and the level edits go into. */
export function selectionMethods(store: SceneMethodsStore, w: SceneWrites) {
  const {
    d,
    selectedPath,
    settings,
    lightChange,
    changePlacement,
    reveal,
    dropCamera,
    removeBody,
    materialChange,
  } = w;
  return {
    /** A row selected; the materials' group only folds (there is nothing of its own to set). */
    select(key: string): void {
      if (targetOf(key).kind === 'group') store.toggleExpanded(key);
      else patchState(store, { selected: key });
    },
    /** The body clicked in the view (by its index as put up) selected, its rows unfolded to it. */
    selectPlaced(index: number): boolean {
      const key = store._placed()?.picks[index];
      if (!key) return false;
      // A group's planet: the group put in the scene.
      const path = key.startsWith('body:') ? pathOf(key.slice(5)) : [];
      store.expand(SCENE, ...path.slice(0, -1).map((_, i) => bodyKey(path.slice(0, i + 1))));
      patchState(store, { selected: key });
      return true;
    },
    /** One of what has been added to what is selected selected in the tree, its rows unfolded to it. */
    showAdded(key: string): void {
      reveal(key);
    },
    /** One of what has been added to what is selected taken out (where it can be). */
    removeAdded(key: string): void {
      const t = targetOf(key);
      if (t.kind === 'body') removeBody(t.path);
      else if (t.kind === 'placement') {
        d.setSceneGroups(
          store.scene(),
          store.placements().filter((_, i) => i !== t.index),
        );
        if (store.selected() === key) patchState(store, { selected: SCENE });
      } else if (t.kind === 'camera') {
        if (store.cameraList().some((c) => c.id === t.id && !c.game)) dropCamera(t.id);
      } else if (t.kind === 'scene-light')
        d.setSceneLights(
          store.scene(),
          store.sceneLights().filter((l) => l.id !== t.id),
        );
      else if ((t.kind === 'part' || t.kind === 'sky-part') && t.key.startsWith('own:')) {
        const host = store._addHost();
        if (host) removePart(host, t.key.slice(4));
      }
    },
    /** What a marker in the view stands for selected, its rows unfolded to it. */
    showMarker(key: string): void {
      reveal(key);
    },
    setEnabled(change: { key: string; enabled: boolean }): void {
      const t = targetOf(change.key);
      const on = change.enabled;
      if (t.kind === 'placement') {
        changePlacement(t.index, { enabled: on ? undefined : false });
        return;
      }
      const b = 'path' in t ? store.bodyByKey().get(bodyKey(t.path)) : undefined;
      // Each back to what is under it where that is the same, else set here (a scene's own
      // light: switched on is as it starts).
      if (t.kind === 'light' && b) {
        const below = lightsOfBody(b).find((l) => l.light.id === t.id)?.enabledBelow ?? true;
        settings(t.path, (s) => withLightSwitched(s, t.id, on, below));
      } else if (t.kind === 'scene-light') lightChange(t, { enabled: on });
      else if (t.kind === 'body') {
        // Back to what is under it where that is the same (a planet's own moon may be off
        // there), else set here.
        const below = b?.below?.enabled !== false;
        settings(t.path, (s) => (on === below ? without(s, ['enabled']) : { ...s, enabled: on }));
      } else if (t.kind === 'part' && b) {
        const below = partsOfBody(b).find((p) => p.key === t.key)?.enabledBelow ?? true;
        settings(t.path, (s) =>
          on === below
            ? withoutPartSetting(s, t.key, ['enabled'])
            : withPartSetting(s, t.key, { enabled: on }),
        );
      } else if (t.kind === 'group' && t.skyOverlay) {
        const below = skyOverlayOn(undefined, d.library(), t.skyOverlay);
        d.setSkyOverlayEnabled(store.scene(), t.skyOverlay, on, below);
      } else if (t.kind === 'sky-part') {
        const below = store.skyParts().find((p) => p.key === t.key)?.enabledBelow ?? true;
        if (on === below) d.clearSkyPart(store.scene(), t.key, ['enabled']);
        else d.setSkyPart(store.scene(), t.key, { enabled: on });
      } else if (t.kind === 'group' && b && t.overlay) {
        const id = t.overlay;
        settings(t.path, (s) => withOverlaySwitched(s, id, on, overlayEnabledBelow(b, id)));
      } else if (t.kind === 'sky-material') {
        const below = materialAt(store.skyMaterials(), t.key)?.enabledBelow ?? true;
        if (on === below) d.clearSkyMaterial(store.scene(), t.key, ['enabled']);
        else materialChange(change.key, { enabled: on });
      } else if (t.kind === 'material' && t.view?.kind === 'gridLight' && b) {
        // One of a shield's lights switched: the shield's lights set here.
        const id = t.view.id;
        const lights = materialAt(materialsOf(b), t.key)?.values.gridLights ?? [];
        settings(t.path, (s) =>
          withMaterial(s, t.key, { gridLights: withLightChanged(lights, id, { enabled: on }) }),
        );
      } else if (t.kind === 'material' && b) {
        const below = materialAt(materialsOf(b), t.key)?.enabledBelow ?? true;
        settings(t.path, (s) => withMaterialSwitched(s, t.key, on, below));
      }
    },
    /** The view centred on the selected moon and its moons, or back on the whole scene. */
    toggleFocus(): void {
      const path = selectedPath();
      if (!path || path.length < 2) return;
      const key = pathKey(path);
      patchState(store, { focus: store.focus() === key ? null : key });
    },
    unfocus(): void {
      patchState(store, { focus: null });
    },
    /** The level switching a planet's variants goes into: the scene ('') or one of its variants. */
    setLayer(value: string): void {
      patchState(store, { sceneVariantEdited: value || null });
    },
    showLayer(): void {
      // (Nothing is over a scene's settings: no override to show.)
    },
    deleteAsset(): void {
      // a scene is deleted from its own panel
    },
  };
}
