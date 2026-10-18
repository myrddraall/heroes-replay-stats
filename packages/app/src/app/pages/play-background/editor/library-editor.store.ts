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
import { withFolding } from '../../../data/store-features/with-folding';
import { withLocalStorage } from '../../../data/store-features/with-local-storage';
import type { BodySettings, SkyChoices } from '../../../scenes/play-background/background-scene';
import { NO_MATERIAL_TINT } from '../../../scenes/play-background/material-settings';
import type { SetPlanet } from '../../../scenes/play-background/planet-sets';
import { loadPlaySceneFile, PLAY_SCENE_URL } from '../../../scenes/play-background/play-scene';
import {
  loadPlanetIndex,
  type MaterialSettings,
  type MaterialTint,
  type SkySettings,
} from '../../../scenes/play-background/scene-planets';
import { withPlanetFiles } from '../../../scenes/play-background/with-planet-files';
import { DraftDesignStore, type LibraryKind } from '../draft-design.store';
import { grouped, type PropertyOption } from '../properties/property-select';
import {
  type BodyInfo,
  bodyView,
  materialsOf,
  skyMaterialsOf,
  type TargetKind,
} from './editor-model';
import { EditorUiStore } from './editor-ui.store';
import type { TreeRow } from './scene-tree';

/**
 * The preview stage's scene: what is around an asset while it is edited in the library (its sky,
 * its colour). A scene of its own, kept and saved as the others are, under a key no planet has.
 */
export const PREVIEW_SCENE = '@preview';
/** The planet a style is shown on, until a planet has been opened. */
const DEFAULT_PREVIEW_PLANET = 'korhal';
/** Where the asset is put on the stage: as a scene's planet is. */
const PREVIEW_POSITION: readonly [number, number, number] = [0, 65, 4];
const PREVIEW_RADIUS = 18;

/** The library tree's rows by what they are. */
const STAGE = 'stage';
const STAGE_SKY = 'stage/sky';
const LIBRARY_SKY = 'lib:sky';
const groupKey = (kind: LibraryKind) => `lib:${kind}`;
const assetKey = (kind: LibraryKind, id: string) => `lib:${kind}:${id}`;
const materialsKey = (kind: LibraryKind, id: string) => `${assetKey(kind, id)}/materials`;
const materialKey = (kind: LibraryKind, id: string, name: string) =>
  `${assetKey(kind, id)}/m/${name}`;

/** What a library tree row's key is. */
type Target =
  | { readonly kind: 'group' }
  | { readonly kind: 'sky'; readonly stage: boolean }
  | { readonly kind: 'sky-material'; readonly stage: boolean; readonly name: string }
  | { readonly kind: 'body'; readonly asset: LibraryKind; readonly id: string }
  | {
      readonly kind: 'material';
      readonly asset: LibraryKind;
      readonly id: string;
      readonly name: string;
    };

function targetOf(key: string): Target {
  for (const [sky, stage] of [
    [STAGE_SKY, true],
    [LIBRARY_SKY, false],
  ] as const) {
    if (key === sky) return { kind: 'sky', stage };
    if (key.startsWith(`${sky}/m/`))
      return { kind: 'sky-material', stage, name: key.slice(sky.length + 3) };
  }
  const match = /^lib:(planets|styles):([^/]+)(\/materials|\/m\/(.+))?$/.exec(key);
  if (!match) return { kind: 'group' };
  const asset = match[1] as LibraryKind;
  const id = match[2]!;
  if (match[3] === '/materials') return { kind: 'group' };
  if (match[4] !== undefined) return { kind: 'material', asset, id, name: match[4] };
  return { kind: 'body', asset, id };
}

interface LibraryEditorState {
  /** The selected row's key. */
  readonly selected: string;
  /** The planet on the stage: the last opened (a style is shown on it). */
  readonly previewPlanet: string;
}

/**
 * The library editor's store (component store, provided by the library editor as its `Editor`
 * and its background's scene): the draft's library ({@link DraftDesignStore}) as a tree (the
 * planets, each with its materials; the styles; the sky's defaults), what is selected and its
 * properties over the game data, and the preview stage around it: a scene of its own
 * ({@link PREVIEW_SCENE}) with its own sky, only there to see the asset while it is edited.
 */
