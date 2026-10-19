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
  EMPTY_LIBRARY,
  EMPTY_SCENES,
} from '../../scenes/play-background/background-design';
import {
  type BodySettings,
  type PlanetChoices,
  type SceneBody,
  type SkyChoices,
  without,
} from '../../scenes/play-background/background-scene';
import {
  placesOnly,
  sceneBodies,
  withMaterial,
  withoutMaterial,
} from '../../scenes/play-background/scene-bodies';
import { PublishedDesignStore } from '../../scenes/play-background/published-design.store';
import type { MaterialSettings, MaterialTint } from '../../scenes/play-background/scene-planets';
import { type PartTint, PRESETS, UNTINTED } from '../../scenes/play-background/tint-settings';

/** Where the draft is kept between visits (until it is saved or discarded). */
const DRAFT_KEY = 'hrs.background-draft';

/** The global tint's choice that is set by hand. */
export const CUSTOM_TINT = 'custom';

/** Which of the library's bodies: a planet's defaults, or a style's. */
export type LibraryKind = 'planets' | 'styles';

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
     * (not a preset or the stage), which stays listed.
     */
    const setScene = (id: string, change: (p: PlanetChoices) => PlanetChoices | null) =>
      setScenes((s) => {
        const planets = { ...s.planets };
        const changed = change(scene(id));
        if (changed && Object.values(changed).some((v) => v !== undefined)) planets[id] = changed;
        else if (ownScene(id)) planets[id] = {};
        else delete planets[id];
        return { ...s, planets };
      });
    const setSceneSky = (id: string, change: (sky: SkyChoices) => SkyChoices) =>
      setScene(id, (p) => {
        const sky = change(p.sky ?? {});
        return { ...p, sky: sky.materials || sky.tint ? sky : undefined };
      });
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
      /** Everything saved and drafted thrown away: nothing published, nothing drafted. */
      clearAll(): void {
        store._published.clear();
        patchState(store, { library: EMPTY_LIBRARY, scenes: EMPTY_SCENES });
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

      // The scenes: each listed, named, with its planets.
      /**
       * A new scene: empty, or a copy of another (`from`: its id, and its planets as they are
       * shown, a preset's included), named (none: as it starts), saved as it is made. Its id
       * (`scene-<n>`, the first free).
       */
      createScene(
        from?: { readonly id: string; readonly bodies: readonly SceneBody[] },
        name?: string,
      ): string {
        const taken = store.scenes().planets;
        let n = 1;
        while (taken[`scene-${n}`]) n++;
        const id = `scene-${n}`;
        const sky = from ? taken[from.id]?.sky : undefined;
        const copy: PlanetChoices = {
          bodies: from ? structuredClone(from.bodies) : [],
          sky: sky ? structuredClone(sky) : undefined,
          name: name?.trim() || undefined,
        };
        setScenes((s) => ({ ...s, planets: { ...s.planets, [id]: copy } }));
        // A new scene starts saved: published as it is made (only it; the rest of the draft as it was).
        store._published.publishScene(id, copy);
        return id;
      },
      /** A scene named ('' takes its name off). */
      renameScene(id: string, name: string): void {
        setScene(id, (p) => ({ ...p, name: name.trim() || undefined }));
      },
      /** A scene's planets as they are now (what kept them before scenes had several goes). */
      setSceneBodies(id: string, bodies: readonly SceneBody[]): void {
        setScene(id, (p) => ({ bodies, name: p.name, sky: p.sky }));
      },
      /** A scene taken out (a preset's or the stage's is only reset). */
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
      /**
       * A scene back as the library has it: its planets' styles, looks and moons, its sky (a
       * scene of the user's own keeps its planets where they are, and its name; a preset, its own).
       */
      resetScene(id: string): void {
        setScene(id, (p) =>
          ownScene(id) ? { name: p.name, bodies: placesOnly(sceneBodies(p, id)) } : null,
        );
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
