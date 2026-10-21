import { computed, inject, resource } from '@angular/core';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withFolding } from '../../../data/store-features/with-folding';
import { withLocalStorage } from '../../../data/store-features/with-local-storage';
import type { BodySettings, SkyChoices } from '../../../scenes/play-background/background-scene';
import {
  PREVIEW_SCENE,
  skyOverlayOn,
  skyWornOf,
} from '../../../scenes/play-background/background-design';
import { fitRadius, without } from '../../../scenes/play-background/background-scene';
import {
  GRID_DEFAULTS,
  materialKey,
  NO_MATERIAL_TINT,
} from '../../../scenes/play-background/material-settings';
import {
  visualExtent,
  withAddedLight,
  withLightChange,
  withLightSwitched,
  withoutAddedLight,
  withoutLightSetting,
  withoutPartSetting,
  withOverlaySwitched,
  withPartSetting,
} from '../../../scenes/play-background/scene-bodies';
import {
  type LightId,
  type LightKind,
  type LightSettings,
  newLight,
  type Receiver,
} from '../../../scenes/play-background/scene-lights';
import type { SetPlanet } from '../../../scenes/play-background/planet-sets';
import {
  loadPlaySceneFile,
  PLAY_SCENE_URL,
  type SceneCamera,
} from '../../../scenes/play-background/play-scene';
import {
  type MaterialSettings,
  type MaterialTint,
  mergePartSettings,
  partId,
  type PartKey,
  type PartSettings,
  reordered,
} from '../../../scenes/play-background/scene-planets';
import { DraftDesignStore, type LibraryKind } from '../draft-design.store';
import { AssetCatalogStore, type MaterialUse } from './asset-catalog.store';
import {
  baseMaterialOf,
  type BodyInfo,
  bodyView,
  type MaterialEntry,
  type LightEntry,
  LIGHT_ICONS,
  lightsOfBody,
  byDepth,
  partsOfBody,
  bodyLabel,
  materialAt,
  type SkyOverlayInfo,
  skyOverlayChoices,
  skyOverlayInfos,
  skyOverlayLabel,
  skyPartsOf,
  overlayLabel,
  overlayEnabled,
  partNodes,
  partIcon,
  type PartNode,
  type PartEntry,
  materialsOf,
  type MaterialView,
  splitViewKey,
  layerRows,
  partMaterialRows,
  viewTitle,
  filesLoaded,
  type LitByEntry,
  litByOf,
  withLitBy,
  referenceRow,
  skyMaterialsOf,
  ownSkyInfo,
  type TargetKind,
} from './editor-model';
import {
  addedSourced,
  type CreatedOverlay,
  createdSkyFile,
  type CreatedShape,
  mergeAddedParts,
  overlayFileFor,
  overlayName,
  PART_SHAPES,
  withAddedParts,
} from '../../../scenes/play-background/created-overlays';
import {
  addMaterial,
  addReused,
  addShape,
  overlayParts,
  type PartHost,
  removeMaterial,
  removePart,
  settingsAsOverlay,
  withOverlayParts,
} from './part-hosts';
import { ownOverlays } from '../../../scenes/play-background/overlays';
import { EditingAidsStore, GRID_CELLS, REFERENCE_KEY } from './editing-aids.store';
import type { PickChoice } from './pick-list';
import { EditorUiStore } from './editor-ui.store';
import type { AssetKind, AssetTarget, OpenTarget } from './open-target';
import type { TreeMove, TreeRow } from './scene-tree';
import type { SceneMarker } from './scene-markers';
import type { AddedLists } from './added-list';
import {
  STAND_IN_MATERIAL,
  standInId,
  standInLightSettings,
  standInLights,
  withStandInLight,
} from './stand-in';

/** The planet a style, a material or the sky is shown on, until a planet has been opened. */
const DEFAULT_PREVIEW_PLANET = 'korhal';
/** Where the asset is put on the stage: as a scene's planet is. */
const PREVIEW_POSITION: readonly [number, number, number] = [0, 65, 4];
const PREVIEW_RADIUS = 18;

/** The asset tree's rows by what they are. */
const STAGE = 'stage';
const STAGE_SKY = 'stage/sky';
const STAGE_BACKDROP = 'stage/backdrop';
const STAGE_STAND_IN = 'stage/stand-in';
/** The stand-in's own lights, under it. */
const standInLightKey = (id: LightId) => `${STAGE_STAND_IN}/l/${id}`;
const ASSET = 'asset';
/** An overlay the planet open wears, by id: its parts and its lights, under it. */
const assetOverlayKey = (id: string) => `asset/overlay/${id}`;
const assetOverlayLightsKey = (id: string) => `asset/overlay-lights/${id}`;
const stageMaterialKey = (name: string) => `${STAGE_SKY}/m/${name}`;
/**
 * A sky's overlays' rows (the stage's sky's, or the sky open's): an overlay it wears (its parts
 * under it), one of their parts (its materials under it), one of their materials.
 */
const skyRowKeys = (stage: boolean) => {
  const at = stage ? STAGE_SKY : `${ASSET}/sky`;
  return {
    overlay: (id: string) => `${at}/overlay/${id}`,
    part: (key: PartKey) => `${at}/p/${key}`,
    material: (overlay: string, name: string) => `${at}/om/${overlay}/${name}`,
  };
};
/** A sky's materials at a depth (background, midground, foreground), a group of their own: the sky open's, the stage's. */
const assetDepthKey = (depth: string) => `${ASSET}/depth/${depth}`;
const stageDepthKey = (depth: string) => `${STAGE_BACKDROP}/depth/${depth}`;
const assetMaterialKey = (name: string) => `${ASSET}/m/${name}`;
/** A material of an overlay the planet open wears (two may share one). */
const assetOverlayMaterialKey = (overlay: string, name: string) => `${ASSET}/om/${overlay}/${name}`;
const assetPartKey = (key: PartKey) => `${ASSET}/p/${key}`;
/** Its lights (its rig's, its shadow, those added), a group of their own. */
const ASSET_LIGHTS = 'asset/lights';
const assetLightKey = (id: LightId) => `${ASSET}/l/${id}`;

const KIND_TITLES: Readonly<Record<AssetKind, string>> = {
  planet: 'Planet',
  style: 'Overlay',
  material: 'Material',
  particle: 'Particles',
  sky: 'Sky',
};

/** What an asset tree row's key is, for the asset open. */
type Target =
  /**
   * A group of rows: an overlay the planet open wears (`overlay`: which), its lights, a sky's
   * depths, an overlay a sky wears (`skyOverlay`: which; the stage's sky's or the sky open's).
   */
  | {
      readonly kind: 'group';
      readonly overlay?: string;
      readonly skyOverlay?: string;
      readonly stage?: boolean;
    }
  /** The stage's sky, or the library's (the sky open). */
  | { readonly kind: 'sky'; readonly stage: boolean }
  | {
      readonly kind: 'sky-material';
      /** What its settings are kept by (see `materialKey`). */
      readonly key: string;
      readonly stage: boolean;
      readonly name: string;
      /** The overlay the sky wears it is of, where it is one's (else the sky's own). */
      readonly overlay?: string;
      readonly view?: MaterialView;
    }
  /** A part of an overlay a sky wears (the stage's, or the sky open's). */
  | { readonly kind: 'sky-part'; readonly stage: boolean; readonly key: PartKey }
  /** The planet or style open. */
  | { readonly kind: 'body' }
  /** A material as the planet or overlay open sets it for itself (`overlay`: of one it wears). */
  | {
      readonly kind: 'material';
      /** What its settings are kept by (see `materialKey`). */
      readonly key: string;
      readonly name: string;
      readonly overlay?: string;
      readonly view?: MaterialView;
    }
  /** One of the planet's or style's parts. */
  | { readonly kind: 'part'; readonly key: PartKey }
  /** One of the planet's or style's lights. */
  | { readonly kind: 'light'; readonly id: LightId }
  /** The material open: its base settings. */
  | { readonly kind: 'base-material'; readonly view?: MaterialView }
  | { readonly kind: 'particle' }
  /** The editing aids: the stage's backdrop, the stand-in planet. */
  | { readonly kind: 'backdrop' }
  | { readonly kind: 'stand-in' }
  /** One of the stand-in's lights (an editing aid's: kept with the aids, never in the design). */
  | { readonly kind: 'stand-in-light'; readonly id: LightId }
  | { readonly kind: 'reference' };

/** What of the body open a target is, as a light reaches it: the body (none), a part or a material; not one (undefined). */
function receiverOf(t: Target): Receiver | null | undefined {
  if (t.kind === 'body') return null;
  if (t.kind === 'part') return `part:${t.key}`;
  if (t.kind === 'material') return `material:${t.key}`;
  return undefined;
}

