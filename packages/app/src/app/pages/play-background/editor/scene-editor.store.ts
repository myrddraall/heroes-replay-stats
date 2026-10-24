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
  skyOverlayOn,
  skyWornOf,
} from '../../../scenes/play-background/background-design';
import {
  type AddedCamera,
  type BodyPath,
  type BodySettings,
  type CameraPlacement,
  cameraSetOf,
  fitRadius,
  GAME_CAMERA,
  fitScene,
  type MoonChoices,
  type Orbit,
  pathKey,
  pathOf,
  placeBodies,
  type GroupPlacement,
  type SceneBody,
  type Vec3,
  without,
} from '../../../scenes/play-background/background-scene';
import { materialKey, NO_MATERIAL_TINT } from '../../../scenes/play-background/material-settings';
import { playSet, type SetPlanet } from '../../../scenes/play-background/planet-sets';
import {
  PLAY_SCENE_URL,
  type SceneCamera,
  type SceneCameraSet,
} from '../../../scenes/play-background/play-scene';
import {
  cameraAngles,
  distanceAhead,
  fieldOfView,
  forwardOf,
} from '../../../scenes/play-background/scene-camera';
import type { LightAid } from '../../../scenes/play-background/scene-beams';
import type { CameraPlaced, CameraPlanet, CameraValues } from './camera-properties';
import type { SceneMarker } from './scene-markers';
import type { AddedItem, AddedLists } from './added-list';
import {
  canPutGroup,
  groupBodies,
  isGroup,
  addMoonAt,
  addPlanet,
  bodyAt,
  changeSettings,
  removeAt,
  resetOverlays,
  SCENE_CENTRE,
  playScreenBodies,
  sceneBodies,
  setOrbit,
  setPlace,
  setOverlays,
  withOverlaySwitched,
  withMaterial,
  withPartSetting,
  withoutPartSetting,
  withoutLightSetting,
  withAddedLight,
  withLightChange,
  withoutAddedLight,
  changedLight,
  visualExtent,
  bodyParts,
  withoutMaterial,
  withLightSwitched,
  withMaterialSwitched,
  libraryMoonAt,
  resetMoon,
  storedBodies,
  withLibraryMoons,
} from '../../../scenes/play-background/scene-bodies';
import {
  loadPlanetIndex,
  type MaterialSettings,
  type MaterialTint,
  partId,
  type PartKey,
  type PartSettings,
  reordered,
} from '../../../scenes/play-background/scene-planets';
import { PRESETS } from '../../../scenes/play-background/tint-settings';
import { withPlanetFiles } from '../../../scenes/play-background/with-planet-files';
import { CUSTOM_TINT, DraftDesignStore } from '../draft-design.store';
import { grouped, type PropertyOption } from '../properties/property-select';
import {
  bodyEnabled,
  type BodyInfo,
  bodyLabel,
  bodyView,
  byDepth,
  filesLoaded,
  layerRows,
  lightAids,
  type LightEntry,
  lightIcon,
  lightMarkerAt,
  lightsOfBody,
  type LitByEntry,
  litByOf,
  materialAt,
  type MaterialEntry,
  materialsOf,
  type MaterialView,
  moonLightsOf,
  movedInPart,
  offPart,
  onPart,
  type OuterLight,
  overlayChoices,
  overlayEnabled,
  overlayEnabledBelow,
  overlayLabel,
  overlayOrder,
  ownSkyInfo,
  type PartEntry,
  partIcon,
  partMaterialRows,
  type PartNode,
  partNodes,
  partsOfBody,
  referenceRow,
  sceneLightsOf,
  sharedMaterials,
  shieldLightsOf,
  shieldLightsOfBody,
  skyMaterialsOf,
  skyOverlayChoices,
  skyOverlayInfos,
  skyOverlayLabel,
  skyPartsOf,
  splitViewKey,
  spotEdges,
  type TargetKind,
  viewTitle,
  withLitBy,
  wornIds,
  wornKeyOf,
  wornLabel,
} from './editor-model';
import { chosenOverlays, ownOverlays, wornKey } from '../../../scenes/play-background/overlays';
import {
  addedSourced,
  createdSkyFile,
  type CreatedShape,
  mergeAddedParts,
  overlayFileFor,
  PART_SHAPES,
  sourceFiles,
  withAddedParts,
} from '../../../scenes/play-background/created-overlays';
import { AssetCatalogStore } from './asset-catalog.store';
import {
  addMaterial,
  addReused,
  addShape,
  type PartHost,
  removeMaterial,
  removePart,
  settingsAsOverlay,
} from './part-hosts';
import { REFERENCE_KEY } from './editing-aids.store';
import type { PickChoice } from './pick-list';
import type { PickItem } from './pick-flyout';
import { EditorUiStore } from './editor-ui.store';
import { type AssetTarget, type OpenTarget, RANDOM_SETS } from './open-target';
import type { TreeMove, TreeRow } from './scene-tree';
import {
  type AddedLight,
  type LightId,
  type NewLightKind,
  type LightSettings,
  knownLights,
  newLight,
  type Receiver,
  withLightChanged,
} from '../../../scenes/play-background/scene-lights';

/** The scene tree's rows by what they are. */
const SCENE = 'scene';
/** The scene's own lights, a group of their own; each by its id. */
const SCENE_LIGHTS = 'scene-lights';
const sceneLightKey = (id: LightId) => `scene-light/${id}`;
const SKY = 'sky';
const bodyKey = (path: BodyPath) => `body:${pathKey(path)}`;
/** An overlay it wears, by id: its parts (with their materials) and its lights, under it. */
const overlayKey = (path: BodyPath, id: string) => `${bodyKey(path)}/overlay/${id}`;
/** An overlay's lights, a group of their own under the overlay. */
const overlayLightsKey = (path: BodyPath, id: string) => `${bodyKey(path)}/overlay-lights/${id}`;
/** A material of its own, or of an overlay it wears (by the overlay's id: two may share one). */
const materialRowKey = (path: BodyPath, name: string, overlay?: string) =>
  overlay ? `${bodyKey(path)}/om/${overlay}/${name}` : `${bodyKey(path)}/m/${name}`;
const partRowKey = (path: BodyPath, key: PartKey) => `${bodyKey(path)}/p/${key}`;
/** The room a body's glow is given where the view is fitted to it (as set, else under it). */
const glowMarginOf = (b: BodyInfo) => b.settings.glowMargin ?? b.below?.glowMargin;
/** A group put in the scene, by its index there. */
const placementKey = (index: number) => `place/${index}`;
/** The scene's cameras, a group of their own; each by its id (the game's: `GAME_CAMERA`). */
const CAMERAS = 'cameras';
const cameraKey = (id: string) => `camera/${id}`;
/** The editor's own camera, as what the view looks through (not one of the scene's). */
export const EDITOR_CAMERA = 'editor';
/** A body of a group put in the scene (by the index of its planet among them all, and its moon path): not a row. */
const groupBodyKey = (planet: number, moon: BodyPath) => `gbody:${planet}/${pathKey(moon)}`;
/** Planets in words: their ids, or that there are none. */
const planetsIn = (bodies: readonly SceneBody[]) =>
  bodies.length ? bodies.map((b) => b.id).join(', ') : 'No planets yet';
/** Its lights (its rig's and its shadow), a group of their own. */
const lightsKey = (path: BodyPath) => `${bodyKey(path)}/lights`;
const lightRowKey = (path: BodyPath, id: LightId) => `${bodyKey(path)}/l/${id}`;
const skyMaterialKey = (name: string) => `${SKY}/m/${name}`;
/** An overlay the sky wears, by id: its parts (with their materials) under it. */
const skyOverlayKey = (id: string) => `${SKY}/overlay/${id}`;
const skyPartKey = (key: PartKey) => `${SKY}/p/${key}`;
/** A material of an overlay the sky wears (two may share one). */
const skyOverlayMaterialKey = (overlay: string, name: string) => `${SKY}/om/${overlay}/${name}`;
/**
 * The sky's materials at a depth (background, midground, foreground), a group of their own: open
 * unless folded (its key among those kept unfolded means folded, so it starts open).
 */
const skyDepthKey = (depth: string) => `${SKY}/depth/${depth}`;

/** What a scene tree row's key is. */
type Target =
  | { readonly kind: 'scene' }
  | { readonly kind: 'sky' }
  | {
      readonly kind: 'sky-material';
      /** What its settings are kept by (see `materialKey`). */
      readonly key: string;
      readonly name: string;
      /** The overlay the sky wears it is of, where it is one's (else the sky's own). */
      readonly overlay?: string;
      readonly view?: MaterialView;
    }
  /** A part of an overlay the sky wears. */
  | { readonly kind: 'sky-part'; readonly key: PartKey }
  | { readonly kind: 'body'; readonly path: BodyPath }
  /** A group of rows: an overlay a body wears (`overlay`: which), its lights, the sky's depths. */
  | {
      readonly kind: 'group';
      readonly path: BodyPath;
      readonly overlay?: string;
      /** An overlay the sky wears (its id). */
      readonly skyOverlay?: string;
    }
  | {
      readonly kind: 'material';
      /** What its settings are kept by (see `materialKey`). */
      readonly key: string;
      readonly path: BodyPath;
      readonly name: string;
      /** The overlay it is of, where it is one's (else the body's own). */
      readonly overlay?: string;
      /** What of it the row shows, where not the material itself. */
      readonly view?: MaterialView;
    }
  | { readonly kind: 'part'; readonly path: BodyPath; readonly key: PartKey }
  | { readonly kind: 'light'; readonly path: BodyPath; readonly id: LightId }
  /** One of the scene's own lights. */
  | { readonly kind: 'scene-light'; readonly id: LightId }
  /** The reference image laid over the view (an editing aid). */
  | { readonly kind: 'reference' }
  /** A group put in the scene, by its index there. */
  | { readonly kind: 'placement'; readonly index: number }
  /** The scene's cameras (their group), and one of them by id. */
  | { readonly kind: 'cameras' }
  | { readonly kind: 'camera'; readonly id: string };

