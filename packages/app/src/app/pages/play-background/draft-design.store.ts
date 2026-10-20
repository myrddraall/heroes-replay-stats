import type { AddedLight } from '../../scenes/play-background/scene-lights';
import { DOCUMENT } from '@angular/common';
import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
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
import { migrateDesign, sceneWithout } from '../../scenes/play-background/overlays';
import {
  type CreatedOverlay,
  nextOverlayId,
  type OverlayKind,
} from '../../scenes/play-background/created-overlays';
import { PublishedDesignStore } from '../../scenes/play-background/published-design.store';
import type {
  MaterialSettings,
  MaterialTint,
  PartKey,
  PartSettings,
} from '../../scenes/play-background/scene-planets';
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

/** A sky with what isn't set taken out (nothing set: none). */
function tidySky(sky: SkyChoices): SkyChoices | undefined {
  const kept = Object.fromEntries(Object.entries(sky).filter(([, v]) => v !== undefined));
  return Object.keys(kept).length ? (kept as SkyChoices) : undefined;
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
  withHooks({
    onInit(store) {
      // A draft kept before bodies wore several overlays, read as it is now.
      patchState(store, migrateDesign({ library: store.library(), scenes: store.scenes() }));
    },
  }),
  withProps(() => ({
    _published: inject(PublishedDesignStore),
    _root: inject(DOCUMENT).documentElement,
  })),
  withComputed(({ library, scenes, _published }) => {
    const changedPlanets = computed(() =>
      differing(library().planets, _published.library().planets),
    );
    const changedStyles = computed(() => [
      ...new Set([
        ...differing(library().styles, _published.library().styles),
        ...differing(library().created ?? {}, _published.library().created ?? {}),
      ]),
    ]);
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
      setScene(id, (p) => ({ ...p, sky: tidySky(change(p.sky ?? {})) }));
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
      setLibrary((l) => ({ ...l, sky: tidySky(change(l.sky)) ?? {} }));
    /** A sky changed: a scene's (by its id), or the library's (null). */
    const changeSky = (scene: string | null, change: (sky: SkyChoices) => SkyChoices) =>
      scene === null ? setLibrarySky(change) : setSceneSky(scene, change);

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
      /** A new overlay (to wear on a planet, or the sky), empty, named; its id. */
      createOverlay(kind: OverlayKind): string {
        const { id, n } = nextOverlayId(store.library());
        const label = `${kind === 'sky' ? 'Sky overlay' : 'Overlay'} ${n}`;
        setLibrary((l) => ({
          ...l,
          created: { ...l.created, [id]: { kind, label, parts: [], sources: {} } },
        }));
        return id;
      },
      /** An overlay made in the editor changed (its parts, the materials they draw). */
      changeOverlay(id: string, change: (o: CreatedOverlay) => CreatedOverlay): void {
        setLibrary((l) => {
          const o = l.created?.[id];
          return o ? { ...l, created: { ...l.created, [id]: change(o) } } : l;
        });
      },
      /** An overlay made in the editor deleted: its settings too, and off whatever wears it. */
      deleteOverlay(id: string): void {
        setLibrary((l) => {
          const created = { ...l.created };
          const styles = { ...l.styles };
          delete created[id];
          delete styles[id];
          const worn = l.sky.overlays;
          const sky = worn ? { ...l.sky, overlays: worn.filter((o) => o !== id) } : l.sky;
          return { ...l, created, styles, sky };
        });
        setScenes((s) => ({
          ...s,
          planets: Object.fromEntries(
            Object.entries(s.planets).map(([k, p]) => [k, sceneWithout(p, id)]),
          ),
        }));
      },
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
      /** The library sky's materials' draw order (none: as the data has it). */
      setLibrarySkyOrder(order: readonly string[] | undefined): void {
        setLibrarySky((sky) => ({ ...sky, order }));
      },
      resetLibrarySky(): void {
        setLibrarySky(() => ({}));
      },
      /** The overlays a sky wears (a scene's, or the library's: null), in order; none: back to what is under it. */
      setSkyOverlays(scene: string | null, overlays: readonly string[] | undefined): void {
        changeSky(scene, (sky) => ({ ...sky, overlays }));
      },
      /** An overlay a sky wears switched on or off: back to what is under it where the same. */
      setSkyOverlayEnabled(scene: string | null, id: string, on: boolean, below: boolean): void {
        changeSky(scene, (sky) => {
          const enabled = { ...sky.overlaysEnabled };
          if (on === below) delete enabled[id];
          else enabled[id] = on;
          return { ...sky, overlaysEnabled: Object.keys(enabled).length ? enabled : undefined };
        });
      },
      /** One of a sky's overlays' parts' settings changed (a scene's sky, or the library's: null). */
      setSkyPart(scene: string | null, key: PartKey, change: Partial<PartSettings>): void {
        changeSky(scene, (sky) => ({
          ...sky,
          parts: { ...sky.parts, [key]: { ...sky.parts?.[key], ...change } },
        }));
      },
      /** One of a sky's overlays' parts' settings taken back (all of it: `keys` left out). */
      clearSkyPart(
        scene: string | null,
        key: PartKey,
        keys?: readonly (keyof PartSettings)[],
      ): void {
        changeSky(scene, (sky) => {
          const parts: Partial<Record<PartKey, PartSettings>> = { ...sky.parts };
          const left = keys ? without(parts[key], keys) : undefined;
          if (left) parts[key] = left;
          else delete parts[key];
          return { ...sky, parts: Object.keys(parts).length ? parts : undefined };
        });
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
      /** A scene's planets as they are now (what kept them before scenes had several goes); its lights kept. */
      setSceneBodies(id: string, bodies: readonly SceneBody[]): void {
        setScene(id, (p) => ({ bodies, name: p.name, sky: p.sky, lights: p.lights }));
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
      /** A scene's own lights (none: none). */
      setSceneLights(id: string, lights: readonly AddedLight[]): void {
        setScene(id, (p) => ({ ...p, lights: lights.length ? lights : undefined }));
      },
      /** A scene's sky's materials' draw order (none: as the library has it). */
      setSkyOrder(id: string, order: readonly string[] | undefined): void {
        setSceneSky(id, (sky) => ({ ...sky, order }));
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