function targetOf(key: string, asset: AssetTarget): Target {
  // What of a material a row shows (a layer, its shader, an effect), or a shader's group.
  const split = splitViewKey(key);
  if (split) {
    const t = targetOf(split.base, asset);
    if (split.view === 'group') return { kind: 'group' };
    return t.kind === 'material' || t.kind === 'sky-material' || t.kind === 'base-material'
      ? { ...t, view: split.view }
      : t;
  }
  // A sky's overlays' rows (the stage's sky's, or the sky open's).
  for (const stage of [true, false]) {
    const at = stage ? `${STAGE_SKY}/` : `${ASSET}/sky/`;
    if (!key.startsWith(at)) continue;
    const rest = key.slice(at.length);
    if (rest.startsWith('overlay/'))
      return { kind: 'group', skyOverlay: rest.slice('overlay/'.length), stage };
    if (rest.startsWith('p/')) return { kind: 'sky-part', stage, key: rest.slice(2) as PartKey };
    if (rest.startsWith('om/')) {
      const [overlay = '', ...parts] = rest.slice(3).split('/');
      const name = parts.join('/');
      return { kind: 'sky-material', stage, name, key: materialKey(name, overlay), overlay };
    }
  }
  if (key === STAGE_BACKDROP) return { kind: 'backdrop' };
  if (key === REFERENCE_KEY) return { kind: 'reference' };
  if (key === STAGE_STAND_IN) return { kind: 'stand-in' };
  if (key.startsWith(`${STAGE_STAND_IN}/l/`))
    return { kind: 'stand-in-light', id: key.slice(STAGE_STAND_IN.length + 3) as LightId };
  if (key.startsWith(`${STAGE_SKY}/m/`)) {
    const name = key.slice(STAGE_SKY.length + 3);
    return { kind: 'sky-material', stage: true, name, key: name };
  }
  if (key === ASSET)
    switch (asset.kind) {
      case 'planet':
      case 'style':
        return { kind: 'body' };
      case 'material':
        return { kind: 'base-material' };
      case 'particle':
        return { kind: 'particle' };
      case 'sky':
        return { kind: 'sky', stage: false };
    }
  if (key.startsWith(`${ASSET}/p/`))
    return { kind: 'part', key: key.slice(ASSET.length + 3) as PartKey };
  if (key.startsWith(`${ASSET}/l/`))
    return { kind: 'light', id: key.slice(ASSET.length + 3) as LightId };
  if (key.startsWith(`${ASSET}/m/`)) {
    const name = key.slice(ASSET.length + 3);
    // An overlay open: its own materials are kept as the overlay's (see `materialKey`).
    if (asset.kind === 'style') return { kind: 'material', name, key: materialKey(name, asset.id) };
    return asset.kind === 'planet'
      ? { kind: 'material', name, key: name }
      : { kind: 'sky-material', stage: false, name, key: name };
  }
  if (key.startsWith(`${ASSET}/om/`)) {
    const [overlay = '', ...parts] = key.slice(ASSET.length + 4).split('/');
    const name = parts.join('/');
    return { kind: 'material', name, key: materialKey(name, overlay), overlay };
  }
  if (key.startsWith(`${ASSET}/overlay/`))
    return { kind: 'group', overlay: key.slice(ASSET.length + 9) };
  return { kind: 'group' };
}

/** The library's list a planet or style is kept in. */
const libraryKind = (kind: AssetKind): LibraryKind | null =>
  kind === 'planet' ? 'planets' : kind === 'style' ? 'styles' : null;

interface AssetEditorState {
  readonly asset: AssetTarget;
  /** The selected row's key. */
  readonly selected: string;
  /** The planet on the stage: the last opened (a style, a material, the sky are shown on it). */
  readonly previewPlanet: string;
  /** A material opened from a planet or overlay: shown on the stand-in instead of on that. */
  readonly onStandIn: boolean;
}

/**
 * The asset editor's store (component store, provided by the asset editor as its `Editor` and its
 * background's scene): one of the library's assets, as the URL opens it (a planet or style with
 * its materials as it sets them for itself; a material's base settings, wherever it is used; a
 * particle system's material; the sky with its materials), in the draft
 * ({@link DraftDesignStore}), over the game data; and the preview stage around it, a scene of its
 * own ({@link PREVIEW_SCENE}) with its own sky, only there to see the asset while it is edited.
 */