export const LibraryEditorStore = signalStore(
  withState<LibraryEditorState>({ selected: STAGE, previewPlanet: DEFAULT_PREVIEW_PLANET }),
  withFolding([STAGE, groupKey('planets')]),
  withLocalStorage<LibraryEditorState & { expanded: readonly string[] }>(
    'hrs.background-library-editor',
    ['selected', 'previewPlanet', 'expanded'],
  ),
  withPlanetFiles(),
  withProps(() => ({
    _draft: inject(DraftDesignStore),
    _ui: inject(EditorUiStore),
    _index: resource({ loader: ({ abortSignal }) => loadPlanetIndex(PLAY_SCENE_URL, abortSignal) }),
    _sceneFile: resource({
      loader: ({ abortSignal }) => loadPlaySceneFile(PLAY_SCENE_URL, abortSignal),
    }),
  })),
  withProps(({ files, _draft, _sceneFile }) => {
    const library = _draft.library;
    const _stage = computed(() => _draft.scenes().planets[PREVIEW_SCENE] ?? {});
    /** A sky (the stage's, or the library's defaults): what is under it, and what is set. */
    const _skyOf = (stageSky: boolean): { below: SkyChoices | undefined; edited: SkyChoices } =>
      stageSky
        ? { below: library().sky, edited: _stage().sky ?? {} }
        : { below: undefined, edited: library().sky };
    return {
      _stage,
      _skyOf,
      /** A library asset as the editor has it: its defaults over its file's tuning. */
      _assetInfo: (kind: LibraryKind, id: string): BodyInfo => ({
        key: assetKey(kind, id),
        id,
        style: '',
        styleSet: false,
        settings: library()[kind][id] ?? {},
        file: files()[kind === 'planets' ? id : `style-${id}`],
        moons: [],
      }),
      /** A sky's materials as shown. */
      _skyMaterials: (stageSky: boolean) => {
        const scene = _sceneFile.hasValue() ? _sceneFile.value() : null;
        const { below, edited } = _skyOf(stageSky);
        return scene ? skyMaterialsOf(scene, below, edited) : [];
      },
      /** Whether an asset differs from what is published. */
      _unsavedAsset: (kind: LibraryKind, id: string) =>
        (kind === 'planets' ? _draft.unsavedLibraryPlanets() : _draft.unsavedLibraryStyles()).has(
          id,
        ),
      resetAllLabel: 'Reset the library',
    };
  }),
  withComputed(
    ({ selected, previewPlanet, _draft, _index, _stage, _skyOf, _assetInfo, _skyMaterials }) => {
      const planetIds = computed(() =>
        _index.hasValue() ? _index.value().planets.map((p) => p.id) : [],
      );
      const styleIds = computed(() =>
        _index.hasValue() ? _index.value().styles.map((s) => s.id) : [],
      );
      const target = computed(() => targetOf(selected()));
      const body = computed(() => {
        const t = target();
        return t.kind === 'body' || t.kind === 'material' ? _assetInfo(t.asset, t.id) : undefined;
      });
      const selectedSky = computed(() => {
        const t = target();
        return t.kind === 'sky' || t.kind === 'sky-material' ? _skyOf(t.stage) : null;
      });
      return {
        planetIds,
        styleIds,
        target,
        kind: computed((): TargetKind => target().kind),
        neededFiles: computed(() => [...planetIds(), ...styleIds().map((id) => `style-${id}`)]),
        bodyView: computed(() => {
          const b = body();
          return b ? bodyView(b, false, false) : null;
        }),
        material: computed(() => {
          const t = target();
          if (t.kind === 'sky-material')
            return _skyMaterials(t.stage).find((m) => m.name === t.name);
          const b = body();
          return t.kind === 'material' && b
            ? materialsOf(b).find((m) => m.name === t.name)
            : undefined;
        }),
        title: computed(() => {
          const t = target();
          if (t.kind === 'sky') return t.stage ? 'Preview sky' : 'Sky (library)';
          if (t.kind === 'sky-material' || t.kind === 'material') return t.name;
          if (t.kind === 'body') return t.id;
          return 'Library';
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
        /** The stage: the planet last opened (wearing the style, where one is opened), its sky; nothing else. */
        stagePlanets: computed((): SetPlanet[] => {
          const t = target();
          const style =
            t.kind === 'body' || t.kind === 'material'
              ? t.asset === 'styles'
                ? t.id
                : undefined
              : undefined;
          return [
            { id: previewPlanet(), position: PREVIEW_POSITION, radius: PREVIEW_RADIUS, style },
          ];
        }),
        stageSky: computed((): SkySettings => ({
          materials: _stage().sky?.materials,
          tint: _stage().sky?.tint,
        })),
        stageTint: computed(() => _draft.scenes().settings),
        /** Whether the stage differs from what is published. */
        stageUnsaved: computed(() => _draft.unsavedScenes().has(PREVIEW_SCENE)),
      };
    },
  ),
  withComputed((store) => ({
    rows: computed((): TreeRow[] => {
      const open = store.unfolded();
      const rows: TreeRow[] = [];
      const row = (key: string, label: string, icon: string, depth: number, unsaved = false) =>
        rows.push({ key, label, icon, depth, expandable: true, expanded: open.has(key), unsaved });
      const leaf = (key: string, label: string, depth: number, enabled: boolean) =>
        rows.push({
          key,
          label,
          icon: 'texture',
          depth,
          expandable: false,
          expanded: false,
          enabled,
        });
      // The stage: only there to see what is edited.
      row(STAGE, 'Preview stage', 'videocam', 0, store.stageUnsaved());
      if (open.has(STAGE)) {
        row(STAGE_SKY, 'Sky', 'blur_on', 1);
        if (open.has(STAGE_SKY))
          for (const m of store._skyMaterials(true))
            leaf(`${STAGE_SKY}/m/${m.name}`, m.name, 2, m.values.enabled);
      }
      // The library's assets.
      const assets = (kind: LibraryKind, label: string, icon: string, ids: readonly string[]) => {
        row(groupKey(kind), label, 'folder', 0);
        if (!open.has(groupKey(kind))) return;
        for (const id of ids) {
          row(assetKey(kind, id), id, icon, 1, store._unsavedAsset(kind, id));
          if (!open.has(assetKey(kind, id))) continue;
          row(materialsKey(kind, id), 'Materials', 'layers', 2);
          if (!open.has(materialsKey(kind, id))) continue;
          for (const m of materialsOf(store._assetInfo(kind, id)))
            leaf(materialKey(kind, id, m.name), m.name, 3, m.values.enabled);
        }
      };
      assets('planets', 'Planets', 'public', store.planetIds());
      assets('styles', 'Styles', 'style', store.styleIds());
      row(LIBRARY_SKY, 'Sky', 'blur_on', 0, store._draft.unsavedLibrarySky());
      if (open.has(LIBRARY_SKY))
        for (const m of store._skyMaterials(false))
          leaf(`${LIBRARY_SKY}/m/${m.name}`, m.name, 1, m.values.enabled);
      return rows;
    }),
  })),
  withMethods((store) => {
    const d = store._draft;
    const materialChange = (key: string, change: Partial<MaterialSettings>) => {
      const t = targetOf(key);
      if (t.kind === 'sky-material') {
        if (t.stage) d.setSkyMaterial(PREVIEW_SCENE, t.name, change);
        else d.setLibrarySkyMaterial(t.name, change);
      } else if (t.kind === 'material') d.setLibraryMaterial(t.asset, t.id, t.name, change);
    };
    const selectedAsset = () => {
      const t = store.target();
      return t.kind === 'body' || t.kind === 'material' ? t : null;
    };
    const selectedSky = () => {
      const t = store.target();
      return t.kind === 'sky' || t.kind === 'sky-material' ? t : null;
    };
    return {
      /** A row selected; a group only folds. Opening a planet puts it on the stage. */
      select(key: string): void {
        const t = targetOf(key);
        if (t.kind === 'group') {
          store.toggleExpanded(key);
          return;
        }
        patchState(store, {
          selected: key,
          ...((t.kind === 'body' || t.kind === 'material') && t.asset === 'planets'
            ? { previewPlanet: t.id }
            : {}),
        });
      },
      setEnabled(change: { key: string; enabled: boolean }): void {
        materialChange(change.key, { enabled: change.enabled });
      },
      setMaterial(change: Partial<MaterialSettings>): void {
        materialChange(store.selected(), change);
      },
      clearMaterial(keys?: readonly (keyof MaterialSettings)[]): void {
        const t = store.target();
        if (t.kind === 'sky-material') {
          if (t.stage) d.clearSkyMaterial(PREVIEW_SCENE, t.name, keys);
          else d.clearLibrarySkyMaterial(t.name, keys);
        } else if (t.kind === 'material') d.clearLibraryMaterial(t.asset, t.id, t.name, keys);
      },
      setBody(change: Partial<BodySettings>): void {
        const a = selectedAsset();
        if (a) d.setLibraryBody(a.asset, a.id, change);
      },
      clearBody(keys: readonly (keyof BodySettings)[]): void {
        const a = selectedAsset();
        if (a) d.clearLibraryBody(a.asset, a.id, keys);
      },
      resetBody(): void {
        const a = selectedAsset();
        if (a) d.resetLibraryBody(a.asset, a.id);
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
      /** The whole library back as the game data has it (the stage keeps its sky). */
      resetAll(): void {
        for (const id of Object.keys(d.library().planets)) d.resetLibraryBody('planets', id);
        for (const id of Object.keys(d.library().styles)) d.resetLibraryBody('styles', id);
        d.resetLibrarySky();
        store._ui.confirmReset(false);
      },
      // A scene's: nothing in the library.
      anotherSet(): void {
        // a scene's: the library has no random sets, orbits or moons
      },
      setOrbit(): void {
        // a scene's: the library has no random sets, orbits or moons
      },
      addMoon(): void {
        // a scene's: the library has no random sets, orbits or moons
      },
      removeMoon(): void {
        // a scene's: the library has no random sets, orbits or moons
      },
      toggleFocus(): void {
        // a scene's: the library has no random sets, orbits or moons
      },
    };
  }),
  withHooks({
    onInit(store) {
      store.needFiles(store.neededFiles);
    },
  }),
);
