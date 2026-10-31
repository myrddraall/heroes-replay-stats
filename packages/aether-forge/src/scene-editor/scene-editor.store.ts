import { sceneAdjustmentMethods } from './adjustments';
import { storageKey, ViewStore } from '@myrddraall/heroes-replay-stats-aether';
import { loadPlanetIndex } from '@myrddraall/heroes-replay-stats-aether/formats';
import { withPlanetFiles } from '../library/with-planet-files';
import { RANDOM_SCENE, siblingKey } from '@myrddraall/heroes-replay-stats-aether/scenes';
import { effect, inject, resource, untracked } from '@angular/core';
import {
  patchState,
  signalStore,
  signalStoreFeature,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withFolding } from '../tree/with-folding';
import { withLocalStorage } from '@myrddraall/heroes-replay-stats-signals';
import { DraftDesignStore } from '../draft/draft-design.store';
import { AssetCatalogStore } from '../library/asset-catalog.store';
import { EditorUiStore } from '../layout/editor-ui.store';
import { RANDOM_SETS } from '../layout/open-target';
import { sceneMethods, sceneViews } from './scene';
import { cameraMethods, cameraViews } from './cameras';
import { skyMethods, skyViews } from './sky';
import { selectionMethods, selectionViews } from './selection';
import { linkingViews } from './linking';
import type { StoreOf, WritableStoreOf } from '../editing/store-of';
import { bodyKey, EDITOR_CAMERA, SCENE, type SceneEditorState } from './scene-targets';
import { partHostViews } from './part-hosts';
import { treeViews } from './tree';
import { backgroundViews } from './background';
import { variantMethods, variantViews } from './variants';
import { sceneWrites } from './scene-writes';
import { groupMethods } from './groups';
import { lightMethods } from './lights';
import { materialMethods } from './materials';
import { partMethods } from './parts';
import { bodyMethods } from './bodies';

const sceneStoreBase = () =>
  signalStoreFeature(
    withState<SceneEditorState>({
      scene: RANDOM_SCENE,
      selected: SCENE,
      focus: null,
      look: EDITOR_CAMERA,
      editorCamera: null,
      sceneVariantEdited: null,
      opening: false,
      inside: null,
    }),
    withFolding([SCENE]),
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
const withLinking = () => signalStoreFeature(withSelection(), withProps(linkingViews));
const withPartHosts = () => signalStoreFeature(withLinking(), withProps(partHostViews));
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
      ...sceneAdjustmentMethods(store, w),
    };
  }),
  withHooks({
    onInit(store) {
      store.needFiles(store.neededFiles);
      // A scene shown before its planets were there (a preset's, from the game's files): its
      // first planet unfolded as they come.
      effect(() => {
        const first = store.sceneBodies()[0];
        if (!first || !store.opening()) return;
        untracked(() => {
          store.expand(bodyKey([siblingKey(first, 0)]));
          patchState(store, { opening: false });
        });
      });
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
