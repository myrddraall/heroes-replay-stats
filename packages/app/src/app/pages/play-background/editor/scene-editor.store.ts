import { computed, inject, resource } from '@angular/core';
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
import type { SetPlanet } from '../../../scenes/play-background/planet-sets';
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
  /** The scene's planet, by id (the URL's); none: the random sets. */
  readonly review: string;
  /** The selected row's key. */
  readonly selected: string;
  /** The moon the view is centred on, by its path's key; none: the planet. */
  readonly focus: string | null;
}

/**
 * The scene editor's store (component store, provided by the scene editor as its `Editor` and its
 * background's scene): one scene of the draft ({@link DraftDesignStore}), its planet by the URL (or
 * the random sets), as a tree (the scene, its sky and the sky's materials, the planet, its
 * materials and moons, theirs in turn), what is selected and its properties through the layers
 * (the data, the library, the scene), the moon the view is centred on. The scene's bodies placed
 * for the background: a selected moon shown where it can be seen, the scene fitted to the view.
 */
export const SceneEditorStore = signalStore(
  withState<SceneEditorState>({ review: '', selected: SCENE, focus: null }),
  withFolding([SCENE, bodyKey([])]),
  withLocalStorage<SceneEditorState & { expanded: readonly string[] }>(
    'hrs.background-scene-editor',
    ['review', 'selected', 'focus', 'expanded'],
  ),
  withPlanetFiles(),
  withProps(() => ({
    resetAllLabel: 'Reset scene',
    _draft: inject(DraftDesignStore),
    _ui: inject(EditorUiStore),
    _background: inject(BackgroundStore),
    _index: resource({ loader: ({ abortSignal }) => loadPlanetIndex(PLAY_SCENE_URL, abortSignal) }),
    _sceneFile: resource({
      loader: ({ abortSignal }) => loadPlaySceneFile(PLAY_SCENE_URL, abortSignal),
    }),
  })),
  withComputed(({ review, files, focus, selected, _draft, _index, _sceneFile }) => {
    const choices = computed(() => _draft.scenes().planets[review()] ?? {});
    const published = computed(() => _draft.publishedScenes().planets[review()] ?? {});
    const moons = computed(() => choices().moons ?? []);
    const library = _draft.library;

    /** The scene's bodies, the planet first, then each moon after its parent. */
    const bodies = computed((): BodyInfo[] => {
      const planet = choices();
      // A scene's planet: its own, where it names one; else the planet its key is.
      const id = review() ? (planet.planet ?? review()) : '';
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
      return scene ? skyMaterialsOf(scene, library().sky, sky()) : [];
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
      sets: computed(() => !review()),
      planetIds: computed(() => (_index.hasValue() ? _index.value().planets.map((p) => p.id) : [])),
      reviewOptions: computed((): PropertyOption[] => {
        const planets = _index.hasValue() ? _index.value().planets : [];
        const of = (kind: string) =>
          planets
            .filter((p) => p.kind === kind)
            .map((p) => p.id)
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        return grouped(
          [{ value: '', label: 'Sets (random)' }],
          of('play'),
          of('world'),
          of('painted'),
        );
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
      const row = (key: string, label: string, icon: string, depth: number, unsaved = false) =>
        rows.push({ key, label, icon, depth, expandable: true, expanded: open.has(key), unsaved });
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
        row(group, 'Materials', 'layers', depth + 1);
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
    /** The scene's bodies placed for the background; null for the random sets, or while what they need is loading. */
    scenePlanets: computed((): SetPlanet[] | null => {
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      if (!scene || !store.review()) return null;
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
    const scene = () => ({ id: store.review(), style: store.bodies()[0]?.style ?? '' });
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
      /** The planet shown, as the URL says (none: the random sets); a new one is selected, the view on it. */
      showPlanet: signalMethod<string | undefined>((id) => {
        const next = id ?? '';
        if (next === store.review()) return;
        patchState(store, { review: next, focus: null, selected: next ? bodyKey([]) : SCENE });
        store._ui.confirmReset(false);
        store.expand(SCENE, bodyKey([]));
      }),
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
        if (path) d.setStyle(store.review(), path, style);
      },
      resetStyle(): void {
        const path = selectedPath();
        if (path) d.resetStyle(store.review(), path);
      },
      setOrbit(change: Partial<Orbit>): void {
        const path = selectedPath();
        if (path?.length) d.setOrbit(store.review(), path, change);
      },
      /** A moon added about the selected body: shown in the tree and selected. */
      addMoon(moon: string): void {
        const parent = selectedPath();
        if (!parent) return;
        const path = d.addMoon(store.review(), parent, moon);
        store.expand(bodyKey(parent));
        patchState(store, { selected: bodyKey(path) });
      },
      /** The selected moon taken out, with its own; its parent selected, the view off it. */
      removeMoon(): void {
        const path = selectedPath();
        if (!path?.length) return;
        d.removeMoon(store.review(), path);
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
        d.setSkyTint(store.review(), tint);
      },
      clearSkyTint(): void {
        d.clearSkyTint(store.review());
      },
      resetSky(): void {
        d.resetSky(store.review());
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
        d.resetScene(store.review());
        d.resetTint();
        patchState(store, { focus: null, selected: SCENE });
        store._ui.confirmReset(false);
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.needFiles(store.neededFiles);
    },
  }),
);
