import { computed, effect, inject, resource } from '@angular/core';
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
import { withFolding } from '../../data/store-features/with-folding';
import { withLocalStorage } from '../../data/store-features/with-local-storage';
import { BackgroundStore } from '../../scenes/play-background/background.store';
import {
  type MaterialControls,
  materialControls,
  type MaterialValues,
  materialValues,
  mergeMaterialSettings,
  NO_MATERIAL_TINT,
} from '../../scenes/play-background/material-settings';
import type { SetPlanet } from '../../scenes/play-background/planet-sets';
import {
  loadPlaySceneFile,
  PLAY_SCENE_URL,
  type SceneMaterial,
} from '../../scenes/play-background/play-scene';
import { keyLightFrom, TOWARDS_EYE } from '../../scenes/play-background/scene-directions';
import {
  DEFAULT_SHADE,
  loadPlanetIndex,
  type MaterialSettings,
  type MaterialTint,
  type PlanetFile,
} from '../../scenes/play-background/scene-planets';
import { withPlanetFiles } from '../../scenes/play-background/with-planet-files';
import {
  type BodyPath,
  type BodySettings,
  type BodyValues,
  fitRadius,
  moonAt,
  type MoonChoices,
  type Orbit,
  pathKey,
  pathOf,
  placeBodies,
  reveal,
} from './background-scene';
import { BackgroundScenesStore, CUSTOM_TINT } from './background-scenes.store';
import type { TreeRow } from './editor/scene-tree';
import { grouped, type PropertyOption } from './properties/property-select';
import { backgroundTints, PRESETS } from './tint-settings';

/** Where the scene's planet is put: in the middle of the view, filling much of it (less where its moons wouldn't fit). */
const REVIEW_POSITION: readonly [number, number, number] = [0, 65, 4];
const REVIEW_RADIUS = 18;
/** Where the editor's own choices are kept (what it shows, how its panels are). */
const EDITOR_KEY = 'hrs.background-editor';

/** The scene tree's rows by what they are. */
export const SCENE = 'scene';
export const SKY = 'sky';
export const bodyKey = (path: BodyPath) => `body:${pathKey(path)}`;
const materialsKey = (path: BodyPath) => `${bodyKey(path)}/materials`;
const materialKey = (path: BodyPath, name: string) => `${bodyKey(path)}/m/${name}`;
const skyMaterialKey = (name: string) => `${SKY}/m/${name}`;

/** What a tree row's key is. */
export type Target =
  | { readonly kind: 'scene' }
  | { readonly kind: 'sky' }
  | { readonly kind: 'sky-material'; readonly name: string }
  | { readonly kind: 'body'; readonly path: BodyPath }
  | { readonly kind: 'materials'; readonly path: BodyPath }
  | { readonly kind: 'material'; readonly path: BodyPath; readonly name: string };

export function targetOf(key: string): Target {
  if (key.startsWith(`${SKY}/m/`)) return { kind: 'sky-material', name: key.slice(SKY.length + 3) };
  if (key === SKY) return { kind: 'sky' };
  if (!key.startsWith('body:')) return { kind: 'scene' };
  const rest = key.slice(5);
  const slash = rest.indexOf('/');
  const path = pathOf(slash < 0 ? rest : rest.slice(0, slash));
  const tail = slash < 0 ? '' : rest.slice(slash);
  if (tail === '/materials') return { kind: 'materials', path };
  if (tail.startsWith('/m/')) return { kind: 'material', path, name: tail.slice(3) };
  return { kind: 'body', path };
}

/** A body in the scene: which planet, its style, its settings here, its files once loaded. */
export interface BodyInfo {
  readonly path: BodyPath;
  readonly id: string;
  readonly style: string;
  /** Whether its style is chosen here (else its own). */
  readonly styleSet: boolean;
  readonly settings: BodySettings;
  readonly file?: PlanetFile;
  readonly styleFile?: PlanetFile;
  /** Its orbit, where it is a moon. */
  readonly orbit?: Orbit;
  readonly moons: readonly MoonChoices[];
}

/** A body as its properties show it. */
export interface BodyView {
  readonly info: BodyInfo;
  readonly values: BodyValues;
  readonly canLight: boolean;
  readonly changed: boolean;
  readonly baseTint: MaterialTint;
  readonly focused: boolean;
}

