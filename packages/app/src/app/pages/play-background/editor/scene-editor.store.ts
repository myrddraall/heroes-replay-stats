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
  moonAt,
  type MoonChoices,
  type Orbit,
  pathKey,
  pathOf,
  placeBodies,
  reveal,
} from '../../../scenes/play-background/background-scene';
import { NO_MATERIAL_TINT } from '../../../scenes/play-background/material-settings';
import { playSet, type SetPlanet } from '../../../scenes/play-background/planet-sets';
import { loadPlaySceneFile, PLAY_SCENE_URL } from '../../../scenes/play-background/play-scene';
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
  skyMaterialsOf,
  type TargetKind,
} from './editor-model';
import { EditorUiStore } from './editor-ui.store';
import { type OpenTarget, RANDOM_SETS } from './open-target';
import type { TreeRow } from './scene-tree';

/** Where the scene's planet is put: in the middle of the view, filling much of it (less where its moons wouldn't fit). */
const REVIEW_POSITION: readonly [number, number, number] = [0, 65, 4];
const REVIEW_RADIUS = 18;

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
  | { readonly kind: 'material'; readonly path: BodyPath; readonly name: string };

function targetOf(key: string): Target {
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

interface SceneEditorState {
  /** The scene, by id (the URL's); '': the random sets'. */
  readonly scene: string;
  /** The selected row's key. */
  readonly selected: string;
  /** The moon the view is centred on, by its path's key; none: the planet. */
  readonly focus: string | null;
}

/**
 * The scene editor's store (component store, provided by the scene editor as its `Editor` and its
 * background's scene): one scene of the draft ({@link DraftDesignStore}), by the URL (or the
 * random sets'), as a tree (the scene, its sky and the sky's materials, the planet, its
 * materials and moons, theirs in turn), what is selected and its properties through the layers
 * (the data, the library, the scene), the moon the view is centred on. The scene's bodies placed
 * for the background: a selected moon shown where it can be seen, the scene fitted to the view.
 */
export const SceneEditorStore = signalStore(
  withState<SceneEditorState>({ scene: RANDOM_SCENE, selected: SCENE, focus: null }),
  withFolding([SCENE, bodyKey([])]),
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
    const published = computed(() => _draft.publishedScenes().planets[sceneId()] ?? {});
    /**
     * The scene's planet: its own, where it names one; else the planet its key is (scenes kept
     * before they were listed). None for the random sets', or a scene there isn't (deleted).
     */
    const planetId = computed(() => {
      const e = entry();
      const id = sceneId();
      if (!ownScene(id) || !e) return '';
      // Scenes kept by a planet's id before scenes were listed have that planet; a new one, its own or none.
      return e.planet ?? (/^scene-\d+$/.test(id) ? '' : id);
    });
    const moons = computed(() => choices().moons ?? []);
    const library = _draft.library;

    /** The scene's bodies, the planet first, then each moon after its parent. */
    const bodies = computed((): BodyInfo[] => {
      const planet = choices();
      const id = planetId();
      if (!id) return [];
      const all = files();
      const lib = library();
      const style = planet.style ?? all[id]?.tuning?.style ?? '';
      const info = (
        path: BodyPath,
        bodyId: string,
        bodyStyle: string,
        styleSet: boolean,
        settings: BodySettings,
        children: readonly MoonChoices[],
        orbit?: Orbit,
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
        moons: children,
      });
      const out = [
        info(
          [],
          id,
          style,
          planet.style !== undefined,
          planet.variants?.[style] ?? {},
          planet.moons ?? [],
        ),
      ];
      const walk = (parent: BodyPath, list: readonly MoonChoices[]) =>
        list.forEach((moon, i) => {
          const path = [...parent, i];
          out.push(
            info(
              path,
              moon.id,
              moon.style ?? '',
              !!moon.style,
              moon.settings ?? {},
              moon.moons ?? [],
              moon.orbit,
            ),
          );
          walk(path, moon.moons ?? []);
        });
      walk([], planet.moons ?? []);
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
    const focusPath = computed((): BodyPath => {
      const key = focus();
      if (key === null) return [];
      const path = pathOf(key);
      return moonAt(moons(), path) ? path : [];
    });
    /** The bodies (by key) that differ from what is published. */
    const unsavedBodies = computed(() => {
      const out = new Set<string>();
      for (const b of bodies()) {
        const path = pathOf(b.key.slice(5));
        if (!path.length) {
          const p = published();
          if (!same(choices().style, p.style) || !same(choices().variants, p.variants))
            out.add(b.key);
          continue;
        }
        const mine = moonAt(moons(), path);
        const theirs = moonAt(published().moons ?? [], path);
        if (!same({ ...mine, moons: undefined }, theirs && { ...theirs, moons: undefined }))
          out.add(b.key);
      }
      return out;
    });
    return {
      planetId,
      resetAllLabel: computed(() => 'Reset scene'),
      opened: computed((): OpenTarget => ({ kind: 'scene', id: sceneId() })),
      /** What the scene is called: its name, else its planet's id. */
      sceneName: computed(() => choices().name ?? ''),
      heading: computed(() => {
        const id = sceneId();
        if (id === RANDOM_SCENE) return 'Scene · Random sets';
        if (id === PLAY_SCREEN_SCENE) return 'Scene · Play screen';
        return `Scene · ${choices().name ?? planetId()}`;
      }),
      /** Whether the scene is one of the user's own (named, of a planet, deletable). */
      own: computed(() => ownScene(sceneId())),
      /** Whether it is one of the user's own that isn't there (deleted, or discarded unsaved). */
      missing: computed(() => ownScene(sceneId()) && !entry()),
      moons,
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
        return b ? bodyView(b, b.key !== bodyKey([]) && focus() === b.key.slice(5), true) : null;
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
        return body()?.id ?? 'Properties';
      }),
      skyChanged: computed(() => !!sky().materials || !!sky().tint),
      skyTint: computed((): MaterialTint => sky().tint ?? library().sky.tint ?? NO_MATERIAL_TINT),
      skyTintSet: computed(() => sky().tint),
      sets: computed(() => sceneId() === RANDOM_SCENE),
      planetIds: computed(() => (_index.hasValue() ? _index.value().planets.map((p) => p.id) : [])),
      planetOptions: computed((): PropertyOption[] => {
        const planets = _index.hasValue() ? _index.value().planets : [];
        const of = (kind: string) =>
          planets
            .filter((p) => p.kind === kind)
            .map((p) => p.id)
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        return grouped([{ value: '', label: 'None' }], of('play'), of('world'), of('painted'));
      }),
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
          path.length ? 'brightness_1' : 'public',
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
      const planet = store.bodies()[0];
      if (planet) body(planet, 1);
      return rows;
    }),
    /**
     * The scene's bodies placed for the background: the game's own three for the Play screen; null
     * for the random sets, or while what they need is loading.
     */
    scenePlanets: computed((): SetPlanet[] | null => {
      if (store.scene() === PLAY_SCREEN_SCENE)
        return store._index.hasValue() ? [...playSet(store._index.value())] : null;
      // A scene with no planet yet: its sky alone.
      if (store.scene() && !store.planetId()) return [];
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      if (!scene || !store.scene()) return null;
      const focus = store.focusPath();
      const centre = focus.length ? (moonAt(store.moons(), focus)?.moons ?? []) : store.moons();
      const eye = scene.camera.eye;
      const reviewed = { position: REVIEW_POSITION, radius: REVIEW_RADIUS };
      // A selected moon under the focused body is shown where it can be seen.
      const t = store.target();
      const path = 'path' in t ? t.path : null;
      const inside = path && focus.every((v, i) => path[i] === v) ? path.slice(focus.length) : null;
      const overrides = inside?.length
        ? reveal(reviewed, centre, eye, inside)
        : new Map<string, number>();
      // The whole scene kept in view: the planet smaller where a moon would reach past its edge.
      const up = Math.tan((scene.camera.fovY * Math.PI) / 360);
      const reach = { up, across: up * store._ui.aspect() };
      const base = { ...reviewed, radius: fitRadius(reviewed, centre, eye, reach, overrides) };
      const out: SetPlanet[] = [];
      for (const p of placeBodies(base, centre, eye, overrides)) {
        const b = store.bodyByKey().get(bodyKey([...focus, ...p.path]));
        if (!b?.file || (b.style && !b.styleFile)) return null;
        const s = b.settings;
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
      return out;
    }),
  })),
  withMethods((store) => {
    const d = store._draft;
    /** The scene's planet and the style its own settings are kept by. */
    const scene = () => ({ id: store.scene(), style: store.bodies()[0]?.style ?? '' });
    /** The selected body's path, if a body (or one of its materials) is selected. */
    const selectedPath = (): BodyPath | null => {
      const t = store.target();
      return 'path' in t ? t.path : null;
    };
    const materialChange = (key: string, change: Partial<MaterialSettings>) => {
      const t = targetOf(key);
      const { id, style } = scene();
      if (t.kind === 'sky-material') d.setSkyMaterial(id, t.name, change);
      else if (t.kind === 'material') d.setMaterial(id, t.path, style, t.name, change);
    };
    return {
      /** The scene shown, as the URL says ('': the random sets'); its planet selected, the view on it. */
      showScene: signalMethod<string>((id) => {
        if (id === store.scene()) return;
        patchState(store, { scene: id, focus: null, selected: id ? bodyKey([]) : SCENE });
        store._ui.confirmReset(false);
        store.expand(SCENE, bodyKey([]));
      }),
      /** The scene's planet changed (its looks were the old planet's: they go). */
      setPlanet(planet: string): void {
        if (ownScene(store.scene()) && planet) d.setScenePlanet(store.scene(), planet);
      },
      rename(name: string): void {
        if (ownScene(store.scene())) d.renameScene(store.scene(), name);
      },
      /** The scene taken out of the draft; the random sets' opened. */
      deleteScene(): void {
        if (!ownScene(store.scene())) return;
        d.deleteScene(store.scene());
        store._ui.open(RANDOM_SETS);
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
        const { id, style } = scene();
        if (t.kind === 'sky-material') d.clearSkyMaterial(id, t.name, keys);
        else if (t.kind === 'material') d.clearMaterial(id, t.path, style, t.name, keys);
      },
      setBody(change: Partial<BodySettings>): void {
        const path = selectedPath();
        const { id, style } = scene();
        if (path) d.setBody(id, path, style, change);
      },
      clearBody(keys: readonly (keyof BodySettings)[]): void {
        const path = selectedPath();
        const { id, style } = scene();
        if (path) d.clearBody(id, path, style, keys);
      },
      resetBody(): void {
        const path = selectedPath();
        const { id, style } = scene();
        if (path) d.resetBody(id, path, style);
      },
      setStyle(style: string): void {
        const path = selectedPath();
        if (path) d.setStyle(store.scene(), path, style);
      },
      resetStyle(): void {
        const path = selectedPath();
        if (path) d.resetStyle(store.scene(), path);
      },
      setOrbit(change: Partial<Orbit>): void {
        const path = selectedPath();
        if (path?.length) d.setOrbit(store.scene(), path, change);
      },
      /** A moon added about the selected body: shown in the tree and selected. */
      addMoon(moon: string): void {
        const parent = selectedPath();
        if (!parent) return;
        const path = d.addMoon(store.scene(), parent, moon);
        store.expand(bodyKey(parent));
        patchState(store, { selected: bodyKey(path) });
      },
      /** The selected moon taken out, with its own; its parent selected, the view off it. */
      removeMoon(): void {
        const path = selectedPath();
        if (!path?.length) return;
        d.removeMoon(store.scene(), path);
        const focus = store.focus();
        patchState(store, {
          selected: bodyKey(path.slice(0, -1)),
          focus: focus !== null && pathOf(focus).length >= path.length ? null : focus,
        });
      },
      /** The view centred on the selected moon and its moons, or back on the planet. */
      toggleFocus(): void {
        const path = selectedPath();
        if (!path?.length) return;
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
      /** The whole scene back as the library has it: the planet, its moons, its sky, the colour; the view on the planet. */
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
