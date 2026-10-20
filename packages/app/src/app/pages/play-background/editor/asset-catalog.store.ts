import { computed, inject, resource } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withLocalStorage } from '../../../data/store-features/with-local-storage';
import {
  ownScene,
  PLAY_SCREEN_SCENE,
  RANDOM_SCENE,
} from '../../../scenes/play-background/background-design';
import { BackgroundStore } from '../../../scenes/play-background/background.store';
import type { SceneBody } from '../../../scenes/play-background/background-scene';
import { playSet, randomSet, seeded } from '../../../scenes/play-background/planet-sets';
import { playScreenBodies, sceneBodies } from '../../../scenes/play-background/scene-bodies';
import {
  loadPlaySceneFile,
  PLAY_SCENE_URL,
  type SceneMaterial,
  type SceneTexture,
} from '../../../scenes/play-background/play-scene';
import { skyDepths } from '../../../scenes/play-background/sky-depths';
import {
  loadPlanetIndex,
  type MaterialDepth,
  type MaterialSettingsMap,
  type PartRole,
  type PlanetKind,
} from '../../../scenes/play-background/scene-planets';
import { materialLabel } from '../../../scenes/play-background/material-names';
import { withPlanetFiles } from '../../../scenes/play-background/with-planet-files';
import { DraftDesignStore } from '../draft-design.store';
import { partMaterials } from './editor-model';
import { EditorUiStore } from './editor-ui.store';
import type { OpenKind } from './open-target';

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
  withLocalStorage<{ type: OpenKind }>('hrs.background-browser', ['type']),
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
    const styles = computed(() => index()?.styles.map((s) => s.id) ?? []);
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
        const file = all[`style-${id}`];
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
      materials,
      materialByName: computed(() => new Map(materials().map((m) => [m.name, m] as const))),
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
        const play = index() && scene ? playScreenBodies(playSet(index()!), scene.camera.eye) : [];
        return (id: string): readonly SceneBody[] =>
          id === RANDOM_SCENE
            ? []
            : sceneBodies(scenes[id], id, id === PLAY_SCREEN_SCENE ? play : []);
      }),
    };
  }),
  withComputed(({ _draft, planetsOf }) => ({
    scenes: computed((): CatalogScene[] => {
      const listed = Object.entries(_draft.scenes().planets)
        .filter(([id]) => ownScene(id))
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
  withComputed(({ _sceneFile, planets, styles }) => {
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
        ...styles().map((id) => `style-${id}`),
      ]),
    };
  }),
  withMethods((store) => ({
    setQuery(query: string): void {
      patchState(store, { query });
    },
    /** The kind of thing listed. */
    setType(type: OpenKind): void {
      patchState(store, { type });
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
