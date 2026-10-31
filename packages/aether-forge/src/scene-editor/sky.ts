import type { TintsSet } from '@myrddraall/heroes-replay-stats-aether/tints';
import { type TintRow, tintRowsOf } from '../tints/tint-rows';
import { skyWornOf } from '@myrddraall/heroes-replay-stats-aether/library';
import {
  addedSourced,
  createdSkyFile,
  mergeAddedParts,
  sourceFiles,
} from '@myrddraall/heroes-replay-stats-aether/overlays';
import {
} from '@myrddraall/heroes-replay-stats-aether/materials';
import { computed } from '@angular/core';
import { wornIds } from '../bodies/body';
import {
  ownSkyInfo,
  skyAnchorView,
  skyMaterialsOf,
  skyOverlayChoices,
  skyOverlayInfos,
  skyPartsOf,
} from '../sky/sky';
import type { PickChoice } from '../controls/pick-list';
import type { SceneMethodsStore, WithCameras } from './scene-editor.store';
import { same } from '../draft/design-writes';
import type { SkyAnchor } from '@myrddraall/heroes-replay-stats-aether/sky';
import { SCENE, SKY, skyOverlayKey } from './scene-targets';
import type { SceneWrites } from './scene-writes';

/** The scene's sky: what it wears, its materials and parts, its tint and anchor, what of it is unsaved, and the files it needs. */
export function skyViews(store: WithCameras) {
  const {
    madeLookup,
    _choices: choices,
    _library: library,
    _sceneFileValue: sceneFile,
    _published: published,
    _overlayFileOf: overlayFileOf,
    bodies,
    groupInfos,
  } = store;
  const sky = computed(() => choices().sky ?? {});
  /** The overlays the sky wears (switched on or off), in order. */
  const skyWorn = computed(() => skyWornOf(sky(), library(), sceneFile()?.wears));
  const skyOverlays = computed(() =>
    skyOverlayInfos(sceneFile(), library(), skyWorn(), madeLookup()),
  );
  /** The parts added onto the sky (the library's, then the scene's). */
  const skyAdded = computed(() => mergeAddedParts(library().sky.addedParts, sky().addedParts));
  /** The sky's own parts (added onto it), as its overlays are had; none: none. */
  const skyOwn = computed(() =>
    skyAdded().length ? [ownSkyInfo(createdSkyFile(addedSourced(skyAdded()), madeLookup()))] : [],
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
  return {
    skyWorn,
    skyOverlays,
    skyMaterials,
    skyParts,
    /** The scene as it is to be shown: its sky (over the library's, by the background) and its colour. */
    sceneSky: sky,
    skyOverlaysSet: computed(() => sky().overlays !== undefined),
    /** The overlays a sky may wear: the game data's, and those made in the editor; by name. */
    skyOverlayOptions: computed((): readonly PickChoice[] =>
      skyOverlayChoices(sceneFile(), library()),
    ),
    skyChanged: computed(() => Object.keys(sky()).length > 0),
    skyTints: computed(
      (): readonly TintRow[] => tintRowsOf([['the library (sky)', library().sky]], sky()),
    ),
    skyTintsSet: computed((): TintsSet | undefined => sky()),
    skyAnchor: computed(() => skyAnchorView(library().sky, sky())),
    skyUnsaved: computed(() => !same(choices().sky, published().sky)),
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
              addedSourced(mergeAddedParts(lib.planets[b.id]?.addedParts, b.settings.addedParts)),
            ),
          ]),
          ...[...groupInfos().values()].flatMap((b) => [
            b.id,
            ...wornIds(b).map(file),
            ...sourceFiles(
              addedSourced(mergeAddedParts(lib.planets[b.id]?.addedParts, b.settings.addedParts)),
            ),
          ]),
          ...sourceFiles(addedSourced(skyAdded())),
        ]),
      ];
    }),
  };
}

/** The scene's sky: the overlays it wears, its tint, anchor and reset. */
export function skyMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d } = w;
  return {
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
    /** An overlay the sky wears shown in the tree, its rows unfolded. */
    showSkyOverlay(id: string): void {
      store.expand(SCENE, SKY);
      store.reopen(skyOverlayKey(id));
    },
    setSkyAnchor(anchor: SkyAnchor): void {
      d.setSkyAnchor(store.scene(), anchor);
    },
    clearSkyAnchor(): void {
      d.setSkyAnchor(store.scene(), undefined);
    },
    resetSky(): void {
      d.resetSky(store.scene());
    },
  };
}
