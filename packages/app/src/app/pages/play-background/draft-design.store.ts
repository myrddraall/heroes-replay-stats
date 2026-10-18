import { DOCUMENT } from '@angular/common';
import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withLocalStorage } from '../../data/store-features/with-local-storage';
import {
  type Design,
  type LibraryState,
  ownScene,
  type ScenesState,
} from '../../scenes/play-background/background-design';
import {
  addMoon,
  type BodyPath,
  type BodySettings,
  changeMoon,
  DEFAULT_ORBIT,
  moonAt,
  type MoonChoices,
  type Orbit,
  type PlanetChoices,
  type SkyChoices,
  without,
} from '../../scenes/play-background/background-scene';
import { PublishedDesignStore } from '../../scenes/play-background/published-design.store';
import type { MaterialSettings, MaterialTint } from '../../scenes/play-background/scene-planets';
import { type PartTint, PRESETS, UNTINTED } from '../../scenes/play-background/tint-settings';

/** Where the draft is kept between visits (until it is saved or discarded). */
const DRAFT_KEY = 'hrs.background-draft';

/** The global tint's choice that is set by hand. */
export const CUSTOM_TINT = 'custom';

/** Which of the library's bodies: a planet's defaults, or a style's. */
export type LibraryKind = 'planets' | 'styles';

/** Settings with one material's changed. */
function withMaterial(
  s: BodySettings,
  name: string,
  change: Partial<MaterialSettings>,
): BodySettings {
  return { ...s, materials: { ...s.materials, [name]: { ...s.materials?.[name], ...change } } };
}

/** Settings with one material's taken back (all of it: `keys` left out); none left: none at all. */
function withoutMaterial(
  s: BodySettings,
  name: string,
  keys?: readonly (keyof MaterialSettings)[],
): BodySettings | undefined {
  const materials = { ...s.materials };
  const left = keys ? without(materials[name], keys) : undefined;
  if (left) materials[name] = left;
  else delete materials[name];
  return without({ ...s, materials }, Object.keys(materials).length ? [] : ['materials']);
}

/** A sky with one material's changed, or taken back; its tint set or taken back. */
function skyMaterial(
  sky: SkyChoices,
  name: string,
  change: Partial<MaterialSettings> | null,
  keys?: readonly (keyof MaterialSettings)[],
): SkyChoices {
  const materials = { ...sky.materials };
  if (change) materials[name] = { ...materials[name], ...change };
  else {
    const left = keys ? without(materials[name], keys) : undefined;
    if (left) materials[name] = left;
    else delete materials[name];
  }
  return { ...sky, materials: Object.keys(materials).length ? materials : undefined };
}

/** Records equal as kept (as JSON): for what is unsaved. */
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The keys of two records whose entries differ. */
function differing(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !same(a[k], b[k]));
}

/**
 * The Background page's draft of the design (component store, provided by the page): its library
 * and scenes as edited there, seeded from the published design ({@link PublishedDesignStore}) and
 * kept between visits until saved (published: the site shows it) or discarded (the published one
 * again). It is what the page's background and panels show: the page provides it as the design in
 * effect for everything under it. Every edit at every level lands here.
 */
