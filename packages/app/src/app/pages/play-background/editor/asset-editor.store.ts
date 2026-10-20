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
import { NO_MATERIAL_TINT } from '../../../scenes/play-background/material-settings';
import { visualExtent } from '../../../scenes/play-background/scene-bodies';
import type { SetPlanet } from '../../../scenes/play-background/planet-sets';
import { loadPlaySceneFile, PLAY_SCENE_URL } from '../../../scenes/play-background/play-scene';
import type {
  MaterialSettings,
  MaterialTint,
  SkySettings,
} from '../../../scenes/play-background/scene-planets';
import { DraftDesignStore, type LibraryKind } from '../draft-design.store';
import { grouped, type PropertyOption } from '../properties/property-select';
import { AssetCatalogStore, type MaterialUse } from './asset-catalog.store';
import {
  baseMaterialOf,
  type BodyInfo,
  bodyView,
  type MaterialEntry,
  materialsOf,
  referenceRow,
  skyMaterialsOf,
  type TargetKind,
} from './editor-model';
import { EditingAidsStore, GRID_CELLS, REFERENCE_KEY } from './editing-aids.store';
import { EditorUiStore } from './editor-ui.store';
import type { AssetKind, AssetTarget, OpenTarget } from './open-target';
import type { TreeRow } from './scene-tree';
import { STAND_IN_MATERIAL, standInId } from './stand-in';

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
const ASSET = 'asset';
const ASSET_MATERIALS = 'asset/materials';
/** The materials the style a planet wears brings, a group of their own. */
const ASSET_STYLE_MATERIALS = 'asset/style-materials';
const stageMaterialKey = (name: string) => `${STAGE_SKY}/m/${name}`;
const assetMaterialKey = (name: string) => `${ASSET}/m/${name}`;

const KIND_TITLES: Readonly<Record<AssetKind, string>> = {
  planet: 'Planet',
  style: 'Style',
  material: 'Material',
  particle: 'Particles',
  sky: 'Sky',
};

/** What an asset tree row's key is, for the asset open. */
type Target =
  | { readonly kind: 'group' }
  /** The stage's sky, or the library's (the sky open). */
  | { readonly kind: 'sky'; readonly stage: boolean }
  | { readonly kind: 'sky-material'; readonly stage: boolean; readonly name: string }
  /** The planet or style open. */
  | { readonly kind: 'body' }
  /** A material as the planet or style open sets it for itself. */
  | { readonly kind: 'material'; readonly name: string }
  /** The material open: its base settings. */
  | { readonly kind: 'base-material' }
  | { readonly kind: 'particle' }
  /** The editing aids: the stage's backdrop, the stand-in planet. */
  | { readonly kind: 'backdrop' }
  | { readonly kind: 'stand-in' }
  | { readonly kind: 'reference' };