/** A material as its properties show it: its settings as shown, what is set here, which controls do anything. */
export interface MaterialEntry {
  readonly name: string;
  readonly values: MaterialValues;
  readonly controls: MaterialControls;
  readonly set: MaterialSettings | undefined;
  readonly baseTint: MaterialTint;
}

/** A planet's (or style's) materials, in its parts' order, each once, with whether a pattern is drawn for it. */
function partMaterials(
  file: PlanetFile,
): { name: string; material: SceneMaterial; pattern: boolean }[] {
  const out: { name: string; material: SceneMaterial; pattern: boolean }[] = [];
  for (const part of file.parts)
    for (const name of part.materials) {
      const material = file.materials[name];
      if (material && !out.some((m) => m.name === name))
        out.push({ name, material, pattern: part.pattern !== undefined });
    }
  return out;
}

/** A body's materials, its own then its style's (each over its file's tuning), as shown. */
function materialsOf(b: BodyInfo): MaterialEntry[] {
  const chosen = b.settings.materials;
  return [b.file, b.styleFile].flatMap((owner) =>
    owner
      ? partMaterials(owner).map(({ name, material, pattern }) => {
          const own = owner.tuning?.materials?.[name];
          return {
            name,
            values: materialValues(
              material,
              mergeMaterialSettings(owner.tuning?.materials, chosen)[name],
            ),
            controls: materialControls(material, pattern),
            set: chosen?.[name],
            baseTint: own?.tint ?? NO_MATERIAL_TINT,
          };
        })
      : [],
  );
}

/** A body's own settings as shown: its own, over its style's, over its file's tuning, over the defaults. */
function valuesOf(b: BodyInfo): BodyValues {
  const tuning = b.file?.tuning;
  const style = b.styleFile;
  const s = b.settings;
  return {
    style: b.style,
    lighting: s.lighting ?? tuning?.lighting ?? 1,
    // A style it wears shades it its way; else its own tuning.
    shade: s.shade ?? style?.shade?.strength ?? tuning?.shade?.strength ?? DEFAULT_SHADE.strength,
    tint: s.tint ?? tuning?.tint ?? NO_MATERIAL_TINT,
    lightFrom: s.lightFrom ?? tuning?.lightFrom ?? keyLightFrom(style?.light ?? b.file?.light),
    shadeTowards:
      s.shadeTowards ??
      style?.shade?.direction ??
      tuning?.shade?.direction ??
      DEFAULT_SHADE.direction,
    rim: s.rim ?? tuning?.rim ?? TOWARDS_EYE,
  };
}

interface EditorState {
  /** The scene's planet, by id (the URL's); none: the random sets. */
  readonly review: string;
  /** Whether the bodies' names float over them. */
  readonly names: boolean;
  /** Whether the scene panel and the properties panel are open. */
  readonly left: boolean;
  readonly right: boolean;
  /** The selected row's key. */
  readonly selected: string;
  /** The moon the view is centred on, by its path's key; none: the planet. */
  readonly focus: string | null;
  /** Whether a reset of the whole scene was asked for and waits to be confirmed. */
  readonly confirmingReset: boolean;
  /** The view's shape (its width over its height), between the panels. */
  readonly aspect: number;
}

/**
 * {@link PlayBackgroundPage}'s component store: the editor of the Background page's scenes (kept
 * in the global {@link BackgroundScenesStore}). What it shows (a planet, by the URL, or the random
 * sets), the scene as a tree (folding: {@link withFolding}), what is selected and what its
 * properties are, the moon the view is centred on, the panels; the bodies placed for the
 * background (a selected moon shown where it can be seen, the scene fitted to the view) and held
 * up on it ({@link BackgroundStore}) while the page is open, with the scene's colour and sky.
 * The editor's own choices are kept in `localStorage`.
 */
