import { PREVIEW_SCENE } from '@myrddraall/heroes-replay-stats-aether/design';
import { type MaterialTint, type SkyAnchor } from '@myrddraall/heroes-replay-stats-aether/formats';
import { ASSET, STAGE, STAGE_SKY } from '../../asset-targets';
import type { AssetMethodsStore } from '../../asset-editor.store';
import type { AssetWrites } from './asset-writes';

/** The sky open or the stage's: the overlays it wears, its tint, anchor and reset. */
export function assetSkyMethods(store: AssetMethodsStore, w: AssetWrites) {
  const { d, selectedSky } = w;
  return {
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
    setSkyAnchor(anchor: SkyAnchor): void {
      const s = selectedSky();
      if (s) d.setSkyAnchor(s.stage ? PREVIEW_SCENE : null, anchor);
    },
    clearSkyAnchor(): void {
      const s = selectedSky();
      if (s) d.setSkyAnchor(s.stage ? PREVIEW_SCENE : null, undefined);
    },
    resetSky(): void {
      const s = selectedSky();
      if (!s) return;
      if (s.stage) d.resetSky(PREVIEW_SCENE);
      else d.resetLibrarySky();
    },
  };
}