function targetOf(key: string, asset: AssetTarget): Target {
  if (key === STAGE_BACKDROP) return { kind: 'backdrop' };
  if (key === REFERENCE_KEY) return { kind: 'reference' };
  if (key === STAGE_STAND_IN) return { kind: 'stand-in' };
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
    /** Where the material open is shown from: on the planet on the stage where it is that planet's, else its first use. */
    const materialUse = computed((): MaterialUse | undefined => {
      const a = asset();
      if (a.kind !== 'material') return undefined;
      const uses = _catalog.materialByName().get(a.id)?.uses ?? [];
      return uses.find((u) => u.kind === 'planet' && u.id === previewPlanet()) ?? uses[0];
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
          return `${KIND_TITLES[a.kind]} · ${a.kind === 'sky' ? 'Play screen' : a.id}`;
        }),
        resetAllLabel: computed(() => {
          const a = asset();
          return `Reset ${a.kind === 'sky' ? 'the sky' : a.id}`;
        }),
        kind: computed((): TargetKind => {
          const k = target().kind;
          return k === 'base-material' ? 'material' : k;
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
              )
            : undefined;
        }),
        title: computed(() => {
          const t = target();
          const a = asset();
          if (t.kind === 'sky') return t.stage ? 'Stage sky' : 'Sky';
          if (t.kind === 'backdrop') return 'Backdrop';
          if (t.kind === 'stand-in') return 'Stand-in planet';
          if (t.kind === 'reference') return 'Reference';
          if (t.kind === 'sky-material')
            return _skyMaterials(t.stage).find((m) => m.name === t.name)?.label ?? t.name;
          if (t.kind === 'material') {
            const b = _body();
            return (b && materialsOf(b).find((m) => m.name === t.name)?.label) ?? t.name;
          }
          if (t.kind === 'base-material') return _catalog.materialByName().get(a.id)?.label ?? a.id;
          if (t.kind === 'group') return 'Properties';
          return a.id;
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
            const extent = visualExtent(
              planet ? files[planet] : undefined,
              styleFile ? files[styleFile] : undefined,
              styleFile?.replace(/^style-/, ''),
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
            };
          };
          if (a.kind === 'material' && !_aids.materialOnPlanet()) {
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
    material: computed((): MaterialEntry | undefined => {
      const t = store.target();
      if (t.kind === 'base-material') return store.baseMaterial();
      if (t.kind === 'sky-material')
        return store._skyMaterials(t.stage).find((m) => m.name === t.name);
      const b = store._body();
      return t.kind === 'material' && b ? materialsOf(b).find((m) => m.name === t.name) : undefined;
    }),
    /** The stage's sky: its own, but for the sky open (shown as the library has it). */
    stageSky: computed((): SkySettings => {
      if (store.asset().kind === 'sky') return {};
      const sky = store._stageScene().sky;
      return { materials: sky?.materials, tint: sky?.tint };
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
        });
      const sky = store._skyMaterials(false);
      switch (a.kind) {
        case 'planet':
        case 'style': {
          row(ASSET, a.id, a.kind === 'planet' ? 'public' : 'style', 0, store.assetUnsaved());
          const b = store._body();
          if (!open.has(ASSET) || !b) break;
          // Its materials by whose they are: its own, then the style's it wears.
          const materials = materialsOf(b);
          const groups: [string, string, string, 'own' | 'style', string?][] = [
            [ASSET_MATERIALS, 'Materials', 'layers', 'own'],
            [ASSET_STYLE_MATERIALS, b.style, 'style', 'style', 'style'],
          ];
          for (const [group, label, icon, from, detail] of groups) {
            const own = materials.filter((m) => m.from === from);
            if (!own.length) continue;
            rows.push({
              key: group,
              label,
              detail,
              icon,
              depth: 1,
              expandable: true,
              expanded: open.has(group),
              group: true,
            });
            if (open.has(group))
              for (const m of own)
                leaf(assetMaterialKey(m.name), m.label, 2, m.values.enabled, false, m.name);
          }
          break;
        }
        case 'material': {
          const m = store.baseMaterial();
          leaf(ASSET, m?.label ?? a.id, 0, m?.values.enabled ?? true, store.assetUnsaved(), a.id);
          break;
        }
        case 'particle': {
          const material = store._catalog.particles().find((p) => p.id === a.id)?.material;
          row(ASSET, a.id, 'grain', 0);
          const m = sky.find((s) => s.name === material);
          if (open.has(ASSET) && m)
            leaf(assetMaterialKey(m.name), m.label, 1, m.values.enabled, false, m.name);
          break;
        }
        case 'sky':
          row(ASSET, 'Sky', 'blur_on', 0, store.assetUnsaved());
          if (open.has(ASSET))
            for (const m of sky)
              leaf(assetMaterialKey(m.name), m.label, 1, m.values.enabled, false, m.name);
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
              for (const m of store._skyMaterials(true))
                leaf(stageMaterialKey(m.name), m.label, 2, m.values.enabled, false, m.name);
          } else
            rows.push({
              key: STAGE_BACKDROP,
              label: 'Backdrop',
              icon: 'wallpaper',
              depth: 1,
              expandable: false,
              expanded: false,
            });
          // The stand-in only where it is shown: a material or a style opened on its own.
          if (a.kind === 'material' || a.kind === 'style')
            rows.push({
              key: STAGE_STAND_IN,
              label: 'Stand-in planet',
              icon: 'circle',
              depth: 1,
              expandable: false,
              expanded: false,
            });
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
    const selectedSky = () => {
      const t = store.target();
      if (t.kind === 'backdrop') return { stage: true };
      return t.kind === 'sky' || t.kind === 'sky-material' ? t : null;
    };
    const body = () => libraryKind(asset().kind);
    return {
      /** The asset the URL opens: its own row selected; a planet opened goes on the stage. */
      showAsset: signalMethod<AssetTarget>((a) => {
        const now = store.asset();
        if (a.kind === now.kind && a.id === now.id) return;
        patchState(store, {
          asset: a,
          selected: ASSET,
          ...(a.kind === 'planet' ? { previewPlanet: a.id } : {}),
        });
        store._ui.confirmReset(false);
        store.expand(ASSET);
      }),
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
        materialChange(change.key, { enabled: change.enabled });
      },
      setMaterial(change: Partial<MaterialSettings>): void {
        materialChange(store.selected(), change);
      },
      clearMaterial(keys?: readonly (keyof MaterialSettings)[]): void {
        const t = store.target();
        const kind = body();
        if (t.kind === 'sky-material') {
          if (t.stage) d.clearSkyMaterial(PREVIEW_SCENE, t.name, keys);
          else d.clearLibrarySkyMaterial(t.name, keys);
        } else if (t.kind === 'material' && kind)
          d.clearLibraryMaterial(kind, asset().id, t.name, keys);
        else if (t.kind === 'base-material') d.clearLibraryBaseMaterial(asset().id, keys);
      },
      setBody(change: Partial<BodySettings>): void {
        const kind = body();
        if (kind) d.setLibraryBody(kind, asset().id, change);
      },
      clearBody(keys: readonly (keyof BodySettings)[]): void {
        const kind = body();
        if (kind) d.clearLibraryBody(kind, asset().id, keys);
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
