import { type MaterialTint, type SkyAnchor } from '@myrddraall/heroes-replay-stats-aether/formats';
import { SCENE, SKY, skyOverlayKey } from '../../scene-targets';
import type { SceneMethodsStore } from '../../scene-editor.store';
import type { SceneWrites } from './scene-writes';

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
    setSkyTint(tint: MaterialTint): void {
      d.setSkyTint(store.scene(), tint);
    },
    clearSkyTint(): void {
      d.clearSkyTint(store.scene());
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
