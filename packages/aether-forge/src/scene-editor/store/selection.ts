import {
  bodyAt,
  type BodyPath,
  pathOf,
  PLAY_SCREEN_SCENE,
  RANDOM_SCENE,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { knownLights } from '@myrddraall/heroes-replay-stats-aether/lights';
import { computed } from '@angular/core';
import { bodyLabel, bodyView, filesLoaded, type TargetKind } from '../../editing/model/body';
import { type MaterialView, viewTitle } from '../../editing/model/views';
import {
  lightsOfBody,
  type LitByEntry,
  litByOf,
  moonLightsOf,
  type OuterLight,
  sceneLightsOf,
} from '../../editing/model/lights';
import { materialAt, materialsOf } from '../../editing/model/materials';
import { partsOfBody } from '../../editing/model/parts';
import { type AssetTarget, type OpenTarget } from '../../layout/open-target';
import type { WithSky } from '../scene-editor.store';
import { targetOf, bodyKey, receiverOf } from '../scene-targets';

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
