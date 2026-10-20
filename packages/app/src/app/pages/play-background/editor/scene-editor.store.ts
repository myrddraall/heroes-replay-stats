import { computed, effect, inject, resource, untracked } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withFolding } from '../../../data/store-features/with-folding';
import { withLocalStorage } from '../../../data/store-features/with-local-storage';
import { BackgroundStore } from '../../../scenes/play-background/background.store';
import {
  ownScene,
  PLAY_SCREEN_SCENE,
  RANDOM_SCENE,
} from '../../../scenes/play-background/background-design';
import {
  type BodyPath,
  type BodySettings,
  fitRadius,
  fitScene,
  type MoonChoices,
  type Orbit,
  pathKey,
  pathOf,
  placeBodies,
  reveal,
  type SceneBody,
  type Vec3,
  without,
} from '../../../scenes/play-background/background-scene';
import { NO_MATERIAL_TINT } from '../../../scenes/play-background/material-settings';
import { playSet, type SetPlanet } from '../../../scenes/play-background/planet-sets';
import { loadPlaySceneFile, PLAY_SCENE_URL } from '../../../scenes/play-background/play-scene';
import {
  addMoonAt,
  addPlanet,
  bodyAt,
  changeSettings,
  removeAt,
  resetStyle,
  SCENE_CENTRE,
  playScreenBodies,
  sceneBodies,
  setOrbit,
  setPlace,
  setStyle,
  withMaterial,
  withPartSetting,
  withoutPartSetting,
  withoutLightSetting,
  withAddedLight,
  withLightChange,
  withoutAddedLight,
  changedLight,
  visualExtent,
  bodyParts,
  withoutMaterial,
  withLightSwitched,
  withMaterialSwitched,
} from '../../../scenes/play-background/scene-bodies';
import {
  loadPlanetIndex,
  type MaterialSettings,
  type MaterialTint,
  type PartKey,
  type PartSettings,
  reordered,
  type SkySettings,
} from '../../../scenes/play-background/scene-planets';
import { PRESETS } from '../../../scenes/play-background/tint-settings';
import { withPlanetFiles } from '../../../scenes/play-background/with-planet-files';
import { CUSTOM_TINT, DraftDesignStore } from '../draft-design.store';
import { grouped, type PropertyOption } from '../properties/property-select';
import {
  type MaterialEntry,
  type BodyInfo,
  bodyView,
  materialsOf,
  filesLoaded,
  partsOfBody,
  moonLightsOf,
  bodyLabel,
  styleLabel,
  wornLabel,
  bodyEnabled,
  overlayEnabled,
  overlayEnabledBelow,
  partNodes,
  type PartNode,
  partIcon,
  lightsOfBody,
  type LightEntry,
  sceneLightsOf,
  LIGHT_ICONS,
  byDepth,
  referenceRow,
  skyMaterialsOf,
  type TargetKind,
  type LitByEntry,
  litByOf,
  type OuterLight,
  withLitBy,
} from './editor-model';
import { REFERENCE_KEY } from './editing-aids.store';
import { EditorUiStore } from './editor-ui.store';
import { type OpenTarget, RANDOM_SETS } from './open-target';
import type { TreeMove, TreeRow } from './scene-tree';
import {
  type AddedLight,
  type LightId,
  type LightKind,
  type LightSettings,
  newLight,
  type Receiver,
} from '../../../scenes/play-background/scene-lights';

/** The scene tree's rows by what they are. */
const SCENE = 'scene';
/** The scene's own lights, a group of their own; each by its id. */
const SCENE_LIGHTS = 'scene-lights';
const sceneLightKey = (id: LightId) => `scene-light/${id}`;
const SKY = 'sky';
const bodyKey = (path: BodyPath) => `body:${pathKey(path)}`;
/** The overlay it wears: its parts (with their materials) and its lights, under it. */
const overlayKey = (path: BodyPath) => `${bodyKey(path)}/overlay`;
/** Its overlay's lights, a group of their own under the overlay. */
const overlayLightsKey = (path: BodyPath) => `${bodyKey(path)}/overlay-lights`;
const materialKey = (path: BodyPath, name: string) => `${bodyKey(path)}/m/${name}`;
const partRowKey = (path: BodyPath, key: PartKey) => `${bodyKey(path)}/p/${key}`;
/** Its lights (its rig's and its shadow), a group of their own. */
const lightsKey = (path: BodyPath) => `${bodyKey(path)}/lights`;
const lightRowKey = (path: BodyPath, id: LightId) => `${bodyKey(path)}/l/${id}`;
const skyMaterialKey = (name: string) => `${SKY}/m/${name}`;
/**
 * The sky's materials at a depth (background, midground, foreground), a group of their own: open
 * unless folded (its key among those kept unfolded means folded, so it starts open).
 */
const skyDepthKey = (depth: string) => `${SKY}/depth/${depth}`;

