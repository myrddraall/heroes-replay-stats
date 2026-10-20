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
import { PREVIEW_SCENE } from '../../../scenes/play-background/background-design';
import { fitRadius } from '../../../scenes/play-background/background-scene';
import { GRID_DEFAULTS, NO_MATERIAL_TINT } from '../../../scenes/play-background/material-settings';
import {
  visualExtent,
  withAddedLight,
  withLightChange,
  withLightSwitched,
  withoutAddedLight,
  withoutLightSetting,
  withoutPartSetting,
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
import { loadPlaySceneFile, PLAY_SCENE_URL } from '../../../scenes/play-background/play-scene';
import {
  type MaterialSettings,
  type MaterialTint,
  mergePartSettings,
  type PartKey,
  type PartSettings,
  reordered,
  type SkySettings,
} from '../../../scenes/play-background/scene-planets';
import { DraftDesignStore, type LibraryKind } from '../draft-design.store';
import { grouped, type PropertyOption } from '../properties/property-select';
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
  styleLabel,
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
  type TargetKind,
} from './editor-model';
import { EditingAidsStore, GRID_CELLS, REFERENCE_KEY } from './editing-aids.store';
import { EditorUiStore } from './editor-ui.store';
import type { AssetKind, AssetTarget, OpenTarget } from './open-target';
import type { TreeMove, TreeRow } from './scene-tree';
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
/** The overlay a planet wears: its parts and its lights, under it. */
const ASSET_OVERLAY = 'asset/overlay';
const ASSET_OVERLAY_LIGHTS = 'asset/overlay-lights';
const stageMaterialKey = (name: string) => `${STAGE_SKY}/m/${name}`;
/** A sky's materials at a depth (background, midground, foreground), a group of their own: the sky open's, the stage's. */
const assetDepthKey = (depth: string) => `${ASSET}/depth/${depth}`;
const stageDepthKey = (depth: string) => `${STAGE_BACKDROP}/depth/${depth}`;
const assetMaterialKey = (name: string) => `${ASSET}/m/${name}`;
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
  | { readonly kind: 'group' }
  /** The stage's sky, or the library's (the sky open). */
  | { readonly kind: 'sky'; readonly stage: boolean }
  | {
      readonly kind: 'sky-material';
      readonly stage: boolean;
      readonly name: string;
      readonly view?: MaterialView;
    }
  /** The planet or style open. */
  | { readonly kind: 'body' }
  /** A material as the planet or style open sets it for itself. */
  | { readonly kind: 'material'; readonly name: string; readonly view?: MaterialView }
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
  if (t.kind === 'material') return `material:${t.name}`;
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
  if (key === STAGE_BACKDROP) return { kind: 'backdrop' };
  if (key === REFERENCE_KEY) return { kind: 'reference' };
  if (key === STAGE_STAND_IN) return { kind: 'stand-in' };
  if (key.startsWith(`${STAGE_STAND_IN}/l/`))
    return { kind: 'stand-in-light', id: key.slice(STAGE_STAND_IN.length + 3) as LightId };
  if (key.startsWith(`${STAGE_SKY}/m/`))
    return { kind: 'sky-material', stage: true, name: key.slice(STAGE_SKY.length + 3) };
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
    return asset.kind === 'planet' || asset.kind === 'style'
      ? { kind: 'material', name }
      : { kind: 'sky-material', stage: false, name };
  }
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
    return {
      _stageScene: stageScene,
      _skyOf: skyOf,
      _materialUse: materialUse,
      /** A sky's materials as shown. */
      _skyMaterials: (stage: boolean): MaterialEntry[] => {
        const scene = _sceneFile.hasValue() ? _sceneFile.value() : null;
        const { below, edited } = skyOf(stage);
        return scene ? skyMaterialsOf(scene, below, edited, library().materials) : [];
      },
      /**
       * The planet or style open, as the editor has it: its defaults over its file's tuning; a
       * planet in the style it wears of its own, whose settings it sets as it wears it.
       */
      _body: computed((): BodyInfo | null => {
        const a = asset();
        const kind = libraryKind(a.kind);
        if (!kind) return null;
        const files = _catalog.files();
        const file = files[a.kind === 'planet' ? a.id : `style-${a.id}`];
        const style = (a.kind === 'planet' && file?.tuning?.style) || '';
        return {
          key: ASSET,
          id: a.id,
          style,
          styleSet: false,
          settings: library()[kind][a.id] ?? {},
          styleBelow: style ? library().styles[style] : undefined,
          materialBase: library().materials,
          file,
          styleFile: style ? files[`style-${style}`] : undefined,
          moons: [],
        };
      }),
    };
  }),
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
      _materialUse,
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
            const on = a.on.kind === 'planet' ? library().planets : library().styles;
            const material = _catalog.materialByName().get(a.id)?.label ?? a.id;
            return `${on[a.on.id]?.label ?? a.on.id} › ${material}`;
          }
          return `${KIND_TITLES[a.kind]} · ${a.kind === 'sky' ? 'Play screen' : a.id}`;
        }),
        sharedMaterial: computed((): AssetTarget | null => {
          const t = target();
          const a = asset();
          const b = _body();
          if (t.kind !== 'material' || !b || (a.kind !== 'planet' && a.kind !== 'style'))
            return null;
          const m = materialsOf(b).find((x) => x.name === t.name);
          if (!m) return null;
          return {
            kind: 'material',
            id: t.name,
            on:
              m.from === 'style' && b.style
                ? { kind: 'style', id: b.style }
                : { kind: a.kind, id: a.id },
          };
        }),
        /** What the asset open was opened from (a material's planet or overlay): its way back. */
        parent: computed((): { target: OpenTarget; label: string } | null => {
          const on = asset().on;
          if (!on) return null;
          const set = on.kind === 'planet' ? library().planets : library().styles;
          return { target: { kind: on.kind, id: on.id }, label: set[on.id]?.label ?? on.id };
        }),
        resetAllLabel: computed(() => {
          const a = asset();
          return `Reset ${a.kind === 'sky' ? 'the sky' : a.id}`;
        }),
        kind: computed((): TargetKind => {
          const t = target();
          if ('view' in t && t.view) return t.view.kind;
          const k = t.kind;
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
                ? _skyMaterials(t.stage).find((x) => x.name === t.name)
                : t.kind === 'material'
                  ? b && materialsOf(b).find((x) => x.name === t.name)
                  : undefined;
            return viewTitle(t.view, m ?? undefined);
          }
          if (t.kind === 'sky') return t.stage ? 'Stage sky' : 'Sky';
          if (t.kind === 'backdrop') return 'Backdrop';
          if (t.kind === 'stand-in') return 'Stand-in planet';
          if (t.kind === 'stand-in-light')
            return (
              standInLights(_aids.standInLights()).find((x) => x.light.id === t.id)?.light.name ??
              'Properties'
            );
          if (t.kind === 'reference') return 'Reference';
          if (t.kind === 'sky-material')
            return _skyMaterials(t.stage).find((m) => m.name === t.name)?.label ?? t.name;
          if (t.kind === 'material') {
            const b = _body();
            return (b && materialsOf(b).find((m) => m.name === t.name)?.label) ?? t.name;
          }
          if (t.kind === 'light') {
            const b = _body();
            return (
              (b && lightsOfBody(b).find((x) => x.light.id === t.id)?.light.name) ?? 'Properties'
            );
          }
          if (t.kind === 'part') {
            const b = _body();
            const p = b && partsOfBody(b).find((x) => x.key === t.key);
            return p ? (p.style ? `${p.label} · ${p.style}` : p.label) : 'Part';
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
        styleOptions: computed((): PropertyOption[] => grouped([{ value: '', label: 'None' }])),
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
          const fitted = (planet?: string, styleFile?: string) => {
            const root = { position: PREVIEW_POSITION, radius: PREVIEW_RADIUS };
            if (!scene) return root;
            const up = Math.tan((scene.camera.fovY * Math.PI) / 360);
            const style = styleFile?.replace(/^style-/, '');
            const lib = _draft.library();
            const extent = visualExtent(
              planet ? files[planet] : undefined,
              styleFile ? files[styleFile] : undefined,
              style,
              mergePartSettings(
                planet ? lib.planets[planet]?.parts : undefined,
                style ? lib.styles[style]?.parts : undefined,
              ),
            );
            const view = { up, across: up * _ui.aspect() };
            return {
              ...root,
              radius: fitRadius(root, [], scene.camera.eye, view, new Map(), () => extent),
            };
          };
          if (a.kind === 'sky') return []; // the sky alone
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
          // A material opened from a planet or overlay: on that (unless asked for the stand-in).
          if (a.kind === 'material' && a.on && !onStandIn()) {
            const on = a.on;
            if (on.kind === 'planet') {
              const style = files[on.id]?.tuning?.style;
              return style
                ? [{ id: on.id, style, ...fitted(on.id, `style-${style}`) }]
                : [{ id: on.id, ...fitted(on.id) }];
            }
            return [
              { id: previewPlanet(), style: on.id, ...fitted(previewPlanet(), `style-${on.id}`) },
            ];
          }
          if (a.kind === 'material') {
            const owner =
              use?.kind === 'planet'
                ? use.id
                : use?.kind === 'style'
                  ? `style-${use.id}`
                  : undefined;
            return [standIn(owner)];
          }
          if (a.kind === 'planet') {
            const style = files[a.id]?.tuning?.style;
            return style
              ? [{ id: a.id, style, ...fitted(a.id, `style-${style}`) }]
              : [{ id: a.id, ...fitted(a.id) }];
          }
          // A style on the stand-in: what it adds, on a plain body.
          if (a.kind === 'style')
            return [{ ...standIn(), style: a.id, ...fitted(undefined, `style-${a.id}`) }];
          if (use?.kind === 'planet') return [{ id: use.id, ...fitted(use.id) }];
          if (use?.kind === 'style')
            return [
              { id: previewPlanet(), style: use.id, ...fitted(previewPlanet(), `style-${use.id}`) },
            ];
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
  withComputed((store) => ({
    litBy: computed((): readonly LitByEntry[] | null => {
      const b = store._body();
      const receiver = receiverOf(store.target());
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
      const b = store._body();
      return t.kind === 'part' && b ? partsOfBody(b).find((p) => p.key === t.key) : undefined;
    }),
    material: computed((): MaterialEntry | undefined => {
      const t = store.target();
      if (t.kind === 'base-material') return store.baseMaterial();
      if (t.kind === 'sky-material')
        return store._skyMaterials(t.stage).find((m) => m.name === t.name);
      const b = store._body();
      // Its layers may read the sky's textures too (always loaded).
      const sky = store._sceneFile.hasValue() ? store._sceneFile.value().textures : {};
      return t.kind === 'material' && b
        ? materialsOf(b, sky).find((m) => m.name === t.name)
        : undefined;
    }),
    /** The stage's sky: its own, but for the sky open (shown as the library has it). */
    stageSky: computed((): SkySettings => {
      if (store.asset().kind === 'sky') return {};
      const sky = store._stageScene().sky;
      return { materials: sky?.materials, tint: sky?.tint, order: sky?.order };
    }),
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
      const skyRows = (
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
          const parts = (list: readonly PartNode[], at: number) => {
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
                partMaterialRows(materials, at + 1, open, assetMaterialKey, materialRow, (r) =>
                  rows.push(r),
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
          if (nodes.overlay.length) {
            rows.push({
              key: ASSET_OVERLAY,
              label: styleLabel(b),
              detail: 'overlay',
              icon: 'style',
              depth: 1,
              expandable: true,
              expanded: !open.has(ASSET_OVERLAY),
              group: true,
              enabled: overlayEnabled(b),
            });
            if (!open.has(ASSET_OVERLAY)) {
              parts(nodes.overlay, 2);
              lightGroup(
                ASSET_OVERLAY_LIGHTS,
                lights.filter((l) => l.overlay),
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
          if (open.has(ASSET)) skyRows(sky, assetDepthKey, assetMaterialKey, 1);
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
            if (open.has(STAGE_BACKDROP))
              skyRows(store._skyMaterials(true), stageDepthKey, stageMaterialKey, 2);
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
          if ((a.kind === 'material' && !(a.on && !store.onStandIn())) || a.kind === 'style') {
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
        if (t.stage) d.setSkyMaterial(PREVIEW_SCENE, t.name, change);
        else d.setLibrarySkyMaterial(t.name, change);
      } else if (t.kind === 'material' && kind)
        d.setLibraryMaterial(kind, asset().id, t.name, change);
      else if (t.kind === 'base-material') d.setLibraryBaseMaterial(asset().id, change);
    };
    /** Settings of a material put back as the levels under it have them (all: none named). */
    const materialClear = (t: Target, keys?: readonly (keyof MaterialSettings)[]) => {
      const kind = libraryKind(asset().kind);
      if (t.kind === 'sky-material') {
        if (t.stage) d.clearSkyMaterial(PREVIEW_SCENE, t.name, keys);
        else d.clearLibrarySkyMaterial(t.name, keys);
      } else if (t.kind === 'material' && kind)
        d.clearLibraryMaterial(kind, asset().id, t.name, keys);
      else if (t.kind === 'base-material') d.clearLibraryBaseMaterial(asset().id, keys);
    };
    /** Whether a material is drawn as the levels under the one edited have it. */
    const materialBelow = (t: Target): boolean => {
      if (t.kind === 'base-material') return store.baseMaterial()?.enabledBelow ?? true;
      if (t.kind === 'sky-material')
        return store._skyMaterials(t.stage).find((m) => m.name === t.name)?.enabledBelow ?? true;
      const b = store._body();
      const m = t.kind === 'material' && b && materialsOf(b).find((x) => x.name === t.name);
      return m ? m.enabledBelow : true;
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
        } else if (change.key === ASSET_OVERLAY && kind) {
          if (on) d.clearLibraryBody(kind, asset().id, ['overlayEnabled']);
          else d.setLibraryBody(kind, asset().id, { overlayEnabled: false });
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
          store.reopen(ASSET_OVERLAY);
          store.expand(ASSET_OVERLAY_LIGHTS);
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
      removeLight(): void {
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
        if (from.kind === 'sky-material' && to.kind === 'sky-material' && from.stage === to.stage) {
          const all = store._skyMaterials(to.stage);
          const moving = all.find((m) => m.name === from.name);
          const target = all.find((m) => m.name === to.name);
          if (!moving || !target) return;
          const depth = target.values.depth;
          const group = all.filter((m) => m.values.depth === depth).map((m) => m.name);
          const order = reordered(
            all.map((m) => m.name),
            group,
            from.name,
            to.name,
            move.after,
          );
          if (moving.values.depth !== depth) materialChange(move.key, { depth });
          if (to.stage) d.setSkyOrder(PREVIEW_SCENE, order);
          else d.setLibrarySkyOrder(order);
        } else if (from.kind === 'material' && to.kind === 'material') {
          const kind = body();
          const b = store._body();
          if (!kind || !b) return;
          const all = materialsOf(b);
          // Within the part they are drawn on (a material isn't moved to another part).
          const group = partsOfBody(b).find((p) => p.materials.includes(to.name))?.materials;
          if (!group?.includes(from.name)) return;
          const order = reordered(
            all.map((m) => m.name),
            group,
            from.name,
            to.name,
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
        if (!kind || t.kind !== 'part') return;
        const now = d.library()[kind][asset().id] ?? {};
        d.setLibraryBody(kind, asset().id, { parts: withPartSetting(now, t.key, change).parts });
      },
      clearPart(keys?: readonly (keyof PartSettings)[]): void {
        const kind = body();
        const t = store.target();
        if (!kind || t.kind !== 'part') return;
        const left = withoutPartSetting(d.library()[kind][asset().id] ?? {}, t.key, keys)?.parts;
        if (left) d.setLibraryBody(kind, asset().id, { parts: left });
        else d.clearLibraryBody(kind, asset().id, ['parts']);
      },
      resetBody(): void {
        const kind = body();
        if (kind) d.resetLibraryBody(kind, asset().id);
      },
      setStyle(): void {
        // a library asset wears no style of its own: styles are worn in scenes
      },
      resetStyle(): void {
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