/** What of a body a target is, as a light reaches it: the body (none), a part or a material; not one (undefined). */
function receiverOf(t: Target): Receiver | null | undefined {
  if (t.kind === 'body') return null;
  if (t.kind === 'part') return `part:${t.key}`;
  if (t.kind === 'material') return `material:${t.key}`;
  return undefined;
}

function targetOf(key: string): Target {
  // What of a material a row shows (a layer, its shader, an effect), or a shader's group.
  const split = splitViewKey(key);
  if (split) {
    const t = targetOf(split.base);
    if (split.view === 'group') return { kind: 'group', path: 'path' in t ? t.path : [] };
    return t.kind === 'material' || t.kind === 'sky-material' ? { ...t, view: split.view } : t;
  }
  if (key === REFERENCE_KEY) return { kind: 'reference' };
  if (key.startsWith(`${SKY}/m/`)) {
    const name = key.slice(SKY.length + 3);
    return { kind: 'sky-material', name, key: name };
  }
  if (key.startsWith(`${SKY}/om/`)) {
    const [overlay = '', ...rest] = key.slice(SKY.length + 4).split('/');
    const name = rest.join('/');
    return { kind: 'sky-material', name, key: materialKey(name, overlay), overlay };
  }
  if (key.startsWith(`${SKY}/overlay/`))
    return { kind: 'group', path: [], skyOverlay: key.slice(SKY.length + 9) };
  if (key.startsWith(`${SKY}/p/`))
    return { kind: 'sky-part', key: key.slice(SKY.length + 3) as PartKey };
  if (key.startsWith(`${SKY}/depth/`)) return { kind: 'group', path: [] };
  if (key === SKY) return { kind: 'sky' };
  if (key === SCENE_LIGHTS) return { kind: 'group', path: [] };
  if (key.startsWith('scene-light/'))
    return { kind: 'scene-light', id: key.slice('scene-light/'.length) as LightId };
  if (key.startsWith('place/')) return { kind: 'placement', index: Number(key.slice(6)) };
  if (key === CAMERAS) return { kind: 'cameras' };
  if (key.startsWith('camera/')) return { kind: 'camera', id: key.slice('camera/'.length) };
  if (!key.startsWith('body:')) return { kind: 'scene' };
  const rest = key.slice(5);
  const slash = rest.indexOf('/');
  const path = pathOf(slash < 0 ? rest : rest.slice(0, slash));
  const tail = slash < 0 ? '' : rest.slice(slash);
  if (tail.startsWith('/overlay/')) return { kind: 'group', path, overlay: tail.slice(9) };
  if (tail === '/lights' || tail.startsWith('/overlay-lights/')) return { kind: 'group', path };
  if (tail.startsWith('/l/')) return { kind: 'light', path, id: tail.slice(3) as LightId };
  if (tail.startsWith('/m/')) {
    const name = offPart(tail.slice(3));
    return { kind: 'material', path, name, key: name };
  }
  if (tail.startsWith('/om/')) {
    const [overlay = '', ...rest] = tail.slice(4).split('/');
    const name = offPart(rest.join('/'));
    return { kind: 'material', path, name, key: materialKey(name, overlay), overlay };
  }
  if (tail.startsWith('/p/')) return { kind: 'part', path, key: tail.slice(3) as PartKey };
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
  /** What the view looks through: the editor's own camera (`EDITOR_CAMERA`), or one of the scene's by id. */
  readonly look: string;
  /** Where the editor's own camera is, over the scene's primary (none: there); not kept. */
  readonly editorCamera: SceneCameraSet | null;
}