/** What a scene tree row's key is. */
type Target =
  | { readonly kind: 'scene' }
  | { readonly kind: 'sky' }
  | { readonly kind: 'sky-material'; readonly name: string }
  | { readonly kind: 'body'; readonly path: BodyPath }
  | { readonly kind: 'group'; readonly path: BodyPath }
  | { readonly kind: 'material'; readonly path: BodyPath; readonly name: string }
  | { readonly kind: 'part'; readonly path: BodyPath; readonly key: PartKey }
  | { readonly kind: 'light'; readonly path: BodyPath; readonly id: LightId }
  /** One of the scene's own lights. */
  | { readonly kind: 'scene-light'; readonly id: LightId }
  /** The reference image laid over the view (an editing aid). */
  | { readonly kind: 'reference' };

/** What of a body a target is, as a light reaches it: the body (none), a part or a material; not one (undefined). */
function receiverOf(t: Target): Receiver | null | undefined {
  if (t.kind === 'body') return null;
  if (t.kind === 'part') return `part:${t.key}`;
  if (t.kind === 'material') return `material:${t.name}`;
  return undefined;
}

function targetOf(key: string): Target {
  if (key === REFERENCE_KEY) return { kind: 'reference' };
  if (key.startsWith(`${SKY}/m/`)) return { kind: 'sky-material', name: key.slice(SKY.length + 3) };
  if (key.startsWith(`${SKY}/depth/`)) return { kind: 'group', path: [] };
  if (key === SKY) return { kind: 'sky' };
  if (key === SCENE_LIGHTS) return { kind: 'group', path: [] };
  if (key.startsWith('scene-light/'))
    return { kind: 'scene-light', id: key.slice('scene-light/'.length) as LightId };
  if (!key.startsWith('body:')) return { kind: 'scene' };
  const rest = key.slice(5);
  const slash = rest.indexOf('/');
  const path = pathOf(slash < 0 ? rest : rest.slice(0, slash));
  const tail = slash < 0 ? '' : rest.slice(slash);
  if (tail === '/overlay' || tail === '/lights' || tail === '/overlay-lights')
    return { kind: 'group', path };
  if (tail.startsWith('/l/')) return { kind: 'light', path, id: tail.slice(3) as LightId };
  if (tail.startsWith('/m/')) return { kind: 'material', path, name: tail.slice(3) };
  if (tail.startsWith('/p/')) return { kind: 'part', path, key: tail.slice(3) as PartKey };
  return { kind: 'body', path };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** A body as set, without its moons (each of them is compared on its own). */
const ownPart = (b: SceneBody | MoonChoices | undefined) => b && { ...b, moons: undefined };

interface SceneEditorState {
  /** The scene, by id (the URL's); '': the random sets'. */
  readonly scene: string;
  /** The selected row's key. */
  readonly selected: string;
  /** The moon the view is centred on, by its path's key; none: the whole scene. */
  readonly focus: string | null;
}

/**
 * The scene editor's store (component store, provided by the scene editor as its `Editor` and its
 * background's scene): one scene of the draft ({@link DraftDesignStore}), by the URL (or the
 * random sets'), as a tree (the scene, its sky and the sky's materials, its planets, each with its
 * materials and moons, theirs in turn), what is selected and its properties through the layers
 * (the data, the library, the scene), the moon the view is centred on. The scene's bodies placed
 * for the background: a selected moon shown where it can be seen; a scene of one planet fitted to
 * the view. The Play screen's planets are the game's three until the scene sets its own.
 */
export const SceneEditorStore = signalStore(
  withState<SceneEditorState>({ scene: RANDOM_SCENE, selected: SCENE, focus: null }),
  withFolding([SCENE, bodyKey([0])]),
  withLocalStorage<SceneEditorState & { expanded: readonly string[] }>(
    'hrs.background-scene-editor',
    ['expanded'],
  ),
  withPlanetFiles(),
  withProps(() => ({
    _draft: inject(DraftDesignStore),
    _ui: inject(EditorUiStore),
    _background: inject(BackgroundStore),
    _index: resource({ loader: ({ abortSignal }) => loadPlanetIndex(PLAY_SCENE_URL, abortSignal) }),
    _sceneFile: resource({
      loader: ({ abortSignal }) => loadPlaySceneFile(PLAY_SCENE_URL, abortSignal),
    }),
  })),
  withComputed(({ scene: sceneId, files, focus, selected, _draft, _index, _sceneFile }) => {
    const entry = computed(() => _draft.scenes().planets[sceneId()]);
    const choices = computed(() => entry() ?? {});
    const publishedEntry = computed(() => _draft.publishedScenes().planets[sceneId()]);
    const published = computed(() => publishedEntry() ?? {});
    /** Whether the scene is the random sets' (its planets drawn with each page, not its own). */
    const random = computed(() => sceneId() === RANDOM_SCENE);
    /** A preset's planets until it sets its own: the Play screen's, the game's three. */
    const defaults = computed((): readonly SceneBody[] =>
      sceneId() === PLAY_SCREEN_SCENE && _index.hasValue() && _sceneFile.hasValue()
        ? playScreenBodies(playSet(_index.value()), _sceneFile.value().camera.eye)
        : [],
    );
    /** The scene's planets, each with its moons. */
    const sceneBodiesNow = computed(() =>
      random() ? [] : sceneBodies(entry(), sceneId(), defaults()),
    );
    const publishedBodies = computed(() =>
      random() ? [] : sceneBodies(publishedEntry(), sceneId(), defaults()),
    );
    const library = _draft.library;

    /** The scene's bodies: each planet, then its moons after it (theirs after each). */
    const bodies = computed((): BodyInfo[] => {
      const all = files();
      const lib = library();
      const out: BodyInfo[] = [];
      const info = (
        path: BodyPath,
        bodyId: string,
        bodyStyle: string,
        styleSet: boolean,
        settings: BodySettings,
        children: readonly MoonChoices[],
        orbit?: Orbit,
        place?: { readonly position: Vec3; readonly radius: number },
      ): BodyInfo => ({
        key: bodyKey(path),
        id: bodyId,
        style: bodyStyle,
        styleSet,
        settings,
        below: lib.planets[bodyId],
        styleBelow: bodyStyle ? lib.styles[bodyStyle] : undefined,
        materialBase: lib.materials,
        file: all[bodyId],
        styleFile: bodyStyle ? all[`style-${bodyStyle}`] : undefined,
        orbit,
        place,
        moons: children,
      });
      const walk = (parent: BodyPath, list: readonly MoonChoices[]) =>
        list.forEach((moon, i) => {
          const path = [...parent, i];
          out.push(
            info(
              path,
              moon.id,
              moon.style ?? all[moon.id]?.tuning?.style ?? '',
              moon.style !== undefined,
              moon.settings ?? {},
              moon.moons ?? [],
              moon.orbit,
            ),
          );
          walk(path, moon.moons ?? []);
        });
      sceneBodiesNow().forEach((planet, b) => {
        const style = planet.style ?? all[planet.id]?.tuning?.style ?? '';
        out.push(
          info(
            [b],
            planet.id,
            style,
            planet.style !== undefined,
            planet.variants?.[style] ?? {},
            planet.moons ?? [],
            undefined,
            { position: planet.position, radius: planet.radius },
          ),
        );
        walk([b], planet.moons ?? []);
      });
      return out;
    });
    const bodyByKey = computed(() => new Map(bodies().map((b) => [b.key, b] as const)));
    const sky = computed(() => choices().sky ?? {});
    const skyMaterials = computed(() => {
      const scene = _sceneFile.hasValue() ? _sceneFile.value() : null;
      return scene ? skyMaterialsOf(scene, library().sky, sky(), library().materials) : [];
    });
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
        ...(choices().lights ?? [])
          .filter((l) => l.enabled !== false)
          .map((light) => ({ light, owner: 'scene' as const })),
        ...t.path.slice(0, -1).flatMap((_, i) => {
          const owner = t.path.slice(0, i + 1);
          const parent = bodyByKey().get(bodyKey(owner));
          if (!parent) return [];
          const overlays = new Set(
            lightsOfBody(parent)
              .filter((l) => l.overlay)
              .map((l) => l.light.id),
          );
          return moonLightsOf(parent).map((light) => ({
            light,
            owner,
            overlay: overlays.has(light.id),
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
    /** The bodies (by key) that differ from what is published. */
    const unsavedBodies = computed(() => {
      const out = new Set<string>();
      for (const b of bodies()) {
        const path = pathOf(b.key.slice(5));
        if (
          !same(ownPart(bodyAt(sceneBodiesNow(), path)), ownPart(bodyAt(publishedBodies(), path)))
        )
          out.add(b.key);
      }
      return out;
    });
    /** What the scene is called: its name; else its first planet's id; else its own. */
    const label = computed(() => choices().name ?? sceneBodiesNow()[0]?.id ?? sceneId());
    return {
      resetAllLabel: computed(() => 'Reset scene'),
      opened: computed((): OpenTarget => ({ kind: 'scene', id: sceneId() })),
      sceneName: computed(() => choices().name ?? ''),
      /** The name a scene shows where it has none of its own. */
      sceneLabel: label,
      heading: computed(() => {
        const id = sceneId();
        if (id === RANDOM_SCENE) return 'Scene · Random sets';
        if (id === PLAY_SCREEN_SCENE) return 'Scene · Play screen';
        return `Scene · ${label()}`;
      }),
      /** Whether the scene is one of the user's own (named, deletable). */
      own: computed(() => ownScene(sceneId())),
      /** Whether planets can be put in it (any scene but the random sets'). */
      hasPlanets: computed(() => !random()),
      /** Whether it is one of the user's own that isn't there (deleted, or discarded unsaved). */
      missing: computed(() => ownScene(sceneId()) && !entry()),
      sceneBodies: sceneBodiesNow,
      bodies,
      bodyByKey,
      skyMaterials,
      target,
      focusPath,
      unsavedBodies,
      /** The scene as it is to be shown: its sky (over the library's, by the background) and its colour. */
      sceneSky: computed((): SkySettings => ({ materials: sky().materials, tint: sky().tint })),
      /** The scene's own lights, lighting every planet in it. */
      sceneLights: computed((): readonly AddedLight[] => choices().lights ?? []),
      sceneTint: computed(() => _draft.scenes().settings),
      neededFiles: computed(() => [
        ...new Set(bodies().flatMap((b) => (b.style ? [b.id, `style-${b.style}`] : [b.id]))),
      ]),
      kind: computed((): TargetKind => {
        const k = target().kind;
        return k === 'scene-light' ? 'light' : k; // the scene's lights shown as any light is
      }),
      bodyView: computed(() => {
        const b = body();
        return b ? bodyView(b, focus() === b.key.slice(5), true) : null;
      }),
      material: computed(() => {
        const t = target();
        if (t.kind === 'sky-material') return skyMaterials().find((m) => m.name === t.name);
        const b = body();
        // Its layers may read the sky's textures too (always loaded).
        const sky = _sceneFile.hasValue() ? _sceneFile.value().textures : {};
        return t.kind === 'material' && b
          ? materialsOf(b, sky).find((m) => m.name === t.name)
          : undefined;
      }),
      part: computed(() => {
        const t = target();
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
        return t.kind === 'light' && b
          ? lightsOfBody(b).find((l) => l.light.id === t.id)
          : undefined;
      }),
      title: computed(() => {
        const t = target();
        if (t.kind === 'scene') return 'Scene';
        if (t.kind === 'sky') return 'Sky';
        if (t.kind === 'sky-material')
          return skyMaterials().find((m) => m.name === t.name)?.label ?? t.name;
        if (t.kind === 'material') {
          const b = body();
          return (b && materialsOf(b).find((m) => m.name === t.name)?.label) ?? t.name;
        }
        if (t.kind === 'part') {
          const p = body() && partsOfBody(body()!).find((x) => x.key === t.key);
          return p ? (p.style ? `${p.label} · ${p.style}` : p.label) : 'Part';
        }
        if (t.kind === 'light') {
          const l = body() && lightsOfBody(body()!).find((x) => x.light.id === t.id);
          return l?.light.name ?? 'Properties';
        }
        if (t.kind === 'scene-light')
          return choices().lights?.find((l) => l.id === t.id)?.name ?? 'Properties';
        if (t.kind === 'reference') return 'Reference';
        const b = body();
        return b ? bodyLabel(b) : 'Properties';
      }),
      skyChanged: computed(() => !!sky().materials || !!sky().tint),
      skyTint: computed((): MaterialTint => sky().tint ?? library().sky.tint ?? NO_MATERIAL_TINT),
      skyTintSet: computed(() => sky().tint),
      sets: random,
      styleOptions: computed((): PropertyOption[] =>
        grouped(
          [{ value: '', label: 'None' }],
          _index.hasValue() ? _index.value().styles.map((s) => s.id) : [],
        ),
      ),
      tintOptions: computed((): PropertyOption[] =>
        grouped(
          [
            { value: PRESETS[0]!.id, label: PRESETS[0]!.label },
            { value: CUSTOM_TINT, label: 'Custom' },
          ],
          PRESETS.slice(1).map((p) => ({ value: p.id, label: p.label })),
        ),
      ),
      tintChoice: computed(() => {
        const settings = _draft.scenes().settings;
        if (settings.choice) return settings.choice;
        return settings.background.on ? CUSTOM_TINT : PRESETS[0]!.id;
      }),
      focusedName: computed(() => {
        const path = focusPath();
        return path.length ? (bodyByKey().get(bodyKey(path))?.id ?? null) : null;
      }),
      sceneUnsaved: computed(() => !same(choices(), published()) || _draft.unsavedColour()),
      skyUnsaved: computed(() => !same(choices().sky, published().sky)),
    };
  }),
  withComputed((store) => ({
    rows: computed((): TreeRow[] => {
      const open = store.unfolded();
      const rows: TreeRow[] = [];
      const row = (
        key: string,
        label: string,
        icon: string,
        depth: number,
        unsaved = false,
        group = false,
        enabled?: boolean,
      ) =>
        rows.push({
          key,
          label,
          icon,
          depth,
          expandable: true,
          expanded: open.has(key),
          unsaved,
          group,
          enabled,
        });
      /** A material's row: movable (its draw order) unless opaque, drawn first wherever it is. */
      const leaf = (key: string, m: MaterialEntry, depth: number) =>
        rows.push({
          key,
          label: m.label,
          detail: m.name,
          icon: 'texture',
          depth,
          expandable: false,
          expanded: false,
          enabled: m.values.enabled,
          movable: m.values.blend !== 'opaque',
        });
      row(SCENE, 'Scene', 'landscape', 0, store.sceneUnsaved());
      if (!open.has(SCENE)) return rows;
      // The scene's own lights, where it has any.
      const own = sceneLightsOf(store.sceneLights());
      if (own.length) {
        rows.push({
          key: SCENE_LIGHTS,
          label: 'Lights',
          icon: 'lightbulb',
          depth: 1,
          expandable: true,
          expanded: !open.has(SCENE_LIGHTS),
          group: true,
        });
        if (!open.has(SCENE_LIGHTS))
          for (const { light } of own)
            rows.push({
              key: sceneLightKey(light.id),
              label: light.name,
              icon: LIGHT_ICONS[light.kind],
              depth: 2,
              expandable: false,
              expanded: false,
              enabled: light.enabled,
            });
      }
      row(SKY, 'Sky', 'blur_on', 1, store.skyUnsaved());
      // Its materials by where they are drawn among the scene's objects: behind, among, in front.
      if (open.has(SKY))
        for (const g of byDepth(store.skyMaterials())) {
          const group = skyDepthKey(g.depth);
          rows.push({
            key: group,
            label: g.label,
            icon: g.icon,
            depth: 2,
            expandable: true,
            expanded: !open.has(group),
            group: true,
          });
          if (!open.has(group)) for (const m of g.materials) leaf(skyMaterialKey(m.name), m, 3);
        }
      const body = (b: BodyInfo, depth: number) => {
        const path = pathOf(b.key.slice(5));
        row(
          b.key,
          wornLabel(b),
          path.length > 1 ? 'brightness_1' : 'public',
          depth,
          store.unsavedBodies().has(b.key),
          false,
          bodyEnabled(b),
        );
        if (!open.has(b.key)) return;
        // Its parts, each with the materials drawn on it (a part is open unless folded: its key
        // among those kept means folded); its lights; then the overlay it wears, its parts and
        // its lights under it.
        const nodes = partNodes(b, materialsOf(b));
        const lights = lightsOfBody(b);
        const parts = (list: readonly PartNode[], at: number) => {
          for (const { part, materials } of list) {
            const key = partRowKey(path, part.key);
            rows.push({
              key,
              label: part.label,
              icon: partIcon(part),
              depth: at,
              expandable: materials.length > 0,
              expanded: !open.has(key),
              enabled: part.enabled,
            });
            if (!open.has(key))
              for (const m of materials) leaf(materialKey(path, m.name), m, at + 1);
          }
        };
        const lightGroup = (group: string, list: readonly LightEntry[], at: number) => {
          if (!list.length) return;
          rows.push({
            key: group,
            label: 'Lights',
            icon: 'lightbulb',
            depth: at,
            expandable: true,
            expanded: open.has(group),
            group: true,
          });
          if (open.has(group))
            for (const { light } of list)
              rows.push({
                key: lightRowKey(path, light.id),
                label: light.name,
                icon: LIGHT_ICONS[light.kind],
                depth: at + 1,
                expandable: false,
                expanded: false,
                enabled: light.enabled,
              });
        };
        parts(nodes.own, depth + 1);
        lightGroup(
          lightsKey(path),
          lights.filter((l) => !l.overlay),
          depth + 1,
        );
        if (nodes.overlay.length) {
          const group = overlayKey(path);
          rows.push({
            key: group,
            label: styleLabel(b),
            detail: 'overlay',
            icon: 'style',
            depth: depth + 1,
            expandable: true,
            expanded: !open.has(group),
            group: true,
            enabled: overlayEnabled(b),
          });
          if (!open.has(group)) {
            parts(nodes.overlay, depth + 2);
            lightGroup(
              overlayLightsKey(path),
              lights.filter((l) => l.overlay),
              depth + 2,
            );
          }
        }
        b.moons.forEach((_, i) => {
          const child = store.bodyByKey().get(bodyKey([...path, i]));
          if (child) body(child, depth + 1);
        });
      };
      store.sceneBodies().forEach((_, i) => {
        const planet = store.bodyByKey().get(bodyKey([i]));
        if (planet) body(planet, 1);
      });
      rows.push(referenceRow());
      return rows;
    }),
    /**
     * The scene's bodies placed for the background: each planet where it is, its moons about it;
     * centred on a moon, that moon in the middle of the view with its own. Null for the random
     * sets (the background draws them), or while what they need is loading.
     */
    _placed: computed((): { planets: SetPlanet[]; paths: BodyPath[] } | null => {
      if (!store.hasPlanets()) return null;
      const planets = store.sceneBodies();
      if (!planets.length) return { planets: [], paths: [] };
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      if (!scene) return null;
      const eye = scene.camera.eye;
      const up = Math.tan((scene.camera.fovY * Math.PI) / 360);
      const reach = { up, across: up * store._ui.aspect() };
      const t = store.target();
      const selected = 'path' in t ? t.path : null;
      // Each group: a root (a planet where it is, or the moon centred on), its moons, and the
      // path its bodies' own paths are under.
      const focus = store.focusPath();
      const focused = focus.length ? bodyAt(planets, focus) : undefined;
      const groups = focused
        ? [{ root: SCENE_CENTRE, moons: focused.moons ?? [], under: focus, fit: true }]
        : planets.map((p, i) => ({
            root: { position: p.position, radius: p.radius },
            moons: p.moons ?? [],
            under: [i],
            // A scene of one planet is kept in view; several are where they are put.
            fit: planets.length === 1,
          }));
      const out: SetPlanet[] = [];
      /** Each body put out's path, in the same order (to pick it by). */
      const paths: BodyPath[] = [];
      /** What must stay in view of each body put out, in its radii. */
      const extents: number[] = [];
      for (const { root, moons, under, fit } of groups) {
        // A selected moon among these is shown where it can be seen.
        const inside =
          selected && under.every((v, i) => selected[i] === v)
            ? selected.slice(under.length)
            : null;
        const overrides = inside?.length
          ? reveal(root, moons, eye, inside)
          : new Map<string, number>();
        // What must stay in view of each body: as far as its parts and its halo reach.
        const extent = (path: BodyPath) => {
          const b = store.bodyByKey().get(bodyKey([...under, ...path]));
          return visualExtent(b?.file, b?.styleFile, b?.style, b && bodyParts(b));
        };
        const base = fit
          ? { ...root, radius: fitRadius(root, moons, eye, reach, overrides, extent) }
          : root;
        for (const p of placeBodies(base, moons, eye, overrides)) {
          const b = store.bodyByKey().get(bodyKey([...under, ...p.path]));
          if (!b?.file || (b.style && !b.styleFile)) return null;
          const s = b.settings;
          // Drawn where it and every body it is a moon of are switched on.
          const at = [...under, ...p.path];
          const drawn = at.every(
            (_, i) =>
              store.bodyByKey().get(bodyKey(at.slice(0, i + 1)))?.settings.enabled !== false,
          );
          // The lights of the bodies it is a moon of that reach their moons.
          const inherited = at.slice(0, -1).flatMap((_, i) => {
            const parent = store.bodyByKey().get(bodyKey(at.slice(0, i + 1)));
            return parent ? moonLightsOf(parent) : [];
          });
          extents.push(visualExtent(b.file, b.styleFile, b.style, bodyParts(b)));
          paths.push([...under, ...p.path]);
          out.push({
            id: b.id,
            position: p.position,
            radius: p.radius,
            style: b.style || undefined,
            ...(drawn ? {} : { enabled: false }),
            ...(s.overlayEnabled !== undefined ? { overlayEnabled: s.overlayEnabled } : {}),
            lighting: s.lighting,
            shade: {
              ...(s.shade !== undefined ? { strength: s.shade } : {}),
              ...(s.shadeTowards ? { direction: s.shadeTowards } : {}),
            },
            materials: s.materials,
            parts: s.parts,
            order: s.order,
            lights: s.lights,
            added: inherited.length ? [...(s.added ?? []), ...inherited] : s.added,
            tint: s.tint,
            lightFrom: s.lightFrom,
            rim: s.rim,
          });
        }
      }
      // Several planets where they are put: the whole drawn smaller where any would leave the view.
      return {
        planets: groups.length > 1 ? fitScene(out, extents, scene.camera, reach) : out,
        paths,
      };
    }),
  })),
  withComputed(({ _placed }) => ({
    /** The scene's bodies placed for the background (null: the random sets', or loading). */
    scenePlanets: computed(() => _placed()?.planets ?? null),
  })),
  withMethods((store) => {
    const d = store._draft;
    /** The scene's planets changed (the random sets' have none of their own). */
    const edit = (change: (bodies: readonly SceneBody[]) => readonly SceneBody[]) => {
      if (store.hasPlanets()) d.setSceneBodies(store.scene(), change(store.sceneBodies()));
    };
    /** The selected body's path, if a body (or one of its materials) is selected. */
    const selectedPath = (): BodyPath | null => {
      const t = store.target();
      return 'path' in t ? t.path : null;
    };
    /** The style a body wears (a planet's settings are kept by it). */
    const styleAt = (path: BodyPath) => store.bodyByKey().get(bodyKey(path))?.style ?? '';
    const settings = (path: BodyPath, change: (s: BodySettings) => BodySettings | undefined) =>
      edit((b) => changeSettings(b, path, styleAt(path), change));
    /** A light changed: the scene's own, or a body's (one added there itself, else what is set for it). */
    const lightChange = (t: Target, change: Partial<LightSettings>) => {
      if (t.kind === 'scene-light')
        d.setSceneLights(store.scene(), changedLight(store.sceneLights(), t.id, change));
      else if (t.kind === 'light') settings(t.path, (s) => withLightChange(s, t.id, change));
    };
    const materialChange = (key: string, change: Partial<MaterialSettings>) => {
      const t = targetOf(key);
      if (t.kind === 'sky-material') d.setSkyMaterial(store.scene(), t.name, change);
      else if (t.kind === 'material') settings(t.path, (s) => withMaterial(s, t.name, change));
    };
    return {
      /** The scene shown, as the URL says ('': the random sets'); its first planet selected. */
      showScene: signalMethod<string>((id) => {
        if (id === store.scene()) return;
        patchState(store, { scene: id, focus: null, selected: id ? bodyKey([0]) : SCENE });
        store._ui.confirmReset(false);
        store.expand(SCENE, bodyKey([0]));
      }),
      rename(name: string): void {
        if (ownScene(store.scene())) d.renameScene(store.scene(), name);
      },
      /** The scene taken out of the draft; the random sets' opened. */
      deleteScene(): void {
        if (!ownScene(store.scene())) return;
        d.deleteScene(store.scene());
        store._ui.open(RANDOM_SETS);
      },
      /** A planet, by id, put in the scene: shown in the tree and selected. */
      addPlanet(id: string): void {
        if (!store.hasPlanets()) return;
        const { bodies, path } = addPlanet(store.sceneBodies(), id);
        d.setSceneBodies(store.scene(), bodies);
        store.expand(SCENE);
        patchState(store, { selected: bodyKey(path) });
      },
      /** The body clicked in the view (by its index as put up) selected, its rows unfolded to it. */
      selectPlaced(index: number): boolean {
        const path = store._placed()?.paths[index];
        if (!path) return false;
        store.expand(SCENE, ...path.slice(0, -1).map((_, i) => bodyKey(path.slice(0, i + 1))));
        patchState(store, { selected: bodyKey(path) });
        return true;
      },
      /** A row selected; the materials' group only folds (there is nothing of its own to set). */
      select(key: string): void {
        if (targetOf(key).kind === 'group') store.toggleExpanded(key);
        else patchState(store, { selected: key });
      },
      setEnabled(change: { key: string; enabled: boolean }): void {
        const t = targetOf(change.key);
        const on = change.enabled;
        const b = 'path' in t ? store.bodyByKey().get(bodyKey(t.path)) : undefined;
        // Each back to what is under it where that is the same, else set here (a scene's own
        // light: switched on is as it starts).
        if (t.kind === 'light' && b) {
          const below = lightsOfBody(b).find((l) => l.light.id === t.id)?.enabledBelow ?? true;
          settings(t.path, (s) => withLightSwitched(s, t.id, on, below));
        } else if (t.kind === 'scene-light') lightChange(t, { enabled: on });
        else if (t.kind === 'body')
          // Only a scene switches a body off: on is as it is unless set.
          settings(t.path, (s) => (on ? without(s, ['enabled']) : { ...s, enabled: false }));
        else if (t.kind === 'part' && b) {
          const below = partsOfBody(b).find((p) => p.key === t.key)?.enabledBelow ?? true;
          settings(t.path, (s) =>
            on === below
              ? withoutPartSetting(s, t.key, ['enabled'])
              : withPartSetting(s, t.key, { enabled: on }),
          );
        } else if (t.kind === 'group' && b && change.key === overlayKey(t.path))
          settings(t.path, (s) =>
            on === overlayEnabledBelow(b)
              ? without(s, ['overlayEnabled'])
              : { ...s, overlayEnabled: on },
          );
        else if (t.kind === 'sky-material') {
          const below = store.skyMaterials().find((m) => m.name === t.name)?.enabledBelow ?? true;
          if (on === below) d.clearSkyMaterial(store.scene(), t.name, ['enabled']);
          else materialChange(change.key, { enabled: on });
        } else if (t.kind === 'material' && b) {
          const below = materialsOf(b).find((m) => m.name === t.name)?.enabledBelow ?? true;
          settings(t.path, (s) => withMaterialSwitched(s, t.name, on, below));
        }
      },
      setLight(change: Partial<LightSettings>): void {
        lightChange(store.target(), change);
      },
      /** One of the lights in the selected body's Lit by selected in the tree, its rows unfolded to it. */
      showLight(id: LightId): void {
        const t = store.target();
        const light = store.litBy()?.find((l) => l.id === id);
        if (!light || !('path' in t)) return;
        if (light.owner === 'scene') {
          store.expand(SCENE);
          store.reopen(SCENE_LIGHTS);
          patchState(store, { selected: sceneLightKey(id) });
          return;
        }
        const path = light.owner ?? t.path;
        store.expand(SCENE, ...path.map((_, i) => bodyKey(path.slice(0, i + 1))));
        if (light.overlay) {
          store.reopen(overlayKey(path));
          store.expand(overlayLightsKey(path));
        } else store.expand(lightsKey(path));
        patchState(store, { selected: lightRowKey(path, id) });
      },
      setLitBy(change: { readonly id: LightId; readonly on: boolean }): void {
        const t = store.target();
        const receiver = receiverOf(t);
        const light = store.litBy()?.find((l) => l.id === change.id);
        if (!light || receiver === undefined || !('path' in t)) return;
        const b = store.bodyByKey().get(bodyKey(t.path));
        if (!b) return;
        settings(t.path, (s) => withLitBy(s, b, light, receiver, change.on));
      },
      addLight(kind: LightKind): void {
        const t = store.target();
        const path = selectedPath();
        if (path && t.kind !== 'scene-light') {
          const b = store.bodyByKey().get(bodyKey(path));
          const light = newLight(
            kind,
            b
              ? lightsOfBody(b)
                  .map((l) => l.light)
                  .filter((l) => l.id.startsWith('added-'))
              : [],
          );
          settings(path, (s) => withAddedLight(s, light));
          store.expand(bodyKey(path), lightsKey(path));
          patchState(store, { selected: lightRowKey(path, light.id) });
        } else {
          const light = newLight(kind, store.sceneLights());
          d.setSceneLights(store.scene(), [...store.sceneLights(), light]);
          patchState(store, { selected: sceneLightKey(light.id) });
        }
      },
      setRevealFrom(from: Vec3): void {
        const t = store.target();
        if (t.kind === 'light') lightChange({ ...t, id: 'reveal' }, { from });
      },
      removeLight(): void {
        const t = store.target();
        if (t.kind === 'scene-light') {
          d.setSceneLights(
            store.scene(),
            store.sceneLights().filter((l) => l.id !== t.id),
          );
          patchState(store, { selected: SCENE });
        } else if (t.kind === 'light') {
          settings(t.path, (s) => withoutAddedLight(s, t.id));
          patchState(store, { selected: bodyKey(t.path) });
        }
      },
      clearLight(keys?: readonly (keyof LightSettings)[]): void {
        const t = store.target();
        if (t.kind === 'light') settings(t.path, (s) => withoutLightSetting(s, t.id, keys));
      },
      moveMaterial(move: TreeMove): void {
        const from = targetOf(move.key);
        const to = targetOf(move.target);
        if (from.kind === 'sky-material' && to.kind === 'sky-material') {
          const all = store.skyMaterials();
          const moving = all.find((m) => m.name === from.name);
          const target = all.find((m) => m.name === to.name);
          if (!moving || !target) return;
          const depth = target.values.depth;
          const group = all.filter((m) => m.values.depth === depth).map((m) => m.name);
          const order = reordered(
            all.map((m) => m.name),
            group,
            from.name,
            to.name,
            move.after,
          );
          if (moving.values.depth !== depth) d.setSkyMaterial(store.scene(), from.name, { depth });
          d.setSkyOrder(store.scene(), order);
        } else if (
          from.kind === 'material' &&
          to.kind === 'material' &&
          pathKey(from.path) === pathKey(to.path)
        ) {
          const b = store.bodyByKey().get(bodyKey(from.path));
          if (!b) return;
          const all = materialsOf(b);
          // Within the part they are drawn on (a material isn't moved to another part).
          const group = partsOfBody(b).find((p) => p.materials.includes(to.name))?.materials;
          if (!group?.includes(from.name)) return;
          const order = reordered(
            all.map((m) => m.name),
            group,
            from.name,
            to.name,
            move.after,
          );
          settings(from.path, (s) => ({ ...s, order }));
        }
      },
      setMaterial(change: Partial<MaterialSettings>): void {
        materialChange(store.selected(), change);
      },
      clearMaterial(keys?: readonly (keyof MaterialSettings)[]): void {
        const t = store.target();
        if (t.kind === 'sky-material') d.clearSkyMaterial(store.scene(), t.name, keys);
        else if (t.kind === 'material') settings(t.path, (s) => withoutMaterial(s, t.name, keys));
      },
      setPart(change: Partial<PartSettings>): void {
        const t = store.target();
        if (t.kind === 'part') settings(t.path, (s) => withPartSetting(s, t.key, change));
      },
      clearPart(keys?: readonly (keyof PartSettings)[]): void {
        const t = store.target();
        if (t.kind === 'part') settings(t.path, (s) => withoutPartSetting(s, t.key, keys));
      },
      setBody(change: Partial<BodySettings>): void {
        const path = selectedPath();
        if (path) settings(path, (s) => ({ ...s, ...change }));
      },
      clearBody(keys: readonly (keyof BodySettings)[]): void {
        const path = selectedPath();
        if (path) settings(path, (s) => without(s, keys));
      },
      resetBody(): void {
        const path = selectedPath();
        if (path) settings(path, () => undefined);
      },
      setStyle(style: string): void {
        const path = selectedPath();
        if (path) edit((b) => setStyle(b, path, style));
      },
      resetStyle(): void {
        const path = selectedPath();
        if (path) edit((b) => resetStyle(b, path));
      },
      setOrbit(change: Partial<Orbit>): void {
        const path = selectedPath();
        if (path && path.length > 1) edit((b) => setOrbit(b, path, change));
      },
      /** The selected planet moved or sized. */
      setPlace(change: { readonly position?: Vec3; readonly radius?: number }): void {
        const path = selectedPath();
        if (path?.length === 1) edit((b) => setPlace(b, path, change));
      },
      /** A moon added about the selected body: shown in the tree and selected. */
      addMoon(moon: string): void {
        const parent = selectedPath();
        if (!parent || !store.hasPlanets()) return;
        const { bodies, path } = addMoonAt(store.sceneBodies(), parent, moon);
        d.setSceneBodies(store.scene(), bodies);
        store.expand(bodyKey(parent));
        patchState(store, { selected: bodyKey(path) });
      },
      /**
       * The selected body taken out (a planet with its moons, a moon with its own): its parent
       * selected (the scene, for a planet), the view off it.
       */
      removeMoon(): void {
        const path = selectedPath();
        if (!path?.length) return;
        edit((b) => removeAt(b, path));
        const focus = store.focus();
        const gone = focus !== null && path.every((v, i) => pathOf(focus)[i] === v);
        patchState(store, {
          selected: path.length > 1 ? bodyKey(path.slice(0, -1)) : SCENE,
          focus: gone ? null : focus,
        });
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
      setSkyTint(tint: MaterialTint): void {
        d.setSkyTint(store.scene(), tint);
      },
      clearSkyTint(): void {
        d.clearSkyTint(store.scene());
      },
      resetSky(): void {
        d.resetSky(store.scene());
      },
      anotherSet(): void {
        store._background.nextPlanetSet();
      },
      chooseTint(choice: string): void {
        d.chooseTint(choice);
      },
      setTint: d.setTint,
      /** The whole scene back as the library has it: its planets' looks, moons, sky, the colour; the view on it all. */
      resetAll(): void {
        d.resetScene(store.scene());
        d.resetTint();
        patchState(store, { focus: null, selected: SCENE });
        store._ui.confirmReset(false);
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.needFiles(store.neededFiles);
      // A scene that isn't there any more: back to the scenes' list.
      effect(() => {
        if (!store.missing()) return;
        untracked(() => {
          store._ui.show(RANDOM_SETS);
          store._ui.setBrowsing(true);
        });
      });
    },
  }),
);
