import {
  chosenOverlays,
  mergeAddedParts,
  overlayFileFor,
  ownOverlays,
  withAddedParts,
  wornKey,
} from '@myrddraall/heroes-replay-stats-aether/overlays';
import { playSet } from '@myrddraall/heroes-replay-stats-aether/planet-sets';
import {
  addPlanet,
  bodyAt,
  type BodyPath,
  canPutGroup,
  groupBodies,
  type GroupPlacement,
  isGroup,
  libraryMoonAt,
  type MoonChoices,
  type Orbit,
  ownScene,
  pathKey,
  pathOf,
  type PlanetChoices,
  planetSettingsOf,
  PLAY_SCREEN_SCENE,
  playScreenBodies,
  RANDOM_SCENE,
  sceneBodies,
  type SceneBody,
  storedBodies,
  withLibraryMoons,
  siblingKey,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import {
  sceneSwitched,
  variantsOf,
  variantsOnOf,
} from '@myrddraall/heroes-replay-stats-aether/variants';
import type { AddedLight } from '@myrddraall/heroes-replay-stats-aether/lights';
import { computed } from '@angular/core';
import { CUSTOM_TINT } from '../draft/with-tint';
import { grouped, type PropertyOption } from '../controls/rows/property-select';
import type { BodyInfo } from '../bodies/body';
import { overlayChoices } from '../overlays/overlays';
import type { PickChoice } from '../controls/pick-list';
import type { PickItem } from '../controls/pick-flyout';
import type { SceneMethodsStore, SceneStoreBase } from './scene-editor.store';
import { same } from '../draft/design-writes';
import { bodyKey, EDITOR_CAMERA, groupBodyKey, ownPart, planetsIn, SCENE } from './scene-targets';
import { patchState, signalMethod } from '@ngrx/signals';
import { RANDOM_SETS } from '../layout/open-target';
import type { SceneWrites } from './scene-writes';
import type { Vec3 } from '@myrddraall/heroes-replay-stats-aether/space';
import type { BodySettings } from '@myrddraall/heroes-replay-stats-aether/bodies';

/** The scene open: its entry in the draft and as published, its planets and groups, its name, tint and what of it is unsaved. */
export function sceneViews(store: SceneStoreBase) {
  const {
    _ui,
    _draft,
    scene: sceneId,
    _index,
    _sceneFile,
    _catalog,
    files,
    madeLookup,
    sceneVariantEdited,
    _tintPresets: presets,
  } = store;
  /** Whether the library shows the scene (a preview: seen through its own cameras, not moved). */
  const browsing = computed(() => _ui.browsing());
  const entry = computed(() => _draft.scenes().planets[sceneId()]);
  const choices = computed(() => entry() ?? {});
  const publishedEntry = computed(() => _draft.publishedScenes().planets[sceneId()]);
  const published = computed(() => publishedEntry() ?? {});
  /** Whether the scene is the random sets' (its planets drawn with each page, not its own). */
  const random = computed(() => sceneId() === RANDOM_SCENE);
  /** A preset's planets until it sets its own: the Play screen's, the game's three. */
  const defaults = computed((): readonly SceneBody[] =>
    sceneId() === PLAY_SCREEN_SCENE && _index.hasValue() && _sceneFile.hasValue()
      ? playScreenBodies(playSet(_index.value()), _sceneFile.value().camera)
      : [],
  );
  /** The scene's planets, each with its moons. */
  const sceneBodiesNow = computed(() =>
    random() ? [] : sceneBodies(entry(), sceneId(), defaults(), _draft.library()),
  );
  const publishedBodies = computed(() =>
    random() ? [] : sceneBodies(publishedEntry(), sceneId(), defaults(), _draft.library()),
  );
  const library = _draft.library;
  /** The file each overlay is loaded from, by its id (one made in the editor: as it is now). */
  const overlayFileOf = computed(() => {
    const lib = library();
    return (id: string) => overlayFileFor(lib, id);
  });
  /** What a planet's data sets for it (its overlays' switches), where it sets any. */
  const dataOf = (bodyId: string): Pick<BodyInfo, 'data'> => {
    const data = _catalog.dataSettings().get(bodyId);
    return data ? { data } : {};
  };
  /**
   * A body's own variants where it is, and which are on: as the level edited sets them (a
   * scene's, a planet's own moon's as its planet sets it), else the library's for its planet;
   * switched by the scene's own variants that are on (`scene`). Those on are its levels under
   * the scene's (`variantsBelow`).
   */
  const variantsWhere = (
    bodyId: string,
    path: BodyPath,
    settings: BodySettings,
    inherited: MoonChoices | undefined,
    scene: PlanetChoices | undefined,
  ): Pick<BodyInfo, 'variants' | 'variantsOn' | 'variantsBelow'> => {
    const own = library().planets[bodyId];
    const variants = variantsOf(_catalog.dataVariants().get(bodyId), own);
    if (!variants.length) return {};
    const on = sceneSwitched(
      scene,
      pathKey(path),
      variantsOnOf(settings, inherited?.settings, own),
    );
    return {
      variants,
      variantsOn: on,
      variantsBelow: variants
        .filter((v) => on.includes(v.id))
        .flatMap((v) => v.layers.map((l) => ({ name: `the ${v.name} variant`, settings: l }))),
    };
  };
  /**
   * Planets' bodies as the editor has them: each planet, then its moons after it (theirs after
   * each), each named by `keyOf` its path.
   */
  const bodiesOf = (
    planets: readonly SceneBody[],
    keyOf: (path: BodyPath) => string,
    /** The scene whose variants switch theirs (its own bodies'), if any. */
    scene?: PlanetChoices,
  ): BodyInfo[] => {
    const all = files();
    const lib = library();
    const out: BodyInfo[] = [];
    const file = overlayFileOf();
    const info = (
      path: BodyPath,
      bodyId: string,
      worn: readonly string[],
      overlaysSet: boolean,
      settings: BodySettings,
      children: readonly MoonChoices[],
      orbit?: Orbit,
      place?: { readonly position: Vec3; readonly radius: number },
      inherited?: MoonChoices,
    ): BodyInfo => ({
      key: keyOf(path),
      id: bodyId,
      ...variantsWhere(bodyId, path, settings, inherited, scene),
      ...dataOf(bodyId),
      ...(inherited ? { inherited } : {}),
      overlays: worn.map((id) => ({
        id,
        ...(lib.created?.[id] ? { name: lib.created[id].label } : {}),
        below: lib.styles[id],
        file: all[file(id)],
      })),
      overlaysSet,
      settings,
      // (One of its planet's own moons: as the planet sets it, over its own planet's look.)
      below: inherited?.settings
        ? { ...lib.planets[bodyId], ...inherited.settings }
        : lib.planets[bodyId],
      materialBase: lib.materials,
      // Its own parts as its data has them, with those added onto it (the library's, the scene's).
      file:
        all[bodyId] &&
        withAddedParts(
          all[bodyId],
          mergeAddedParts(lib.planets[bodyId]?.addedParts, settings.addedParts),
          madeLookup(),
        ),
      orbit,
      place,
      moons: children,
    });
    /** What a body wears: as chosen, else its own (the library's choice for it, else its data's). */
    const worn = (chosen: readonly string[] | undefined, id: string) =>
      chosen ?? lib.planets[id]?.overlays ?? ownOverlays(all[id]?.tuning?.style);
    /** `planet`: the one the moons are about (its own moons, the library's, are among them). */
    const walk = (parent: BodyPath, list: readonly MoonChoices[], planet: string) =>
      list.forEach((moon, i) => {
        const path = [...parent, siblingKey(moon, i)];
        const chosen = chosenOverlays(moon);
        out.push(
          info(
            path,
            moon.id,
            worn(chosen, moon.id),
            chosen !== undefined,
            moon.settings ?? {},
            moon.moons ?? [],
            moon.orbit,
            undefined,
            moon.inherited === undefined
              ? undefined
              : libraryMoonAt(lib.moons?.[planet], moon.inherited),
          ),
        );
        walk(path, moon.moons ?? [], planet);
      });
    planets.forEach((planet, b) => {
      const key = siblingKey(planet, b);
      const chosen = chosenOverlays(planet);
      const wears = worn(chosen, planet.id);
      out.push(
        info(
          [key],
          planet.id,
          wears,
          chosen !== undefined,
          planetSettingsOf(planet, wornKey(wears)) ?? {},
          planet.moons ?? [],
          undefined,
          { position: planet.position, radius: planet.radius },
        ),
      );
      walk([key], planet.moons ?? [], planet.id);
    });
    return out;
  };
  /** The scene's bodies: each planet, then its moons after it (theirs after each). */
  /** The scene as its variants switch its planets': with the one edited on too (as it is seen while edited). */
  const switching = computed((): PlanetChoices => {
    const edited = sceneVariantEdited();
    const on = choices().sceneVariantsOn ?? [];
    return edited && !on.includes(edited)
      ? { ...choices(), sceneVariantsOn: [...on, edited] }
      : choices();
  });
  const bodies = computed((): BodyInfo[] => bodiesOf(sceneBodiesNow(), bodyKey, switching()));
  const bodyByKey = computed(() => new Map(bodies().map((b) => [b.key, b] as const)));
  /** Whether what is open is a group (a scene within scenes: no sky of its own). */
  const groupOpen = computed(() => isGroup(sceneId()));
  /** The groups put in it, in order. */
  const placements = computed(() => choices().groups ?? []);
  /** A group (kept with the scenes), by its id. */
  const groupOf = (id: string) => _draft.scenes().planets[id];
  /** The planets of the groups put in it, where they are put (theirs in turn). */
  const placedGroups = computed(() =>
    groupBodies(placements(), groupOf).map((g) => ({
      ...g,
      body: withLibraryMoons([g.body], _draft.library())[0]!,
    })),
  );
  /** Those planets' bodies (their moons too), by `groupBodyKey`. */
  const groupInfos = computed(
    () =>
      new Map(
        placedGroups()
          .flatMap((g, j) => bodiesOf([g.body], (path) => groupBodyKey(j, path.slice(1))))
          .map((b) => [b.key, b] as const),
      ),
  );
  const sceneFile = computed(() => (_sceneFile.hasValue() ? _sceneFile.value() : null));
  /** What the scene is called: its name; else its first planet's id; else its own. */
  const label = computed(() => choices().name ?? sceneBodiesNow()[0]?.id ?? sceneId());
  /** The bodies (by key) that differ from what is published. */
  const unsavedBodies = computed(() => {
    const out = new Set<string>();
    for (const b of bodies()) {
      const path = pathOf(b.key.slice(5));
      if (!same(ownPart(bodyAt(sceneBodiesNow(), path)), ownPart(bodyAt(publishedBodies(), path))))
        out.add(b.key);
    }
    return out;
  });
  return {
    _browsing: browsing,
    _choices: choices,
    _published: published,
    _random: random,
    _sceneBodiesNow: sceneBodiesNow,
    _library: library,
    _overlayFileOf: overlayFileOf,
    bodies,
    bodyByKey,
    groupOpen,
    placements,
    _groupOf: groupOf,
    placedGroups,
    groupInfos,
    _sceneFileValue: sceneFile,
    _label: label,
    sceneName: computed(() => choices().name ?? ''),
    /** The name a scene shows where it has none of its own. */
    sceneLabel: label,
    /** Whether the scene is one of the user's own (named, deletable). */
    own: computed(() => ownScene(sceneId())),
    /** Whether planets can be put in it (any scene but the random sets'). */
    hasPlanets: computed(() => !random()),
    /** Whether it is one of the user's own that isn't there (deleted, or discarded unsaved). */
    missing: computed(() => ownScene(sceneId()) && !entry()),
    sceneBodies: sceneBodiesNow,
    unsavedBodies,
    /** The groups that may be put in it (none it is in, round about), by name. */
    groupOptions: computed((): readonly PickItem[] =>
      Object.entries(_draft.scenes().planets)
        .filter(([id]) => isGroup(id) && canPutGroup(id, sceneId(), groupOf))
        .map(([id, g]) => ({
          id,
          label: g.name ?? id,
          caption: planetsIn(g.bodies ?? []),
        })),
    ),
    /** A group put in it: its name there, else the group's own. */
    placementLabel: computed(
      () => (p: GroupPlacement) => p.label ?? groupOf(p.group)?.name ?? p.group,
    ),
    /** The scene's own lights, lighting every planet in it. */
    sceneLights: computed((): readonly AddedLight[] => choices().lights ?? []),
    sceneTint: computed(() => _draft.scenes().settings),
    sets: random,
    tintOptions: computed((): PropertyOption[] =>
      grouped(
        [
          { value: presets[0]!.id, label: presets[0]!.label },
          { value: CUSTOM_TINT, label: 'Custom' },
        ],
        presets.slice(1).map((p) => ({ value: p.id, label: p.label })),
      ),
    ),
    /** The tint choice that is none. */
    noTint: computed(() => presets[0]!.id),
    tintChoice: computed(() => {
      const settings = _draft.scenes().settings;
      if (settings.choice) return settings.choice;
      return settings.background.on ? CUSTOM_TINT : presets[0]!.id;
    }),
    sceneUnsaved: computed(() => !same(choices(), published()) || _draft.unsavedColour()),
    /** The overlays a body may wear: the game data's, and those made in the editor; by name. */
    overlayOptions: computed((): readonly PickChoice[] =>
      overlayChoices(_index.hasValue() ? _index.value() : null, library()),
    ),
  };
}

/** The scene itself: shown, renamed, deleted, its planets added, another set drawn, its tint, all of it reset. */
export function sceneMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d } = w;
  return {
    /** The scene shown, as the URL says ('': the random sets'); its first planet selected. */
    showScene: signalMethod<string>((id) => {
      if (id === store.scene()) return;
      // Seen through the editor's camera, where the scene's primary is.
      patchState(store, {
        scene: id,
        focus: null,
        inside: null,
        look: EDITOR_CAMERA,
        editorCamera: null,
      });
      // Its first planet selected, where it has one (else the scene itself).
      const first = store.sceneBodies()[0];
      const planet = first ? bodyKey([siblingKey(first, 0)]) : SCENE;
      patchState(store, { selected: id && first ? planet : SCENE, opening: !!id && !first });
      store._ui.confirmReset(false);
      store.expand(SCENE, planet);
    }),
    rename(name: string): void {
      if (ownScene(store.scene())) d.renameScene(store.scene(), name);
    },
    /** The scene taken out of the draft; the library shown (the random sets behind it). */
    deleteScene(): void {
      if (!ownScene(store.scene())) return;
      d.deleteScene(store.scene());
      store._ui.show(RANDOM_SETS);
    },
    /** A planet, by id, put in the scene: shown in the tree and selected. */
    addPlanet(id: string): void {
      if (!store.hasPlanets()) return;
      const { bodies, path } = addPlanet(store.sceneBodies(), id);
      d.setSceneBodies(store.scene(), storedBodies(bodies, d.library()));
      store.expand(SCENE);
      patchState(store, { selected: bodyKey(path) });
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
}