export const AssetEditorStore = signalStore(
  withState<AssetEditorState>({
    asset: { kind: 'planet', id: DEFAULT_PREVIEW_PLANET },
    selected: ASSET,
    previewPlanet: DEFAULT_PREVIEW_PLANET,
    onStandIn: false,
  }),
  withFolding([STAGE, ASSET]),
  withLocalStorage<AssetEditorState & { expanded: readonly string[] }>(
    'hrs.background-asset-editor',
    ['previewPlanet', 'expanded'],
  ),
  withProps(() => ({
    _draft: inject(DraftDesignStore),
    _ui: inject(EditorUiStore),
    _catalog: inject(AssetCatalogStore),
    _aids: inject(EditingAidsStore),
    _sceneFile: resource({
      loader: ({ abortSignal }) => loadPlaySceneFile(PLAY_SCENE_URL, abortSignal),
    }),
  })),
  withProps(({ asset, previewPlanet, _draft, _catalog, _sceneFile }) => {
    const library = _draft.library;
    const stageScene = computed(() => _draft.scenes().planets[PREVIEW_SCENE] ?? {});
    /** A sky (the stage's, or the library's): what is under it, and what is set. */
    const skyOf = (stage: boolean): { below: SkyChoices | undefined; edited: SkyChoices } =>
      stage
        ? { below: library().sky, edited: stageScene().sky ?? {} }
        : { below: undefined, edited: library().sky };
    /**
     * Where the material open is shown from: the planet or overlay it was opened from, else the
     * planet on the stage where it is that planet's, else its first use.
     */
    const materialUse = computed((): MaterialUse | undefined => {
      const a = asset();
      if (a.kind !== 'material') return undefined;
      const uses = _catalog.materialByName().get(a.id)?.uses ?? [];
      const on = a.on;
      return (
        (on && uses.find((u) => u.kind === on.kind && u.id === on.id)) ||
        uses.find((u) => u.kind === 'planet' && u.id === previewPlanet()) ||
        uses[0]
      );
    });
    const sceneFile = computed(() => (_sceneFile.hasValue() ? _sceneFile.value() : null));
    /** The overlays a sky wears (the stage's, or the library's), switched on or off, as an editor has them. */
    const skyOverlays = (stage: boolean): SkyOverlayInfo[] => {
      const scene = sceneFile();
      const worn = skyWornOf(stage ? stageScene().sky : undefined, library(), scene?.wears);
      return skyOverlayInfos(scene, library(), worn, _catalog.madeLookup());
    };
    /** The overlay open, where it is a sky's: its file, the data's or made in the editor. */
    const skyOverlay = computed((): SkyOverlayInfo | null => {
      const a = asset();
      if (a.kind !== 'style') return null;
      const made = library().created?.[a.id];
      const data = sceneFile()?.overlays?.[a.id];
      if (made?.kind !== 'sky' && !data) return null;
      const [info] = skyOverlayInfos(sceneFile(), library(), [a.id], _catalog.madeLookup());
      return info ? { ...info, below: undefined } : null;
    });
    /** The parts added onto a sky (the library's; the stage's over them). */
    const skyAdded = (stage: boolean) =>
      mergeAddedParts(library().sky.addedParts, stage ? stageScene().sky?.addedParts : undefined);
    /** A sky's own parts (added onto it), as its overlays are had; none: none. */
    const skyOwn = (stage: boolean): SkyOverlayInfo[] =>
      skyAdded(stage).length
        ? [ownSkyInfo(createdSkyFile(addedSourced(skyAdded(stage)), _catalog.madeLookup()))]
        : [];
    return {
      /** The overlay open, where it is one made in the editor. */
      _created: computed(() => {
        const a = asset();
        return a.kind === 'style' ? library().created?.[a.id] : undefined;
      }),
      _skyOverlay: skyOverlay,
      _stageScene: stageScene,
      _skyOf: skyOf,
      _materialUse: materialUse,
      _skyOverlays: skyOverlays,
      /** A sky's materials as shown (its overlays' too). */
      _skyMaterials: (stage: boolean): MaterialEntry[] => {
        const scene = sceneFile();
        const { below, edited } = skyOf(stage);
        return scene
          ? skyMaterialsOf(scene, below, edited, library().materials, [
              ...skyOwn(stage),
              ...skyOverlays(stage),
            ])
          : [];
      },
      /** A sky's own parts (added onto it) and its overlays' parts, as shown. */
      _skyParts: (stage: boolean): PartEntry[] => {
        const { below, edited } = skyOf(stage);
        const here = (edited.addedParts ?? []).map((p) => p.id);
        return [...skyOwn(stage), ...skyOverlays(stage)].flatMap((o) =>
          skyPartsOf(o, below?.parts, edited.parts, false, here),
        );
      },
      /** The sky overlay open's materials, as it sets them for itself. */
      _skyOverlayMaterials: computed((): MaterialEntry[] => {
        const o = skyOverlay();
        const scene = sceneFile();
        if (!o || !scene) return [];
        const edited = { materials: library().styles[o.id]?.materials };
        return skyMaterialsOf(scene, undefined, edited, library().materials, [o]).filter(
          (m) => m.overlay === o.id,
        );
      }),
      /** The sky overlay open's parts, as it sets them for itself. */
      _skyOverlayParts: computed((): PartEntry[] => {
        const o = skyOverlay();
        return o ? skyPartsOf(o, undefined, library().styles[o.id]?.parts, true) : [];
      }),
      /**
       * The planet or style open, as the editor has it: its defaults over its file's tuning; a
       * planet in the style it wears of its own, whose settings it sets as it wears it.
       */
      _body: computed((): BodyInfo | null => {
        const a = asset();
        const kind = libraryKind(a.kind);
        if (!kind) return null;
        const files = _catalog.files();
        // A sky's overlay open: a body with no parts of its own (its parts are the sky's).
        const file = skyOverlay()
          ? { kind: 'style' as const, parts: [], materials: {}, textures: {} }
          : a.kind === 'planet'
            ? files[a.id] &&
              withAddedParts(
                files[a.id],
                library().planets[a.id]?.addedParts,
                _catalog.madeLookup(),
              )
            : files[overlayFileFor(library(), a.id)];
        // A planet wears what its data says (overlays are worn in scenes); an overlay, none.
        const worn = a.kind === 'planet' ? ownOverlays(file?.tuning?.style) : [];
        const name = (id: string) => library().created?.[id]?.label;
        const made = name(a.id) ?? skyOverlay()?.name;
        return {
          key: ASSET,
          id: a.id,
          ...(made ? { name: made } : {}),
          overlays: worn.map((id) => ({
            id,
            ...(name(id) ? { name: name(id) } : {}),
            below: library().styles[id],
            file: files[overlayFileFor(library(), id)],
          })),
          overlaysSet: false,
          settings: library()[kind][a.id] ?? {},
          materialBase: library().materials,
          file,
          moons: [],
        };
      }),
    };
  }),
  withProps(({ _body, _skyOverlay, _skyOverlayMaterials, _skyOverlayParts, _sceneFile }) => ({
    /** The planet's or overlay's open materials (a sky overlay's: its own), as it sets them for itself. */
    _ownMaterials: computed((): MaterialEntry[] => {
      if (_skyOverlay()) return _skyOverlayMaterials();
      const b = _body();
      // Its layers may read the sky's textures too (always loaded).
      const sky = _sceneFile.hasValue() ? _sceneFile.value().textures : {};
      return b ? materialsOf(b, sky) : [];
    }),
    /** The planet's or overlay's open parts (a sky overlay's: about the eye), as it sets them for itself. */
    _ownParts: computed((): PartEntry[] => {
      if (_skyOverlay()) return _skyOverlayParts();
      const b = _body();
      return b ? partsOfBody(b) : [];
    }),
  })),
  withComputed(
    ({
      asset,
      selected,
      previewPlanet,
      onStandIn,
      _draft,
      _skyOf,
      _skyMaterials,
      _body,
      _ownMaterials,
      _ownParts,
      _skyOverlay,
      _skyParts,
      _materialUse,
      _created,
      _aids,
      _catalog,
      _sceneFile,
      _ui,
    }) => {
      const library = _draft.library;
      const target = computed(() => targetOf(selected(), asset()));
      const selectedSky = computed(() => {
        const t = target();
        // The backdrop, where it is the sky, is the stage's sky.
        if (t.kind === 'backdrop') return _skyOf(true);
        return t.kind === 'sky' || t.kind === 'sky-material' ? _skyOf(t.stage) : null;
      });
      return {
        target,
        opened: computed((): OpenTarget => asset()),
        heading: computed(() => {
          const a = asset();
          if (a.on) {
            const on =
              a.on.kind === 'planet'
                ? (library().planets[a.on.id]?.label ?? a.on.id)
                : overlayName(library(), a.on.id);
            const material = _catalog.materialByName().get(a.id)?.label ?? a.id;
            return `${on} › ${material}`;
          }
          // One made in the editor by its name (its id says nothing).
          const named =
            a.kind === 'sky'
              ? 'Play screen'
              : _created() || _skyOverlay()
                ? (library().styles[a.id]?.label ??
                  _skyOverlay()?.name ??
                  overlayName(library(), a.id))
                : a.id;
          return `${KIND_TITLES[a.kind]} · ${named}`;
        }),
        sharedMaterial: computed((): AssetTarget | null => {
          const t = target();
          const a = asset();
          const b = _body();
          if (t.kind !== 'material' || !b || (a.kind !== 'planet' && a.kind !== 'style'))
            return null;
          const m = materialAt(_ownMaterials(), t.key);
          if (!m) return null;
          return {
            kind: 'material',
            id: t.name,
            on: m.overlay ? { kind: 'style', id: m.overlay } : { kind: a.kind, id: a.id },
          };
        }),
        /** What the asset open was opened from (a material's planet or overlay): its way back. */
        parent: computed((): { target: OpenTarget; label: string } | null => {
          const on = asset().on;
          if (!on) return null;
          const label =
            on.kind === 'planet'
              ? (library().planets[on.id]?.label ?? on.id)
              : overlayName(library(), on.id);
          return { target: { kind: on.kind, id: on.id }, label };
        }),
        deletable: computed(() => _created() !== undefined),
        // An asset is shown on the stage, through the game's camera.
        camera: computed((): SceneCamera | null => null),
        lookOptions: computed((): readonly { readonly id: string; readonly label: string }[] => []),
        look: computed(() => ''),
        editorCameraMoved: computed(() => false),
        markers: computed((): readonly SceneMarker[] => []),
        skyOverlayOpen: computed(() => _skyOverlay() !== null),
        resetAllLabel: computed(() => {
          const a = asset();
          return `Reset ${a.kind === 'sky' ? 'the sky' : a.id}`;
        }),
        kind: computed((): TargetKind => {
          const t = target();
          if ('view' in t && t.view) return t.view.kind;
          const k = t.kind;
          if (k === 'sky-part') return 'part';
          return k === 'base-material' ? 'material' : k === 'stand-in-light' ? 'light' : k;
        }),
        materialView: computed((): MaterialView | null => {
          const t = target();
          return 'view' in t && t.view ? t.view : null;
        }),
        bodyView: computed(() => {
          const b = _body();
          return target().kind === 'body' && b ? bodyView(b, false, false) : null;
        }),
        baseMaterial: computed((): MaterialEntry | undefined => {
          const use = _materialUse();
          return use
            ? baseMaterialOf(
                asset().id,
                use.material,
                use.textures,
                use.pattern,
                use.tuning,
                library().materials,
                use.particles,
                use.role,
                use.depth,
              )
            : undefined;
        }),
        title: computed(() => {
          const t = target();
          const a = asset();
          if ('view' in t && t.view) {
            const b = _body();
            const m =
              t.kind === 'sky-material'
                ? materialAt(_skyMaterials(t.stage), t.key)
                : t.kind === 'material'
                  ? b && materialAt(_ownMaterials(), t.key)
                  : undefined;
            return viewTitle(t.view, m ?? undefined);
          }
          if (t.kind === 'sky') return t.stage ? 'Stage sky' : 'Sky';
          if (t.kind === 'sky-part')
            return _skyParts(t.stage).find((p) => p.key === t.key)?.label ?? 'Part';
          if (t.kind === 'backdrop') return 'Backdrop';
          if (t.kind === 'stand-in') return 'Stand-in planet';
          if (t.kind === 'stand-in-light')
            return (
              standInLights(_aids.standInLights()).find((x) => x.light.id === t.id)?.light.name ??
              'Properties'
            );
          if (t.kind === 'reference') return 'Reference';
          if (t.kind === 'sky-material')
            return materialAt(_skyMaterials(t.stage), t.key)?.label ?? t.name;
          if (t.kind === 'material') {
            const b = _body();
            return (b && materialAt(_ownMaterials(), t.key)?.label) ?? t.name;
          }
          if (t.kind === 'light') {
            const b = _body();
            return (
              (b && lightsOfBody(b).find((x) => x.light.id === t.id)?.light.name) ?? 'Properties'
            );
          }
          if (t.kind === 'part') {
            const p = _ownParts().find((x) => x.key === t.key);
            return p ? (p.overlayName ? `${p.label} · ${p.overlayName}` : p.label) : 'Part';
          }
          if (t.kind === 'base-material') return _catalog.materialByName().get(a.id)?.label ?? a.id;
          if (t.kind === 'group') return 'Properties';
          const b = _body();
          return b ? bodyLabel(b) : a.id;
        }),
        skyTint: computed((): MaterialTint => {
          const sky = selectedSky();
          return sky?.edited.tint ?? sky?.below?.tint ?? NO_MATERIAL_TINT;
        }),
        skyTintSet: computed(() => selectedSky()?.edited.tint),
        skyChanged: computed(() => {
          const sky = selectedSky();
          return !!sky && (!!sky.edited.materials || !!sky.edited.tint);
        }),
        overlayOptions: computed((): readonly PickChoice[] => []),
        sets: computed(() => false),
        /**
         * The stage: a planet itself; a style worn by the stand-in planet; a material on the
         * stand-in, drawn as on what uses it (or on that, where asked); the sky with no planet.
         */
        stagePlanets: computed((): SetPlanet[] => {
          const a = asset();
          const use = _materialUse();
          const files = _catalog.files();
          const scene = _sceneFile.hasValue() ? _sceneFile.value() : null;
          /** The stage's place, the asset as big as fits the view with its shells and halo. */
          const fitted = (planet?: string, overlays: readonly string[] = []) => {
            const root = { position: PREVIEW_POSITION, radius: PREVIEW_RADIUS };
            if (!scene) return root;
            const up = Math.tan((scene.camera.fovY * Math.PI) / 360);
            const lib = _draft.library();
            const extent = visualExtent(
              planet ? files[planet] : undefined,
              overlays.map((id) => ({ id, file: files[overlayFileFor(lib, id)] })),
              mergePartSettings(
                planet ? lib.planets[planet]?.parts : undefined,
                ...overlays.map((id) => lib.styles[id]?.parts),
              ),
              planet ? lib.planets[planet]?.glowMargin : undefined,
            );
            const view = { up, across: up * _ui.aspect() };
            return {
              ...root,
              radius: fitRadius(root, [], scene.camera.eye, view, new Map(), () => extent),
            };
          };
          if (a.kind === 'sky' || _skyOverlay()) return []; // the sky alone (with its overlay)
          /** The stand-in planet, a material drawn over it from where it is used (`owner`), if any. */
          const standIn = (owner?: string): SetPlanet => {
            const fill = _aids.standIn();
            const id = standInId({
              fill,
              cells: GRID_CELLS[_aids.gridSize()],
              owner,
              material: owner ? a.id : undefined,
            });
            const tint = { colour: _aids.standInColour(), blend: 'multiply' as const, strength: 1 };
            return {
              id,
              ...fitted(owner),
              materials: fill === 'colour' ? { [STAND_IN_MATERIAL]: { tint } } : undefined,
              // Lit by its own lights, as set (a material preview's: evenly, unless asked).
              lights: standInLightSettings(_aids.standInLights()),
            };
          };
          /** A planet wearing what its data says. */
          const own = (id: string): SetPlanet => {
            const overlays = ownOverlays(files[id]?.tuning?.style);
            return { id, overlays, ...fitted(id, overlays) };
          };
          /** The planet on the stage wearing an overlay. */
          const wearing = (overlay: string): SetPlanet => ({
            id: previewPlanet(),
            overlays: [overlay],
            ...fitted(previewPlanet(), [overlay]),
          });
          // A material opened from a planet or overlay: on that (unless asked for the stand-in).
          if (a.kind === 'material' && a.on && !onStandIn())
            return [a.on.kind === 'planet' ? own(a.on.id) : wearing(a.on.id)];
          if (a.kind === 'material') {
            const owner =
              use?.kind === 'planet'
                ? use.id
                : use?.kind === 'style'
                  ? overlayFileFor(_draft.library(), use.id)
                  : undefined;
            return [standIn(owner)];
          }
          if (a.kind === 'planet') return [own(a.id)];
          // An overlay on the stand-in: what it adds, on a plain body.
          // A planet's overlay on the stand-in: what it adds, on a plain body (one not yet known to
          // be a planet's, nothing until it is: a sky's is the sky's).
          if (a.kind === 'style')
            return _catalog.styles().includes(a.id)
              ? [{ ...standIn(), overlays: [a.id], ...fitted(undefined, [a.id]) }]
              : [];
          if (use?.kind === 'planet') return [{ id: use.id, ...fitted(use.id) }];
          if (use?.kind === 'style') return [wearing(use.id)];
          return [{ id: previewPlanet(), ...fitted(previewPlanet()) }];
        }),
        stageTint: computed(() => _draft.scenes().settings),
        /** Which asset is on the stage (another one flown to; this one edited, faded in place). */
        stageKey: computed(() => {
          const a = asset();
          return `${a.kind}:${a.id}`;
        }),
        /**
         * The stage's backdrop in place of the sky; none (the sky) for what is part of the sky: the
         * sky open, a particle system, a material only the sky uses.
         */
        stageBackdrop: computed(() => {
          const a = asset();
          const ofSky =
            a.kind === 'sky' ||
            a.kind === 'particle' ||
            _skyOverlay() !== null ||
            (a.kind === 'material' &&
              (_catalog
                .materialByName()
                .get(a.id)
                ?.uses.every((u) => u.kind === 'sky') ??
                false));
          return ofSky ? null : _aids.rendererBackdrop();
        }),
        /** Whether the stage differs from what is published. */
        stageUnsaved: computed(() => _draft.unsavedScenes().has(PREVIEW_SCENE)),
        /** Whether the asset open differs from what is published. */
        assetUnsaved: computed(() => {
          const a = asset();
          switch (a.kind) {
            case 'planet':
              return _draft.unsavedLibraryPlanets().has(a.id);
            case 'style':
              return _draft.unsavedLibraryStyles().has(a.id);
            case 'material':
              return _draft.unsavedLibraryMaterials().has(a.id);
            case 'particle':
            case 'sky':
              return _draft.unsavedLibrarySky();
          }
        }),
      };
    },
  ),
  withComputed((store) => {
    const d = store._draft;
    const asset = store.asset;
    /** The overlay open's parts (one made in the editor), to change them by. */
    const overlayHost = (o: CreatedOverlay): PartHost => ({
      kind: o.kind,
      parts: overlayParts(o),
      taken: [],
      set: (parts) => d.changeOverlay(asset().id, (x) => withOverlayParts(x, parts)),
    });
    /** The parts added onto the planet open (in the library), to change them by. */
    const planetHost = (): PartHost | null => {
      const a = asset();
      if (a.kind !== 'planet') return null;
      return {
        kind: 'planet',
        parts: d.library().planets[a.id]?.addedParts ?? [],
        taken: (store._catalog.files()[a.id]?.parts ?? []).map(partId),
        set: (parts) =>
          parts.length
            ? d.setLibraryBody('planets', a.id, { addedParts: parts })
            : d.clearLibraryBody('planets', a.id, ['addedParts']),
      };
    };
    /** The parts added onto a sky (the stage's, or the library's), to change them by. */
    const skyHost = (stage: boolean): PartHost => ({
      kind: 'sky',
      parts: (stage ? store._stageScene().sky : d.library().sky)?.addedParts ?? [],
      taken: store
        ._skyParts(stage)
        .filter((p) => !p.overlay)
        .map((p) => p.key.slice(4)),
      set: (parts) => d.setSkyAddedParts(stage ? PREVIEW_SCENE : null, parts),
    });
    /** Where parts are added for what is selected: the overlay or planet open, or a sky. */
    const addHost = computed((): PartHost | null => {
      const t = store.target();
      const o = store._created();
      if (t.kind === 'body') return o ? overlayHost(o) : planetHost();
      return t.kind === 'sky' ? skyHost(t.stage) : null;
    });
    /** The part selected and where it is kept, where it was made at the level edited. */
    const partHost = computed((): { host: PartHost; id: string } | null => {
      const t = store.target();
      const o = store._created();
      if (t.kind === 'part' && o && t.key.startsWith(`style:${asset().id}:`))
        return { host: overlayHost(o), id: t.key.slice(`style:${asset().id}:`.length) };
      if ((t.kind !== 'part' && t.kind !== 'sky-part') || !t.key.startsWith('own:')) return null;
      const host = t.kind === 'part' ? planetHost() : skyHost(t.stage);
      const id = t.key.slice(4);
      return host?.parts.some((p) => p.id === id) ? { host, id } : null;
    });
    return {
      _addHost: addHost,
      _partHost: partHost,
      /** What has been added to what is selected: the parts made here, on the body or sky open. */
      added: computed((): AddedLists => {
        const t = store.target();
        const host = addHost();
        if (!host?.parts.length) return {};
        const o = store._created();
        const listed = (
          entries: readonly PartEntry[],
          keyOf: (id: string) => PartKey,
          rowKey: (key: PartKey) => string,
        ): AddedLists => ({
          parts: host.parts.map((p) => {
            const key = keyOf(p.id);
            const entry = entries.find((e) => e.key === key);
            return {
              key: rowKey(key),
              label: entry?.label ?? p.id,
              icon: entry ? partIcon(entry) : 'circle',
              removable: true,
            };
          }),
        });
        if (t.kind === 'body') {
          const b = store._body();
          return listed(
            b ? partsOfBody(b) : [],
            (id) => (o ? `style:${asset().id}:${id}` : `own:${id}`) as PartKey,
            assetPartKey,
          );
        }
        if (t.kind === 'sky')
          return listed(
            store._skyParts(t.stage),
            (id) => `own:${id}` as PartKey,
            (key) => `${t.stage ? STAGE_SKY : `${ASSET}/sky`}/p/${key}`,
          );
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
      // An overlay is saved from what is added onto a planet or a sky (not from an overlay).
      canSaveAsOverlay: computed(() => !store._created() && (addHost()?.parts.length ?? 0) > 0),
    };
  }),
  withComputed((store) => ({
    partMaterials: computed(() => {
      const at = store._partHost();
      const part = at?.host.parts.find((p) => p.id === at.id);
      return part ? { picked: part.materials, choices: store._catalog.materialChoices() } : null;
    }),
    litBy: computed((): readonly LitByEntry[] | null => {
      const b = store._body();
      const receiver = receiverOf(store.target());
      // A sky's overlay is drawn as the sky is: no light lights it.
      if (store._skyOverlay()) return null;
      return b && filesLoaded(b) && receiver !== undefined ? litByOf(b, receiver) : null;
    }),
    light: computed((): LightEntry | undefined => {
      const t = store.target();
      if (t.kind === 'stand-in-light')
        return standInLights(store._aids.standInLights()).find((l) => l.light.id === t.id);
      const b = store._body();
      return t.kind === 'light' && b ? lightsOfBody(b).find((l) => l.light.id === t.id) : undefined;
    }),
    part: computed((): PartEntry | undefined => {
      const t = store.target();
      if (t.kind === 'sky-part') return store._skyParts(t.stage).find((p) => p.key === t.key);
      return t.kind === 'part' ? store._ownParts().find((p) => p.key === t.key) : undefined;
    }),
    material: computed((): MaterialEntry | undefined => {
      const t = store.target();
      if (t.kind === 'base-material') return store.baseMaterial();
      if (t.kind === 'sky-material') return materialAt(store._skyMaterials(t.stage), t.key);
      return t.kind === 'material' ? materialAt(store._ownMaterials(), t.key) : undefined;
    }),
    /** The stage's sky: its own, but for the sky open (shown as the library has it). */
    stageSky: computed((): SkyChoices => {
      if (store.asset().kind === 'sky') return {};
      const sky = store._stageScene().sky ?? {};
      // A sky's overlay open: worn by the stage's sky (over what it wears), drawn.
      const o = store._skyOverlay();
      if (!o) return sky;
      const worn = store._skyOverlays(true).map((x) => x.id);
      return {
        ...sky,
        overlays: worn.includes(o.id) ? worn : [...worn, o.id],
        overlaysEnabled: { ...sky.overlaysEnabled, [o.id]: true },
      };
    }),
    /** The overlays the sky selected wears (the stage's, or the library's), in order. */
    skyWorn: computed((): readonly string[] => {
      const t = store.target();
      const stage =
        t.kind === 'backdrop' || ((t.kind === 'sky' || t.kind === 'sky-material') && t.stage);
      return store._skyOverlays(stage).map((o) => o.id);
    }),
    /** Whether what the sky selected wears is chosen at the level it is edited at. */
    skyOverlaysSet: computed(() => {
      const t = store.target();
      const stage =
        t.kind === 'backdrop' || ((t.kind === 'sky' || t.kind === 'sky-material') && t.stage);
      return (
        (stage ? store._stageScene().sky?.overlays : store._draft.library().sky.overlays) !==
        undefined
      );
    }),
    /** The overlays a sky may wear: the game data's, and those made in the editor; by name. */
    skyOverlayOptions: computed((): readonly PickChoice[] =>
      skyOverlayChoices(
        store._sceneFile.hasValue() ? store._sceneFile.value() : null,
        store._draft.library(),
      ),
    ),
    rows: computed((): TreeRow[] => {
      const open = store.unfolded();
      const a = store.asset();
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
      const leaf = (
        key: string,
        label: string,
        depth: number,
        enabled: boolean,
        unsaved = false,
        detail?: string,
        movable = false,
      ) =>
        rows.push({
          key,
          label,
          detail,
          icon: 'texture',
          depth,
          expandable: false,
          expanded: false,
          enabled,
          unsaved,
          movable,
        });
      /** A material's row: movable (its draw order) unless opaque, drawn first wherever it is. */
      /** A material's row (movable: its draw order, unless opaque), its layers under it (folded unless unfolded). */
      const materialRow = (
        key: string,
        m: MaterialEntry,
        depth: number,
        unsaved = false,
        movable = m.values.blend !== 'opaque',
      ) => {
        rows.push({
          key,
          label: m.label,
          detail: m.name,
          icon: 'texture',
          depth,
          expandable: m.layers.length > 0,
          expanded: open.has(key),
          enabled: m.values.enabled,
          unsaved,
          movable,
        });
        if (open.has(key)) rows.push(...layerRows(key, m, depth + 1));
      };
      /**
       * A sky's materials by where they are drawn among the scene's objects: behind, among, in front
       * (each group open unless folded: its key among those kept means folded).
       */
      /**
       * A sky's parts' rows (its own added onto it, or under the overlay they are of), their
       * materials under each (its own's by `ownMaterialKey`).
       */
      const skyPartRows = (
        parts: readonly PartEntry[],
        materials: readonly MaterialEntry[],
        partKey: (key: PartKey) => string,
        materialKey: (overlay: string, name: string) => string,
        depth: number,
        ownMaterialKey?: (name: string) => string,
      ) => {
        for (const part of parts) {
          const key = partKey(part.key);
          const drawn = materials.filter(
            (m) => m.overlay === part.overlay && part.materials.includes(m.name),
          );
          rows.push({
            key,
            label: part.label,
            icon: part.band || part.overlay ? 'panorama_horizontal' : 'category',
            depth,
            expandable: drawn.length > 0,
            expanded: !open.has(key),
            enabled: part.enabled,
          });
          if (!open.has(key))
            for (const m of drawn)
              materialRow(
                part.overlay || !ownMaterialKey
                  ? materialKey(part.overlay ?? '', m.name)
                  : ownMaterialKey(m.name),
                m,
                depth + 1,
              );
        }
      };
      /**
       * A sky's rows (the stage's, or the sky open's): its own materials by depth; then each overlay
       * it wears (open unless folded), its parts and their materials under it.
       */
      const skyRows = (
        stage: boolean,
        groupKey: (depth: string) => string,
        materialKey: (name: string) => string,
        depth: number,
      ) => {
        const materials = store._skyMaterials(stage);
        const keys = skyRowKeys(stage);
        ownSkyRows(
          materials.filter((m) => !m.overlay && !m.added),
          groupKey,
          materialKey,
          depth,
        );
        const sky = stage ? store._stageScene().sky : undefined;
        const overlays = store._skyOverlays(stage);
        const parts = store._skyParts(stage);
        // The parts added onto it (its own), each with the materials it draws.
        skyPartRows(
          parts.filter((p) => !p.overlay),
          materials,
          keys.part,
          keys.material,
          depth,
          materialKey,
        );
        for (const o of overlays) {
          const group = keys.overlay(o.id);
          rows.push({
            key: group,
            label: skyOverlayLabel(o),
            detail: 'overlay',
            icon: 'style',
            depth,
            expandable: true,
            expanded: !open.has(group),
            group: true,
            enabled: skyOverlayOn(sky, store._draft.library(), o.id),
            movable: overlays.length > 1,
          });
          if (!open.has(group))
            skyPartRows(
              parts.filter((p) => p.overlay === o.id),
              materials,
              keys.part,
              keys.material,
              depth + 1,
            );
        }
      };
      const ownSkyRows = (
        materials: readonly MaterialEntry[],
        groupKey: (depth: string) => string,
        materialKey: (name: string) => string,
        depth: number,
      ) => {
        for (const g of byDepth(materials)) {
          const group = groupKey(g.depth);
          rows.push({
            key: group,
            label: g.label,
            icon: g.icon,
            depth,
            expandable: true,
            expanded: !open.has(group),
            group: true,
          });
          if (!open.has(group))
            for (const m of g.materials) materialRow(materialKey(m.name), m, depth + 1);
        }
      };
      const sky = store._skyMaterials(false);
      // A sky's overlay open: its parts about the eye, their materials under each.
      const skyOverlay = store._skyOverlay();
      if (skyOverlay) {
        row(
          ASSET,
          skyOverlayLabel({ ...skyOverlay, below: store._draft.library().styles[skyOverlay.id] }),
          'style',
          0,
          store.assetUnsaved(),
        );
        if (open.has(ASSET))
          skyPartRows(
            store._skyOverlayParts(),
            store._skyOverlayMaterials(),
            assetPartKey,
            (_, name) => assetMaterialKey(name),
            1,
          );
      } else
        switch (a.kind) {
          case 'planet':
          case 'style': {
            const b = store._body();
            row(
              ASSET,
              b ? bodyLabel(b) : a.id,
              a.kind === 'planet' ? 'public' : 'style',
              0,
              store.assetUnsaved(),
            );
            if (!open.has(ASSET) || !b) break;
            // Its parts, each with the materials drawn on it (a part is open unless folded: its key
            // among those kept means folded); its lights; then the overlay it wears, its parts and
            // its lights under it.
            const nodes = partNodes(b, materialsOf(b));
            const lights = lightsOfBody(b);
            const parts = (list: readonly PartNode[], at: number, overlay?: string) => {
              for (const { part, materials } of list) {
                const key = assetPartKey(part.key);
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
                      overlay ? assetOverlayMaterialKey(overlay, name) : assetMaterialKey(name),
                    materialRow,
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
                    key: assetLightKey(light.id),
                    label: light.name,
                    icon: LIGHT_ICONS[light.kind],
                    depth: at + 1,
                    expandable: false,
                    expanded: false,
                    enabled: light.enabled,
                  });
            };
            parts(nodes.own, 1);
            lightGroup(
              ASSET_LIGHTS,
              lights.filter((l) => !l.overlay),
              1,
            );
            for (const { overlay, nodes: list } of nodes.overlays) {
              const group = assetOverlayKey(overlay.id);
              rows.push({
                key: group,
                label: overlayLabel(overlay),
                detail: 'overlay',
                icon: 'style',
                depth: 1,
                expandable: true,
                expanded: !open.has(group),
                group: true,
                enabled: overlayEnabled(b, overlay.id),
              });
              if (!open.has(group)) {
                parts(list, 2, overlay.id);
                lightGroup(
                  assetOverlayLightsKey(overlay.id),
                  lights.filter((l) => l.overlay === overlay.id),
                  2,
                );
              }
            }
            break;
          }
          case 'material': {
            const m = store.baseMaterial();
            if (m) materialRow(ASSET, m, 0, store.assetUnsaved(), false);
            else leaf(ASSET, a.id, 0, true, store.assetUnsaved(), a.id);
            break;
          }
          case 'particle': {
            const material = store._catalog.particles().find((p) => p.id === a.id)?.material;
            row(ASSET, a.id, 'grain', 0);
            const m = sky.find((s) => s.name === material);
            if (open.has(ASSET) && m) materialRow(assetMaterialKey(m.name), m, 1, false, false);
            break;
          }
          case 'sky':
            row(ASSET, 'Sky', 'blur_on', 0, store.assetUnsaved());
            if (open.has(ASSET)) skyRows(false, assetDepthKey, assetMaterialKey, 1);
            break;
        }
      // The stage, after what is edited and set apart from it: only there to see it (the sky open
      // is its own stage). Its rows are marked as aids.
      const aidsFrom = rows.length;
      if (a.kind !== 'sky') {
        row(STAGE, 'Preview stage', 'videocam', 0, store.stageUnsaved(), true);
        if (open.has(STAGE)) {
          // The backdrop: the stage's sky (its materials under it), or a colour or grid in its place.
          if (store._aids.backdrop() === 'sky') {
            row(STAGE_BACKDROP, 'Backdrop', 'wallpaper', 1);
            if (open.has(STAGE_BACKDROP)) skyRows(true, stageDepthKey, stageMaterialKey, 2);
          } else
            rows.push({
              key: STAGE_BACKDROP,
              label: 'Backdrop',
              icon: 'wallpaper',
              depth: 1,
              expandable: false,
              expanded: false,
            });
          // The stand-in only where it is shown: a material or a style opened on its own (a
          // material opened from a planet or overlay: where switched to the stand-in); its
          // lights under it (open unless folded: its key among those kept means folded).
          if (
            (a.kind === 'material' && !(a.on && !store.onStandIn())) ||
            (a.kind === 'style' && !store._skyOverlay())
          ) {
            const unfolded = !open.has(STAGE_STAND_IN);
            rows.push({
              key: STAGE_STAND_IN,
              label: 'Stand-in planet',
              icon: 'circle',
              depth: 1,
              expandable: true,
              expanded: unfolded,
            });
            if (unfolded)
              for (const { light } of standInLights(store._aids.standInLights()))
                rows.push({
                  key: standInLightKey(light.id),
                  label: light.name,
                  icon: LIGHT_ICONS[light.kind],
                  depth: 2,
                  expandable: false,
                  expanded: false,
                  enabled: light.enabled,
                });
          }
        }
      }
      rows.push(referenceRow());
      for (let i = aidsFrom; i < rows.length; i++) rows[i] = { ...rows[i]!, aid: true };
      return rows;
    }),
  })),
  withMethods((store) => {
    const d = store._draft;
    const asset = () => store.asset();
    const materialChange = (key: string, change: Partial<MaterialSettings>) => {
      const t = targetOf(key, asset());
      const kind = libraryKind(asset().kind);
      if (t.kind === 'sky-material') {
        if (t.stage) d.setSkyMaterial(PREVIEW_SCENE, t.key, change);
        else d.setLibrarySkyMaterial(t.key, change);
      } else if (t.kind === 'material' && kind)
        d.setLibraryMaterial(kind, asset().id, t.key, change);
      else if (t.kind === 'base-material') d.setLibraryBaseMaterial(asset().id, change);
    };
    /** Settings of a material put back as the levels under it have them (all: none named). */
    const materialClear = (t: Target, keys?: readonly (keyof MaterialSettings)[]) => {
      const kind = libraryKind(asset().kind);
      if (t.kind === 'sky-material') {
        if (t.stage) d.clearSkyMaterial(PREVIEW_SCENE, t.key, keys);
        else d.clearLibrarySkyMaterial(t.key, keys);
      } else if (t.kind === 'material' && kind)
        d.clearLibraryMaterial(kind, asset().id, t.key, keys);
      else if (t.kind === 'base-material') d.clearLibraryBaseMaterial(asset().id, keys);
    };
    /** Whether a material is drawn as the levels under the one edited have it. */
    const materialBelow = (t: Target): boolean => {
      if (t.kind === 'base-material') return store.baseMaterial()?.enabledBelow ?? true;
      if (t.kind === 'sky-material')
        return materialAt(store._skyMaterials(t.stage), t.key)?.enabledBelow ?? true;
      const b = store._body();
      const m = t.kind === 'material' && b && materialAt(store._ownMaterials(), t.key);
      return m ? m.enabledBelow : true;
    };
    /** A part just added onto what is selected selected, its row shown. */
    const selectAdded = (id: string) => {
      const t = store.target();
      if (t.kind === 'sky') {
        const keys = skyRowKeys(t.stage);
        if (!t.stage) store.expand(ASSET);
        patchState(store, { selected: keys.part(`own:${id}`) });
      } else {
        store.expand(ASSET);
        patchState(store, {
          selected: assetPartKey(store._created() ? `style:${asset().id}:${id}` : `own:${id}`),
        });
      }
    };
    const selectedSky = () => {
      const t = store.target();
      if (t.kind === 'backdrop') return { stage: true };
      return t.kind === 'sky' || t.kind === 'sky-material' ? t : null;
    };
    const body = () => libraryKind(asset().kind);
    /** One of the stand-in's lights changed (an editing aid's: kept with the aids). */
    const standInLightChange = (
      id: LightId,
      change: Partial<LightSettings>,
      clear: readonly (keyof LightSettings)[] | 'all' = [],
    ) =>
      store._aids.set({
        standInLights: withStandInLight(store._aids.standInLights(), id, change, clear),
      });
    /**
     * The library body's lights changed: what is left of them written back (none: taken back), and
     * its shadow as set before lights were objects taken back once it is its shadow light's.
     */
    const lightChange = (change: (s: BodySettings) => BodySettings) => {
      const kind = body();
      if (!kind) return;
      const now = d.library()[kind][asset().id] ?? {};
      const next = change(now);
      if (next.lights) d.setLibraryBody(kind, asset().id, { lights: next.lights });
      else d.clearLibraryBody(kind, asset().id, ['lights']);
      if (next.added) d.setLibraryBody(kind, asset().id, { added: next.added });
      else if (now.added) d.clearLibraryBody(kind, asset().id, ['added']);
      const gone = (['shade', 'shadeTowards'] as const).filter(
        (k) => now[k] !== undefined && next[k] === undefined,
      );
      if (gone.length) d.clearLibraryBody(kind, asset().id, gone);
    };
    return {
      /** The asset the URL opens: its own row selected; a planet opened goes on the stage. */
      showAsset: signalMethod<AssetTarget>((a) => {
        const now = store.asset();
        if (
          a.kind === now.kind &&
          a.id === now.id &&
          a.on?.kind === now.on?.kind &&
          a.on?.id === now.on?.id
        )
          return;
        patchState(store, {
          asset: a,
          selected: ASSET,
          onStandIn: false,
          ...(a.kind === 'planet' ? { previewPlanet: a.id } : {}),
        });
        store._ui.confirmReset(false);
        store.expand(ASSET);
      }),
      /** A material opened from a planet or overlay: shown on the stand-in, or on that again. */
      showOnStandIn(onStandIn: boolean): void {
        patchState(store, { onStandIn });
      },
      /** The asset on the stage clicked: its own row selected. */
      selectPlaced(): boolean {
        if (store.asset().kind === 'sky') return false;
        patchState(store, { selected: ASSET });
        return true;
      },
      /** A row selected; a group only folds. */
      select(key: string): void {
        if (targetOf(key, asset()).kind === 'group') store.toggleExpanded(key);
        else patchState(store, { selected: key });
      },
      setEnabled(change: { key: string; enabled: boolean }): void {
        const t = targetOf(change.key, asset());
        const on = change.enabled;
        const kind = body();
        if (t.kind === 'stand-in-light') standInLightChange(t.id, { enabled: on });
        // A sky's overlay, or one of its parts (the stage's sky's, or the library's).
        else if (t.kind === 'group' && t.skyOverlay) {
          const below = t.stage ? skyOverlayOn(undefined, d.library(), t.skyOverlay) : true;
          d.setSkyOverlayEnabled(t.stage ? PREVIEW_SCENE : null, t.skyOverlay, on, below);
        } else if (t.kind === 'sky-part') {
          const scope = t.stage ? PREVIEW_SCENE : null;
          const below = store._skyParts(t.stage).find((p) => p.key === t.key)?.enabledBelow ?? true;
          if (on === below) d.clearSkyPart(scope, t.key, ['enabled']);
          else d.setSkyPart(scope, t.key, { enabled: on });
        }
        // Each back to what is under it where that is the same, else set here.
        else if (t.kind === 'light') {
          const b = store._body();
          const below =
            (b && lightsOfBody(b).find((l) => l.light.id === t.id)?.enabledBelow) ?? true;
          lightChange((s) => withLightSwitched(s, t.id, on, below) ?? {});
        } else if (t.kind === 'part' && kind) {
          const now = d.library()[kind][asset().id] ?? {};
          const next = on
            ? withoutPartSetting(now, t.key, ['enabled'])
            : withPartSetting(now, t.key, { enabled: false });
          if (next?.parts) d.setLibraryBody(kind, asset().id, { parts: next.parts });
          else d.clearLibraryBody(kind, asset().id, ['parts']);
        } else if (t.kind === 'group' && t.overlay && kind) {
          const now = d.library()[kind][asset().id] ?? {};
          const next = withOverlaySwitched(now, t.overlay, on, true);
          if (next?.overlaysEnabled)
            d.setLibraryBody(kind, asset().id, { overlaysEnabled: next.overlaysEnabled });
          else d.clearLibraryBody(kind, asset().id, ['overlaysEnabled']);
          if (now.overlayEnabled !== undefined)
            d.clearLibraryBody(kind, asset().id, ['overlayEnabled']);
        } else if ('view' in t && t.view?.kind === 'effect') {
          // A shield's effect switched: as it starts, nothing set.
          const field = t.view.effect === 'reveal' ? 'revealOn' : 'activationOn';
          if (on === GRID_DEFAULTS[field]) materialClear(t, [field]);
          else materialChange(change.key, { [field]: on });
        } else if (on === materialBelow(t)) materialClear(t, ['enabled']);
        else materialChange(change.key, { enabled: on });
      },
      setLight(change: Partial<LightSettings>): void {
        const t = store.target();
        if (t.kind === 'stand-in-light') standInLightChange(t.id, change);
        else if (t.kind === 'light') lightChange((s) => withLightChange(s, t.id, change));
      },
      addLight(kind: LightKind): void {
        const b = store._body();
        if (!b) return;
        const light = newLight(
          kind,
          lightsOfBody(b)
            .map((l) => l.light)
            .filter((l) => l.id.startsWith('added-')),
        );
        lightChange((s) => withAddedLight(s, light));
        store.expand(ASSET, ASSET_LIGHTS);
        patchState(store, { selected: assetLightKey(light.id) });
      },
      /** One of the lights in the selected body's Lit by selected in the tree, its rows unfolded to it. */
      showLight(id: LightId): void {
        const light = store.litBy()?.find((l) => l.id === id);
        if (!light) return;
        store.expand(ASSET);
        if (light.overlay) {
          store.reopen(assetOverlayKey(light.overlay));
          store.expand(assetOverlayLightsKey(light.overlay));
        } else store.expand(ASSET_LIGHTS);
        patchState(store, { selected: assetLightKey(id) });
      },
      setLitBy(change: { readonly id: LightId; readonly on: boolean }): void {
        const b = store._body();
        const receiver = receiverOf(store.target());
        const light = store.litBy()?.find((l) => l.id === change.id);
        if (b && light && receiver !== undefined)
          lightChange((s) => withLitBy(s, b, light, receiver, change.on) ?? {});
      },
      removeLight(id?: LightId): void {
        if (id) {
          lightChange((s) => withoutAddedLight(s, id) ?? {});
          return;
        }
        const t = store.target();
        if (t.kind !== 'light') return;
        lightChange((s) => withoutAddedLight(s, t.id) ?? {});
        patchState(store, { selected: ASSET });
      },
      clearLight(keys?: readonly (keyof LightSettings)[]): void {
        const t = store.target();
        if (t.kind === 'stand-in-light') standInLightChange(t.id, {}, keys ?? 'all');
        else if (t.kind === 'light') lightChange((s) => withoutLightSetting(s, t.id, keys) ?? {});
      },
      moveMaterial(move: TreeMove): void {
        const from = targetOf(move.key, asset());
        const to = targetOf(move.target, asset());
        // An overlay moved among those a sky wears: worn in that order.
        if (
          from.kind === 'group' &&
          to.kind === 'group' &&
          from.skyOverlay &&
          to.skyOverlay &&
          !!from.stage === !!to.stage
        ) {
          const worn = store._skyOverlays(!!from.stage).map((o) => o.id);
          d.setSkyOverlays(
            from.stage ? PREVIEW_SCENE : null,
            reordered(worn, worn, from.skyOverlay, to.skyOverlay, move.after),
          );
          return;
        }
        if (from.kind === 'sky-material' && to.kind === 'sky-material' && from.stage === to.stage) {
          const all = store._skyMaterials(to.stage);
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
          if (moving.values.depth !== depth) materialChange(move.key, { depth });
          if (to.stage) d.setSkyOrder(PREVIEW_SCENE, order);
          else d.setLibrarySkyOrder(order);
        } else if (from.kind === 'material' && to.kind === 'material') {
          const kind = body();
          if (!kind) return;
          const all = store._ownMaterials();
          // Within the part they are drawn on (a material isn't moved to another part).
          const part = store
            ._ownParts()
            .find((p) => all.some((m) => m.key === to.key && p.materials.includes(m.name)));
          const group = all
            .filter((m) => part?.materials.includes(m.name) && m.overlay === part.overlay)
            .map((m) => m.key);
          if (!group.includes(from.key)) return;
          const order = reordered(
            all.map((m) => m.key),
            group,
            from.key,
            to.key,
            move.after,
          );
          d.setLibraryBody(kind, asset().id, { order });
        }
      },
      setMaterial(change: Partial<MaterialSettings>): void {
        materialChange(store.selected(), change);
      },
      clearMaterial(keys?: readonly (keyof MaterialSettings)[]): void {
        materialClear(store.target(), keys);
      },
      setBody(change: Partial<BodySettings>): void {
        const kind = body();
        if (kind) d.setLibraryBody(kind, asset().id, change);
      },
      clearBody(keys: readonly (keyof BodySettings)[]): void {
        const kind = body();
        if (kind) d.clearLibraryBody(kind, asset().id, keys);
      },
      setPart(change: Partial<PartSettings>): void {
        const kind = body();
        const t = store.target();
        if (t.kind === 'sky-part') {
          d.setSkyPart(t.stage ? PREVIEW_SCENE : null, t.key, change);
          return;
        }
        if (!kind || t.kind !== 'part') return;
        const now = d.library()[kind][asset().id] ?? {};
        d.setLibraryBody(kind, asset().id, { parts: withPartSetting(now, t.key, change).parts });
      },
      clearPart(keys?: readonly (keyof PartSettings)[]): void {
        const kind = body();
        const t = store.target();
        if (t.kind === 'sky-part') {
          d.clearSkyPart(t.stage ? PREVIEW_SCENE : null, t.key, keys);
          return;
        }
        if (!kind || t.kind !== 'part') return;
        const left = withoutPartSetting(d.library()[kind][asset().id] ?? {}, t.key, keys)?.parts;
        if (left) d.setLibraryBody(kind, asset().id, { parts: left });
        else d.clearLibraryBody(kind, asset().id, ['parts']);
      },
      resetBody(): void {
        const kind = body();
        if (kind) d.resetLibraryBody(kind, asset().id);
      },
      /** A new part of a shape added onto what is selected (the overlay or planet open, a sky): selected. */
      addPart(shape: CreatedShape): void {
        const host = store._addHost();
        if (host) selectAdded(addShape(host, shape));
      },
      /** One of the game data's parts added onto what is selected, reused: selected. */
      reusePart(value: string): void {
        const host = store._addHost();
        const reused = host && store._catalog.reusableParts()[host.kind][Number(value)];
        if (host && reused) selectAdded(addReused(host, reused));
      },
      /** The selected part taken out (one made at this level: what only it drew, with it). */
      removePart(): void {
        const at = store._partHost();
        const t = store.target();
        if (!at) return;
        removePart(at.host, at.id);
        patchState(store, {
          selected: t.kind === 'sky-part' ? (t.stage ? STAGE_SKY : ASSET) : ASSET,
        });
      },
      /**
       * A material drawn on the selected part too, over the rest: as the game data has it where it
       * is first used there (kept by where that is, not copied).
       */
      addPartMaterial(name: string): void {
        const at = store._partHost();
        const source = store._catalog.materialSource()(name);
        if (at && source) addMaterial(at.host, at.id, name, source);
      },
      /** A material no longer drawn on the selected part. */
      removePartMaterial(name: string): void {
        const at = store._partHost();
        if (at) removeMaterial(at.host, at.id, name);
      },
      /**
       * The parts added onto the planet or sky selected saved as a new overlay: a sky wears it in
       * their place (what was set for them kept as the overlay's); a planet keeps them (a library
       * planet wears what its data says), the overlay starting as they are set.
       */
      saveAsOverlay(): void {
        const host = store._addHost();
        const t = store.target();
        if (!host?.parts.length || store._created()) return;
        const parts = host.parts;
        const id = d.createOverlay(host.kind, parts);
        const kept = (s: BodySettings) => settingsAsOverlay({ ...s, addedParts: parts }, id, parts);
        if (t.kind === 'sky') {
          const scene = t.stage ? PREVIEW_SCENE : null;
          d.changeSky(scene, (sky) => settingsAsOverlay(sky, id, parts));
          d.setSkyOverlays(scene, [...store._skyOverlays(t.stage).map((o) => o.id), id]);
        } else {
          // The overlay's own settings start as the planet's for those parts.
          const own = kept(d.library().planets[asset().id] ?? {});
          const settings = without(own, ['label', 'enabled', 'lights', 'added', 'tint', 'rim']);
          if (settings) d.setLibraryBody('styles', id, settings);
        }
        store._ui.open({ kind: 'style', id });
      },
      moveCamera(): void {
        // the stage keeps the game's camera
      },
      lookThrough(): void {
        // the stage has one camera
      },
      resetEditorCamera(): void {
        // the stage keeps the game's camera
      },
      showMarker(): void {
        // nothing on the stage is marked
      },
      /** A part made here selected in the tree. */
      showAdded(key: string): void {
        store.expand(ASSET);
        patchState(store, { selected: key });
      },
      /** A part made here taken out (by the id its row's key ends with). */
      removeAdded(key: string): void {
        const host = store._addHost();
        if (host) removePart(host, key.slice(key.lastIndexOf(':') + 1));
      },
      /** The overlay open (made in the editor) deleted, and off whatever wore it: the library shown. */
      deleteAsset(): void {
        if (!store._created()) return;
        d.deleteOverlay(asset().id);
        store._ui.show({ kind: 'planet', id: store.previewPlanet() });
      },
      showOverlay(): void {
        // what is open wears no overlays of the library's own (its own are its tree)
      },
      /** An overlay the sky selected wears shown in the tree, its rows unfolded. */
      showSkyOverlay(id: string): void {
        const sky = selectedSky();
        if (!sky) return;
        const at = sky.stage ? STAGE_SKY : `${ASSET}/sky`;
        store.expand(sky.stage ? STAGE : ASSET, at);
        store.reopen(`${at}/overlay/${id}`);
      },
      /** An overlay put on the sky selected (the stage's, or the library's), over what it wears. */
      addSkyOverlay(id: string): void {
        const sky = selectedSky();
        if (!sky) return;
        const worn = store._skyOverlays(sky.stage).map((o) => o.id);
        if (!worn.includes(id)) d.setSkyOverlays(sky.stage ? PREVIEW_SCENE : null, [...worn, id]);
      },
      /** An overlay taken off the sky selected. */
      removeSkyOverlay(id: string): void {
        const sky = selectedSky();
        if (!sky) return;
        const worn = store._skyOverlays(sky.stage).map((o) => o.id);
        d.setSkyOverlays(
          sky.stage ? PREVIEW_SCENE : null,
          worn.filter((w) => w !== id),
        );
      },
      /** What the sky selected wears back as what is under it (the library's, the data's). */
      resetSkyOverlays(): void {
        const sky = selectedSky();
        if (sky) d.setSkyOverlays(sky.stage ? PREVIEW_SCENE : null, undefined);
      },
      addOverlay(): void {
        // a library asset wears no overlays of its own choosing: overlays are worn in scenes
      },
      removeOverlay(): void {
        // as above
      },
      resetOverlays(): void {
        // as above
      },
      setSkyTint(tint: MaterialTint): void {
        const s = selectedSky();
        if (!s) return;
        if (s.stage) d.setSkyTint(PREVIEW_SCENE, tint);
        else d.setLibrarySkyTint(tint);
      },
      clearSkyTint(): void {
        const s = selectedSky();
        if (!s) return;
        if (s.stage) d.clearSkyTint(PREVIEW_SCENE);
        else d.clearLibrarySkyTint();
      },
      resetSky(): void {
        const s = selectedSky();
        if (!s) return;
        if (s.stage) d.resetSky(PREVIEW_SCENE);
        else d.resetLibrarySky();
      },
      /** The asset open back as the game data has it (the stage keeps its sky). */
      resetAll(): void {
        const a = asset();
        const kind = body();
        if (kind) d.resetLibraryBody(kind, a.id);
        else if (a.kind === 'material') d.clearLibraryBaseMaterial(a.id);
        else if (a.kind === 'sky') d.resetLibrarySky();
        else {
          const material = store._catalog.particles().find((p) => p.id === a.id)?.material;
          if (material) d.clearLibrarySkyMaterial(material);
        }
        store._ui.confirmReset(false);
      },
      anotherSet(): void {
        // a scene's: an asset has no random sets, orbits or moons
      },
      setOrbit(): void {
        // a scene's: an asset has no random sets, orbits or moons
      },
      addMoon(): void {
        // a scene's: an asset has no random sets, orbits or moons
      },
      removeMoon(): void {
        // a scene's: an asset has no random sets, orbits or moons
      },
      toggleFocus(): void {
        // a scene's: an asset has no random sets, orbits or moons
      },
    };
  }),
);