export const DraftDesignStore = signalStore(
  withState<Design>(() => {
    const published = inject(PublishedDesignStore);
    return { library: published.library(), scenes: published.scenes() };
  }),
  withLocalStorage<Design>(DRAFT_KEY, ['library', 'scenes']),
  withProps(() => ({
    _published: inject(PublishedDesignStore),
    _root: inject(DOCUMENT).documentElement,
  })),
  withComputed(({ library, scenes, _published }) => {
    const changedPlanets = computed(() =>
      differing(library().planets, _published.library().planets),
    );
    const changedStyles = computed(() => differing(library().styles, _published.library().styles));
    const changedMaterials = computed(() =>
      differing(library().materials ?? {}, _published.library().materials ?? {}),
    );
    const changedScenes = computed(() => differing(scenes().planets, _published.scenes().planets));
    const skyChanged = computed(() => !same(library().sky, _published.library().sky));
    const colourChanged = computed(() => !same(scenes().settings, _published.scenes().settings));
    return {
      /** What is published, to compare with. */
      publishedScenes: computed(() => _published.scenes()),
      publishedLibrary: computed(() => _published.library()),
      /** The library's planets, styles and sky, and the scenes, that differ from what is published. */
      unsavedLibraryPlanets: computed(() => new Set(changedPlanets())),
      unsavedLibraryStyles: computed(() => new Set(changedStyles())),
      unsavedLibraryMaterials: computed(() => new Set(changedMaterials())),
      unsavedLibrarySky: skyChanged,
      unsavedScenes: computed(() => new Set(changedScenes())),
      unsavedColour: colourChanged,
      /** How many things differ from what is published (an asset, a scene, the sky, the colour). */
      unsaved: computed(
        () =>
          changedPlanets().length +
          changedStyles().length +
          changedMaterials().length +
          changedScenes().length +
          (skyChanged() ? 1 : 0) +
          (colourChanged() ? 1 : 0),
      ),
    };
  }),
  withMethods((store) => {
    const setLibrary = (change: (l: LibraryState) => LibraryState) =>
      patchState(store, { library: change(store.library()) });
    const setScenes = (change: (s: ScenesState) => ScenesState) =>
      patchState(store, { scenes: change(store.scenes()) });
    const scene = (id: string): PlanetChoices => store.scenes().planets[id] ?? {};
    /**
     * A scene changed. One with nothing left set is dropped, but for a scene of the user's own
     * (not a preset or the stage), which stays listed, its planet kept (or none: an empty one).
     */
    const setScene = (id: string, change: (p: PlanetChoices) => PlanetChoices | null) =>
      setScenes((s) => {
        const planets = { ...s.planets };
        const changed = change(scene(id));
        if (changed && Object.values(changed).some((v) => v !== undefined)) planets[id] = changed;
        else if (ownScene(id)) planets[id] = changed?.planet ? { planet: changed.planet } : {};
        else delete planets[id];
        return { ...s, planets };
      });
    const setSceneSky = (id: string, change: (sky: SkyChoices) => SkyChoices) =>
      setScene(id, (p) => {
        const sky = change(p.sky ?? {});
        return { ...p, sky: sky.materials || sky.tint ? sky : undefined };
      });
    const setMoons = (id: string, moons: readonly MoonChoices[]) =>
      setScene(id, (p) => ({ ...p, moons: moons.length ? moons : undefined }));
    /** A body's settings in a scene changed: the planet's in `style`, a moon's its own. */
    const updateBody = (
      id: string,
      path: BodyPath,
      style: string,
      change: (s: BodySettings) => BodySettings | undefined,
    ) => {
      if (path.length) {
        setMoons(
          id,
          changeMoon(scene(id).moons ?? [], path, (m) => ({
            ...m,
            settings: change(m.settings ?? {}),
          })),
        );
        return;
      }
      setScene(id, (p) => {
        const variants = { ...p.variants };
        const changed = change(variants[style] ?? {});
        if (changed) variants[style] = changed;
        else delete variants[style];
        return { ...p, variants: Object.keys(variants).length ? variants : undefined };
      });
    };
    /** A library body's defaults changed (none left: none kept). */
    const updateLibraryBody = (
      kind: LibraryKind,
      id: string,
      change: (s: BodySettings) => BodySettings | undefined,
    ) =>
      setLibrary((l) => {
        const bodies = { ...l[kind] };
        const changed = change(bodies[id] ?? {});
        if (changed && Object.keys(changed).length) bodies[id] = changed;
        else delete bodies[id];
        return { ...l, [kind]: bodies };
      });
    const setLibrarySky = (change: (sky: SkyChoices) => SkyChoices) =>
      setLibrary((l) => {
        const sky = change(l.sky);
        return { ...l, sky: { materials: sky.materials, tint: sky.tint } };
      });

    return {
      /** The draft published: the site shows it from now on. */
      save(): void {
        store._published.publish({ library: store.library(), scenes: store.scenes() });
      },
      /** The draft thrown away: the published design again. */
      discard(): void {
        patchState(store, {
          library: store._published.library(),
          scenes: store._published.scenes(),
        });
      },

      // The library: each asset's defaults.
      setLibraryBody(kind: LibraryKind, id: string, change: Partial<BodySettings>): void {
        updateLibraryBody(kind, id, (s) => ({ ...s, ...change }));
      },
      clearLibraryBody(kind: LibraryKind, id: string, keys: readonly (keyof BodySettings)[]): void {
        updateLibraryBody(kind, id, (s) => without(s, keys));
      },
      resetLibraryBody(kind: LibraryKind, id: string): void {
        updateLibraryBody(kind, id, () => undefined);
      },
      setLibraryMaterial(
        kind: LibraryKind,
        id: string,
        name: string,
        change: Partial<MaterialSettings>,
      ): void {
        updateLibraryBody(kind, id, (s) => withMaterial(s, name, change));
      },
      clearLibraryMaterial(
        kind: LibraryKind,
        id: string,
        name: string,
        keys?: readonly (keyof MaterialSettings)[],
      ): void {
        updateLibraryBody(kind, id, (s) => withoutMaterial(s, name, keys));
      },
      /** A material's base settings, wherever it is used. */
      setLibraryBaseMaterial(name: string, change: Partial<MaterialSettings>): void {
        setLibrary((l) => ({
          ...l,
          materials: { ...l.materials, [name]: { ...l.materials?.[name], ...change } },
        }));
      },
      clearLibraryBaseMaterial(name: string, keys?: readonly (keyof MaterialSettings)[]): void {
        setLibrary((l) => {
          const materials = { ...l.materials };
          const left = keys ? without(materials[name], keys) : undefined;
          if (left) materials[name] = left;
          else delete materials[name];
          return { ...l, materials };
        });
      },
      setLibrarySkyMaterial(name: string, change: Partial<MaterialSettings>): void {
        setLibrarySky((sky) => skyMaterial(sky, name, change));
      },
      clearLibrarySkyMaterial(name: string, keys?: readonly (keyof MaterialSettings)[]): void {
        setLibrarySky((sky) => skyMaterial(sky, name, null, keys));
      },
      setLibrarySkyTint(tint: MaterialTint): void {
        setLibrarySky((sky) => ({ ...sky, tint }));
      },
      clearLibrarySkyTint(): void {
        setLibrarySky((sky) => ({ ...sky, tint: undefined }));
      },
      resetLibrarySky(): void {
        setLibrarySky(() => ({}));
      },

      // The scenes: each listed, named, of a planet.
      /** A new scene of a planet: its id (`scene-<n>`, the first free). */
      /**
       * A new scene: empty (no planet yet), or a copy of another (`from`, by id) under a name of
       * its own. Its id (`scene-<n>`, the first free).
       */
      createScene(from?: { readonly id: string; readonly name: string }): string {
        const taken = store.scenes().planets;
        let n = 1;
        while (taken[`scene-${n}`]) n++;
        const id = `scene-${n}`;
        const copy: PlanetChoices = from
          ? { ...(structuredClone(taken[from.id]) ?? {}), name: from.name }
          : {};
        setScenes((s) => ({ ...s, planets: { ...s.planets, [id]: copy } }));
        return id;
      },
      /** A scene named ('' takes its name off: its planet's id is shown). */
      renameScene(id: string, name: string): void {
        setScene(id, (p) => ({ ...p, name: name.trim() || undefined }));
      },
      /** A scene's planet changed ('': none): its looks were the old planet's, so they go; its moons and sky stay. */
      setScenePlanet(id: string, planet: string): void {
        setScene(id, (p) => ({
          ...p,
          planet: planet || undefined,
          style: undefined,
          variants: undefined,
        }));
      },
      /** A scene taken out (the random sets', a preset's or the stage's is only reset). */
      deleteScene(id: string): void {
        if (!ownScene(id)) {
          setScene(id, () => null);
          return;
        }
        setScenes((s) => {
          const planets = { ...s.planets };
          delete planets[id];
          return { ...s, planets };
        });
      },

      // A scene ('' for the random sets'): its planet, moons and sky.
      setStyle(id: string, path: BodyPath, style: string): void {
        if (path.length)
          setMoons(
            id,
            changeMoon(scene(id).moons ?? [], path, (m) => ({ ...m, style: style || undefined })),
          );
        else setScene(id, (p) => ({ ...p, style }));
      },
      resetStyle(id: string, path: BodyPath): void {
        if (path.length)
          setMoons(
            id,
            changeMoon(scene(id).moons ?? [], path, (m) => ({ ...m, style: undefined })),
          );
        else setScene(id, (p) => ({ ...p, style: undefined }));
      },
      setBody(id: string, path: BodyPath, style: string, change: Partial<BodySettings>): void {
        updateBody(id, path, style, (s) => ({ ...s, ...change }));
      },
      clearBody(
        id: string,
        path: BodyPath,
        style: string,
        keys: readonly (keyof BodySettings)[],
      ): void {
        updateBody(id, path, style, (s) => without(s, keys));
      },
      resetBody(id: string, path: BodyPath, style: string): void {
        updateBody(id, path, style, () => undefined);
      },
      setMaterial(
        id: string,
        path: BodyPath,
        style: string,
        name: string,
        change: Partial<MaterialSettings>,
      ): void {
        updateBody(id, path, style, (s) => withMaterial(s, name, change));
      },
      clearMaterial(
        id: string,
        path: BodyPath,
        style: string,
        name: string,
        keys?: readonly (keyof MaterialSettings)[],
      ): void {
        updateBody(id, path, style, (s) => withoutMaterial(s, name, keys));
      },
      setOrbit(id: string, path: BodyPath, change: Partial<Orbit>): void {
        setMoons(
          id,
          changeMoon(scene(id).moons ?? [], path, (m) => ({
            ...m,
            orbit: { ...m.orbit, ...change },
          })),
        );
      },
      /** A moon, by its planet's id, added about a body: its path. */
      addMoon(id: string, parent: BodyPath, moon: string): BodyPath {
        const moons = scene(id).moons ?? [];
        const count = parent.length ? (moonAt(moons, parent)?.moons?.length ?? 0) : moons.length;
        setMoons(id, addMoon(moons, parent, { id: moon, orbit: DEFAULT_ORBIT }));
        return [...parent, count];
      },
      removeMoon(id: string, path: BodyPath): void {
        setMoons(
          id,
          changeMoon(scene(id).moons ?? [], path, () => null),
        );
      },
      /** A scene back as the library has it: its planet's style and looks, its moons, its sky (its planet and name kept). */
      resetScene(id: string): void {
        setScene(id, (p) => ({ planet: p.planet, name: p.name }));
      },
      setSkyMaterial(id: string, name: string, change: Partial<MaterialSettings>): void {
        setSceneSky(id, (sky) => skyMaterial(sky, name, change));
      },
      clearSkyMaterial(id: string, name: string, keys?: readonly (keyof MaterialSettings)[]): void {
        setSceneSky(id, (sky) => skyMaterial(sky, name, null, keys));
      },
      setSkyTint(id: string, tint: MaterialTint): void {
        setSceneSky(id, (sky) => ({ ...sky, tint }));
      },
      clearSkyTint(id: string): void {
        setSceneSky(id, (sky) => ({ ...sky, tint: undefined }));
      },
      resetSky(id: string): void {
        setSceneSky(id, () => ({}));
      },

      // The colour over the whole picture.
      /**
       * The colour chosen: a preset by id (the first: none, its colour read from the theme), or
       * Custom, which starts from the tint there is and is set by hand.
       */
      chooseTint(choice: string): void {
        if (choice === CUSTOM_TINT) {
          setScenes((s) => ({
            ...s,
            settings: { choice, background: { ...s.settings.background, on: true } },
          }));
          return;
        }
        const preset = PRESETS.find((p) => p.id === choice);
        if (!preset) return;
        const colour = preset.token
          ? getComputedStyle(store._root).getPropertyValue(preset.token).trim()
          : '#ffffff';
        setScenes((s) => ({
          ...s,
          settings: {
            choice,
            background: { on: preset.token !== null, colour, blend: preset.blend },
          },
        }));
      },
      setTint(change: Partial<PartTint>): void {
        setScenes((s) => ({
          ...s,
          settings: { ...s.settings, background: { ...s.settings.background, ...change } },
        }));
      },
      resetTint(): void {
        setScenes((s) => ({ ...s, settings: UNTINTED }));
      },
    };
  }),
);
