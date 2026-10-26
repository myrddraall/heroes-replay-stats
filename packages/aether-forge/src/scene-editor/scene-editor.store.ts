import { storageKey, TINT_PRESETS, ViewStore } from '@myrddraall/heroes-replay-stats-aether';
import { RANDOM_SCENE, withPlanetFiles } from '@myrddraall/heroes-replay-stats-aether/design';
import { loadPlanetIndex } from '@myrddraall/heroes-replay-stats-aether/formats';
import { effect, inject, resource, untracked } from '@angular/core';
import {
  signalStore,
  signalStoreFeature,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withFolding } from '../editing/with-folding';
import { withLocalStorage } from '@myrddraall/heroes-replay-stats-signals';
import { DraftDesignStore } from '../draft/draft-design.store';
import { AssetCatalogStore } from '../library/asset-catalog.store';
import { EditorUiStore } from '../layout/editor-ui.store';
import { RANDOM_SETS } from '../layout/open-target';
import { sceneViews } from './store/scene';
import { cameraViews } from './store/cameras';
import { skyViews } from './store/sky';
import { selectionViews } from './store/selection';
import type { StoreOf, WritableStoreOf } from '../editing/store-of';
import { EDITOR_CAMERA, SCENE, type SceneEditorState, bodyKey } from './scene-targets';
import { partHostViews } from './store/part-hosts';
import { treeViews } from './store/tree';
import { backgroundViews } from './store/background';
import { variantViews } from './store/variants';
import { sceneWrites } from './store/methods/scene-writes';
import { selectionMethods } from './store/methods/selection';
import { sceneMethods } from './store/methods/scene';
import { cameraMethods } from './store/methods/cameras';
import { groupMethods } from './store/methods/groups';
import { lightMethods } from './store/methods/lights';
import { materialMethods } from './store/methods/materials';
import { partMethods } from './store/methods/parts';
import { bodyMethods } from './store/methods/bodies';
import { skyMethods } from './store/methods/sky';
import { variantMethods } from './store/methods/variants';

const sceneStoreBase = () =>
  signalStoreFeature(
    withState<SceneEditorState>({
      scene: RANDOM_SCENE,
      selected: SCENE,
      focus: null,
      look: EDITOR_CAMERA,
      editorCamera: null,
      sceneVariantEdited: null,
    }),
    withFolding([SCENE, bodyKey([0])]),
    withLocalStorage<SceneEditorState & { expanded: readonly string[] }>(
      storageKey('scene-editor'),
      ['expanded'],
    ),
    withPlanetFiles(),
    withProps(({ _base }) => ({
      _draft: inject(DraftDesignStore),
      _ui: inject(EditorUiStore),
      _background: inject(ViewStore),
      _catalog: inject(AssetCatalogStore),
      _tintPresets: inject(TINT_PRESETS),
      _index: resource({ loader: ({ abortSignal }) => loadPlanetIndex(_base, abortSignal) }),
    })),
  );

export type SceneStoreBase = StoreOf<typeof sceneStoreBase>;

const withScene = () => signalStoreFeature(sceneStoreBase(), withProps(sceneViews));

export type WithScene = StoreOf<typeof withScene>;

const withCameras = () => signalStoreFeature(withScene(), withProps(cameraViews));

export type WithCameras = StoreOf<typeof withCameras>;

const withSky = () => signalStoreFeature(withCameras(), withProps(skyViews));

export type WithSky = StoreOf<typeof withSky>;

const withSelection = () => signalStoreFeature(withSky(), withProps(selectionViews));

export type WithSelection = StoreOf<typeof withSelection>;
const withPartHosts = () => signalStoreFeature(withSelection(), withProps(partHostViews));
export type WithPartHosts = StoreOf<typeof withPartHosts>;
const withTree = () => signalStoreFeature(withPartHosts(), withProps(treeViews));
export type WithTree = StoreOf<typeof withTree>;
const withBackground = () => signalStoreFeature(withTree(), withProps(backgroundViews));
export type WithBackground = StoreOf<typeof withBackground>;
const withVariants = () => signalStoreFeature(withBackground(), withProps(variantViews));
export type WithVariants = StoreOf<typeof withVariants>;
/** The store as its methods see it: everything computed under them, its state writable. */
export type SceneMethodsStore = WritableStoreOf<typeof withVariants>;

export const SceneEditorStore = signalStore(
  withVariants(),
  withMethods((store) => {
    const w = sceneWrites(store);
    return {
      ...selectionMethods(store, w),
      ...sceneMethods(store, w),
      ...cameraMethods(store, w),
      ...groupMethods(store, w),
      ...lightMethods(store, w),
      ...materialMethods(store, w),
      ...partMethods(store, w),
      ...bodyMethods(store, w),
      ...skyMethods(store, w),
      ...variantMethods(store, w),
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