/** One of a scene's cameras: its id, its name, where it puts the view (over the game's), whether it is the game's. */
export interface CameraEntry {
  readonly id: string;
  readonly name: string;
  readonly set: SceneCameraSet;
  readonly game: boolean;
  /** How its place is set (none: in the scene's own space). */
  readonly placement?: CameraPlacement;
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
  withState<SceneEditorState>({
    scene: RANDOM_SCENE,
    selected: SCENE,
    focus: null,
    look: EDITOR_CAMERA,
    editorCamera: null,
  }),
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
    _catalog: inject(AssetCatalogStore),
    _index: resource({ loader: ({ abortSignal }) => loadPlanetIndex(PLAY_SCENE_URL, abortSignal) }),
  })),
  withComputed(
    ({
      scene: sceneId,
      files,
      madeLookup,
      focus,
      selected,
      look,
      editorCamera,
      _draft,
      _index,
      _sceneFile,
      _ui,
    }) => {
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

      /**
       * Planets' bodies as the editor has them: each planet, then its moons after it (theirs after
       * each), each named by `keyOf` its path.
       */
      const bodiesOf = (
        planets: readonly SceneBody[],
        keyOf: (path: BodyPath) => string,
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
        /** What a body wears: as chosen, else its own (its data's). */
        const worn = (chosen: readonly string[] | undefined, id: string) =>
          chosen ?? ownOverlays(all[id]?.tuning?.style);
        /** `planet`: the one the moons are about (its own moons, the library's, are among them). */
        const walk = (parent: BodyPath, list: readonly MoonChoices[], planet: string) =>
          list.forEach((moon, i) => {
            const path = [...parent, i];
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
          const chosen = chosenOverlays(planet);
          const wears = worn(chosen, planet.id);
          out.push(
            info(
              [b],
              planet.id,
              wears,
              chosen !== undefined,
              planet.variants?.[wornKey(wears)] ?? {},
              planet.moons ?? [],
              undefined,
              { position: planet.position, radius: planet.radius },
            ),
          );
          walk([b], planet.moons ?? [], planet.id);
        });
        return out;
      };
      /** The scene's bodies: each planet, then its moons after it (theirs after each). */
      const bodies = computed((): BodyInfo[] => bodiesOf(sceneBodiesNow(), bodyKey));
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
      const sky = computed(() => choices().sky ?? {});
      const sceneFile = computed(() => (_sceneFile.hasValue() ? _sceneFile.value() : null));
      /** Its cameras, the game's first (none: the random sets'; a group has none of its own). */
      const cameraList = computed((): readonly CameraEntry[] => {
        if (random() || groupOpen()) return [];
        const c = choices();
        return [
          {
            id: GAME_CAMERA,
            name: 'Game camera',
            set: without(c.camera, ['placement']) ?? {},
            game: true,
            ...(c.camera?.placement ? { placement: c.camera.placement } : {}),
          },
          ...(c.cameras ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            set: cameraSetOf(a),
            game: false,
            ...(a.placement ? { placement: a.placement } : {}),
          })),
        ];
      });
      /** The camera it is shown through, by id (the game's unless one added is). */
      const primaryCamera = computed(() => {
        const id = choices().primaryCamera;
        return id && cameraList().some((c) => c.id === id) ? id : GAME_CAMERA;
      });
      const cameraSetById = (id: string) => cameraList().find((c) => c.id === id)?.set;
      /** What the view looks through now: as chosen, but the library's preview through the primary, not the editor's camera. */
      const lookShown = computed(() =>
        browsing() && look() === EDITOR_CAMERA ? primaryCamera() : look(),
      );
      /**
       * The camera the view looks through (none: the random sets', or loading): one of its own,
       * or the editor's, where it has been moved to from its primary.
       */
      const camera = computed((): SceneCamera | null => {
        const scene = sceneFile();
        if (!scene || random()) return null;
        const own = lookShown() === EDITOR_CAMERA ? undefined : cameraSetById(lookShown());
        return own
          ? { ...scene.camera, ...own }
          : { ...scene.camera, ...cameraSetById(primaryCamera()), ...editorCamera() };
      });
      /** The overlays the sky wears (switched on or off), in order. */
      const skyWorn = computed(() => skyWornOf(sky(), library(), sceneFile()?.wears));
      const skyOverlays = computed(() =>
        skyOverlayInfos(sceneFile(), library(), skyWorn(), madeLookup()),
      );
      /** The parts added onto the sky (the library's, then the scene's). */
      const skyAdded = computed(() => mergeAddedParts(library().sky.addedParts, sky().addedParts));
      /** The sky's own parts (added onto it), as its overlays are had; none: none. */
      const skyOwn = computed(() =>
        skyAdded().length
          ? [ownSkyInfo(createdSkyFile(addedSourced(skyAdded()), madeLookup()))]
          : [],
      );
      const skyMaterials = computed(() => {
        const scene = sceneFile();
        return scene
          ? skyMaterialsOf(scene, library().sky, sky(), library().materials, [
              ...skyOwn(),
              ...skyOverlays(),
            ])
          : [];
      });
      /** The sky's own parts (added onto it) and those of the overlays it wears, as shown. */
      const skyParts = computed(() =>
        [...skyOwn(), ...skyOverlays()].flatMap((o) =>
          skyPartsOf(
            o,
            library().sky.parts,
            sky().parts,
            false,
            (sky().addedParts ?? []).map((p) => p.id),
          ),
        ),
      );
      const target = computed(() => targetOf(selected()));
      const body = computed(() => {
        const t = target();
        return 'path' in t ? bodyByKey().get(bodyKey(t.path)) : undefined;
      });
      /**
       * The lights from beyond the selected body that light it too: the scene's (those on), and
       * those of the planets it is a moon of that reach their moons.
       */
      const outerLights = computed((): OuterLight[] => {
        const t = target();
        if (!('path' in t)) return [];
        return [
          ...knownLights(choices().lights ?? [])
            .filter((l) => l.enabled !== false)
            .map((light) => ({ light, owner: 'scene' as const })),
          ...t.path.slice(0, -1).flatMap((_, i) => {
            const owner = t.path.slice(0, i + 1);
            const parent = bodyByKey().get(bodyKey(owner));
            if (!parent) return [];
            const overlays = new Map(
              lightsOfBody(parent).flatMap((l) => (l.overlay ? [[l.light.id, l.overlay]] : [])),
            );
            return moonLightsOf(parent).map((light) => ({
              light,
              owner,
              overlay: overlays.get(light.id),
            }));
          }),
        ];
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
        deletable: computed(() => false),
        skyOverlayOpen: computed(() => false),
        opened: computed((): OpenTarget => ({
          kind: groupOpen() ? 'group' : 'scene',
          id: sceneId(),
        })),
        parent: computed(() => null),
        sharedMaterial: computed((): AssetTarget | null => {
          const t = target();
          const b = body();
          if (t.kind !== 'material' || !b) return null;
          const m = materialAt(materialsOf(b), t.key);
          if (!m) return null;
          return {
            kind: 'material',
            id: t.name,
            on: m.overlay ? { kind: 'style', id: m.overlay } : { kind: 'planet', id: b.id },
          };
        }),
        sceneName: computed(() => choices().name ?? ''),
        /** The name a scene shows where it has none of its own. */
        sceneLabel: label,
        heading: computed(() => {
          const id = sceneId();
          if (id === RANDOM_SCENE) return 'Scene · Random sets';
          if (id === PLAY_SCREEN_SCENE) return 'Scene · Play screen';
          return `${groupOpen() ? 'Group' : 'Scene'} · ${label()}`;
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
        cameraList,
        /** The cameras added to it, as kept. */
        addedCameras: computed((): readonly AddedCamera[] => choices().cameras ?? []),
        primaryCamera,
        camera,
        lookShown,
        /** Where the view puts the camera, for the background (none: the random sets' own). */
        viewCamera: computed((): SceneCameraSet | undefined => {
          const c = camera();
          return c ? { eye: c.eye, forward: c.forward, fovY: c.fovY } : undefined;
        }),
        /** The selected camera of the scene's. */
        selectedCamera: computed((): CameraEntry | null => {
          const t = targetOf(selected());
          return t.kind === 'camera' ? (cameraList().find((c) => c.id === t.id) ?? null) : null;
        }),
        /** The scene's planets a camera may be placed about, in order: each named, where it is, how big. */
        cameraPlanets: computed((): readonly CameraPlanet[] =>
          sceneBodiesNow().map((p, i) => {
            const b = bodyByKey().get(bodyKey([i]));
            return { label: b ? bodyLabel(b) : p.id, position: p.position, radius: p.radius };
          }),
        ),
        /** The selected camera as its panel shows it: where it is, its turn and tilt, its field of view. */
        cameraValues: computed((): CameraValues | null => {
          const t = targetOf(selected());
          const set = t.kind === 'camera' ? cameraSetById(t.id) : undefined;
          const scene = sceneFile();
          if (!set || !scene) return null;
          const c = { ...scene.camera, ...set };
          // (Its place as kept, to a thousandth: no -0 from the data's.)
          const eye = c.eye.map((v) => Math.round(v * 1000) / 1000 || 0) as unknown as Vec3;
          return { eye, ...cameraAngles(c.forward), fovY: c.fovY };
        }),
        /** What the view may look through: the editor's camera (not in the library's preview), then the scene's (none: no choice). */
        lookOptions: computed((): readonly { readonly id: string; readonly label: string }[] =>
          cameraList().length
            ? [
                ...(browsing() ? [] : [{ id: EDITOR_CAMERA, label: 'Editor camera' }]),
                ...cameraList().map((c) => ({
                  id: c.id,
                  label: c.id === primaryCamera() ? `${c.name} (primary)` : c.name,
                })),
              ]
            : [],
        ),
        /** Whether the view looks through the editor's camera, moved from the scene's primary. */
        editorCameraMoved: computed(
          () => !random() && !browsing() && look() === EDITOR_CAMERA && editorCamera() !== null,
        ),
        groupOpen,
        placements,
        placedGroups,
        groupInfos,
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
        skyMaterials,
        target,
        focusPath,
        unsavedBodies,
        /** The scene as it is to be shown: its sky (over the library's, by the background) and its colour. */
        sceneSky: sky,
        skyWorn,
        skyOverlays,
        skyParts,
        skyOverlaysSet: computed(() => sky().overlays !== undefined),
        /** The overlays a sky may wear: the game data's, and those made in the editor; by name. */
        skyOverlayOptions: computed((): readonly PickChoice[] =>
          skyOverlayChoices(sceneFile(), library()),
        ),
        /** The scene's own lights, lighting every planet in it. */
        sceneLights: computed((): readonly AddedLight[] => choices().lights ?? []),
        sceneTint: computed(() => _draft.scenes().settings),
        neededFiles: computed(() => {
          const file = overlayFileOf();
          const lib = library();
          // Each body, what it wears, and the files what is added onto it (and the sky) reads.
          return [
            ...new Set([
              ...bodies().flatMap((b) => [
                b.id,
                ...wornIds(b).map(file),
                ...sourceFiles(
                  addedSourced(
                    mergeAddedParts(lib.planets[b.id]?.addedParts, b.settings.addedParts),
                  ),
                ),
              ]),
              ...[...groupInfos().values()].flatMap((b) => [
                b.id,
                ...wornIds(b).map(file),
                ...sourceFiles(
                  addedSourced(
                    mergeAddedParts(lib.planets[b.id]?.addedParts, b.settings.addedParts),
                  ),
                ),
              ]),
              ...sourceFiles(addedSourced(skyAdded())),
            ]),
          ];
        }),
        kind: computed((): TargetKind => {
          const t = target();
          if ('view' in t && t.view) return t.view.kind;
          // The scene's lights shown as any light is; the sky's overlays' parts as any part.
          return t.kind === 'scene-light' ? 'light' : t.kind === 'sky-part' ? 'part' : t.kind;
        }),
        materialView: computed((): MaterialView | null => {
          const t = target();
          return 'view' in t && t.view ? t.view : null;
        }),
        bodyView: computed(() => {
          const b = body();
          // (Moons can be put about any body but one of its planet's own.)
          return b ? bodyView(b, focus() === b.key.slice(5), !b.inherited) : null;
        }),
        material: computed(() => {
          const t = target();
          if (t.kind === 'sky-material') return materialAt(skyMaterials(), t.key);
          const b = body();
          // Its layers may read the sky's textures too (always loaded).
          const sky = _sceneFile.hasValue() ? _sceneFile.value().textures : {};
          return t.kind === 'material' && b ? materialAt(materialsOf(b, sky), t.key) : undefined;
        }),
        part: computed(() => {
          const t = target();
          if (t.kind === 'sky-part') return skyParts().find((p) => p.key === t.key);
          const b = body();
          return t.kind === 'part' && b ? partsOfBody(b).find((p) => p.key === t.key) : undefined;
        }),
        litBy: computed((): readonly LitByEntry[] | null => {
          const t = target();
          const b = body();
          const receiver = receiverOf(t);
          return b && filesLoaded(b) && receiver !== undefined
            ? litByOf(b, receiver, outerLights())
            : null;
        }),
        light: computed(() => {
          const t = target();
          if (t.kind === 'scene-light')
            return sceneLightsOf(choices().lights).find((l) => l.light.id === t.id);
          const b = body();
          return t.kind === 'light' && b
            ? lightsOfBody(b).find((l) => l.light.id === t.id)
            : undefined;
        }),
        title: computed(() => {
          const t = target();
          if ('view' in t && t.view) {
            const b = body();
            const m =
              t.kind === 'sky-material'
                ? materialAt(skyMaterials(), t.key)
                : b && t.kind === 'material'
                  ? materialAt(materialsOf(b), t.key)
                  : undefined;
            return viewTitle(t.view, m ?? undefined);
          }
          if (t.kind === 'scene') return groupOpen() ? 'Group' : 'Scene';
          if (t.kind === 'sky') return 'Sky';
          if (t.kind === 'sky-material') return materialAt(skyMaterials(), t.key)?.label ?? t.name;
          if (t.kind === 'material') {
            const b = body();
            return (b && materialAt(materialsOf(b), t.key)?.label) ?? t.name;
          }
          if (t.kind === 'sky-part')
            return skyParts().find((x) => x.key === t.key)?.label ?? 'Part';
          if (t.kind === 'part') {
            const p = body() && partsOfBody(body()!).find((x) => x.key === t.key);
            return p ? (p.overlayName ? `${p.label} · ${p.overlayName}` : p.label) : 'Part';
          }
          if (t.kind === 'light') {
            const l = body() && lightsOfBody(body()!).find((x) => x.light.id === t.id);
            return l?.light.name ?? 'Properties';
          }
          if (t.kind === 'scene-light')
            return choices().lights?.find((l) => l.id === t.id)?.name ?? 'Properties';
          if (t.kind === 'reference') return 'Reference';
          if (t.kind === 'placement') {
            const p = placements()[t.index];
            return p ? `Group · ${p.label ?? groupOf(p.group)?.name ?? p.group}` : 'Group';
          }
          if (t.kind === 'cameras') return 'Cameras';
          if (t.kind === 'camera') return cameraList().find((c) => c.id === t.id)?.name ?? 'Camera';
          const b = body();
          return b ? bodyLabel(b) : 'Properties';
        }),
        skyChanged: computed(() => Object.keys(sky()).length > 0),
        skyTint: computed((): MaterialTint => sky().tint ?? library().sky.tint ?? NO_MATERIAL_TINT),
        skyTintSet: computed(() => sky().tint),
        sets: random,
        /** The overlays a body may wear: the game data's, and those made in the editor; by name. */
        overlayOptions: computed((): readonly PickChoice[] =>
          overlayChoices(_index.hasValue() ? _index.value() : null, library()),
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
    },
  ),
  withComputed((store) => {
    const d = store._draft;
    /** The parts added onto a body of the scene (its settings', in the scene), to change them by. */
    const bodyHost = (path: BodyPath): PartHost | null => {
      const b = store.bodyByKey().get(bodyKey(path));
      if (!b) return null;
      return {
        kind: 'planet',
        parts: b.settings.addedParts ?? [],
        taken: (b.file?.parts ?? []).map(partId),
        set: (parts) =>
          d.setSceneBodies(
            store.scene(),
            storedBodies(
              changeSettings(store.sceneBodies(), path, wornKeyOf(b), (s) =>
                without({ ...s, addedParts: parts }, parts.length ? [] : ['addedParts']),
              ),
              d.library(),
            ),
          ),
      };
    };
    /** The parts added onto the scene's sky, to change them by. */
    const skyHost = (): PartHost => ({
      kind: 'sky',
      parts: store.sceneSky().addedParts ?? [],
      taken: store
        .skyParts()
        .filter((p) => !p.overlay)
        .map((p) => p.key.slice(4)),
      set: (parts) => d.setSkyAddedParts(store.scene(), parts),
    });
    /** Where parts are added for what is selected: the body selected, or the sky. */
    const addHost = computed((): PartHost | null => {
      const t = store.target();
      return t.kind === 'body' ? bodyHost(t.path) : t.kind === 'sky' ? skyHost() : null;
    });
    /** The part selected and where it is kept, where it was added in the scene. */
    const partHost = computed((): { host: PartHost; id: string } | null => {
      const t = store.target();
      if ((t.kind !== 'part' && t.kind !== 'sky-part') || !t.key.startsWith('own:')) return null;
      const host = t.kind === 'part' ? bodyHost(t.path) : skyHost();
      const id = t.key.slice(4);
      return host?.parts.some((p) => p.id === id) ? { host, id } : null;
    });
    return {
      _addHost: addHost,
      _partHost: partHost,
      /**
       * What has been added to what is selected: the scene's planets and the groups put in it, its
       * cameras (its cameras' group's too) and lights; a body's moons and the parts added onto it
       * here; the sky's parts.
       */
      added: computed((): AddedLists => {
        const t = store.target();
        const byKey = store.bodyByKey();
        const body = (path: BodyPath, icon: string): AddedItem[] => {
          const b = byKey.get(bodyKey(path));
          return b
            ? [{ key: bodyKey(path), label: bodyLabel(b), icon, removable: !b.inherited }]
            : [];
        };
        /** The parts added here, as the tree has them (by `own:<id>`). */
        const parts = (
          entries: readonly PartEntry[],
          rowKey: (key: PartKey) => string,
        ): AddedItem[] =>
          (addHost()?.parts ?? []).map((p) => {
            const key = `own:${p.id}` as PartKey;
            const entry = entries.find((e) => e.key === key);
            return {
              key: rowKey(key),
              label: entry?.label ?? p.id,
              icon: entry ? partIcon(entry) : 'circle',
              removable: true,
            };
          });
        const cameras = (): AddedItem[] =>
          store.cameraList().map((c) => ({
            key: cameraKey(c.id),
            label: c.name,
            icon: 'videocam',
            ...(c.id === store.primaryCamera() ? { detail: 'primary' } : {}),
            removable: !c.game,
          }));
        if (t.kind === 'cameras') return { cameras: cameras() };
        if (t.kind === 'scene')
          return {
            planets: [
              ...store.sceneBodies().flatMap((_, i) => body([i], 'public')),
              ...store.placements().map((p, i) => ({
                key: placementKey(i),
                label: store.placementLabel()(p),
                icon: 'workspaces',
                detail: 'group',
                removable: true,
              })),
            ],
            cameras: cameras(),
            lights: sceneLightsOf(store.sceneLights()).map(({ light }) => ({
              key: sceneLightKey(light.id),
              label: light.name,
              icon: lightIcon(light),
              removable: true,
            })),
          };
        if (t.kind === 'body') {
          const b = byKey.get(bodyKey(t.path));
          if (!b) return {};
          return {
            moons: b.moons.flatMap((_, i) => body([...t.path, i], 'brightness_1')),
            parts: parts(partsOfBody(b), (key) => partRowKey(t.path, key)),
          };
        }
        if (t.kind === 'sky') return { parts: parts(store.skyParts(), skyPartKey) };
        return {};
      }),
      partShapes: computed((): readonly CreatedShape[] => {
        const host = addHost();
        return host ? PART_SHAPES[host.kind] : [];
      }),
      reusableParts: computed((): readonly PickChoice[] => {
        const host = addHost();
        if (!host) return [];
        const offered = store._catalog.reusableParts()[host.kind];
        return offered.map((r, i) => ({ value: String(i), label: r.label }));
      }),
      canSaveAsOverlay: computed(() => (addHost()?.parts.length ?? 0) > 0),
      partMaterials: computed(() => {
        const at = partHost();
        const part = at?.host.parts.find((p) => p.id === at.id);
        return part ? { picked: part.materials, choices: store._catalog.materialChoices() } : null;
      }),
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
        enabled?: boolean,
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
          enabled,
        });
      /** A material's row: movable (its draw order) unless opaque, drawn first wherever it is. */
      /** A material's row, its layers under it (folded unless unfolded). */
      const leaf = (key: string, m: MaterialEntry, depth: number) => {
        rows.push({
          key,
          label: m.label,
          detail: m.name,
          icon: 'texture',
          depth,
          expandable: m.layers.length > 0,
          expanded: open.has(key),
          enabled: m.values.enabled,
          movable: m.values.blend !== 'opaque',
        });
        if (open.has(key)) rows.push(...layerRows(key, m, depth + 1));
      };
      if (store.groupOpen()) row(SCENE, 'Group', 'workspaces', 0, store.sceneUnsaved());
      else row(SCENE, 'Scene', 'landscape', 0, store.sceneUnsaved());
      if (!open.has(SCENE)) return rows;
      // The scene's own lights, where it has any.
      const own = sceneLightsOf(store.sceneLights());
      if (own.length) {
        rows.push({
          key: SCENE_LIGHTS,
          label: 'Lights',
          icon: 'lightbulb',
          depth: 1,
          expandable: true,
          expanded: !open.has(SCENE_LIGHTS),
          group: true,
        });
        if (!open.has(SCENE_LIGHTS))
          for (const { light } of own)
            rows.push({
              key: sceneLightKey(light.id),
              label: light.name,
              icon: lightIcon(light),
              depth: 2,
              expandable: false,
              expanded: false,
              enabled: light.enabled,
            });
      }
      // Its cameras, the game's first (the one it is shown through marked).
      const cameras = store.cameraList();
      if (cameras.length) {
        rows.push({
          key: CAMERAS,
          label: 'Cameras',
          icon: 'videocam',
          depth: 1,
          expandable: true,
          expanded: !open.has(CAMERAS),
          group: true,
        });
        if (!open.has(CAMERAS))
          for (const c of cameras)
            rows.push({
              key: cameraKey(c.id),
              label: c.name,
              ...(c.id === store.primaryCamera() ? { detail: 'primary' } : {}),
              icon: 'videocam',
              depth: 2,
              expandable: false,
              expanded: false,
            });
      }
      // A group has no sky of its own (it is drawn under the scene's it is put in).
      const sky = !store.groupOpen();
      if (sky) row(SKY, 'Sky', 'blur_on', 1, store.skyUnsaved());
      // Its materials by where they are drawn among the scene's objects: behind, among, in front;
      // then each overlay it wears, its parts with their materials under it.
      if (sky && open.has(SKY))
        for (const g of byDepth(store.skyMaterials().filter((m) => !m.overlay && !m.added))) {
          const group = skyDepthKey(g.depth);
          rows.push({
            key: group,
            label: g.label,
            icon: g.icon,
            depth: 2,
            expandable: true,
            expanded: !open.has(group),
            group: true,
          });
          if (!open.has(group)) for (const m of g.materials) leaf(skyMaterialKey(m.name), m, 3);
        }
      // The parts added onto it (its own), each with the materials it draws.
      if (sky && open.has(SKY))
        for (const part of store.skyParts().filter((p) => !p.overlay)) {
          const key = skyPartKey(part.key);
          const materials = store
            .skyMaterials()
            .filter((m) => m.added && part.materials.includes(m.name));
          rows.push({
            key,
            label: part.label,
            icon: part.band ? 'panorama_horizontal' : 'category',
            depth: 2,
            expandable: materials.length > 0,
            expanded: !open.has(key),
            enabled: part.enabled,
          });
          if (!open.has(key)) for (const m of materials) leaf(skyMaterialKey(m.name), m, 3);
        }
      if (sky && open.has(SKY))
        for (const o of store.skyOverlays()) {
          const group = skyOverlayKey(o.id);
          rows.push({
            key: group,
            label: skyOverlayLabel(o),
            detail: 'overlay',
            icon: 'style',
            depth: 2,
            expandable: true,
            expanded: !open.has(group),
            group: true,
            enabled: skyOverlayOn(store.sceneSky(), store._draft.library(), o.id),
            movable: store.skyOverlays().length > 1,
          });
          if (open.has(group)) continue;
          for (const part of store.skyParts().filter((p) => p.overlay === o.id)) {
            const key = skyPartKey(part.key);
            const materials = store
              .skyMaterials()
              .filter((m) => m.overlay === o.id && part.materials.includes(m.name));
            rows.push({
              key,
              label: part.label,
              icon: 'panorama_horizontal',
              depth: 3,
              expandable: materials.length > 0,
              expanded: !open.has(key),
              enabled: part.enabled,
            });
            if (!open.has(key))
              for (const m of materials) leaf(skyOverlayMaterialKey(o.id, m.name), m, 4);
          }
        }
      const body = (b: BodyInfo, depth: number) => {
        const path = pathOf(b.key.slice(5));
        row(
          b.key,
          wornLabel(b),
          path.length > 1 ? 'brightness_1' : 'public',
          depth,
          store.unsavedBodies().has(b.key),
          false,
          bodyEnabled(b),
        );
        if (!open.has(b.key)) return;
        // Its parts, each with the materials drawn on it (a part is open unless folded: its key
        // among those kept means folded); its lights; then the overlay it wears, its parts and
        // its lights under it.
        const nodes = partNodes(b, materialsOf(b));
        const lights = lightsOfBody(b);
        const parts = (list: readonly PartNode[], at: number, overlay?: string) => {
          const shared = sharedMaterials(list);
          for (const { part, materials } of list) {
            const key = partRowKey(path, part.key);
            rows.push({
              key,
              label: part.label,
              icon: partIcon(part),
              depth: at,
              expandable: materials.length > 0,
              expanded: !open.has(key),
              enabled: part.enabled,
            });
            if (!open.has(key))
              partMaterialRows(
                materials,
                at + 1,
                open,
                (name) =>
                  onPart(
                    materialRowKey(path, name, overlay),
                    shared.has(name) ? part.key : undefined,
                  ),
                leaf,
                (r) => rows.push(r),
              );
          }
        };
        const lightGroup = (group: string, list: readonly LightEntry[], at: number) => {
          if (!list.length) return;
          rows.push({
            key: group,
            label: 'Lights',
            icon: 'lightbulb',
            depth: at,
            expandable: true,
            expanded: open.has(group),
            group: true,
          });
          if (open.has(group))
            for (const { light } of list)
              rows.push({
                key: lightRowKey(path, light.id),
                label: light.name,
                icon: lightIcon(light),
                depth: at + 1,
                expandable: false,
                expanded: false,
                enabled: light.enabled,
              });
        };
        parts(nodes.own, depth + 1);
        lightGroup(
          lightsKey(path),
          lights.filter((l) => !l.overlay),
          depth + 1,
        );
        // Each overlay it wears, in the order worn (the later drawn over the earlier): moved
        // among them to wear them in another order.
        for (const { overlay, nodes: list } of nodes.overlays) {
          const group = overlayKey(path, overlay.id);
          rows.push({
            key: group,
            label: overlayLabel(overlay),
            detail: 'overlay',
            icon: 'style',
            depth: depth + 1,
            expandable: true,
            expanded: !open.has(group),
            group: true,
            enabled: overlayEnabled(b, overlay.id),
            movable: b.overlays.length > 1,
          });
          if (!open.has(group)) {
            parts(list, depth + 2, overlay.id);
            lightGroup(
              overlayLightsKey(path, overlay.id),
              lights.filter((l) => l.overlay === overlay.id),
              depth + 2,
            );
          }
        }
        b.moons.forEach((_, i) => {
          const child = store.bodyByKey().get(bodyKey([...path, i]));
          if (child) body(child, depth + 1);
        });
      };
      store.sceneBodies().forEach((_, i) => {
        const planet = store.bodyByKey().get(bodyKey([i]));
        if (planet) body(planet, 1);
      });
      // The groups put in it, each switched by its checkbox (what is in it is set in the group).
      store.placements().forEach((p, i) =>
        rows.push({
          key: placementKey(i),
          label: store.placementLabel()(p),
          detail: 'group',
          icon: 'workspaces',
          depth: 1,
          expandable: false,
          expanded: false,
          enabled: p.enabled !== false,
        }),
      );
      rows.push(referenceRow());
      return rows;
    }),
    /**
     * The scene's bodies placed for the background: each planet where it is, its moons about it;
     * centred on a moon, that moon in the middle of the view with its own. Null for the random
     * sets (the background draws them), or while what they need is loading.
     */
    _placed: computed((): { planets: SetPlanet[]; picks: string[] } | null => {
      if (!store.hasPlanets()) return null;
      const planets = store.sceneBodies();
      const grouped = store.placedGroups();
      if (!planets.length && !grouped.length) return { planets: [], picks: [] };
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      if (!scene) return null;
      // Its moons are placed, and what is drawn smaller to keep in view fitted, as the game's
      // camera sees them, so the scene's own cameras and the editor's move round the same layout.
      const layoutView = scene.camera;
      const up = Math.tan((layoutView.fovY * Math.PI) / 360);
      const reach = { up, across: up * store._ui.aspect() };
      /** The scene's bodies from its planet down to the one at a path. */
      const sceneChain = (at: BodyPath) =>
        at.map((_, i) => store.bodyByKey().get(bodyKey(at.slice(0, i + 1))));
      // Each root: a planet where it is (the scene's, or a group's put in it), or the moon
      // centred on; its moons; the path its bodies' own paths are under (the scene's); its
      // bodies from it down to each (`chain`); what picking one selects; the lights of the
      // groups it is in.
      interface Root {
        readonly root: { readonly position: Vec3; readonly radius: number };
        readonly moons: readonly MoonChoices[];
        readonly fit: boolean;
        readonly chain: (path: BodyPath) => (BodyInfo | undefined)[];
        readonly pick: (path: BodyPath) => string;
        readonly lights: readonly AddedLight[];
      }
      const focus = store.focusPath();
      const focused = focus.length ? bodyAt(planets, focus) : undefined;
      const roots: Root[] = focused
        ? [
            {
              root: SCENE_CENTRE,
              moons: focused.moons ?? [],
              fit: true,
              chain: (path) => sceneChain([...focus, ...path]),
              pick: (path) => bodyKey([...focus, ...path]),
              lights: [],
            },
          ]
        : [
            ...planets.map((p, i): Root => ({
              root: { position: p.position, radius: p.radius },
              moons: p.moons ?? [],
              // A scene of one planet is kept in view; several are where they are put.
              fit: planets.length === 1 && !grouped.length,
              chain: (path) => sceneChain([i, ...path]),
              pick: (path) => bodyKey([i, ...path]),
              lights: [],
            })),
            // The groups' planets where they are put: picked, the group put in it is selected.
            ...grouped.map((g, j): Root => ({
              root: { position: g.body.position, radius: g.body.radius },
              moons: g.body.moons ?? [],
              fit: false,
              chain: (path) =>
                [[], ...path.map((_, k) => path.slice(0, k + 1))].map((at) =>
                  store.groupInfos().get(groupBodyKey(j, at)),
                ),
              pick: () => placementKey(g.placement[0]!),
              lights: g.lights,
            })),
          ];
      const out: SetPlanet[] = [];
      /** What picking each body put out selects, in the same order. */
      const picks: string[] = [];
      /** What must stay in view of each body put out, in its radii. */
      const extents: number[] = [];
      for (const { root, moons, fit, chain, pick, lights } of roots) {
        // What must stay in view of each body: as far as its parts and its halo reach.
        const extent = (path: BodyPath) => {
          const b = chain(path).at(-1);
          return b
            ? visualExtent(b.file, b.overlays, bodyParts(b), glowMarginOf(b))
            : visualExtent();
        };
        const base = fit
          ? { ...root, radius: fitRadius(root, moons, layoutView, reach, new Map(), extent) }
          : root;
        for (const p of placeBodies(base, moons, layoutView)) {
          const bodies = chain(p.path);
          const b = bodies.at(-1);
          if (!b || !filesLoaded(b)) return null;
          const s = b.settings;
          // Drawn where it and every body it is a moon of are switched on.
          const drawn = bodies.every((x) => (x?.settings.enabled ?? x?.below?.enabled) !== false);
          // The lights of the bodies it is a moon of that reach their moons, and its groups'.
          const inherited = [
            ...bodies.slice(0, -1).flatMap((parent) => (parent ? moonLightsOf(parent) : [])),
            ...lights,
          ];
          extents.push(visualExtent(b.file, b.overlays, bodyParts(b), glowMarginOf(b)));
          picks.push(pick(p.path));
          out.push({
            id: b.id,
            position: p.position,
            radius: p.radius,
            overlays: wornIds(b),
            ...(drawn ? {} : { enabled: false }),
            ...(s.overlayEnabled !== undefined ? { overlayEnabled: s.overlayEnabled } : {}),
            ...(s.overlaysEnabled ? { overlaysEnabled: s.overlaysEnabled } : {}),
            lighting: s.lighting,
            shade: {
              ...(s.shade !== undefined ? { strength: s.shade } : {}),
              ...(s.shadeTowards ? { direction: s.shadeTowards } : {}),
            },
            materials: s.materials,
            parts: s.parts,
            ...(s.addedParts ? { addedParts: s.addedParts } : {}),
            order: s.order,
            lights: s.lights,
            added: inherited.length ? [...(s.added ?? []), ...inherited] : s.added,
            tint: s.tint,
            lightFrom: s.lightFrom,
            rim: s.rim,
          });
        }
      }
      // Several planets where they are put: the whole drawn smaller where any would leave the view.
      return {
        planets: roots.length > 1 ? fitScene(out, extents, layoutView, reach) : out,
        picks,
      };
    }),
  })),
  withComputed((store) => ({
    /** The scene's bodies placed for the background (null: the random sets', or loading). */
    scenePlanets: computed(() => store._placed()?.planets ?? null),
    /**
     * What the view marks where it is: the scene's cameras (not the one looked through), each
     * with what it sees outlined; the groups put in it; the lights of what is selected (a body's
     * round it, the scene's round each of its planets), each on the side it comes from.
     */
    markers: computed((): readonly SceneMarker[] => {
      const view = store.camera();
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      if (!view || !scene) return [];
      const t = store.target();
      const out: SceneMarker[] = [];
      for (const c of store.cameraList()) {
        if (c.id === store.look()) continue;
        const camera = { ...scene.camera, ...c.set };
        out.push({
          id: cameraKey(c.id),
          key: cameraKey(c.id),
          kind: 'camera',
          label: c.name,
          icon: 'videocam',
          at: camera.eye,
          camera,
          // What it sees outlined as far as the scene's middle.
          outline: distanceAhead(camera, SCENE_CENTRE.position, 5),
          selected: t.kind === 'camera' && t.id === c.id,
        });
      }
      store.placements().forEach((p, i) =>
        out.push({
          id: placementKey(i),
          key: placementKey(i),
          kind: 'group',
          label: store.placementLabel()(p),
          icon: 'workspaces',
          at: p.position,
          selected: t.kind === 'placement' && t.index === i,
          off: p.enabled === false,
        }),
      );
      const placed = store._placed();
      if (!placed) return out;
      /**
       * A body's lights' markers: each one from a side out from the body, on the side it comes
       * from (in the body's frame), a line to it; each one from all round on the body's middle
       * (several there side by side).
       */
      const lit = (
        lights: readonly { readonly key: string; readonly light: LightEntry['light'] }[],
        body: SetPlanet,
        i: number,
      ) => {
        const round = lights.filter(
          ({ light }) =>
            light.kind === 'ambient' ||
            light.kind === 'environment' ||
            (light.kind === 'rim' && !light.from),
        );
        const marker = (key: string, light: LightEntry['light'], at: Vec3) => ({
          id: `${key}@${i}`,
          key,
          kind: 'light' as const,
          label: light.name,
          icon: lightIcon(light),
          at,
          selected: store.selected() === key,
          off: !light.enabled,
        });
        round.forEach(({ key, light }, n) =>
          out.push({ ...marker(key, light, body.position), nudge: n - (round.length - 1) / 2 }),
        );
        for (const { key, light } of lights) {
          const at = lightMarkerAt(light, body, view);
          if (at)
            out.push({
              ...marker(key, light, at.at),
              from: at.from,
              lines: spotEdges(light, body, view),
            });
        }
      };
      if (t.kind === 'scene-light') {
        placed.picks.forEach((pick, i) => {
          const body = placed.planets[i];
          if (!body || !pick.startsWith('body:') || pathOf(pick.slice(5)).length !== 1) return;
          lit(
            sceneLightsOf(store.sceneLights()).map(({ light }) => ({
              key: sceneLightKey(light.id),
              light,
            })),
            body,
            i,
          );
        });
      } else if (
        t.kind === 'material' &&
        (t.view?.kind === 'gridLight' || t.view?.kind === 'shader')
      ) {
        // A shield's light, or its shader, selected: the shield's lights, round its body.
        const split = splitViewKey(store.selected());
        const key = bodyKey(t.path);
        const b = store.bodyByKey().get(key);
        const i = placed.picks.indexOf(key);
        const body = placed.planets[i];
        const m = b && materialAt(materialsOf(b), t.key);
        if (m && body && split) lit(shieldLightsOf(split.base, m.values.gridLights), body, i);
      } else if ('path' in t && t.path.length) {
        const key = bodyKey(t.path);
        const b = store.bodyByKey().get(key);
        const i = placed.picks.indexOf(key);
        const body = placed.planets[i];
        // The body's lights, and its shields' (an overlay's it wears).
        if (b && body)
          lit(
            [
              ...lightsOfBody(b).map(({ light }) => ({
                key: lightRowKey(t.path, light.id),
                light,
              })),
              ...shieldLightsOfBody(b, materialsOf(b), (name, overlay) =>
                materialRowKey(t.path, name, overlay),
              ),
            ],
            body,
            i,
          );
      }
      return out;
    }),
    /**
     * What the view shows of the light selected, on each body it lights (the scene's: each of
     * its planets): the outline of where it falls, a directional light's beam.
     */
    beams: computed((): readonly LightAid[] => {
      const view = store.camera();
      const placed = store._placed();
      const t = store.target();
      if (!view || !placed) return [];
      const beam = (light: LightEntry['light'], body: SetPlanet): LightAid[] =>
        lightAids(light, body, view);
      if (t.kind === 'scene-light') {
        const light = sceneLightsOf(store.sceneLights()).find((l) => l.light.id === t.id)?.light;
        if (!light) return [];
        return placed.picks.flatMap((pick, i) => {
          const body = placed.planets[i];
          return body && pick.startsWith('body:') && pathOf(pick.slice(5)).length === 1
            ? beam(light, body)
            : [];
        });
      }
      if (t.kind === 'material' && t.view?.kind === 'gridLight') {
        const id = t.view.id;
        const key = bodyKey(t.path);
        const b = store.bodyByKey().get(key);
        const body = placed.planets[placed.picks.indexOf(key)];
        const m = b && materialAt(materialsOf(b), t.key);
        const light =
          m && shieldLightsOf('', m.values.gridLights).find((l) => l.light.id === (id as string));
        return light && body ? beam(light.light, body) : [];
      }
      if (t.kind !== 'light') return [];
      const key = bodyKey(t.path);
      const b = store.bodyByKey().get(key);
      const body = placed.planets[placed.picks.indexOf(key)];
      const light = b && lightsOfBody(b).find((l) => l.light.id === t.id)?.light;
      return light && body ? beam(light, body) : [];
    }),
  })),
  withMethods((store) => {
    const d = store._draft;
    /** The scene's planets changed (the random sets' have none of their own). */
    const edit = (change: (bodies: readonly SceneBody[]) => readonly SceneBody[]) => {
      if (store.hasPlanets())
        d.setSceneBodies(store.scene(), storedBodies(change(store.sceneBodies()), d.library()));
    };
    /** The selected body's path, if a body (or one of its materials) is selected. */
    const selectedPath = (): BodyPath | null => {
      const t = store.target();
      return 'path' in t ? t.path : null;
    };
    /** The key of what a body wears (a planet's settings are kept by it). */
    const wornAt = (path: BodyPath) => {
      const b = store.bodyByKey().get(bodyKey(path));
      return b ? wornKeyOf(b) : '';
    };
    const settings = (path: BodyPath, change: (s: BodySettings) => BodySettings | undefined) =>
      edit((b) => changeSettings(b, path, wornAt(path), change));
    /** What the selected body wears changed (the later over the earlier). */
    const wear = (change: (worn: readonly string[]) => readonly string[]) => {
      const path = selectedPath();
      const b = path && store.bodyByKey().get(bodyKey(path));
      if (path && b) edit((bodies) => setOverlays(bodies, path, change(wornIds(b)), wornKeyOf(b)));
    };
    /** A light changed: the scene's own, or a body's (one added there itself, else what is set for it). */
    const lightChange = (t: Target, change: Partial<LightSettings>) => {
      if (t.kind === 'scene-light')
        d.setSceneLights(store.scene(), changedLight(store.sceneLights(), t.id, change));
      else if (t.kind === 'light') settings(t.path, (s) => withLightChange(s, t.id, change));
    };
    /** A group put in the scene changed (a setting given as none: taken back). */
    const changePlacement = (index: number, change: Partial<GroupPlacement>) => {
      const placements = store.placements();
      const p = placements[index];
      if (!p) return;
      const next = { ...p, ...change } as Record<string, unknown>;
      for (const k of Object.keys(change)) if (next[k] === undefined) delete next[k];
      d.setSceneGroups(
        store.scene(),
        placements.map((x, i) => (i === index ? (next as unknown as GroupPlacement) : x)),
      );
    };
    /** Something selected by its row's key, the rows above it unfolded to it. */
    const reveal = (key: string) => {
      const t = targetOf(key);
      store.expand(SCENE);
      if (t.kind === 'camera') store.reopen(CAMERAS);
      if (t.kind === 'scene-light') store.reopen(SCENE_LIGHTS);
      if (t.kind === 'body' || t.kind === 'part') {
        // (A body's own rows: under each it is a moon of; a part's, under its body too.)
        const upTo = t.kind === 'body' ? t.path.length - 1 : t.path.length;
        store.expand(...t.path.slice(0, upTo).map((_, i) => bodyKey(t.path.slice(0, i + 1))));
      }
      if (t.kind === 'sky-part') store.expand(SKY);
      if (t.kind === 'light') {
        const path = t.path;
        store.expand(...path.map((_, i) => bodyKey(path.slice(0, i + 1))));
        const b = store.bodyByKey().get(bodyKey(path));
        const overlay = b && lightsOfBody(b).find((l) => l.light.id === t.id)?.overlay;
        if (overlay) {
          store.reopen(overlayKey(path, overlay));
          store.expand(overlayLightsKey(path, overlay));
        } else store.expand(lightsKey(path));
      }
      patchState(store, { selected: key });
    };
    /** A camera added to the scene taken out; the view through it back to the editor's. */
    const dropCamera = (id: string) => {
      d.setSceneCameras(
        store.scene(),
        store.addedCameras().filter((a) => a.id !== id),
      );
      if (store.look() === id) patchState(store, { look: EDITOR_CAMERA });
    };
    /**
     * A body taken out (a planet with its moons, a moon with its own): what was selected of it, its
     * parent selected (the scene, for a planet); the view off it.
     */
    const removeBody = (path: BodyPath) => {
      edit((b) => removeAt(b, path));
      const inside = (key: string | null) =>
        key !== null && path.every((v, i) => pathOf(key)[i] === v);
      const t = store.target();
      const selected = 'path' in t && t.path.length >= path.length && inside(pathKey(t.path));
      const focus = store.focus();
      patchState(store, {
        ...(selected ? { selected: path.length > 1 ? bodyKey(path.slice(0, -1)) : SCENE } : {}),
        focus: inside(focus) ? null : focus,
      });
    };
    /** One of the scene's cameras moved or set: the game's over the data's, one added as it is. */
    const changeCamera = (id: string, set: SceneCameraSet & { placement?: CameraPlacement }) => {
      if (id === GAME_CAMERA) {
        const game = store.cameraList().find((c) => c.id === GAME_CAMERA);
        const placement = 'placement' in set ? set.placement : game?.placement;
        d.setSceneCamera(store.scene(), {
          ...game?.set,
          ...without(set, ['placement']),
          ...(placement ? { placement } : {}),
        });
      } else
        d.setSceneCameras(
          store.scene(),
          store.addedCameras().map((a) => (a.id === id ? { ...a, ...set } : a)),
        );
    };
    /** A part just added onto the body or sky selected selected, its row shown. */
    const selectAdded = (id: string) => {
      const t = store.target();
      if (t.kind === 'body') {
        store.expand(bodyKey(t.path));
        patchState(store, { selected: partRowKey(t.path, `own:${id}`) });
      } else {
        store.expand(SKY);
        patchState(store, { selected: skyPartKey(`own:${id}`) });
      }
    };
    const materialChange = (key: string, change: Partial<MaterialSettings>) => {
      const t = targetOf(key);
      if (t.kind === 'sky-material') d.setSkyMaterial(store.scene(), t.key, change);
      else if (t.kind === 'material') settings(t.path, (s) => withMaterial(s, t.key, change));
    };
    return {
      /** The scene shown, as the URL says ('': the random sets'); its first planet selected. */
      showScene: signalMethod<string>((id) => {
        if (id === store.scene()) return;
        // Seen through the editor's camera, where the scene's primary is.
        patchState(store, { scene: id, focus: null, look: EDITOR_CAMERA, editorCamera: null });
        // Its first planet selected, where it has one (else the scene itself).
        patchState(store, { selected: id && store.sceneBodies().length ? bodyKey([0]) : SCENE });
        store._ui.confirmReset(false);
        store.expand(SCENE, bodyKey([0]));
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
      /**
       * The camera the view looks through moved (dragged in the view): the editor's, kept while
       * the scene is open; one of the scene's, kept with it.
       */
      moveCamera(set: SceneCameraSet): void {
        if (store.sets() || store._ui.browsing()) return; // the library's preview isn't moved
        if (
          store.look() === EDITOR_CAMERA ||
          !store.cameraList().some((c) => c.id === store.look())
        )
          patchState(store, { editorCamera: { ...store.editorCamera(), ...set } });
        else changeCamera(store.look(), set);
      },
      /** The selected camera set in its panel: where it is, its turn and tilt, its field of view. */
      setCamera(change: Partial<CameraValues>): void {
        const now = store.cameraValues();
        const c = store.selectedCamera();
        if (!now || !c) return;
        const { turn = now.turn, tilt = now.tilt } = change;
        changeCamera(c.id, {
          ...(change.eye ? { eye: change.eye } : {}),
          ...(change.turn !== undefined || change.tilt !== undefined
            ? { forward: forwardOf(turn, tilt) }
            : {}),
          ...(change.fovY !== undefined ? { fovY: fieldOfView(change.fovY) } : {}),
        });
      },
      /** The selected camera placed (about a planet, or in the scene's own space): where it is now, how it is set. */
      setCameraPlacement(change: CameraPlaced): void {
        const c = store.selectedCamera();
        if (c) changeCamera(c.id, { eye: change.eye, placement: change.placement });
      },
      /** The game's camera, selected, back where the game puts it. */
      resetCamera(): void {
        if (store.selectedCamera()?.game) d.setSceneCamera(store.scene(), undefined);
      },
      /** A camera added where the view looks from (named after those there are): selected. */
      addCamera(): void {
        const view = store.camera();
        if (!view || !store.cameraList().length) return;
        const cameras = store.addedCameras();
        const taken = new Set(store.cameraList().map((c) => c.name));
        let n = cameras.length + 1;
        while (taken.has(`Camera ${n}`)) n++;
        const camera: AddedCamera = {
          id: `camera-${Math.random().toString(36).slice(2, 10)}`,
          name: `Camera ${n}`,
          eye: view.eye,
          forward: view.forward,
          fovY: view.fovY,
        };
        d.setSceneCameras(store.scene(), [...cameras, camera]);
        store.expand(SCENE);
        store.reopen(CAMERAS);
        patchState(store, { selected: cameraKey(camera.id) });
      },
      /** The selected camera (one added) named ('': as it was). */
      renameCamera(name: string): void {
        const c = store.selectedCamera();
        const named = name.trim();
        if (!c || c.game || !named) return;
        d.setSceneCameras(
          store.scene(),
          store.addedCameras().map((a) => (a.id === c.id ? { ...a, name: named } : a)),
        );
      },
      /** The selected camera (one added) taken out; the view through it back to the editor's. */
      removeCamera(): void {
        const c = store.selectedCamera();
        if (!c || c.game) return;
        dropCamera(c.id);
        patchState(store, { selected: CAMERAS });
      },
      /** One of what has been added to what is selected selected in the tree, its rows unfolded to it. */
      showAdded(key: string): void {
        reveal(key);
      },
      /** One of what has been added to what is selected taken out (where it can be). */
      removeAdded(key: string): void {
        const t = targetOf(key);
        if (t.kind === 'body') removeBody(t.path);
        else if (t.kind === 'placement') {
          d.setSceneGroups(
            store.scene(),
            store.placements().filter((_, i) => i !== t.index),
          );
          if (store.selected() === key) patchState(store, { selected: SCENE });
        } else if (t.kind === 'camera') {
          if (store.cameraList().some((c) => c.id === t.id && !c.game)) dropCamera(t.id);
        } else if (t.kind === 'scene-light')
          d.setSceneLights(
            store.scene(),
            store.sceneLights().filter((l) => l.id !== t.id),
          );
        else if ((t.kind === 'part' || t.kind === 'sky-part') && t.key.startsWith('own:')) {
          const host = store._addHost();
          if (host) removePart(host, t.key.slice(4));
        }
      },
      /** The scene shown through the selected camera. */
      makePrimary(): void {
        const c = store.selectedCamera();
        if (c) d.setPrimaryCamera(store.scene(), c.id);
      },
      /** The view seen through one of the scene's cameras, or the editor's (`EDITOR_CAMERA`). */
      lookThrough(id: string): void {
        patchState(store, {
          look: store.cameraList().some((c) => c.id === id) ? id : EDITOR_CAMERA,
        });
      },
      /** The editor's camera back where the scene's primary is. */
      resetEditorCamera(): void {
        patchState(store, { editorCamera: null });
      },
      /** What a marker in the view stands for selected, its rows unfolded to it. */
      showMarker(key: string): void {
        reveal(key);
      },
      /** A group put in the scene, its middle where a first planet goes: selected. */
      addGroup(id: string): void {
        if (!store.hasPlanets() || !canPutGroup(id, store.scene(), (g) => d.scenes().planets[g]))
          return;
        const placements = store.placements();
        d.setSceneGroups(store.scene(), [
          ...placements,
          { group: id, position: SCENE_CENTRE.position },
        ]);
        store.expand(SCENE);
        patchState(store, { selected: placementKey(placements.length) });
      },
      /** The group put in the scene selected changed (where it is, how big, its name there). */
      setPlacement(change: Partial<GroupPlacement>): void {
        const t = store.target();
        if (t.kind === 'placement') changePlacement(t.index, change);
      },
      /** The group put in the scene selected taken out: the scene selected. */
      removePlacement(): void {
        const t = store.target();
        if (t.kind !== 'placement') return;
        d.setSceneGroups(
          store.scene(),
          store.placements().filter((_, i) => i !== t.index),
        );
        patchState(store, { selected: SCENE });
      },
      /** The group put in the scene selected opened (what is in it is set there). */
      editPlacedGroup(): void {
        const t = store.target();
        const p = t.kind === 'placement' ? store.placements()[t.index] : undefined;
        if (p) store._ui.open({ kind: 'group', id: p.group });
      },
      /** A planet, by id, put in the scene: shown in the tree and selected. */
      addPlanet(id: string): void {
        if (!store.hasPlanets()) return;
        const { bodies, path } = addPlanet(store.sceneBodies(), id);
        d.setSceneBodies(store.scene(), storedBodies(bodies, d.library()));
        store.expand(SCENE);
        patchState(store, { selected: bodyKey(path) });
      },
      /** The body clicked in the view (by its index as put up) selected, its rows unfolded to it. */
      selectPlaced(index: number): boolean {
        const key = store._placed()?.picks[index];
        if (!key) return false;
        // A group's planet: the group put in the scene.
        const path = key.startsWith('body:') ? pathOf(key.slice(5)) : [];
        store.expand(SCENE, ...path.slice(0, -1).map((_, i) => bodyKey(path.slice(0, i + 1))));
        patchState(store, { selected: key });
        return true;
      },
      /** A row selected; the materials' group only folds (there is nothing of its own to set). */
      select(key: string): void {
        if (targetOf(key).kind === 'group') store.toggleExpanded(key);
        else patchState(store, { selected: key });
      },
      setEnabled(change: { key: string; enabled: boolean }): void {
        const t = targetOf(change.key);
        const on = change.enabled;
        if (t.kind === 'placement') {
          changePlacement(t.index, { enabled: on ? undefined : false });
          return;
        }
        const b = 'path' in t ? store.bodyByKey().get(bodyKey(t.path)) : undefined;
        // Each back to what is under it where that is the same, else set here (a scene's own
        // light: switched on is as it starts).
        if (t.kind === 'light' && b) {
          const below = lightsOfBody(b).find((l) => l.light.id === t.id)?.enabledBelow ?? true;
          settings(t.path, (s) => withLightSwitched(s, t.id, on, below));
        } else if (t.kind === 'scene-light') lightChange(t, { enabled: on });
        else if (t.kind === 'body') {
          // Back to what is under it where that is the same (a planet's own moon may be off
          // there), else set here.
          const below = b?.below?.enabled !== false;
          settings(t.path, (s) => (on === below ? without(s, ['enabled']) : { ...s, enabled: on }));
        } else if (t.kind === 'part' && b) {
          const below = partsOfBody(b).find((p) => p.key === t.key)?.enabledBelow ?? true;
          settings(t.path, (s) =>
            on === below
              ? withoutPartSetting(s, t.key, ['enabled'])
              : withPartSetting(s, t.key, { enabled: on }),
          );
        } else if (t.kind === 'group' && t.skyOverlay) {
          const below = skyOverlayOn(undefined, d.library(), t.skyOverlay);
          d.setSkyOverlayEnabled(store.scene(), t.skyOverlay, on, below);
        } else if (t.kind === 'sky-part') {
          const below = store.skyParts().find((p) => p.key === t.key)?.enabledBelow ?? true;
          if (on === below) d.clearSkyPart(store.scene(), t.key, ['enabled']);
          else d.setSkyPart(store.scene(), t.key, { enabled: on });
        } else if (t.kind === 'group' && b && t.overlay) {
          const id = t.overlay;
          settings(t.path, (s) => withOverlaySwitched(s, id, on, overlayEnabledBelow(b, id)));
        } else if (t.kind === 'sky-material') {
          const below = materialAt(store.skyMaterials(), t.key)?.enabledBelow ?? true;
          if (on === below) d.clearSkyMaterial(store.scene(), t.key, ['enabled']);
          else materialChange(change.key, { enabled: on });
        } else if (t.kind === 'material' && t.view?.kind === 'gridLight' && b) {
          // One of a shield's lights switched: the shield's lights set here.
          const id = t.view.id;
          const lights = materialAt(materialsOf(b), t.key)?.values.gridLights ?? [];
          settings(t.path, (s) =>
            withMaterial(s, t.key, { gridLights: withLightChanged(lights, id, { enabled: on }) }),
          );
        } else if (t.kind === 'material' && b) {
          const below = materialAt(materialsOf(b), t.key)?.enabledBelow ?? true;
          settings(t.path, (s) => withMaterialSwitched(s, t.key, on, below));
        }
      },
      setLight(change: Partial<LightSettings>): void {
        lightChange(store.target(), change);
      },
      /** One of the lights in the selected body's Lit by selected in the tree, its rows unfolded to it. */
      showLight(id: LightId): void {
        const t = store.target();
        const light = store.litBy()?.find((l) => l.id === id);
        if (!light || !('path' in t)) return;
        if (light.owner === 'scene') {
          store.expand(SCENE);
          store.reopen(SCENE_LIGHTS);
          patchState(store, { selected: sceneLightKey(id) });
          return;
        }
        const path = light.owner ?? t.path;
        store.expand(SCENE, ...path.map((_, i) => bodyKey(path.slice(0, i + 1))));
        if (light.overlay) {
          store.reopen(overlayKey(path, light.overlay));
          store.expand(overlayLightsKey(path, light.overlay));
        } else store.expand(lightsKey(path));
        patchState(store, { selected: lightRowKey(path, id) });
      },
      setLitBy(change: { readonly id: LightId; readonly on: boolean }): void {
        const t = store.target();
        const receiver = receiverOf(t);
        const light = store.litBy()?.find((l) => l.id === change.id);
        if (!light || receiver === undefined || !('path' in t)) return;
        const b = store.bodyByKey().get(bodyKey(t.path));
        if (!b) return;
        settings(t.path, (s) => withLitBy(s, b, light, receiver, change.on));
      },
      addLight(kind: NewLightKind): void {
        const t = store.target();
        const path = selectedPath();
        if (path && t.kind !== 'scene-light') {
          const b = store.bodyByKey().get(bodyKey(path));
          const light = newLight(
            kind,
            b
              ? lightsOfBody(b)
                  .map((l) => l.light)
                  .filter((l) => l.id.startsWith('added-'))
              : [],
          );
          settings(path, (s) => withAddedLight(s, light));
          store.expand(bodyKey(path), lightsKey(path));
          patchState(store, { selected: lightRowKey(path, light.id) });
        } else {
          const light = newLight(kind, store.sceneLights());
          d.setSceneLights(store.scene(), [...store.sceneLights(), light]);
          patchState(store, { selected: sceneLightKey(light.id) });
        }
      },
      removeLight(id?: LightId): void {
        const t = store.target();
        const path = selectedPath();
        if (id) {
          if (path) settings(path, (s) => withoutAddedLight(s, id));
          return;
        }
        if (t.kind === 'scene-light') {
          d.setSceneLights(
            store.scene(),
            store.sceneLights().filter((l) => l.id !== t.id),
          );
          patchState(store, { selected: SCENE });
        } else if (t.kind === 'light') {
          settings(t.path, (s) => withoutAddedLight(s, t.id));
          patchState(store, { selected: bodyKey(t.path) });
        }
      },
      clearLight(keys?: readonly (keyof LightSettings)[]): void {
        const t = store.target();
        if (t.kind === 'light') settings(t.path, (s) => withoutLightSetting(s, t.id, keys));
      },
      moveMaterial(move: TreeMove): void {
        const from = targetOf(move.key);
        const to = targetOf(move.target);
        // An overlay moved among those the sky wears: worn in that order.
        if (from.kind === 'group' && to.kind === 'group' && from.skyOverlay && to.skyOverlay) {
          const worn = store.skyWorn();
          d.setSkyOverlays(
            store.scene(),
            reordered(worn, worn, from.skyOverlay, to.skyOverlay, move.after),
          );
          return;
        }
        // An overlay moved among those its body wears: worn in that order, drawn so.
        if (
          from.kind === 'group' &&
          to.kind === 'group' &&
          from.overlay &&
          to.overlay &&
          pathKey(from.path) === pathKey(to.path)
        ) {
          const b = store.bodyByKey().get(bodyKey(from.path));
          if (!b) return;
          const worn = wornIds(b);
          const next = reordered(worn, worn, from.overlay, to.overlay, move.after);
          const order = overlayOrder(materialsOf(b), next);
          edit((bodies) =>
            changeSettings(
              setOverlays(bodies, from.path, next, wornKeyOf(b)),
              from.path,
              wornKey(next),
              (s) => ({ ...s, order }),
            ),
          );
          return;
        }
        if (from.kind === 'sky-material' && to.kind === 'sky-material') {
          const all = store.skyMaterials();
          const moving = materialAt(all, from.key);
          const target = materialAt(all, to.key);
          if (!moving || !target) return;
          const depth = target.values.depth;
          const group = all.filter((m) => m.values.depth === depth).map((m) => m.key);
          const order = reordered(
            all.map((m) => m.key),
            group,
            from.key,
            to.key,
            move.after,
          );
          if (moving.values.depth !== depth) d.setSkyMaterial(store.scene(), from.key, { depth });
          d.setSkyOrder(store.scene(), order);
        } else if (
          from.kind === 'material' &&
          to.kind === 'material' &&
          pathKey(from.path) === pathKey(to.path)
        ) {
          const b = store.bodyByKey().get(bodyKey(from.path));
          if (!b) return;
          const order = movedInPart(b, materialsOf(b), from.key, to.key, move.after);
          if (order) settings(from.path, (s) => ({ ...s, order }));
        }
      },
      setMaterial(change: Partial<MaterialSettings>): void {
        materialChange(store.selected(), change);
      },
      clearMaterial(keys?: readonly (keyof MaterialSettings)[]): void {
        const t = store.target();
        if (t.kind === 'sky-material') d.clearSkyMaterial(store.scene(), t.key, keys);
        else if (t.kind === 'material') settings(t.path, (s) => withoutMaterial(s, t.key, keys));
      },
      setPart(change: Partial<PartSettings>): void {
        const t = store.target();
        if (t.kind === 'sky-part') d.setSkyPart(store.scene(), t.key, change);
        else if (t.kind === 'part') settings(t.path, (s) => withPartSetting(s, t.key, change));
      },
      clearPart(keys?: readonly (keyof PartSettings)[]): void {
        const t = store.target();
        if (t.kind === 'sky-part') d.clearSkyPart(store.scene(), t.key, keys);
        else if (t.kind === 'part') settings(t.path, (s) => withoutPartSetting(s, t.key, keys));
      },
      /** An overlay put on the scene's sky, over what it wears. */
      addSkyOverlay(id: string): void {
        const worn = store.skyWorn();
        if (!worn.includes(id)) d.setSkyOverlays(store.scene(), [...worn, id]);
      },
      /** An overlay taken off the scene's sky. */
      removeSkyOverlay(id: string): void {
        d.setSkyOverlays(
          store.scene(),
          store.skyWorn().filter((w) => w !== id),
        );
      },
      /** What the scene's sky wears back as the library has it. */
      resetSkyOverlays(): void {
        d.setSkyOverlays(store.scene(), undefined);
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
        if (!path) return;
        // One of its planet's own moons: back as the planet has it, orbit and overlays too.
        if (store.bodyByKey().get(bodyKey(path))?.inherited)
          edit((b) => resetMoon(b, path, d.library()));
        else settings(path, () => undefined);
      },
      /** An overlay put on the selected body, over what it wears. */
      /** An overlay the selected body wears shown in the tree, its rows unfolded. */
      showOverlay(id: string): void {
        const path = selectedPath();
        if (!path) return;
        store.expand(SCENE, ...path.map((_, i) => bodyKey(path.slice(0, i + 1))));
        store.reopen(overlayKey(path, id));
      },
      /** An overlay the sky wears shown in the tree, its rows unfolded. */
      showSkyOverlay(id: string): void {
        store.expand(SCENE, SKY);
        store.reopen(skyOverlayKey(id));
      },
      addOverlay(id: string): void {
        wear((worn) => (worn.includes(id) ? worn : [...worn, id]));
      },
      /** An overlay taken off the selected body. */
      removeOverlay(id: string): void {
        wear((worn) => worn.filter((w) => w !== id));
      },
      /** What the selected body wears back as its own (its data's). */
      resetOverlays(): void {
        const path = selectedPath();
        const b = path && store.bodyByKey().get(bodyKey(path));
        if (path && b)
          edit((bodies) =>
            resetOverlays(bodies, path, wornKeyOf(b), ownOverlays(b.file?.tuning?.style)),
          );
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
        // (None about one of its planet's own moons: they are the planet's.)
        if (!parent || !store.hasPlanets() || store.bodyByKey().get(bodyKey(parent))?.inherited)
          return;
        const { bodies, path } = addMoonAt(store.sceneBodies(), parent, moon);
        d.setSceneBodies(store.scene(), storedBodies(bodies, d.library()));
        store.expand(bodyKey(parent));
        patchState(store, { selected: bodyKey(path) });
      },
      /**
       * The selected body taken out (a planet with its moons, a moon with its own): its parent
       * selected (the scene, for a planet), the view off it.
       */
      removeMoon(): void {
        const path = selectedPath();
        // (One of its planet's own moons stays: switched off, not taken out.)
        if (path?.length && !store.bodyByKey().get(bodyKey(path))?.inherited) removeBody(path);
      },
      /** A new part of a shape added onto the body or sky selected: selected. */
      addPart(shape: CreatedShape): void {
        const host = store._addHost();
        if (host) selectAdded(addShape(host, shape));
      },
      /** One of the game data's parts added onto the body or sky selected, reused: selected. */
      reusePart(value: string): void {
        const host = store._addHost();
        const reused = host && store._catalog.reusableParts()[host.kind][Number(value)];
        if (host && reused) selectAdded(addReused(host, reused));
      },
      /** The selected part taken off (one added in the scene): its owner selected. */
      removePart(): void {
        const at = store._partHost();
        const t = store.target();
        if (!at) return;
        removePart(at.host, at.id);
        patchState(store, { selected: t.kind === 'part' ? bodyKey(t.path) : SKY });
      },
      addPartMaterial(name: string): void {
        const at = store._partHost();
        const source = store._catalog.materialSource()(name);
        if (at && source) addMaterial(at.host, at.id, name, source);
      },
      removePartMaterial(name: string): void {
        const at = store._partHost();
        if (at) removeMaterial(at.host, at.id, name);
      },
      /**
       * The parts added onto the body or sky selected saved as a new overlay, worn in their place
       * (what was set for them kept, as the overlay's).
       */
      saveAsOverlay(): void {
        const host = store._addHost();
        const t = store.target();
        if (!host?.parts.length) return;
        const parts = host.parts;
        const id = d.createOverlay(host.kind, parts);
        if (t.kind === 'body') {
          settings(t.path, (s) => settingsAsOverlay(s, id, parts));
          wear((worn) => [...worn, id]);
        } else {
          d.changeSky(store.scene(), (sky) => settingsAsOverlay(sky, id, parts));
          d.setSkyOverlays(store.scene(), [...store.skyWorn(), id]);
        }
      },
      deleteAsset(): void {
        // a scene is deleted from its own panel
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
        });
      });
    },
  }),
);
