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
  sceneBodies,
  setOrbit,
  setPlace,
  setStyle,
  withMaterial,
  visualExtent,
  withoutMaterial,
} from '../../../scenes/play-background/scene-bodies';
import {
  loadPlanetIndex,
  type MaterialSettings,
  type MaterialTint,
  type SkySettings,
} from '../../../scenes/play-background/scene-planets';
import { PRESETS } from '../../../scenes/play-background/tint-settings';
import { withPlanetFiles } from '../../../scenes/play-background/with-planet-files';
import { CUSTOM_TINT, DraftDesignStore } from '../draft-design.store';
import { grouped, type PropertyOption } from '../properties/property-select';
import {
  type BodyInfo,
  bodyView,
  materialsOf,
  referenceRow,
  skyMaterialsOf,
  type TargetKind,
} from './editor-model';
import { REFERENCE_KEY } from './editing-aids.store';
import { EditorUiStore } from './editor-ui.store';
import { type OpenTarget, RANDOM_SETS } from './open-target';
import type { TreeRow } from './scene-tree';

/** The scene tree's rows by what they are. */
const SCENE = 'scene';
const SKY = 'sky';
const bodyKey = (path: BodyPath) => `body:${pathKey(path)}`;
const materialsKey = (path: BodyPath) => `${bodyKey(path)}/materials`;
const materialKey = (path: BodyPath, name: string) => `${bodyKey(path)}/m/${name}`;
const skyMaterialKey = (name: string) => `${SKY}/m/${name}`;

/** What a scene tree row's key is. */
type Target =
  | { readonly kind: 'scene' }
  | { readonly kind: 'sky' }
  | { readonly kind: 'sky-material'; readonly name: string }
  | { readonly kind: 'body'; readonly path: BodyPath }
  | { readonly kind: 'group'; readonly path: BodyPath }
  | { readonly kind: 'material'; readonly path: BodyPath; readonly name: string }
  /** The reference image laid over the view (an editing aid). */
  | { readonly kind: 'reference' };

function targetOf(key: string): Target {
  if (key === REFERENCE_KEY) return { kind: 'reference' };
  if (key.startsWith(`${SKY}/m/`)) return { kind: 'sky-material', name: key.slice(SKY.length + 3) };
  if (key === SKY) return { kind: 'sky' };
  if (!key.startsWith('body:')) return { kind: 'scene' };
  const rest = key.slice(5);
  const slash = rest.indexOf('/');
  const path = pathOf(slash < 0 ? rest : rest.slice(0, slash));
  const tail = slash < 0 ? '' : rest.slice(slash);
  if (tail === '/materials') return { kind: 'group', path };
  if (tail.startsWith('/m/')) return { kind: 'material', path, name: tail.slice(3) };
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
      sceneId() === PLAY_SCREEN_SCENE && _index.hasValue()
        ? playSet(_index.value()).map((p) => ({ id: p.id, position: p.position, radius: p.radius }))
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
      sceneTint: computed(() => _draft.scenes().settings),
      neededFiles: computed(() => [
        ...new Set(bodies().flatMap((b) => (b.style ? [b.id, `style-${b.style}`] : [b.id]))),
      ]),
      kind: computed((): TargetKind => target().kind),
      bodyView: computed(() => {
        const b = body();
        return b ? bodyView(b, focus() === b.key.slice(5), true) : null;
      }),
      material: computed(() => {
        const t = target();
        if (t.kind === 'sky-material') return skyMaterials().find((m) => m.name === t.name);
        const b = body();
        return t.kind === 'material' && b
          ? materialsOf(b).find((m) => m.name === t.name)
          : undefined;
      }),
      title: computed(() => {
        const t = target();
        if (t.kind === 'scene') return 'Scene';
        if (t.kind === 'sky') return 'Sky';
        if (t.kind === 'sky-material' || t.kind === 'material') return t.name;
        if (t.kind === 'reference') return 'Reference';
        return body()?.id ?? 'Properties';
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
        });
      const leaf = (key: string, label: string, depth: number, enabled: boolean) =>
        rows.push({
          key,
          label,
          icon: 'texture',
          depth,
          expandable: false,
          expanded: false,
          enabled,
        });
      row(SCENE, 'Scene', 'landscape', 0, store.sceneUnsaved());
      if (!open.has(SCENE)) return rows;
      row(SKY, 'Sky', 'blur_on', 1, store.skyUnsaved());
      if (open.has(SKY))
        for (const m of store.skyMaterials())
          leaf(skyMaterialKey(m.name), m.name, 2, m.values.enabled);
      const body = (b: BodyInfo, depth: number) => {
        const path = pathOf(b.key.slice(5));
        row(
          b.key,
          b.style ? `${b.id} · ${b.style}` : b.id,
          path.length > 1 ? 'brightness_1' : 'public',
          depth,
          store.unsavedBodies().has(b.key),
        );
        if (!open.has(b.key)) return;
        const group = materialsKey(path);
        row(group, 'Materials', 'layers', depth + 1, false, true);
        if (open.has(group))
          for (const m of materialsOf(b))
            leaf(materialKey(path, m.name), m.name, depth + 2, m.values.enabled);
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
          return visualExtent(b?.file, b?.styleFile);
        };
        const base = fit
          ? { ...root, radius: fitRadius(root, moons, eye, reach, overrides, extent) }
          : root;
        for (const p of placeBodies(base, moons, eye, overrides)) {
          const b = store.bodyByKey().get(bodyKey([...under, ...p.path]));
          if (!b?.file || (b.style && !b.styleFile)) return null;
          const s = b.settings;
          extents.push(visualExtent(b.file, b.styleFile));
          paths.push([...under, ...p.path]);
          out.push({
            id: b.id,
            position: p.position,
            radius: p.radius,
            style: b.style || undefined,
            lighting: s.lighting,
            shade: {
              ...(s.shade !== undefined ? { strength: s.shade } : {}),
              ...(s.shadeTowards ? { direction: s.shadeTowards } : {}),
            },
            materials: s.materials,
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
        materialChange(change.key, { enabled: change.enabled });
      },
      setMaterial(change: Partial<MaterialSettings>): void {
        materialChange(store.selected(), change);
      },
      clearMaterial(keys?: readonly (keyof MaterialSettings)[]): void {
        const t = store.target();
        if (t.kind === 'sky-material') d.clearSkyMaterial(store.scene(), t.name, keys);
        else if (t.kind === 'material') settings(t.path, (s) => withoutMaterial(s, t.name, keys));
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
