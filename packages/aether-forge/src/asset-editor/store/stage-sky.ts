import {
  addedSourced,
  createdSkyFile,
  mergeAddedParts,
  PREVIEW_SCENE,
  type SkyChoices,
  skyWornOf,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { computed } from '@angular/core';
import { type MaterialUse } from '../../library/asset-catalog.store';
import { type MaterialEntry } from '../../editing/model/materials';
import {
  ownSkyInfo,
  skyMaterialsOf,
  type SkyOverlayInfo,
  skyOverlayInfos,
  skyPartsOf,
} from '../../editing/model/sky';
import { type PartEntry } from '../../editing/model/parts';
import type { WithVariants } from '../asset-editor.store';

/** The preview stage's scene and its sky, or the sky open: the overlays it wears, its materials and parts, an overlay made here. */
export function stageSkyViews(store: WithVariants) {
  const { _draft, asset, _catalog, previewPlanet, _sceneFile } = store;
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
  };
}
