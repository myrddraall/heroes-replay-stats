import {
  addedSourced,
  createdSkyFile,
  mergeAddedParts,
  skyWornOf,
  sourceFiles,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { type MaterialTint } from '@myrddraall/heroes-replay-stats-aether/formats';
import { NO_MATERIAL_TINT } from '@myrddraall/heroes-replay-stats-aether/materials';
import { computed } from '@angular/core';
import { wornIds } from '../../editing/model/body';
import {
  ownSkyInfo,
  skyAnchorView,
  skyMaterialsOf,
  skyOverlayChoices,
  skyOverlayInfos,
  skyPartsOf,
} from '../../editing/model/sky';
import type { PickChoice } from '../../controls/pick-list';
import type { WithCameras } from '../scene-editor.store';
import { same } from '../../draft/design-writes';

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
    skyTint: computed((): MaterialTint => sky().tint ?? library().sky.tint ?? NO_MATERIAL_TINT),
    skyTintSet: computed(() => sky().tint),
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
