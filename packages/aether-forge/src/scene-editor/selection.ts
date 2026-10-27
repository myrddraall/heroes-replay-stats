import {
  bodyAt,
  type BodyPath,
  pathKey,
  pathOf,
  PLAY_SCREEN_SCENE,
  RANDOM_SCENE,
  withLightSwitched,
  withMaterial,
  withMaterialSwitched,
  without,
  withoutPartSetting,
  withOverlaySwitched,
  withPartSetting,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { knownLights, withLightChanged } from '@myrddraall/heroes-replay-stats-aether/lights';
import { computed } from '@angular/core';
import {
  bodyLabel,
  bodyView,
  filesLoaded,
  overlayEnabledBelow,
  type TargetKind,
} from '../bodies/body';
import { type MaterialView, viewTitle } from '../materials/material-views';
import {
  lightsOfBody,
  type LitByEntry,
  litByOf,
  moonLightsOf,
  type OuterLight,
  sceneLightsOf,
} from '../lights/lights';
import { materialAt, materialsOf } from '../materials/materials';
import { partsOfBody } from '../parts/parts';
import type { AssetTarget, OpenTarget } from '../layout/open-target';
import type { SceneMethodsStore, WithSky } from './scene-editor.store';
import { bodyKey, receiverOf, SCENE, targetOf } from './scene-targets';
import { skyOverlayOn } from '@myrddraall/heroes-replay-stats-aether/library';
import { patchState } from '@ngrx/signals';
import { removePart } from '../parts/part-hosts';
import type { SceneWrites } from './scene-writes';

/** What is selected in the tree: its target, the body, material, part or light it is, how the panel heads it, and what can be done with it. */
export function selectionViews(store: WithSky) {
  const {
    selected,
    focus,
    scene: sceneId,
    _sceneFile,
    bodyByKey,
    _choices: choices,
    _sceneBodiesNow: sceneBodiesNow,
    groupOpen,
    _label: label,
    skyMaterials,
    skyParts,
    placements,
    _groupOf: groupOf,
    cameraList,
  } = store;
  const target = computed(() => targetOf(selected()));
  const body = computed(() => {
    const t = target();
    return 'path' in t ? bodyByKey().get(bodyKey(t.path)) : undefined;
  });
  /**
   * The lights from beyond the selected body that light it too: the scene's (those on), and
   * those of the planets it is a moon of that reach their moons.
   */
  const outerLights = computed((): OuterLight[] => {
    const t = target();
    if (!('path' in t)) return [];
    return [
      ...knownLights(choices().lights ?? [])
        .filter((l) => l.enabled !== false)
        .map((light) => ({ light, owner: 'scene' as const })),
      ...t.path.slice(0, -1).flatMap((_, i) => {
        const owner = t.path.slice(0, i + 1);
        const parent = bodyByKey().get(bodyKey(owner));
        if (!parent) return [];
        const overlays = new Map(
          lightsOfBody(parent).flatMap((l) => (l.overlay ? [[l.light.id, l.overlay]] : [])),
        );
        return moonLightsOf(parent).map((light) => ({
          light,
          owner,
          overlay: overlays.get(light.id),
        }));
      }),
    ];
  });
  /** The moon the view is centred on (its planet's index and its own path), if any. */
  const focusPath = computed((): BodyPath => {
    const key = focus();
    if (key === null) return [];
    const path = pathOf(key);
    return path.length > 1 && bodyAt(sceneBodiesNow(), path) ? path : [];
  });
  return {
    target,
    focusPath,
    resetAllLabel: computed(() => 'Reset scene'),
    deletable: computed(() => false),
    skyOverlayOpen: computed(() => false),
    opened: computed((): OpenTarget => ({
      kind: groupOpen() ? 'group' : 'scene',
      id: sceneId(),
    })),
    parent: computed(() => null),
    sharedMaterial: computed((): AssetTarget | null => {
      const t = target();
      const b = body();
      if (t.kind !== 'material' || !b) return null;
      const m = materialAt(materialsOf(b), t.key);
      if (!m) return null;
      return {
        kind: 'material',
        id: t.name,
        on: m.overlay ? { kind: 'style', id: m.overlay } : { kind: 'planet', id: b.id },
      };
    }),
    heading: computed(() => {
      const id = sceneId();
      if (id === RANDOM_SCENE) return 'Scene · Random sets';
      if (id === PLAY_SCREEN_SCENE) return 'Scene · Play screen';
      return `${groupOpen() ? 'Group' : 'Scene'} · ${label()}`;
    }),
    kind: computed((): TargetKind => {
      const t = target();
      if ('view' in t && t.view) return t.view.kind;
      // The scene's lights shown as any light is; the sky's overlays' parts as any part.
      return t.kind === 'scene-light' ? 'light' : t.kind === 'sky-part' ? 'part' : t.kind;
    }),
    materialView: computed((): MaterialView | null => {
      const t = target();
      return 'view' in t && t.view ? t.view : null;
    }),
    bodyView: computed(() => {
      const b = body();
      // (Moons can be put about any body but one of its planet's own.)
      return b ? bodyView(b, focus() === b.key.slice(5), !b.inherited) : null;
    }),
    material: computed(() => {
      const t = target();
      if (t.kind === 'sky-material') return materialAt(skyMaterials(), t.key);
      const b = body();
      // Its layers may read the sky's textures too (always loaded).
      const sky = _sceneFile.hasValue() ? _sceneFile.value().textures : {};
      return t.kind === 'material' && b ? materialAt(materialsOf(b, sky), t.key) : undefined;
    }),
    part: computed(() => {
      const t = target();
      if (t.kind === 'sky-part') return skyParts().find((p) => p.key === t.key);
      const b = body();
      return t.kind === 'part' && b ? partsOfBody(b).find((p) => p.key === t.key) : undefined;
    }),
    litBy: computed((): readonly LitByEntry[] | null => {
      const t = target();
      const b = body();
      const receiver = receiverOf(t);
      return b && filesLoaded(b) && receiver !== undefined
        ? litByOf(b, receiver, outerLights())
        : null;
    }),
    light: computed(() => {
      const t = target();
      if (t.kind === 'scene-light')
        return sceneLightsOf(choices().lights).find((l) => l.light.id === t.id);
      const b = body();
      return t.kind === 'light' && b ? lightsOfBody(b).find((l) => l.light.id === t.id) : undefined;
    }),
    title: computed(() => {
      const t = target();
      if ('view' in t && t.view) {
        const b = body();
        const m =
          t.kind === 'sky-material'
            ? materialAt(skyMaterials(), t.key)
            : b && t.kind === 'material'
              ? materialAt(materialsOf(b), t.key)
              : undefined;
        return viewTitle(t.view, m ?? undefined);
      }
      if (t.kind === 'scene') return groupOpen() ? 'Group' : 'Scene';
      if (t.kind === 'sky') return 'Sky';
      if (t.kind === 'sky-material') return materialAt(skyMaterials(), t.key)?.label ?? t.name;
      if (t.kind === 'material') {
        const b = body();
        return (b && materialAt(materialsOf(b), t.key)?.label) ?? t.name;
      }
      if (t.kind === 'sky-part') return skyParts().find((x) => x.key === t.key)?.label ?? 'Part';
      if (t.kind === 'part') {
        const p = body() && partsOfBody(body()!).find((x) => x.key === t.key);
        return p ? (p.overlayName ? `${p.label} · ${p.overlayName}` : p.label) : 'Part';
      }
      if (t.kind === 'light') {
        const l = body() && lightsOfBody(body()!).find((x) => x.light.id === t.id);
        return l?.light.name ?? 'Properties';
      }
      if (t.kind === 'scene-light')
        return choices().lights?.find((l) => l.id === t.id)?.name ?? 'Properties';
      if (t.kind === 'reference') return 'Reference';
      if (t.kind === 'placement') {
        const p = placements()[t.index];
        return p ? `Group · ${p.label ?? groupOf(p.group)?.name ?? p.group}` : 'Group';
      }
      if (t.kind === 'cameras') return 'Cameras';
      if (t.kind === 'camera') return cameraList().find((c) => c.id === t.id)?.name ?? 'Camera';
      const b = body();
      return b ? bodyLabel(b) : 'Properties';
    }),
    focusedName: computed(() => {
      const path = focusPath();
      return path.length ? (bodyByKey().get(bodyKey(path))?.id ?? null) : null;
    }),
  };
}

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
