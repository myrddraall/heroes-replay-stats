import { PREVIEW_SCENE } from '@myrddraall/heroes-replay-stats-aether/scenes';
import { reordered } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { MaterialSettings } from '@myrddraall/heroes-replay-stats-aether/materials';
import { materialAt } from '../materials/materials';
import type { TreeMove } from '../tree/scene-tree';
import { targetOf } from './asset-targets';
import type { AssetMethodsStore } from './asset-editor.store';
import type { AssetWrites } from './asset-writes';
import { bodyEdits } from '../editing/body-edits';

/** The asset's materials: their order and settings. */
export function assetMaterialMethods(store: AssetMethodsStore, w: AssetWrites) {
  const { asset, d, materialChange, materialClear, levelOf } = w;
  return {
    moveMaterial(move: TreeMove): void {
      const from = targetOf(move.key, asset());
      const to = targetOf(move.target, asset());
      // An overlay moved among those a sky wears: worn in that order.
      if (
        from.kind === 'group' &&
        to.kind === 'group' &&
        from.skyOverlay &&
        to.skyOverlay &&
        !!from.stage === !!to.stage
      ) {
        const worn = store._skyOverlays(!!from.stage).map((o) => o.id);
        d.setSkyOverlays(
          from.stage ? PREVIEW_SCENE : null,
          reordered(worn, worn, from.skyOverlay, to.skyOverlay, move.after),
        );
        return;
      }
      if (from.kind === 'sky-material' && to.kind === 'sky-material' && from.stage === to.stage) {
        const all = store._skyMaterials(to.stage);
        const moving = materialAt(all, from.key);
        const target = materialAt(all, to.key);
        if (!moving || !target) return;
        const depth = target.values.depth;
        const group = all.filter((m) => m.values.depth === depth).map((m) => m.key);
        const order = reordered(
          all.map((m) => m.key),
          group,
          from.key,
          to.key,
          move.after,
        );
        if (moving.values.depth !== depth) materialChange(move.key, { depth });
        if (to.stage) d.setSkyOrder(PREVIEW_SCENE, order);
        else d.setLibrarySkyOrder(order);
      } else if (from.kind === 'part' && to.kind === 'part') {
        // A shape moved among the body's: its materials drawn where it is put.
        const level = levelOf(from);
        if (level) bodyEdits.moveShape(level, from.key, to.key, move.after);
      } else if (from.kind === 'material' && to.kind === 'material') {
        // Within the part they are drawn on, among those drawn as it is (opaque or blended).
        const level = levelOf(from);
        if (level) bodyEdits.moveMaterial(level, from.key, to.key, move.after);
      }
    },
    setMaterial(change: Partial<MaterialSettings>): void {
      materialChange(store.selected(), change);
    },
    clearMaterial(keys?: readonly (keyof MaterialSettings)[]): void {
      materialClear(store.target(), keys);
    },
  };
}
