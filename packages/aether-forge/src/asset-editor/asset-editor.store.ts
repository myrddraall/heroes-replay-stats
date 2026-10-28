import { DATA_URL, storageKey } from '@myrddraall/heroes-replay-stats-aether';
import { loadPlaySceneFile } from '@myrddraall/heroes-replay-stats-aether/formats';
import { inject, resource } from '@angular/core';
import { signalStore, signalStoreFeature, withMethods, withProps, withState } from '@ngrx/signals';
import { withFolding } from '../tree/with-folding';
import { withLocalStorage } from '@myrddraall/heroes-replay-stats-signals';
import { DraftDesignStore } from '../draft/draft-design.store';
import { AssetCatalogStore } from '../library/asset-catalog.store';
import { EditingAidsStore } from '../aids/editing-aids.store';
import { EditorUiStore } from '../layout/editor-ui.store';
import { ASSET, type AssetEditorState, DEFAULT_PREVIEW_PLANET, STAGE } from './asset-targets';
import { assetVariantMethods, assetVariantViews } from './variants';
import { assetSkyMethods, stageSkyViews } from './sky';
import { assetBodyMethods, assetBodyViews } from './body';
import type { StoreOf, WritableStoreOf } from '../editing/store-of';
import { ownViews } from './own';
import { assetSelectionMethods, assetSelectionViews } from './selection';
import { assetCameraMethods, assetCameraViews } from './cameras';
import { stageViews } from './stage';
import { assetBackgroundViews } from './background';
import { assetPartHostViews } from './part-hosts';
import { assetTreeViews } from './tree';
import { stageLightingViews } from './stage-lighting';
import { assetWrites } from './asset-writes';
import { assetLightMethods } from './lights';
import { assetMaterialMethods } from './materials';
import { assetPartMethods } from './parts';
const assetStoreBase = () =>
  signalStoreFeature(
    withState<AssetEditorState>({
      asset: { kind: 'planet', id: DEFAULT_PREVIEW_PLANET },
      selected: ASSET,
      onStandIn: false,
      editorCamera: null,
      variantEdited: null,
    }),
    withFolding([STAGE, ASSET]),
    withLocalStorage<AssetEditorState & { expanded: readonly string[] }>(
      storageKey('asset-editor'),
      ['expanded'],
    ),
    withProps(() => {
      const data = inject(DATA_URL);
      return {
        _draft: inject(DraftDesignStore),
        _ui: inject(EditorUiStore),
        _catalog: inject(AssetCatalogStore),
        _aids: inject(EditingAidsStore),
        _sceneFile: resource({
          loader: ({ abortSignal }) => loadPlaySceneFile(data, abortSignal),
        }),
      };
    }),
  );
export type AssetStoreBase = StoreOf<typeof assetStoreBase>;
const withVariants = () => signalStoreFeature(assetStoreBase(), withProps(assetVariantViews));
export type WithVariants = StoreOf<typeof withVariants>;
const withStageSky = () => signalStoreFeature(withVariants(), withProps(stageSkyViews));
export type WithStageSky = StoreOf<typeof withStageSky>;
const withBody = () => signalStoreFeature(withStageSky(), withProps(assetBodyViews));
export type WithBody = StoreOf<typeof withBody>;

const withOwn = () => signalStoreFeature(withBody(), withProps(ownViews));
export type WithOwn = StoreOf<typeof withOwn>;

const withSelection = () => signalStoreFeature(withOwn(), withProps(assetSelectionViews));
export type WithSelection = StoreOf<typeof withSelection>;
const withCameras = () => signalStoreFeature(withSelection(), withProps(assetCameraViews));
export type WithCameras = StoreOf<typeof withCameras>;
const withStage = () => signalStoreFeature(withCameras(), withProps(stageViews));
export type WithStage = StoreOf<typeof withStage>;
const withBackground = () => signalStoreFeature(withStage(), withProps(assetBackgroundViews));
export type WithBackground = StoreOf<typeof withBackground>;
const withPartHosts = () => signalStoreFeature(withBackground(), withProps(assetPartHostViews));
export type WithPartHosts = StoreOf<typeof withPartHosts>;
const withTree = () => signalStoreFeature(withPartHosts(), withProps(assetTreeViews));
export type WithTree = StoreOf<typeof withTree>;
const withStageLighting = () => signalStoreFeature(withTree(), withProps(stageLightingViews));
/** The store as its methods see it: everything computed under them, its state writable. */
export type AssetMethodsStore = WritableStoreOf<typeof withStageLighting>;

export const AssetEditorStore = signalStore(
  withStageLighting(),
  withMethods((store) => {
    const w = assetWrites(store);
    return {
      ...assetSelectionMethods(store, w),
      ...assetCameraMethods(store),
      ...assetLightMethods(store, w),
      ...assetMaterialMethods(store, w),
      ...assetPartMethods(store, w),
      ...assetBodyMethods(store, w),
      ...assetSkyMethods(store, w),
      ...assetVariantMethods(store, w),
    };
  }),
);