export const PlayBackgroundPageStore = signalStore(
  withState<EditorState>({
    review: '',
    names: true,
    left: true,
    right: true,
    selected: SCENE,
    focus: null,
    confirmingReset: false,
    aspect: 16 / 9,
  }),
  withFolding([SCENE, bodyKey([])]),
  withLocalStorage<EditorState & { expanded: readonly string[] }>(EDITOR_KEY, [
    'review',
    'names',
    'left',
    'right',
    'selected',
    'focus',
    'expanded',
  ]),
  withPlanetFiles(),
  withProps(() => ({
    _scenes: inject(BackgroundScenesStore),
    _background: inject(BackgroundStore),
    /** The planets there are. */
    _index: resource({ loader: ({ abortSignal }) => loadPlanetIndex(PLAY_SCENE_URL, abortSignal) }),
    /** The scene's own file: its sky's materials, and its camera (where the eye is). */
    _sceneFile: resource({
      loader: ({ abortSignal }) => loadPlaySceneFile(PLAY_SCENE_URL, abortSignal),
    }),
  })),
  withComputed(({ review, files, focus, selected, _scenes, _index, _sceneFile }) => {
    const planetChoices = computed(() => _scenes.planets()[review()] ?? {});
    /** The scene's own sky (the random sets' under ''). */
    const sky = computed(() => planetChoices().sky ?? {});
    const moons = computed(() => planetChoices().moons ?? []);
    const planetIds = computed(() =>
      _index.hasValue() ? _index.value().planets.map((p) => p.id) : [],
    );

    /** The scene's bodies, the planet first, then each moon after its parent. */
    const bodies = computed((): BodyInfo[] => {
      const id = review();
      if (!id) return [];
      const all = files();
      const planet = planetChoices();
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
        path,
        id: bodyId,
        style: bodyStyle,
        styleSet,
        settings,
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
    const bodyByKey = computed(() => new Map(bodies().map((b) => [pathKey(b.path), b] as const)));

    /** The sky's materials, as shown. */
    const skyMaterials = computed((): MaterialEntry[] => {
      const scene = _sceneFile.hasValue() ? _sceneFile.value() : null;
      if (!scene) return [];
      const chosen = sky().materials ?? {};
      const out: MaterialEntry[] = [];
      for (const mesh of Object.values(scene.meshes)) {
        if (mesh.planet) continue; // the scene's own planets are placed planets
        for (const name of mesh.materials) {
          const material = scene.materials[name];
          if (!material || out.some((m) => m.name === name)) continue;
          out.push({
            name,
            values: materialValues(material, chosen[name]),
            controls: materialControls(material, false),
            set: chosen[name],
            baseTint: NO_MATERIAL_TINT,
          });
        }
      }
      return out;
    });

    const target = computed(() => targetOf(selected()));
    const body = computed(() => {
      const t = target();
      return 'path' in t ? bodyByKey().get(pathKey(t.path)) : undefined;
    });
    const focusPath = computed((): BodyPath => {
      const key = focus();
      if (key === null) return [];
      const path = pathOf(key);
      return moonAt(moons(), path) ? path : [];
    });

    return {
      planetIds,
      moons,
      bodies,
      bodyByKey,
      skyMaterials,
      target,
      focusPath,
      /** The files the scene needs: its bodies' and their styles'. */
      neededFiles: computed(() => [
        ...new Set(bodies().flatMap((b) => (b.style ? [b.id, `style-${b.style}`] : [b.id]))),
      ]),
      /** The selected body (a body, or the body of a selected material), as its properties show it. */
      bodyView: computed((): BodyView | null => {
        const b = body();
        if (!b) return null;
        return {
          info: b,
          values: valuesOf(b),
          canLight: !!b.file && (!!b.file.light || b.style !== ''),
          changed: Object.keys(b.settings).length > 0,
          baseTint: b.file?.tuning?.tint ?? NO_MATERIAL_TINT,
          focused: b.path.length > 0 && focus() === pathKey(b.path),
        };
      }),
      /** The selected material, as its properties show it. */
      material: computed((): MaterialEntry | undefined => {
        const t = target();
        if (t.kind === 'sky-material') return skyMaterials().find((m) => m.name === t.name);
        const b = body();
        return t.kind === 'material' && b
          ? materialsOf(b).find((m) => m.name === t.name)
          : undefined;
      }),
      /** The properties panel's title: what is selected. */
      title: computed(() => {
        const t = target();
        if (t.kind === 'scene') return 'Scene';
        if (t.kind === 'sky') return 'Sky';
        if (t.kind === 'sky-material' || t.kind === 'material') return t.name;
        return body()?.id ?? 'Properties';
      }),
      sky,
      skyChanged: computed(() => !!sky().materials || !!sky().tint),
      /** The sky's tint as shown (none: no tint), and as set here. */
      skyTint: computed(() => sky().tint ?? NO_MATERIAL_TINT),
      skyTintSet: computed(() => sky().tint),
      /** The colour over the whole picture. */
      tint: computed(() => _scenes.settings().background),
      /** The scenes to choose: the random sets, then the planets by kind. */
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
      /** The global tint's choices: none or a custom one, then the presets. */
      tintOptions: computed((): PropertyOption[] =>
        grouped(
          [
            { value: PRESETS[0]!.id, label: PRESETS[0]!.label },
            { value: CUSTOM_TINT, label: 'Custom' },
          ],
          PRESETS.slice(1).map((p) => ({ value: p.id, label: p.label })),
        ),
      ),
      /** The global tint chosen: a preset's id (the first: none), or Custom. */
      tintChoice: computed(() => {
        const settings = _scenes.settings();
        if (settings.choice) return settings.choice;
        return settings.background.on ? CUSTOM_TINT : PRESETS[0]!.id;
      }),
      /** The focused moon's name, while one is. */
      focusedName: computed(() => {
        const path = focusPath();
        return path.length ? (bodyByKey().get(pathKey(path))?.id ?? null) : null;
      }),
    };
  }),
  withComputed((store) => ({
    /** The scene as a tree, as many rows as are unfolded. */
    rows: computed((): TreeRow[] => {
      const open = store.unfolded();
      const rows: TreeRow[] = [];
      const row = (key: string, label: string, icon: string, depth: number) =>
        rows.push({ key, label, icon, depth, expandable: true, expanded: open.has(key) });
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
      row(SCENE, 'Scene', 'landscape', 0);
      if (!open.has(SCENE)) return rows;
      row(SKY, 'Sky', 'blur_on', 1);
      if (open.has(SKY))
        for (const m of store.skyMaterials())
          leaf(skyMaterialKey(m.name), m.name, 2, m.values.enabled);
      const body = (b: BodyInfo, depth: number) => {
        const key = bodyKey(b.path);
        row(
          key,
          b.style ? `${b.id} · ${b.style}` : b.id,
          b.path.length ? 'brightness_1' : 'public',
          depth,
        );
        if (!open.has(key)) return;
        const group = materialsKey(b.path);
        row(group, 'Materials', 'layers', depth + 1);
        if (open.has(group))
          for (const m of materialsOf(b))
            leaf(materialKey(b.path, m.name), m.name, depth + 2, m.values.enabled);
        b.moons.forEach((_, i) => {
          const child = store.bodyByKey().get(pathKey([...b.path, i]));
          if (child) body(child, depth + 1);
        });
      };
      const planet = store.bodies()[0];
      if (planet) body(planet, 1);
      return rows;
    }),
    /** The scene's bodies placed for the background; null while what they need is loading. */
    placed: computed((): SetPlanet[] | null => {
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
      const reach = { up, across: up * store.aspect() };
      const base = { ...reviewed, radius: fitRadius(reviewed, centre, eye, reach, overrides) };
      const out: SetPlanet[] = [];
      for (const p of placeBodies(base, centre, eye, overrides)) {
        const b = store.bodyByKey().get(pathKey([...focus, ...p.path]));
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
    /** The planet shown, and the style its own settings are kept by. */
    const scene = () => ({ id: store.review(), style: store.bodies()[0]?.style ?? '' });
    /** A material's settings changed: the sky's, or a body's. */
    const setMaterial = (t: Target, change: Partial<MaterialSettings>) => {
      const { id, style } = scene();
      if (t.kind === 'sky-material') store._scenes.setSkyMaterial(id, t.name, change);
      else if (t.kind === 'material') store._scenes.setMaterial(id, t.path, style, t.name, change);
    };
    return {
      /** The planet shown, as the URL says (none: the random sets); a new one is selected, the view on it. */
      showPlanet: signalMethod<string | undefined>((id) => {
        const next = id ?? '';
        if (next === store.review()) return;
        patchState(store, {
          review: next,
          focus: null,
          selected: next ? bodyKey([]) : SCENE,
          confirmingReset: false,
        });
        store.expand(SCENE, bodyKey([]));
      }),
      setNames(names: boolean): void {
        patchState(store, { names });
      },
      setPanel(panel: 'left' | 'right', open: boolean): void {
        patchState(store, { [panel]: open });
      },
      setAspect(aspect: number): void {
        if (Number.isFinite(aspect) && aspect > 0) patchState(store, { aspect });
      },
      /** A row selected; the materials' group only folds (there is nothing of its own to set). */
      select(key: string): void {
        if (targetOf(key).kind === 'materials') store.toggleExpanded(key);
        else patchState(store, { selected: key });
      },
      setMaterial,
      /** A material's settings taken back (all of them: `keys` left out). */
      clearMaterial(t: Target, keys?: readonly (keyof MaterialSettings)[]): void {
        const { id, style } = scene();
        if (t.kind === 'sky-material') store._scenes.clearSkyMaterial(id, t.name, keys);
        else if (t.kind === 'material')
          store._scenes.clearMaterial(id, t.path, style, t.name, keys);
      },
      /** A material switched on or off from the tree. */
      setEnabled(change: { key: string; enabled: boolean }): void {
        setMaterial(targetOf(change.key), { enabled: change.enabled });
      },
      setBody(path: BodyPath, change: Partial<BodySettings>): void {
        const { id, style } = scene();
        store._scenes.setBody(id, path, style, change);
      },
      clearBody(path: BodyPath, keys: readonly (keyof BodySettings)[]): void {
        const { id, style } = scene();
        store._scenes.clearBody(id, path, style, keys);
      },
      resetBody(path: BodyPath): void {
        const { id, style } = scene();
        store._scenes.resetBody(id, path, style);
      },
      setStyle(path: BodyPath, style: string): void {
        store._scenes.setStyle(store.review(), path, style);
      },
      resetStyle(path: BodyPath): void {
        store._scenes.resetStyle(store.review(), path);
      },
      setOrbit(path: BodyPath, change: Partial<Orbit>): void {
        store._scenes.setOrbit(store.review(), path, change);
      },
      /** A moon added about a body: shown in the tree and selected. */
      addMoon(parent: BodyPath, moon: string): void {
        const path = store._scenes.addMoon(store.review(), parent, moon);
        store.expand(bodyKey(parent));
        patchState(store, { selected: bodyKey(path) });
      },
      /** A moon taken out, with its own; its parent selected, the view off it. */
      removeMoon(path: BodyPath): void {
        store._scenes.removeMoon(store.review(), path);
        const focus = store.focus();
        patchState(store, {
          selected: bodyKey(path.slice(0, -1)),
          focus: focus !== null && pathOf(focus).length >= path.length ? null : focus,
        });
      },
      /** The view centred on a moon and its moons, or back on the planet. */
      toggleFocus(path: BodyPath): void {
        const key = pathKey(path);
        patchState(store, { focus: store.focus() === key ? null : key });
      },
      unfocus(): void {
        patchState(store, { focus: null });
      },
      resetSky(): void {
        store._scenes.resetSky(store.review());
      },
      setSkyTint(tint: MaterialTint): void {
        store._scenes.setSkyTint(store.review(), tint);
      },
      clearSkyTint(): void {
        store._scenes.clearSkyTint(store.review());
      },
      chooseTint(choice: string): void {
        store._scenes.chooseTint(choice);
      },
      setTint: store._scenes.setTint,
      anotherSet(): void {
        store._background.nextPlanetSet();
      },
      confirmReset(asked: boolean): void {
        patchState(store, { confirmingReset: asked });
      },
      /** The whole scene back as the data has it: the planet, its moons, the scene's sky, the colour; the view on the planet. */
      resetScene(): void {
        store._scenes.resetPlanet(store.review()); // its sky with it
        store._scenes.resetTint();
        patchState(store, { focus: null, selected: SCENE, confirmingReset: false });
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.needFiles(store.neededFiles);
      effect(() => store._background.setPageTints(backgroundTints(store._scenes.settings())));
      effect(() =>
        store._background.setPageSky({
          materials: store.sky().materials,
          tint: store.sky().tint,
        }),
      );
      effect(() => {
        if (!store.review()) {
          store._background.setPagePlanets(null);
          return;
        }
        const placed = store.placed();
        if (placed) store._background.setPagePlanets(placed); // else the last stay till these load
      });
    },
    onDestroy(store) {
      store._background.setPageTints(null);
      store._background.setPagePlanets(null);
      store._background.setPageSky(null);
    },
  }),
);
