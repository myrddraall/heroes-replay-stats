import { storageKey, ViewStore } from '@myrddraall/heroes-replay-stats-aether';
import {
  createdOverlay,
  loadPlanetIndex,
  type MaterialSource,
  partId,
  type PartRole,
  type PlanetFile,
  type PlanetKind,
  type SceneMaterial,
  type SceneTexture,
} from '@myrddraall/heroes-replay-stats-aether/formats';
import { withPlanetFiles } from './with-planet-files';
import type {
  MaterialDepth,
  MaterialSettingsMap,
} from '@myrddraall/heroes-replay-stats-aether/materials';
import { overlayFileFor, type OverlayKind } from '@myrddraall/heroes-replay-stats-aether/overlays';
import { playSet, randomSet, seeded } from '@myrddraall/heroes-replay-stats-aether/planet-sets';
import {
  isGroup,
  ownScene,
  PLAY_SCREEN_SCENE,
  playScreenBodies,
  RANDOM_SCENE,
  sceneBodies,
  type SceneBody,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { skyDepths } from '@myrddraall/heroes-replay-stats-aether/sky';
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
import { withLocalStorage } from '@myrddraall/heroes-replay-stats-signals';
import { DraftDesignStore } from '../draft/draft-design.store';
import { partMaterials } from '../materials/materials';
import { partName } from '../parts/parts';
import type { ReusablePart } from '../parts/part-hosts';
import type { PickChoice } from '../controls/pick-list';
import { EditorUiStore } from '../layout/editor-ui.store';
import type { OpenKind } from '../layout/open-target';
import { materialLabel } from '../materials/material-names';

/** The one sky there is (the Play screen's), as the lists name it. */
export const PLAY_SKY = 'play';

/** Where a material is used: by a planet, a style or the sky, with what that asset's file says of it. */
export interface MaterialUse {
  readonly kind: 'planet' | 'style' | 'sky';
  readonly id: string;
  /** The role of the part it is drawn on there (none: the sky's). */
  readonly role?: PartRole;
  readonly material: SceneMaterial;
  readonly textures: Readonly<Record<string, SceneTexture>>;
  /** Whether a pattern is drawn for it there (in place of its emissive texture). */
  readonly pattern: boolean;
  /** Whether a particle system draws it there. */
  readonly particles?: boolean;
  /** Its tuning there (the exporter's, where the data alone isn't right). */
  readonly tuning?: MaterialSettingsMap;
  /** Where the sky's is drawn among the scene's objects, as the game data puts it (see `skyDepths`). */
  readonly depth?: MaterialDepth;
}

/** A material of the library: its name, and each asset using it (the first is how it is shown). */
export interface CatalogMaterial {
  readonly name: string;
  /** Its name as people read it (from how its first use shows it). */
  readonly label: string;
  readonly uses: readonly MaterialUse[];
}

/** An overlay of the library: which, what it is worn on, and whether it was made in the editor. */
export interface CatalogOverlay {
  readonly id: string;
  readonly kind: OverlayKind;
  readonly made: boolean;
  /** Its name as the game data has it, where it has one. */
  readonly label?: string;
}

export interface CatalogScene {
  readonly id: string;
  readonly label: string;
  /** What it shows, in words: its planets, or the random sets, or nothing yet. */
  readonly shows: string;
}

/** Planets in words: their ids, or that there are none. */
const planetWords = (bodies: readonly SceneBody[]) =>
  bodies.length ? bodies.map((b) => b.id).join(', ') : 'No planets yet';

/** A set put up as a scene's planets: each where it is, as big. */
const asBodies = (
  set: readonly { id: string; position: SceneBody['position']; radius: number }[],
) => set.map((p): SceneBody => ({ id: p.id, position: p.position, radius: p.radius }));

/**
 * What the Background page's library has (component store, provided by the page): flat lists of
 * the scenes, planets, styles, materials (each with the assets using it), particle systems and
 * skies, from the game data and the draft ({@link DraftDesignStore}); which kind is listed, and
 * the search. The asset editors read a material's uses from it.
 */
export const AssetCatalogStore = signalStore(
  withState<{ query: string; type: OpenKind }>({ query: '', type: 'planet' }),
  withLocalStorage<{ type: OpenKind }>(storageKey('browser'), ['type']),
  withPlanetFiles(),
  withProps(({ _base }) => ({
    _draft: inject(DraftDesignStore),
    _ui: inject(EditorUiStore),
    _background: inject(ViewStore),
    _index: resource({ loader: ({ abortSignal }) => loadPlanetIndex(_base, abortSignal) }),
  })),
  withComputed(({ files, _draft, _index, _sceneFile }) => {
    const index = computed(() => (_index.hasValue() ? _index.value() : null));
    const sceneFile = computed(() => (_sceneFile.hasValue() ? _sceneFile.value() : null));
    const planets = computed((): { id: string; kind: PlanetKind }[] => {
      const order: readonly PlanetKind[] = ['play', 'world', 'painted'];
      return [...(index()?.planets ?? [])].sort(
        (a, b) =>
          order.indexOf(a.kind) - order.indexOf(b.kind) ||
          a.id.localeCompare(b.id, undefined, { numeric: true }),
      );
    });
    /** The planets' overlays: the game data's, then those made in the editor. */
    const styles = computed(() => [
      ...(index()?.styles.map((s) => s.id) ?? []),
      ...Object.entries(_draft.library().created ?? {})
        .filter(([, o]) => o.kind === 'planet')
        .map(([id]) => id),
    ]);
    const materials = computed((): CatalogMaterial[] => {
      const uses = new Map<string, MaterialUse[]>();
      const use = (name: string, u: MaterialUse) => {
        const list = uses.get(name) ?? [];
        if (!list.some((l) => l.kind === u.kind && l.id === u.id)) list.push(u);
        uses.set(name, list);
      };
      const all = files();
      for (const p of planets()) {
        const file = all[p.id];
        if (!file) continue;
        for (const m of partMaterials(file))
          use(m.name, {
            kind: 'planet',
            id: p.id,
            role: m.role,
            material: m.material,
            textures: file.textures,
            pattern: m.pattern,
            tuning: file.tuning?.materials,
          });
      }
      for (const id of styles()) {
        const file = all[overlayFileFor(_draft.library(), id)];
        if (!file) continue;
        for (const m of partMaterials(file))
          use(m.name, {
            kind: 'style',
            id,
            role: m.role,
            material: m.material,
            textures: file.textures,
            pattern: m.pattern,
            tuning: file.tuning?.materials,
          });
      }
      const scene = sceneFile();
      if (scene) {
        const depths = skyDepths(scene);
        const sky = (name: string, particles: boolean) => {
          const material = scene.materials[name];
          if (material)
            use(name, {
              kind: 'sky',
              id: PLAY_SKY,
              material,
              textures: scene.textures,
              pattern: false,
              particles,
              depth: depths[name],
            });
        };
        for (const mesh of Object.values(scene.meshes))
          if (!mesh.planet) for (const name of mesh.materials) sky(name, false);
        for (const p of scene.particles) sky(p.material, true);
        // The sky's overlays in the game data (the energy round the view): the sky's, as it wears them.
        for (const overlay of Object.values(scene.overlays ?? {}))
          for (const part of overlay.parts)
            for (const name of part.materials) {
              const material = overlay.materials[name];
              if (material)
                use(name, {
                  kind: 'sky',
                  id: PLAY_SKY,
                  material,
                  textures: { ...scene.textures, ...overlay.textures },
                  pattern: false,
                  depth: depths[name],
                });
            }
      }
      return [...uses]
        .map(([name, u]) => ({
          name,
          // As renamed in the library (its own settings), else as made from the data's.
          label:
            _draft.library().materials?.[name]?.label ??
            materialLabel(name, u[0]?.material, u[0]?.textures ?? {}, u[0]?.role),
          uses: u,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    });
    return {
      planets,
      styles,
      /** Each planet's own variants as its data has them (the planet index's), by its id. */
      dataVariants: computed(
        () => new Map((index()?.planets ?? []).map((p) => [p.id, p.variants] as const)),
      ),
      /** The overlays, by what they are worn on (planets', then the sky's), and whether made here. */
      overlays: computed((): CatalogOverlay[] => [
        ...styles().map((id) => ({ id, kind: 'planet' as const, made: createdOverlay(id) })),
        ...Object.entries(sceneFile()?.overlays ?? {}).map(([id, file]) => ({
          id,
          kind: 'sky' as const,
          made: false,
          ...(file.label ? { label: file.label } : {}),
        })),
        ...Object.entries(_draft.library().created ?? {})
          .filter(([, o]) => o.kind === 'sky')
          .map(([id]) => ({ id, kind: 'sky' as const, made: true })),
      ]),
      materials,
      materialByName: computed(() => new Map(materials().map((m) => [m.name, m] as const))),
      /** The materials a part may draw, by name (one shared by name with another: where it is first used too). */
      materialChoices: computed((): PickChoice[] => {
        const count = new Map<string, number>();
        for (const m of materials()) count.set(m.label, (count.get(m.label) ?? 0) + 1);
        return materials().map((m) => {
          const use = m.uses[0];
          const where = use?.kind === 'sky' ? 'sky' : use?.id;
          return {
            value: m.name,
            label: (count.get(m.label) ?? 0) > 1 && where ? `${m.label} · ${where}` : m.label,
          };
        });
      }),
      /**
       * Where a material is kept by when it is picked for a part: where it is first used in the game
       * data (not by an overlay made in the editor, which reads it from there too).
       */
      materialSource: computed(() => {
        const byName = new Map(materials().map((m) => [m.name, m] as const));
        return (name: string): MaterialSource | undefined => {
          const use = byName
            .get(name)
            ?.uses.find((u) => u.kind !== 'style' || !createdOverlay(u.id));
          if (!use) return undefined;
          return use.kind === 'sky' ? { kind: 'sky' } : { kind: use.kind, id: use.id };
        };
      }),
      /**
       * The game data's parts that may be reused, by what they are about: a planet's and its data
       * overlays' (spheres, rings, shields…), and the sky's overlays' (about the eye); each with
       * the materials it draws there, kept by where they are.
       */
      reusableParts: computed((): Readonly<Record<OverlayKind, readonly ReusablePart[]>> => {
        const all = files();
        const fromFile = (
          kind: 'planet' | 'style',
          id: string,
          owner: string,
          file: PlanetFile | undefined,
        ): ReusablePart[] =>
          (file?.parts ?? []).map((p) => {
            const drawn = p.materials.filter((m) => file?.materials[m]);
            return {
              label: `${partName(p)} · ${owner}`,
              base: partId(p),
              part: {
                shape: p.shape.kind,
                materials: drawn,
                from: { kind, id, part: partId(p) },
                sources: Object.fromEntries(drawn.map((m) => [m, { kind, id }])),
              },
            };
          });
        const scene = sceneFile();
        return {
          planet: [
            ...planets().flatMap((p) => fromFile('planet', p.id, p.id, all[p.id])),
            ...(index()?.styles ?? []).flatMap((s) =>
              fromFile('style', s.id, s.id, all[overlayFileFor(_draft.library(), s.id)]),
            ),
          ],
          sky: Object.entries(scene?.overlays ?? {}).flatMap(([id, o]) =>
            o.parts.map((p) => ({
              label: `${p.id} · ${o.label ?? id}`,
              base: 'mesh',
              part: {
                shape: p.shape.kind,
                materials: p.materials,
                from: { kind: 'sky' as const, overlay: id, part: p.id },
                sources: Object.fromEntries(p.materials.map((m) => [m, { kind: 'sky' as const }])),
              },
            })),
          ),
        };
      }),
      particles: computed(
        () =>
          sceneFile()?.particles.map((p) => ({
            id: p.emitter,
            material: p.material,
            rate: p.rate,
            max: p.max,
            lifespan: p.lifespan,
          })) ?? [],
      ),
      skies: computed(() => [{ id: PLAY_SKY, label: 'Play screen' }]),
      /** A scene's planets: its own; the Play screen's, the game's three until it sets its own. */
      planetsOf: computed(() => {
        const scenes = _draft.scenes().planets;
        const scene = _sceneFile.hasValue() ? _sceneFile.value() : null;
        const play = index() && scene ? playScreenBodies(playSet(index()!), scene.camera) : [];
        return (id: string): readonly SceneBody[] =>
          id === RANDOM_SCENE
            ? []
            : sceneBodies(scenes[id], id, id === PLAY_SCREEN_SCENE ? play : []);
      }),
    };
  }),
  withComputed(({ _draft, planetsOf }) => ({
    /** The groups (scenes within scenes, to put in them), by name. */
    groups: computed((): CatalogScene[] =>
      Object.entries(_draft.scenes().planets)
        .filter(([id]) => isGroup(id))
        .map(([id, p]) => {
          const bodies = p.bodies ?? [];
          const placed = p.groups?.length ?? 0;
          const shows = [planetWords(bodies), ...(placed ? [`${placed} groups`] : [])].join(' · ');
          return { id, label: p.name ?? bodies[0]?.id ?? id, shows };
        })
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    ),
    scenes: computed((): CatalogScene[] => {
      const listed = Object.entries(_draft.scenes().planets)
        .filter(([id]) => ownScene(id) && !isGroup(id))
        .map(([id, p]) => {
          const bodies = planetsOf()(id);
          return { id, label: p.name ?? bodies[0]?.id ?? id, shows: planetWords(bodies) };
        })
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
      // The presets first: the random sets, the game's own Play screen.
      return [
        { id: RANDOM_SCENE, label: 'Random sets', shows: 'A set drawn with each page' },
        {
          id: PLAY_SCREEN_SCENE,
          label: 'Play screen',
          shows: planetWords(planetsOf()(PLAY_SCREEN_SCENE)),
        },
        ...listed,
      ];
    }),
  })),
  withComputed(({ _sceneFile, _draft, planets, styles }) => {
    const sceneFile = computed(() => (_sceneFile.hasValue() ? _sceneFile.value() : null));
    return {
      /** The sky's own materials (not its planets'), in its meshes' order, then its particles'. */
      skyMaterials: computed(() => {
        const scene = sceneFile();
        if (!scene) return [];
        const names = Object.values(scene.meshes)
          .filter((m) => !m.planet)
          .flatMap((m) => m.materials)
          .concat(scene.particles.map((p) => p.material));
        return [...new Set(names)];
      }),
      neededFiles: computed(() => [
        ...planets().map((p) => p.id),
        ...styles().map((id) => overlayFileFor(_draft.library(), id)),
      ]),
    };
  }),
  withMethods((store) => ({
    /** A new overlay (to wear on a planet, or the sky), opened. */
    /** A new group, empty, named as it starts: opened. */
    createGroup(): void {
      const id = store._draft.createGroup();
      store._ui.open({ kind: 'group', id });
    },
    createOverlay(kind: OverlayKind): void {
      const id = store._draft.createOverlay(kind);
      store._ui.open({ kind: 'style', id });
    },
    setQuery(query: string): void {
      patchState(store, { query });
    },
    /** The kind of thing listed, as the library's URL says (none: as it was). */
    followKind: signalMethod<OpenKind | undefined>((type) => {
      if (type) patchState(store, { type });
    }),
    /** The random sets' next set, drawn (what the background shows while they are shown). */
    nextRandomSet(): void {
      store._background.nextPlanetSet();
    },
    /**
     * A new scene, empty or a copy of another (by id) with its planets as they are shown (the
     * random sets': the set up now), named (none: a copy's '<name> copy'), opened.
     */
    createScene(from?: string, name?: string): void {
      // ('' is the random sets': a template too.)
      const template = from !== undefined ? store.scenes().find((s) => s.id === from) : undefined;
      let bodies: readonly SceneBody[] = [];
      if (template?.id === RANDOM_SCENE) {
        const index = store._index.hasValue() ? store._index.value() : null;
        const n = store._background.planetSet();
        if (index) bodies = asBodies(n === 0 ? playSet(index) : randomSet(index, seeded(n)));
      } else if (template) bodies = store.planetsOf()(template.id);
      const id = store._draft.createScene(
        template ? { id: template.id, bodies } : undefined,
        name?.trim() || (template ? `${template.label} copy` : undefined),
      );
      store._ui.open({ kind: 'scene', id });
    },
  })),
  withHooks({
    onInit(store) {
      store.needFiles(store.neededFiles);
    },
  }),
);
