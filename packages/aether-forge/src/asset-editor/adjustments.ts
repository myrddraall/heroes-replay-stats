import { PREVIEW_SCENE } from '@myrddraall/heroes-replay-stats-aether/scenes';
import { bodyTintRows } from '../bodies/body';
import { bodyEdits } from '../editing/body-edits';
import { materialAt } from '../materials/materials';
import { type AdjustmentsOwner, adjustmentMethods } from '../tints/adjustments';
import { tintChanges, tintRowsOf } from '../tints/tint-rows';
import { moonKey, targetOf } from './asset-targets';
import type { AssetMethodsStore } from './asset-editor.store';
import type { AssetWrites } from './asset-writes';

/**
 * The asset open's colour adjustments, by the row they are under: the planet's or overlay's (the
 * variant edited, where one is), one of its own moons', one of its materials', the material open's
 * own; the sky's (the sky open's, or the stage's backdrop), one of its materials' (see
 * `adjustmentMethods`).
 */
export function assetAdjustmentMethods(store: AssetMethodsStore, w: AssetWrites) {
  const { d, asset, levelOf, materialChange, materialClear } = w;
  return adjustmentMethods((owner): AdjustmentsOwner | null => {
    const t = targetOf(owner, asset());
    // A material's kept with the rest of its settings, at its own level.
    const material = (rows: AdjustmentsOwner['rows'], set: AdjustmentsOwner['set']) => ({
      rows,
      set,
      write: (next: AdjustmentsOwner['set']) => {
        const change = tintChanges(next);
        if (change.clear.length) materialClear(t, change.clear);
        if (change.set) materialChange(owner, change.set);
      },
    });
    if (t.kind === 'sky' || t.kind === 'backdrop') {
      const stage = t.kind === 'backdrop' || t.stage;
      const sky = store._skyOf(stage);
      return {
        rows: tintRowsOf(sky.below ? [['the library (sky)', sky.below]] : [], sky.edited),
        set: sky.edited,
        write: (set) => (stage ? d.setSkyTints(PREVIEW_SCENE, set) : d.setLibrarySkyTints(set)),
      };
    }
    if (t.kind === 'sky-material') {
      const m = materialAt(store._skyMaterials(t.stage), t.key);
      return m ? material(m.tints, m.set) : null;
    }
    if (t.kind === 'base-material') {
      const m = store.baseMaterial();
      return m ? material(m.tints, m.set) : null;
    }
    const level = levelOf(t);
    if (!level) return null;
    if (t.kind === 'body' || t.kind === 'moon') {
      const b = t.kind === 'moon' ? store._moonInfos().get(moonKey(t.path)) : store._body();
      return b
        ? { rows: bodyTintRows(b), set: b.settings, write: (set) => bodyEdits.setTints(level, set) }
        : null;
    }
    if (t.kind === 'material') {
      const m = materialAt(store._ownMaterials(), t.key);
      return m
        ? { rows: m.tints, set: m.set, write: (set) => bodyEdits.setMaterialTints(level, t.key, set) }
        : null;
    }
    return null;
  });
}
